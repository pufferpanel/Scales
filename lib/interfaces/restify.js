/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("../logger.js"),
	gconfig = require("../../config.json"),
	fs = require("fs-extra"),
	restify = require('restify'),
	plugin = require("../plugins.js").pluginLoader,
	Scales = require("../process.js"),
	s = require("../initalize.js").servers,
	request = require("request"),
	mime = require("mime"),
	path = require("path"),
	async = require("async"),
	initalizeServer = require("../initalize.js").initalize;

if(fs.existsSync(gconfig.ssl.cert) && fs.existsSync(gconfig.ssl.key)) {

	rest = restify.createServer({
		name: "Scales",
		certificate: fs.readFileSync(gconfig.ssl.cert),
		key: fs.readFileSync(gconfig.ssl.key)
	})

} else {

	log.error(' ** WARNING: Missing HTTPS keys. **');
	process.exit();

}

rest.use(restify.bodyParser());
rest.use(restify.authorizationParser());
rest.use(restify.queryParser());
rest.use(restify.CORS());

rest.opts(/.*/, function (req, res, next) {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method"));
    res.header("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers"));
    res.send(200);

    return next();

});

// rest.on('uncaughtException', function (req, res, route, err) {
//
// 	log.error("An unhandled exception occured with the webserver at [" + route.spec.method +"] " + route.spec.path + ".");
// 	log.error(err.stack);
// 	res.send(500, {"message": "An unhandled error has occured. (" + err.message + ")"});
//
// });

function checkAuthorization(req, res, permission) {

	try {

		if(!('x-access-server' in req.headers) && !('X-Access-Server' in req.headers)) {
			res.send(400, {"message": "Missing required X-Access-Server header."});
			return false;
		}

		if('x-access-server' in req.headers && !('X-Access-Server' in req.headers)) {
			req.headers['X-Access-Server'] = req.headers['x-access-server'];
		}

		if(typeof permission !== 'undefined') {

			if(!('x-access-token' in req.headers) && !('X-Access-Token' in req.headers)) {
				res.send(400, {"message": "Missing required X-Access-Token header."});
				return false;
			}

			if('x-access-token' in req.headers && !('X-Access-Token' in req.headers)) {
				req.headers['X-Access-Token'] = req.headers['x-access-token'];
			}

			if(permission.indexOf("s:") == 0) {

				if(s[req.headers['X-Access-Server']] === undefined) {
					res.send(400, {"message": "Required X-Access-Token header is an invalid server."});
					return false;
				}

				if(!s[req.headers['X-Access-Server']].hasPermission(req.headers['X-Access-Token'], permission)) {
					res.send(403, {"message": "You do not have permission to perform that action."});
					return false;
				}

			}

		}

	} catch(ex) {

		log.verbose("An exception was encountered processing a restify request.", ex.stack);
		return false;

	}

	return true;

}

rest.get('/', function(req, res, next) {

	res.send("Scales Management Daemon");

});

rest.get('/server', function(req, res) {

	if(!checkAuthorization(req, res, "s:get")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];
	res.send(server.coreInfo());

});

rest.post('/server', function(req, res, next) {

	if(!checkAuthorization(req, res, "g:create")) {
		return;
	}

	if(!req.params.settings) {
		res.send(500, {'error': 'Missing required parameter.'});
		return;
	}

	try {

		config = JSON.parse(req.params.settings);

		if(config.name) {

			initalizeServer(config);

			s[config.name].install(res, config.build.pack, req.params.password, req.params.build_params);

		} else {

			log.verbose("Recieved an invalid JSON request for adding a new server.");
			res.send(500, {'error': 'Missing required parameters in JSON.'});

		}

	} catch(ex) {

		log.verbose("An exception occured trying to process adding a new server.", ex.stack);
		res.send(500, {'error': 'An exception occured trying to process this request.'});

	}

});

rest.put('/server', function(req, res) {

	if(!checkAuthorization(req, res, "g:update")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];
	server.mergeJson(req.params.json, req.params.object, req.params.overwrite, res);

});

rest.del('/server', function(req, res) {

	if(!checkAuthorization(req, res, "g:delete")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];
	server.delete(res);

	s[req.headers['X-Access-Server']] = undefined;

});

