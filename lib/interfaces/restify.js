/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("../logger.js"),
	restify = require('restify'),
	plugin = require("../plugins.js").pluginLoader,
	Scales = require("../process.js"),
	server = restify.createServer({
		name: "Scales"
	}),
	s = require("../initalize.js").servers
	initalizeServer = require("../initalize.js").initalize;

server.use(function crossOrigin(req, res, next) {

	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	return next();

});

server.use(restify.bodyParser());
server.use(restify.authorizationParser());
server.use(restify.queryParser());

function send403(res) {

	res.json(403, {'error': 'HTTP/1.1 403 Forbidden. You do not have permission to access this function.'});
	return res;

}

server.get('/', function(req, res, next) {
	res.send(req.headers);
});

server.post('/server', function(req, res, next) {

	if(!req.params.settings) {
		res.send(500, {'error': 'Missing required parameter.'});
		return;
	}

	try {

		config = JSON.parse(req.params.settings);

		if(config.name) {

			initalizeServer(config);

			s[config.name].create();
			res.send("ok");

		} else {

			log.verbose("Recieved an invalid JSON request for adding a new server.");
			res.send(500, {'error': 'Missing required parameters in JSON.'});

		}

	} catch(ex) {

		log.verbose("An exception occured trying to process adding a new server.", ex.stack);
		res.send(500, {'error': 'An exception occured trying to process this request.'});

	}

});

server.get('/server/:id/power/:action', function(req, res, next) {

	s[req.params.id].test();
	res.send();

});

server.listen(5656, function() {
	log.info("Scales is now listening on port 5656");
});