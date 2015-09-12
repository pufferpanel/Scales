/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Rfr = require('rfr');
var Proc = require('child_process');
var Yargs = require('yargs').argv;
var Logger = Rfr('lib/logger.js');

if (Yargs.consoleLevel === 'verbose') {
    Logger.info('PufferPanel running in verbose console output mode.');
}

if (Yargs.showMeta === true) {
    Logger.info('PufferPanel will output log metadata to console.');
}

Logger.info('+ ========================================== +');
Logger.info('| Scales logs all information, (inc. errors) |');
Logger.info('| into the logs/ directory. Please check     |');
Logger.info('| there before asking for help with bugs.    |');
Logger.info('|                                            |');
Logger.info('| '.reset + 'Submit bug reports at the following link: '.red + '  |');
Logger.info('| https://github.com/PufferPanel/Scales      |');
Logger.info('+ ========================================== +');

Proc.exec('cd lib/scripts && chmod +x *.sh', function (err, stdout, stderr) {

    if (err) {
        Logger.error('An error occured while attempting to correct script permissions on boot.', stderr);
    } else {
        Logger.verbose('All scripts in /lib/scripts successfully had their permissions updated.');
    }

});

Rfr('lib/interfaces/restify.js');
Rfr('lib/interfaces/socket.js');

process.on('SIGINT', function () {

    Logger.warn('Detected hard shutdown! Stopping all running docker containers.');
    Proc.exec('docker stop $(docker ps -a -q)', function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error('An error occured while attempting to stop all running docker containers.', stderr);
            process.exit(1);
        }

        Logger.warn('All running docker containers stopped successfully.');
        process.exit(0);

    });

});
