/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */

var log = require("../logger.js"),
	gconfig = require("../../config.json"),
	fs = require("fs-extra"),
	server = require('https').createServer({
		key: fs.readFileSync(gconfig.ssl.key),
		cert: fs.readFileSync(gconfig.ssl.cert)
	}),
	server2 = require('https').createServer({
		key: fs.readFileSync(gconfig.ssl.key),
		cert: fs.readFileSync(gconfig.ssl.cert)
	}),
	io = require('socket.io').listen(server),
	Scales = require("../process.js"),
	BinaryServer = require('binaryjs').BinaryServer,
	bserver = BinaryServer({
		server: server2,
		chunkSize: 40960
	}),
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

	this.on('status', function(data) {

		// Internal crash handler
		if(data === 4) {
			return;
		}

		self.websocket.emit('status', {
			"status": data
		});

	});

	this.on('installer', function(data) {

		self.websocket.emit('installer', {
			"line": data.toString()
		});

	});

}

Scales.prototype.binaryjs = function() {

	// Prevents the constant errors about 'possible EventEmitter memory leak detected'
	bserver.removeAllListeners('connection');

	bserver.on('connection', function(client){

		client.on('stream', function(stream, meta) {

			if(!meta.token || !meta.server) {

				stream.write({"error": "Missing required meta variables in the request."});
				stream.end();
				return;

			}

			var self = s[meta.server];
			if(!self.hasPermission(meta.token, "s:files:put")) {

				stream.write({"error": "You do not have permission to upload files to this server."});
				stream.end();
				return;

			}

			if(meta.size > gconfig.upload_maxfilesize) {

				stream.write({"error": "That file is too big to upload."});
				stream.end();
				return;

			}

			fs.ensureDirSync(self.buildPath(meta.path));

			var file = fs.createWriteStream(self.buildPath(meta.path) + '/' + meta.name);
			stream.pipe(file);

			stream.on('data', function(data){
				stream.write({rx: data.length / meta.size});
			});

		});

	});

}

server.listen(gconfig.listen.socket, function() {
	log.info("Scales is now listening to Socket.IO on port " + gconfig.listen.socket);
});

server2.listen(gconfig.listen.uploads, function() {
	log.info("Scales is now listening for uploads on port " + gconfig.listen.uploads);
});
