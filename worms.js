"use strict"; 

Array.prototype.contains = function(x) { return this.indexOf(x) != -1; }

Array.prototype.forEveryPair = function(callback, thisPtr) {
	var l = this.length;
	for(var i = 0; i < l; i++) {
		for(var j = i + 1; j < l; j++) {
			var ti = this[i], tj = this[j];
			if(ti !== undefined && tj !== undefined)
				callback.call(thisPtr, ti, tj, i, j, this);
		}
	}
}
Array.prototype.forAdjacentPairs = function(callback, thisPtr) {
	var l = this.length;
	for (var i = 0, j = 1; j < l; i = j++) {
		var ti = this[i], tj = this[j];
		if(ti !== undefined && tj !== undefined)
			callback.call(thisPtr, ti, tj, i, j, this);
	}
}

var alertFallback = true; 
if (typeof console === "undefined" || typeof console.log === "undefined") { 
	console = {}; 
	if (alertFallback) { 
		console.log = function(msg) { 
			alert(msg); 
		}; 
	} else {
		console.log = function() {}; 
	} 
} 

var randomInt = function(min, max) {
	if(max === undefined) {
		max = min;
		min = 0;
	}
	return Math.floor(Math.random() * (max - min) + min);
};


var width = 0, height = 0;
window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame  || window.oRequestAnimationFrame || function(callback) {
	window.setTimeout(function() {callback(Date.now())}, 1000 / 60.0);
};

var canvas = $('#canvas').get(0);

$(window).resize(function(){
	width = canvas.width = $(canvas).width();
	height = canvas.height = $(canvas).height();
}).resize();

var ctx = canvas.getContext('2d');
var keycodes = [{
	up:    87,
	down:  83,
	left:  65,
	right: 68
}, {
	up:    38,
	down:  40,
	left:  37,
	right: 39
}]

var worms = [];
var Worm = function(length, color, pos) {
	var ballSize = 10;
	this.balls = [];
	this.balls[0] = this.head = new Ball(pos, ballSize, color.randomNear(16))
	this.maxMass = this.head.getMass();
	for (var i = 1; i < length; i++) {
		tryplaceballs: for(var j = 0; j < 100; j++) {
			var newPos = pos.plus(Vector.fromPolarCoords(ballSize*2, Math.random() * Math.PI * 2))
			var b = new Ball(newPos, ballSize, color.randomNear(16));
			for(var k = 0; k < this.balls.length; k++) {
				if(this.balls[k].touches(b))
					continue tryplaceballs;
			}
			pos = newPos;
			this.balls[i] = b;
			break;
		}
		pos = newPos;
	};
}
Worm.prototype.drawTo = function(ctx) {
	for (var i = 0; i < this.balls.length; i++) {
		this.balls[i].drawTo(ctx);
	};
	ctx.save();
	ctx.fillStyle = "white";
	ctx.beginPath();
	ctx.arc(this.head.position.x, this.head.position.y, 5, 0, Math.PI * 2, false);
	ctx.fill();
	ctx.restore();
	return this;
};
Worm.prototype.eat = function(ball) {
	if(this.balls.contains(ball)) return false;
	if(this.maxMass * 4 < ball.getMass()) return false;

	this.maxMass *= 1.05;
	ball.forces = {};
	ball.forces.contact = {};
	this.balls.push(ball);
	return true;
}
Worm.prototype.getMass = function(ball) {
	return this.balls.reduce(function(sum, x) { return sum + x.getMass(); }, 0);
}
var balls = [];
Worm.prototype.update = function(dt) {

	//Shortening
	var rate = 50;
	this.balls.forAdjacentPairs(function(a, b) {
		var aMass = a.getMass();
		var diff = aMass - this.maxMass;
		if(diff > rate) {
			a.setMass(aMass - rate);
			b.setMass(b.getMass() + rate);
		} else if(diff < -rate) {
			a.setMass(aMass + rate);
			b.setMass(b.getMass() - rate);
		} else {
			a.setMass(this.maxMass);
			b.setMass(b.getMass() + diff);
		}
	}, this);
	var last = this.balls[this.balls.length - 1];
	if(last.getMass() < rate) {
		this.balls.pop();
	}
	/*
	var len = this.balls.length
	if(len > 10) {
		var lose = 1;
		var last = this.balls[len-1];
		last.radius -= lose;
		if(last.radius <= 0) this.balls.pop();

		this.balls.forEach(function(ball) {
			if(ball != last)
				ball.radius += lose / len;
		})
	}*/
	/*var last = this.balls[this.balls.length - 1];
	var eachTime = 0.1;
	this.balls.forEach(function(a, i) {
		var aMass = a.getMass();
		var neededMass = this.maxMass - aMass;
		var massLeft = Math.abs(neededMass * eachTime);
		var massAdded = 0;
		for(var j = i + 1; j < this.balls.length; j++) {
			var b = this.balls[i];
			var m = b.getMass();
			var toTake = Math.min(massLeft, m, 10);
			if(neededMass > 0)
				b.setMass(m - toTake);
			else
				b.setMass(m + toTake);

			massLeft -= toTake;
			massAdded += toTake;
		}
		if(neededMass > 0)
			a.setMass(aMass + massAdded);
		else
			a.setMass(aMass - massAdded);

	}, this);
	var theMass = last.getMass()
	if(theMass > this.maxMass) {
		var newTail = new Ball(this.head.position.clone(), 0, last.color);
		this.balls.push(newTail);
		last.setMass(theMass - 10)
		newTail.setMass(10)
	} else if (last.getMass() < 0) {
		this.balls.pop();
	}*/


	//Physics on the head
	this.balls[0].update(dt);
	this.balls[0].bounceOffWalls(width, height);
	this.balls[0].updateForceFrom(this.balls);

	//Iterate down the body
	this.balls.forAdjacentPairs(function(bi, bj, i, j) {
		for(var k = 1; k < this.balls.length; k++) {
			if(k > j+1 || k < j - 1)
				this.balls[j].updateForceFrom(this.balls[k]);
		}
		bj.color = bj.color.lerp(this.head.color, 0.01);
		bj.update(dt);
		bj.follow(bi);
		bj.bounceOffWalls(width, height);
	}, this);

	//Interactions with free balls
	balls.forEach(function(ball, i) {
		if(ball.touches(this.head) && this.eat(ball)) {
			balls.splice(i, 1)[0];
		} else {
			this.balls.forEach(function(b) {
				b.updateForceFrom(ball);
			});
		}
	}, this);


	//Worm/worm collisions
	worms.forEach(function(that) {
		if(that == this) return;
		this.balls.forEach(function(segment1) {
			that.balls.forEach(function(segment2, index) {
				segment1.updateForceFrom(segment2);
				if(segment1 == this.head && segment2 != that.head && this.head.touches(segment2)) {
					if(this.eat(segment2)) {
						var removed = that.balls.splice(index);
						removed.shift();
						if(removed.length > that.balls.length) {
							var r = that.balls;
							that.balls = removed.reverse();
							that.balls[0].color = that.head.color;
							that.balls[0].radius = that.head.radius;
							that.head = that.balls[0];
							removed = r;
						}
						removed.forEach(function(b) {
							balls.push(b);
							b.forces = {};
							b.forces.contact = {};
						});
					}
				};
			}, this);
		}, this);
	}, this);


};

