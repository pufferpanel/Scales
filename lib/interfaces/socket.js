/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Rfr = require('rfr');
var Logger = Rfr('lib/logger.js');
var Config = {
    global: Rfr('config.json')
};
var Fs = require('fs-extra');
var HttpsServer = require('https').createServer({
    key: Fs.readFileSync(Config.global.ssl.key),
    cert: Fs.readFileSync(Config.global.ssl.cert)
});
var HttpsServer2 = require('https').createServer({
    key: Fs.readFileSync(Config.global.ssl.key),
    cert: Fs.readFileSync(Config.global.ssl.cert)
});
var IO = require('socket.io').listen(HttpsServer);
var Scales = Rfr('lib/process.js');
var BinaryServer = require('binaryjs').BinaryServer;
var BServer = BinaryServer({
    server: HttpsServer2,
    chunkSize: 40960
});
var Servers = Rfr('lib/initalize.js').servers;
var Path = require('path');

Scales.prototype.socketio = function () {

    var self = this;
    this.websocket = IO.of('/server/' + this.config.name);

    this.websocket.use(function (params, next) {

        if (!params.handshake.query.token) {
            return next(new Error('You must pass the correct handshake values.'));
        }

        if (!self.hasPermission(params.handshake.query.token, 's:console')) {
            return next(new Error('You do not have permission to access this socket.'));
        }

        return next();

    });

    this.websocket.on('connection', function () {

        self.websocket.emit('initial_status', {
            'status': self.status
        });

    });

    this.on('console', function (data) {

        data = data.toString();

        // @TODO: Fix things like Bungee which has a hayday with return feeds.
        if ((data.replace(/\s+/g, '')).length > 1) {
            self.websocket.emit('console', {
                'line': data.replace(/\r\n/g, '') + '\n'
            });
        }

    });

    this.on('query', function (data) {

        self.websocket.emit('query', {
            'data': self.plugin.query
        });

    });

    this.on('stats', function (data) {

        self.websocket.emit('stats', {
            'data': self.usageStatistics
        });

    });

    this.on('status', function (data) {

        // Internal crash handler
        if (data === 4) {
            return;
        }

        self.websocket.emit('status', {
            'status': data
        });

    });

    this.installerSocket = IO.of('/server/install/' + this.config.name);

    this.installerSocket.use(function (params, next) {

        if (!params.handshake.query.token) {
            return next(new Error('You must pass the correct handshake values.'));
        }

        if (!self.hasPermission(params.handshake.query.token, 'g:server-install')) {
            return next(new Error('You do not have permission to access this socket.'));
        }

        return next();

    });

    this.on('installer', function (data) {

        self.installerSocket.emit('installer', {
            'line': data.toString()
        });

    });

};

Scales.prototype.binaryjs = function () {

    // Prevents the constant errors about 'possible EventEmitter memory leak detected'
    BServer.removeAllListeners('connection');

    BServer.on('connection', function (client){

        client.on('stream', function (stream, meta) {

            if (!meta.token || !meta.server) {

                stream.write({ 'error': 'Missing required meta variables in the request.' });
                stream.end();
                return;

            }

            var server = Servers[meta.server];
            if (!server.hasPermission(meta.token, 's:files:put')) {

                stream.write({ 'error': 'You do not have permission to upload files to this server.' });
                stream.end();
                return;

            }

            if (meta.size > Config.global.upload_maxfilesize) {

                stream.write({ 'error': 'That file is too big to upload.' });
                stream.end();
                return;

            }

            Fs.ensureDirSync(server.buildPath(meta.path));

            var file = Fs.createWriteStream(server.buildPath(Path.join(meta.path, meta.name)));
            stream.pipe(file);

            stream.on('data', function (data){
                stream.write({ rx: data.length / meta.size });
            });

        });

    });

};

HttpsServer.listen(Config.global.listen.socket, function () {
    Logger.info('Scales is now listening to Socket.IO on port ' + Config.global.listen.socket);
});

HttpsServer2.listen(Config.global.listen.uploads, function () {
    Logger.info('Scales is now listening for uploads on port ' + Config.global.listen.uploads);
});
