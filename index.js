/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Rfr = require('rfr');
var Async = require('async');
var Proc = require('child_process');
var Util = require('util');
var Fs = require('fs-extra');
var Logger = Rfr('lib/logger.js');
var Config = Rfr('config.json');
var Vargs = require('yargs');

var cliArgs = Vargs.argv;

Logger.info('+ ========================================== +');
Logger.info('| Scales logs all information, (inc. errors) |');
Logger.info('| into the logs/ directory. Please check     |');
Logger.info('| there before asking for help with bugs.    |');
Logger.info('|                                            |');
Logger.info('| '.reset + 'Submit bug reports at the following link: '.red + ' |');
Logger.info('| https://github.com/PufferPanel/Scales      |');
Logger.info('+ ========================================== +');

var pidFilePath = __dirname + '/scales.pid';

Logger.verbose('Using docker?: ' + ((typeof Config.docker === 'undefined') || (Config.docker) == true));

Proc.execSync('find ./lib/scripts -name "*.sh" -exec chmod +x {} \\;', function (err, stdout, stderr) {

    if (err) {
        Logger.error('An error occurred while attempting to correct script permissions on boot.', stderr);
        process.exit(1);
    }
});

Logger.verbose('All scripts in /lib/scripts successfully had their permissions updated.');
Rfr('lib/interfaces/restify.js');
Rfr('lib/interfaces/socket.js');

Logger.info('Scales has completed started');
if (!cliArgs.nodaemon) {
    require('daemon')();
}

Fs.writeFileSync(pidFilePath, process.pid);
process.on('SIGINT', function () {

    var servers = Rfr('lib/initalize.js').servers;

    Logger.warn('Detected shutdown! Stopping all running server containers.');
    Async.forEachOf(servers, function (value, key, next) {

        if (typeof servers[key] !== 'undefined') {
            try {
                servers[key]._stop(function () {
                });
            } catch (err) {
                Logger.error(Util.format('Unexpected error shutting down server %s', key), err);
            }
        }

        return next();
    }, function (err) {

        if (err) {
            Logger.error('An error was detected while shutting down', err);
        }
        Logger.warn('All running server containers stopped successfully.');
        Logger.shutdown();
        sleep(2);
        Fs.unlinkSync(pidFilePath);
        process.exit(0);
    });
});