rest.get('/server/power/:action', function(req, res) {

	if(!checkAuthorization(req, res, "s:power")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];

	if(req.params.action == "on") {
		server.preflight();
	} else if(req.params.action == "off") {
		server.powerOff();
	} else if(req.params.action == "restart") {
		server.powerCycle();
	} else if(req.params.action == "kill") {
		server.kill();
	}

	res.send(204);

});

rest.post('/server/console', function(req, res) {

	if(!checkAuthorization(req, res, "s:console:send")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];

	if(server.console(req.params.command) === false) {
		res.send(500);
	} else {
		res.send(204);
	}

});

rest.get(/^\/server\/directory\/(.+)/, function(req, res) {

	if(!checkAuthorization(req, res, "s:files")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']],
		contents = server.listDirectory(req.params[0]);

	if(contents !== false) {
		res.send(contents);
	} else {
		res.send(500, {"message": "The requested directory does not exist on the system for this user."});
	}

});

rest.get(/^\/server\/file\/(.+)/, function(req, res) {

	if(!checkAuthorization(req, res, "s:files:get")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']],
		contents = server.returnFile(req.params[0]);

	if(contents !== false) {
		res.send({"contents": contents});
	} else {
		res.send(500, {"message": "The requested file does not exist on the system for this user."});
	}

});

rest.put(/^\/server\/file\/(.+)/, function(req, res) {

	if(!checkAuthorization(req, res, "s:files:put")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']],
		contents = server.writeFile(req.params[0], req.params.contents);

	if(contents !== false) {
		res.send(204);
	} else {
		res.send(500, {"message": "Unable to save file due to an error."});
	}

});

rest.del(/^\/server\/file\/(.+)/, function(req, res) {

	if(!checkAuthorization(req, res, "s:files:delete")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']],
		contents = server.deleteFile(req.params[0]);

	if(contents !== false) {
		res.send(204);
	} else {
		res.send(500, {"message": "Unable to delete file due to an error."});
	}

});

rest.get(/^\/server\/download\/(.+)/, function(req, res) {

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
	if (gconfig.urls.download != null) {

		request.post(gconfig.urls.download, {
			form: {
				token: req.params[0]
			}
		}, function (error, response, body) {

			if (!error && response.statusCode == 200) {

				try {

					json = JSON.parse(body);
					if (json.path && json.path != null){

						var filename = path.basename(json.path);
						var mimetype = mime.lookup(json.path);
						var file = s[json.server].buildPath(json.path);
						var stat = fs.statSync(file);
						res.writeHead(200, {
							'Content-Type': mimetype,
							'Content-Length': stat.size,
							'Content-Disposition': 'attachment; filename=' + filename
						});
						var filestream = fs.createReadStream(file);
						filestream.pipe(res);

					}else{

						log.verbose("Downloader failed to authenticate: server did not respond with valid download path.");
						res.send(500, {"message": "Server did not respond with a valid download path."});

					}
				} catch (ex) {

					log.warn("Downloader failed to authenticate due to an error in Scales.", ex.stack);
					res.send(500, {"message": "Server was unable to authenticate this request."});

				}

			}else{

				log.verbose("Downloader failed to authenticate: Server returned error code [HTTP/1.1 " + response.statusCode + "].");
				res.send(500, {"message":"Server responded with an error code. [HTTP/1.1 " + response.statusCode + "]"});

			}

		});

	}else{

		log.warn("Downloader failed to authenticate: no authentication URL provided.");
		res.send(500, {"message":"This action is not configured correctly in the configuration."});

	}

});

rest.get('/server/log/:lines', function(req, res) {

	if(!checkAuthorization(req, res, "s:console")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];
	res.send(server.logContents(req.params.lines));

});

rest.post('/server/reset-password', function(req, res) {

	if(!checkAuthorization(req, res, "s:ftp")) {
		return;
	}

	var server = s[req.headers['X-Access-Server']];
	server.resetPassword(req.params.password, res);

});

rest.listen(gconfig.listen.rest, function() {
	log.info("Scales is now listening on port 5656");
});