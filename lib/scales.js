/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var log = require("./logger.js"),
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

	if(val == 'test') {
		testing = true;
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
var rest = require("./interfaces/restify.js");

if(testing === true) {
	log.warn("Running as test, Scales is now stopping.");
	process.exit();
}

process.on('SIGINT', function() {

	log.warn("Detected hard shutdown!");
	log.warn("Killing all running java processes on the server!");

	// try {
    //
	// 	var server = servers.servers;
	// 	server.forEach(function(s) {
	// 		if(s.ps) {
	// 			run = exec('kill '+ s.ps.pid, function(error, stdout, stderr) {
	// 				log.info("Killing server with pid of "+ s.ps.pid + "out: "+ stdout);
	// 			});
	// 		}
	// 	});
    //
	// } catch (ex) {
	// 	log.error("Exception occured trying to stop all running servers.",ex.stack);
	// 	log.warn("Please run 'killall java -9' before restarting GSD!");
	// }

	log.info("All shutdown parameters complete. Stopping...\n");
	process.exit();

});