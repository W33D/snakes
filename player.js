Player = function Player(socket, name, snake) {
	this.socket = socket;
	this.snake = snake;
	this.color = this.snake.color;
	this.name = name;
	this.connected = true;
	Object.defineEvent(this, 'onQuit');
	Object.defineEvent(this, 'onChat');
	this.resendAllEntities();

	var $this = this;

	socket.on('playercontrol', function(target) {
		if($this.connected) {
			target = Vector.ify(target);
			if(target)
				$this.snake.target = target;
		}
	});

	socket.on('chat', function(msg) {
		$this.chat(msg);
	});

	socket.on('disconnect', function() {
		$this.disconnect();
	});
}
Player.prototype.disconnect = function() {
	if(this.connected) {
		this.onQuit();
		this.connected = false;
		this.snake.destroy();
		this.name = null;
		this.snake = null;
	}
}
Player.prototype.chat = function(msg) {
	msg = (""+msg).trim();

	if(this.connected && msg.length < 1024 && msg.length != 0) {
		this.onChat(msg);
	}
}
Player.prototype.resendAllEntities = function() {
	var p = this;
	universe.entities.forEach(function(e) {
		p.socket.emit('entityadded', {
			p: e.position.toFixed(2),
			r: e.radius,
			c: e.color.toInt(),
			i: e._id
		});
	});
}

//returns a function that listens to a socket, and calls onJoined when a player joins
Player.listener = function(onJoined) {
	return function(socket) {
		var gotResponse = false;
		socket.on('join', function(data, callback) {
			if(gotResponse) return;

			var name = data.name;
			if(typeof name != "string") return;

			name = name.replace(/^\s+|\s+$/, '');
			if(name.length < 3 || name.length > 64) {
				callback({error: "Name length invalid"});
			} else if(!(name in players)) {
				snake = new Snake(
					10,
					Color.ify(data.color),
					universe.randomPosition(),
					universe
				);
				snake.name = name;
				snake.target = snake.head.position.clone();
				gotResponse = true;
				onJoined.call(new Player(socket, name, snake));

				callback(true);
			} else {
				//Name already taken
				callback({error: "Someone else has that name"});
				console.log();
			}
		});
	}
}
