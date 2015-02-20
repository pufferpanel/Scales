/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("../logger.js"),
	restify = require('restify'),
	server = restify.createServer({
		name: "Scales"
	});

server.use(function crossOrigin(req, res, next) {

	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	return next();

});

function send403(res) {

	res.json(403, {'error': 'HTTP/1.1 403 Forbidden. You do not have permission to access this function.'});
	return res;

}

server.get('/', function(req, res, next) {
	res.send(req.headers);
});

server.get('/server/:id/power/:action', function(req, res, next) {

	if(!req.headers['X-Access-Token']) {
		send403(res);
		return next();
	}

});

server.listen(5656, function() {
	log.info("Scales is now listening on port 5656");
});