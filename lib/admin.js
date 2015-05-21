/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	gconfig = require("../config.json"),
	path = require("path"),
	fs = require("fs-extra"),
	async = require("async"),
	s = require("../initalize.js").servers;

function Admin() {

}

Admin.prototype.checkAuthorization = function(req, res, permission) {

	try {

		if(!('x-access-token' in req.headers) && !('X-Access-Token' in req.headers)) {
			res.send(400, {"message": "Missing required X-Access-Token header."});
			return false;
		}

		if('x-access-token' in req.headers && !('X-Access-Token' in req.headers)) {
			req.headers['X-Access-Token'] = req.headers['x-access-token'];
		}

		if(permission.indexOf("a:") == 0) {

			if(gconfig.keys.indexOf(req.headers['X-Access-Token']) < 0) {
				return false;
			}

		}

	} catch(ex) {

		log.verbose("An exception was encountered processing a restify request.", ex.stack);
		return false;

	}

	return true;

}

Admin.prototype.retrieveLogs = function(req, res, next) {

	if(!this.checkAuthorization("a:logs")) {
		return;
	}

	// Return the logs from the log file

}

module.exports = new Admin();