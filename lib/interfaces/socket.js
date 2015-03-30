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
	server2 = require('https').createServer({
		key: fs.readFileSync('https.key'),
		cert: fs.readFileSync('https.pem')
	}),
	io = require('socket.io').listen(server),
	Scales = require("../process.js"),
	BinaryServer = require('binaryjs').BinaryServer,
	bserver = BinaryServer({
		server: server2
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

}

Scales.prototype.binaryjs = function() {

	var self = this;
	passedAuth = false;

	bserver.on('connection', function(client){

		client.on('stream', function(stream, meta) {

			if(passedAuth === false && (!meta.token || !self.hasPermission(meta.token, "s:files:put"))) {
				log.warn("Error authenticating websocket.");
				stream.write({"error": "You do not have permission to upload files to this server."});
				stream.end();
				return;
			} else {
				passedAuth = true;
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

server.listen(gconfig.listen.socket);
server2.listen(gconfig.listen.uploads);