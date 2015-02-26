/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("../logger.js"),
	restify = require('restify'),
	plugin = require("../plugins.js").pluginLoader,
	Scales = require("../process.js"),
	rest = restify.createServer({
		name: "Scales"
	}),
	s = require("../initalize.js").servers
	initalizeServer = require("../initalize.js").initalize;

rest.use(function crossOrigin(req, res, next) {

	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	return next();

});

rest.use(restify.bodyParser());
rest.use(restify.authorizationParser());
rest.use(restify.queryParser());

function send403(res) {

	res.json(403, {'error': 'HTTP/1.1 403 Forbidden. You do not have permission to access this function.'});
	return res;

}

function checkAuthorization(req, res, permission) {

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

			if(!s[req.headers['X-Access-Server']].hasPermission(req.headers['X-Access-Token'], permission)) {
				res.send(403, {"message": "You do not have permission to perform that action."});
				return false;
			}

		}

	}

	return true;

}

rest.get('/', function(req, res, next) {
	res.send(req.headers);
});

rest.post('/server', function(req, res, next) {

	if(!req.params.settings) {
		res.send(500, {'error': 'Missing required parameter.'});
		return;
	}

	try {

		config = JSON.parse(req.params.settings);

		if(config.name) {

			initalizeServer(config);

			s[config.name].create();
			res.send(204);

		} else {

			log.verbose("Recieved an invalid JSON request for adding a new server.");
			res.send(500, {'error': 'Missing required parameters in JSON.'});

		}

	} catch(ex) {

		log.verbose("An exception occured trying to process adding a new server.", ex.stack);
		res.send(500, {'error': 'An exception occured trying to process this request.'});

	}

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

rest.get('/server', function(req, res) {

	if(!checkAuthorization(req, res, "s:get")) {
		return;
	}

});

rest.listen(5656, function() {
	log.info("Scales is now listening on port 5656");
});