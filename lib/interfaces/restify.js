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
var Restify = require('restify');
var Plugin = Rfr('lib/plugins.js').pluginLoader;
var Scales = Rfr('lib/process.js');
var Servers = Rfr('lib/initalize.js').servers;
var Request = require('request');
var Mime = require('mime');
var Path = require('path');
var Async = require('async');
var InitalizeServer = Rfr('lib/initalize.js').initalize;

if (Fs.existsSync(Config.global.ssl.cert) && Fs.existsSync(Config.global.ssl.key)) {

    var RestServer = Restify.createServer({
        name: 'Scales',
        certificate: Fs.readFileSync(Config.global.ssl.cert),
        key: Fs.readFileSync(Config.global.ssl.key)
    });

} else {

    Logger.error(' ** WARNING: Missing HTTPS keys. **');
    process.exit(1);

}

RestServer.use(Restify.bodyParser());
RestServer.use(Restify.authorizationParser());
RestServer.use(Restify.queryParser());
RestServer.use(Restify.CORS());

RestServer.opts(/.*/, function (req, res, next) {

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', req.header('Access-Control-Request-Method'));
    res.header('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers'));
    res.send(200);

    return next();

});

var checkAuthorization = function (req, res, permission) {

    if ('x-access-server' in req.headers && !('X-Access-Server' in req.headers)) {
        req.headers['X-Access-Server'] = req.headers['x-access-server'];
    }

    if ('x-access-token' in req.headers && !('X-Access-Token' in req.headers)) {
        req.headers['X-Access-Token'] = req.headers['x-access-token'];
    }

    try {

        if (!('X-Access-Server' in req.headers)) {
            res.send(400, { 'message': 'Missing required X-Access-Server header.' });
            return false;
        }

        if (typeof permission !== 'undefined') {

            if (!('X-Access-Token' in req.headers)) {
                res.send(400, { 'message': 'Missing required X-Access-Token header.' });
                return false;
            }

            if (permission.indexOf('s:') === 0) {

                if (Servers[req.headers['X-Access-Server']] === undefined) {
                    res.send(400, { 'message': 'Required X-Access-Token header is an invalid server.' });
                    return false;
                }

                if (Servers[req.headers['X-Access-Server']].hasPermission(req.headers['X-Access-Token'], permission)) {
                    return true;
                }

            } else if (permission.indexOf('g:') === 0) {

                if (Config.global.keys.indexOf(req.headers['X-Access-Token']) > -1) {
                    return true;
                }

            }

        }

    } catch(ex) {

        Logger.error('An exception was encountered processing a restify request.', ex.stack);
        return false;
    }

    res.send(403, { 'message': 'You do not have permission to perform that action.' });
    return false;

};

RestServer.get('/', function (req, res, next) {

    res.send('Scales Management Daemon');

});

