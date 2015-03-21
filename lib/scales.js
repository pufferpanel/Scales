/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
	proc = require("child_process")
	testing = false;

process.argv.forEach(function(val, index, array) {

	if(val == 'debug') {
		log.d = true;
		log.debug("Scales running in debug mode.");
	}

	if(val == 'verbose') {
		log.v = true;
		log.verbose("Scales running in verbose mode.");
	}

});

log.info("+ ========================================== +");
log.info("| Scales logs all information, (inc. errors) |");
log.info("| into the logs/ directory. Please check     |");
log.info("| there before asking for help with bugs.    |");
log.info("|                                            |");
log.info("| \x1b[41mSubmit bug reports at the following link:\x1b[0m  |");
log.info("| https://github.com/PufferPanel/Scales      |");
log.info("+ ========================================== +");

proc.exec("cd lib/scripts && chmod +x *.sh", function(error, stdout, stderr) {

	if(error !== null) {
		log.error("An error occured while attempting to correct script permissions on boot.", stderr);
	} else {
		log.verbose("All scripts in /lib/scripts successfully had their permissions updated.");
	}

});

require("./interfaces/restify.js");
require("./interfaces/socket.js");

if(testing === true) {
	log.warn("Running as test, Scales is now stopping.");
	process.exit();
}

process.on('SIGINT', function() {

	log.warn("Detected hard shutdown!");
	log.warn("Killing all running java processes on the server!");
	log.info("All shutdown parameters complete. Stopping...\n");
	process.exit();

});