for(var i = 0; i <= 50; i++) {
	var r = Math.random();
	var color, radius

	if(r < 0.33)
		color = new Color(192, 192, 192), radius = randomInt(5,10);
	else if(r < 0.66)
		color = new Color(128, 128, 128), radius = randomInt(10, 20);
	else
		color = new Color(64, 64, 64), radius = randomInt(20,40);

	balls[i] = new Ball(new Vector(randomInt(width), randomInt(height)), radius, color);
}

worms[0] = new Worm(10, new Color(255, 128, 0), new Vector(width/3, height / 2));
worms[1] = new Worm(10, new Color(0, 128, 255), new Vector(2*width/3, height / 2));

var lastt = Date.now();
var lastdrawt = lastt;

var bluescore = $('#blue-score');
var orangescore = $('#orange-score');
setInterval(function() {
	orangescore.text(Math.round(worms[0].getMass() / 500));
	bluescore.text(Math.round(worms[1].getMass() / 500));
}, 250);

function draw(t) {
	var dt = (t - lastt) / 1000.0;
	if(dt > 0.2) dt = 0.2;
	//ctx.clearRect(0, 0, canvas.width, canvas.height)
	
	balls.forEach(function(b1, i) {
		for(var j = i+1; j <= balls.length - 1; j++) {
			var b2 = balls[j];
			b1.updateForceFrom(b2, dt);
		}
		//b1.forces.gravity = new Vector(0, 200).times(b1.getMass());
		b1.update(dt);
		b1.bounceOffWalls(width, height);
	});
	worms[0].update(dt);
	worms[1].update(dt);

	ctx.globalCompositeOperation = "source-over";
	//ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, width, height);
	ctx.globalCompositeOperation = "lighter";
	balls.forEach(function(ball) {
		ball.drawTo(ctx);
	});
	worms[0].drawTo(ctx);
	worms[1].drawTo(ctx);
	lastt = t;
	requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
$(window).keydown(function(e) {
	keycodes.forEach(function(k, i) {
		var h = worms[i].head;
		if(!("player" in h.forces)) h.forces.player = Vector.zero()
		var a = 200* h.getMass();
		if(k.up    == e.which) h.forces.player.y = -a;
		if(k.down  == e.which) h.forces.player.y = a;
		if(k.left  == e.which) h.forces.player.x = -a;
		if(k.right == e.which) h.forces.player.x = a;
	});
})
$(window).keyup(function(e) {
	keycodes.forEach(function(k, i) {
		var h = worms[i].head;
		if(!("player" in h.forces)) h.forces.player = Vector.zero()

		if(k.up    == e.which) h.forces.player.y = 0;
		if(k.down  == e.which) h.forces.player.y = 0;
		if(k.left  == e.which) h.forces.player.x = 0;
		if(k.right == e.which) h.forces.player.x = 0;
	});
})
