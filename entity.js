Object.prototype.reduce = function(f, start, thisPtr) {
	current = start || 0;
	for(k in this) {
		if(this.hasOwnProperty(k)) {
			current = f.call(thisPtr, current, this[k], k, this)
		}
	}
	return current;
};

Entity = function(position, velocity) {
	this.position = position || Vector.zero();
	this.velocity = velocity || Vector.zero();
	this.forces = {};
	this._id = Entity.generateIdNo();
};
Entity.generateIdNo = (function(id) {
	return function() {	return id++; }
})(0);

Entity.prototype.getAcceleration = function() {
	return this.forces.reduce(function sumVectors(total, current) {
		if(current instanceof Vector)
			return total.plusEquals(current);
		else if(current instanceof Array || current instanceof Object) 
			return current.reduce(sumVectors, total);
		else
			return total;
	}, Vector.zero()).overEquals(this.mass);
};
Entity.prototype.update = function(dt) {
	this.velocity.plusEquals(this.getAcceleration().times(dt))
	this.position.plusEquals(this.velocity.times(dt))
	return this;
};
Entity.prototype.__defineGetter__('id', function() {
	return 'e' + this._id;
});
Entity.prototype.mass = 1;