RestServer.get('/server', function (req, res) {

    if (!checkAuthorization(req, res, 's:get')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    res.send(server.coreInfo());

});

RestServer.post('/server', function (req, res, next) {

    if (!checkAuthorization(req, res, 'g:create')) {
        return;
    }

    if (!req.params.settings) {
        res.send(500, { 'error': 'Missing required parameter.' });
        return;
    }

    try {

        config = JSON.parse(req.params.settings);
        if (config.name) {

            InitalizeServer(config);
            Servers[config.name].install(res, config.build.pack, req.params.password, req.params.build_params);
        } else {

            Logger.verbose('Recieved an invalid JSON request for adding a new server.');
            res.send(500, { 'error': 'Missing required parameters in JSON.' });
        }

    } catch(ex) {

        Logger.warn('An exception occured trying to process adding a new server.', ex.stack);
        res.send(500, { 'error': 'An exception occured trying to process this request.' });
    }

});

RestServer.put('/server', function (req, res) {

    if (!checkAuthorization(req, res, 'g:update')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    server.mergeJson(req.params.json, req.params.object, req.params.overwrite, res);

});

RestServer.del('/server', function (req, res) {

    if (!checkAuthorization(req, res, 'g:delete')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    server.delete(res);

    Servers[req.headers['X-Access-Server']] = undefined;

});

RestServer.get('/server/power/:action', function (req, res) {

    if (!checkAuthorization(req, res, 's:power')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];

    if (req.params.action === 'on') {
        server.preflight();
    } else if (req.params.action === 'off') {
        server.powerOff();
    } else if (req.params.action === 'restart') {
        server.powerCycle();
    } else if (req.params.action === 'kill') {
        server.kill();
    }

    res.send(204);

});

RestServer.put('/server/rebuild-container', function (req, res) {

    if (!checkAuthorization(req, res, 'g:rebuild')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];

    server.rebuildDockerContainer(function (err) {
        if (err) {
            res.send(500);
            console.log(err);
        } else {
            res.send(204);
        }
    });

});

RestServer.put('/server/reinstall', function (req, res) {

    if (!checkAuthorization(req, res, 'g:reinstall')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];

    if (!req.params.build_params) {
        Logger.warn('Recieved a reinstall request without any build parameters.');
        res.send(500);
    }

    server.reinstallServer(null, req.params.build_params, function (err) {
        if (err) {
            res.send(500);
        } else {
            res.send(204);
        }
    });

});

RestServer.post('/server/console', function (req, res) {

    if (!checkAuthorization(req, res, 's:console:send')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];

    if (!server.console(req.params.command)) {
        res.send(500);
    } else {
        res.send(204);
    }

});

RestServer.get(/^\/server\/directory\/(.+)/, function (req, res) {

    if (!checkAuthorization(req, res, 's:files')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    var contents = server.listDirectory(req.params[0]);

    if (contents) {
        res.send(contents);
    } else {
        res.send(500, { 'message': 'The requested directory does not exist on the system for this user.' });
    }

});

RestServer.get(/^\/server\/file\/(.+)/, function (req, res) {

    if (!checkAuthorization(req, res, 's:files:get')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    var contents = server.returnFile(req.params[0]);

    if (contents) {
        res.send({ 'contents': contents });
    } else {
        res.send(500, { 'message': 'The requested file does not exist on the system for this user.' });
    }

});

RestServer.put(/^\/server\/file\/(.+)/, function (req, res) {

    if (!checkAuthorization(req, res, 's:files:put')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    if (server.writeFile(req.params[0], req.params.contents)) {
        res.send(204);
    } else {
        res.send(500, { 'message': 'Unable to save file due to an error.' });
    }

});

RestServer.del(/^\/server\/file\/(.+)/, function (req, res) {

    if (!checkAuthorization(req, res, 's:files:delete')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    if (server.deleteFile(req.params[0])) {
        res.send(204);
    } else {
        res.send(500, { 'message': 'Unable to delete file due to an error.' });
    }

});

RestServer.get(/^\/server\/download\/(.+)/, function (req, res) {

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    if (Config.global.urls.download) {

        Request.post(Config.global.urls.download, {
            form: {
                token: req.params[0]
            }
        }, function (err, response, body) {

            if (!err && response.statusCode === 200) {

                try {

                    json = JSON.parse(body);
                    if (json.path && json.path){

                        var filename = Path.basename(json.path);
                        var mimetype = mime.lookup(json.path);
                        var file = Servers[json.server].buildPath(json.path);
                        var stat = Fs.statSync(file);
                        res.writeHead(200, {
                            'Content-Type': mimetype,
                            'Content-Length': stat.size,
                            'Content-Disposition': 'attachment; filename=' + filename
                        });
                        var filestream = Fs.createReadStream(file);
                        filestream.pipe(res);

                    } else {

                        Logger.verbose('Downloader failed to authenticate: server did not respond with valid download path.');
                        res.send(500, { 'message': 'Server did not respond with a valid download path.' });
                    }

                } catch (ex) {

                    Logger.warn('Downloader failed to authenticate due to an error in Scales.', ex.stack);
                    res.send(500, { 'message': 'Server was unable to authenticate this request.' });
                }

            } else {

                Logger.verbose('Downloader failed to authenticate: Server returned error code [HTTP/1.1 ' + response.statusCode + '].');
                res.send(500, { 'message':'Server responded with an error code. [HTTP/1.1 ' + response.statusCode + ']' });
            }

        });

    } else {

        Logger.warn('Downloader failed to authenticate: no authentication URL provided.');
        res.send(500, { 'message':'This action is not configured correctly by the daemon.' });

    }

});

RestServer.get('/server/log/:lines', function (req, res) {

    if (!checkAuthorization(req, res, 's:console')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    res.send(server.logContents(req.params.lines));

});

RestServer.post('/server/reset-password', function (req, res) {

    if (!checkAuthorization(req, res, 's:ftp')) {
        return;
    }

    var server = Servers[req.headers['X-Access-Server']];
    server.resetPassword(req.params.password, res);

});

RestServer.listen(Config.global.listen.rest, Config.global.listen.host || '0.0.0.0', function () {
    Logger.info('Scales is now listening on port ' + Config.global.listen.rest);
});
