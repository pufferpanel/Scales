/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */

var log = require("../logger.js"),
	gconfig = require("../../config.json"),
	fs = require("fs-extra"),
	server = require('https').createServer({
		key: fs.readFileSync('https.key'),
		cert: fs.readFileSync('https.pem')
	}),
	io = require('socket.io').listen(server),
	Scales = require("../process.js"),
	s = require("../initalize.js").servers;

Scales.prototype.socketio = function() {

	var self = this;
	this.websocket = io.of('/server/' + this.config.name);

	this.websocket.use(function(params, next) {

		if(!params.handshake.query.token) {
			next(new Error("You must pass the correct handshake values."));
		}

		if(!self.hasPermission(params.handshake.query.token, "s:console")) {
			next(new Error("You do not have permission to access this socket."));
		} else {
			next();
		}

	});

	this.on('console', function(data) {

		self.websocket.emit('console', {
			"line": data.toString()
		});

	});

	this.on('query', function(data) {

		self.websocket.emit('query', {
			"data": self.plugin.lastQuery
		});

	});

	this.on('stats', function(data) {

		self.websocket.emit('stats', {
			"data": self.usageStatistics
		});

	});

}

server.listen(gconfig.listen.socket);