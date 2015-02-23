/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
require("date-utils");
var fs = require("fs-extra"),
	winston = require("winston");

// Make sure that the logs directory oe
fs.ensureDir("./logs", function(err) {
	if(err != null) {
		console.log(err);
	}
});

// Define the logger implementation
var l = {};
var date = new Date();
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.File)({
			filename: './logs/' + date.toYMD('.') + '-' + date.toFormat('HH24.MI.SS') + '.log',
			level: 'info',
			json: false,
			timestamp: function() {
				return date.toFormat('HH24:MI:SS');
			}
		})
	]
});

l.d = false;
l.v = false;

// Setup the different loggers to output to the console depending on debug or verbosity setting.
l.debug = function(l, data) {

	var date = new Date();

	logger.transports.file.level = 'debug';
	logger.debug(l, { meta: data });

	if(this.d === true) {
		console.log("[" + date.toFormat('HH24:MI:SS') + "][DEBUG] " + l);
	}

};

l.error = function(l, data) {

	var date = new Date();

	logger.error(l, { meta: data });
	console.log("[" + date.toFormat('HH24:MI:SS') + "]\x1b[1m\x1b[37m\x1b[41m[ERROR]\x1b[0m " + l);

};

l.verbose = function(l, data) {

	var date = new Date();

	logger.transports.file.level = 'verbose';
	logger.verbose(l, { meta: data });

	if(this.v === true || this.d === true) {
		console.log("[" + date.toFormat('HH24:MI:SS') + "][VERBOSE] " + l);
	}

};

l.info = function(l, data) {

	var date = new Date();

	logger.info(l, { meta: data });
	console.info("[" + date.toFormat('HH24:MI:SS') + "][INFO] " + l);

};

l.warn = function(l, data) {

	var date = new Date();

	logger.warn(l, { meta: data });
	console.info("[" + date.toFormat('HH24:MI:SS') + "]\x1b[30m\x1b[43m[WARN]\x1b[0m " + l);

};

module.exports = l;