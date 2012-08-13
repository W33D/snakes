//var process = require('process');
var express = require('express');
var socketio = require('socket.io');
var readline = require('readline');
var colors = require('colors');
var util = require('util');
var browserify = require('browserify');
var faceplate = require('faceplate');
var fs = require('fs');

require('./util');
require('./color');
require('./vector');
require('./entity');
require('./ball');
require('./world');
require('./snake');
require('./player');
require('./game');
require('./gamemanager');
//universe = new World(2000, 2000);


var app = express.createServer(/*{
    key: fs.readFileSync('ssl/privatekey.pem'),
    cert: fs.readFileSync('ssl/certificate.pem')
}*/);
var port = +process.argv[2] || 8090;
app.listen(port);

var io = socketio.listen(app);
io.configure('development', function() {
	io.set('log level', 1);
	io.set('close timeout', 2.5);
})


var gameManager = new GameManager(io);
io.sockets.on('connection', gameManager.playerListener());


app.configure(function() {
	app.use(express.static(__dirname, {maxAge: 60000}));
	app.use(browserify({
		require : [
			'events',
			'util',
			'./color',
			'./explosion',
			'./snake',
			'./vector',
			'./ball',
			'./entity',
			'./world'
		],
		cache: './.browserify-cache.json'
	}));
	console.log(process.env.FACEBOOK_APP_ID, process.env.FACEBOOK_SECRET);
	/*app.use(faceplate.middleware({
		app_id: process.env.FACEBOOK_APP_ID,
		secret: process.env.FACEBOOK_SECRET
	}));*/
	app.set('view options', { layout: false });
	app.set('view engine', 'ejs');
	app.use(express.errorHandler());
});
app.get('/games/:id', function (req, res) {
	res.render(__dirname + '/index', {port: port, room: req.params.id, gameName: 'Snake or Break'});
	//res.sendfile(__dirname + '/index.html');
});
app.get('/', function (req, res) {
	res.render(__dirname + '/index', {port: port, room: gameManager.defaultGame.name, gameName: 'Snake or Break'});
	//res.sendfile(__dirname + '/index.ejs');
});
app.get('/local', function (req, res) {
	res.sendfile(__dirname + '/snakes.html');
});
app.get('/log', function (req, res) {
	fs.readFile('game.log', 'utf8', function (err, data) {
		res.send(
			data
				.replace(/\u001B\[[^m]+m/g, '')
				.split('\n').join('\<br />')
		);
	});
});

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


setInterval(function() {
	gameManager.games.forEach(function(game) {
		io.sockets.in(game.name).emit('scores', game.scores());
	});
}, 500);

(function makeCLI() {
	var logfile = fs.createWriteStream('game.log', {flags: 'a+'});

	//Create a command line interface from the console
	var cli = readline.createInterface(
		process.stdin,
		process.stdout,
		function (line) {
			var playercommands = ['kick', 'kill', 'spawn', 'help'];
			var commands = ['mass', 'balls'];
			var allCommands = playercommands.concat(commands)

			for(var i = 0; i < playercommands.length; i++) {
				var command = playercommands[i]
				if(line.indexOf(command) == 0) {
					var name = line.substr(command.length + 1);
					var completions = [];
					Object.forEach(gameManager.defaultGame.players, function(p, n) {
						if(n.indexOf(name) == 0)
							completions.push(command + ' ' + n);
					})
					return [completions, line];
				}
			}

			var hits = allCommands.filter(function(c) {
				return c.indexOf(line) == 0;
			});
			return [hits && hits.length ? hits : completions, line];
		}
	);
	cli.setPrompt("> ".grey, 2);

	//Fix the way the cli handles logging while the user is typing
	(function() {
		var oldWrite = process.stdout.write;
		var newStdout = Object.create(process.stdout);
		newStdout.write = function() {
			cli.output.write('\x1b[2K\r');
			var args = Array.prototype.slice.call(arguments);
			var result = oldWrite.apply(this, args);
			logfile.write(args);
			cli._refreshLine();
			return result;
		}
		process.__defineGetter__('stdout', function() { return newStdout; });
	})();

	//Add commands
	cli.on('line', function(line) {
		if(/^\s*players/.test(line)) {
			util.log(Object.values(gameManager.defaultGame.players).pluck('coloredName').join(', '));
		} else if(/^\s*game/.test(line)) {
			console.log(gameManager.defaultGame);
		} else if(/^\s*mass/.test(line)) {
			console.log('Total mass of the universe: '+gameManager.defaultGame.world.totalMass);
		} else if(/^\s*score/.test(line)) {
			var width = cli.columns;
			var perMass = width / gameManager.defaultGame.world.totalMass;
			var bar = "";
			var barLength = 0;
			var scoreSoFar = 0;

			Object.forEach(gameManager.defaultGame.players, function(p) {
				if(p.snake) {
					var score = p.snake.mass;
					scoreSoFar += score;
					var thisBar = "";
					while(barLength + thisBar.length < scoreSoFar * perMass)
						thisBar += '█';

					barLength += thisBar.length;
					bar += thisBar.colored(p.color);
				}
			});

			console.log(bar);
			console.log(Object.values(gameManager.defaultGame.players).pluck('coloredName').join(', '));
		} else if(matches = /^\s*balls (\d+)/.exec(line)) {
			gameManager.defaultGame.generateBalls(+matches[1]);
		} else if(matches = /^\s*kick (.+)/.exec(line)) {
			var player = gameManager.defaultGame.players[matches[1]]
			player && player.disconnect();
		} else if(matches = /^\s*kill (.+)/.exec(line)) {
			var player = gameManager.defaultGame.players[matches[1]]
			player && player.kill();
		} else if(matches = /^\s*spawn (.+)/.exec(line)) {
			var player = gameManager.defaultGame.players[matches[1]]
			player && !player.snake && player.spawnSnake(gameManager.defaultGame.world);
		} else if(matches = /^\s*help (.+)/.exec(line)) {
			var player = gameManager.defaultGame.players[matches[1]]
			player && player.snake && (player.snake.maxMass *= 2);
		} else {
			util.log('sending "'.grey+line+'"'.grey);
			io.sockets.emit('servermessage', ""+line);
		}
		cli.prompt();
	}).on('close', function() {
		io.sockets.emit('servermessage', 'Server going down!');
		process.exit(0);
	});
	cli.prompt();
})();