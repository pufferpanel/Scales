/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Rfr = require('rfr');
var Fs = require('fs-extra');
var Logger = Rfr('lib/logger.js');
var Path = require('path');
var Async = require('async');
var Util = require('util');
var Proc = require('child_process');
var Pty = require('pty.js');
var GlobalConfig = Rfr('config.json');
var Plugin = Rfr('lib/plugins.js').pluginLoader;
var Scales = Rfr('lib/process.js');
var Servers = Rfr('lib/initalize.js').servers;

Logger.info('Running Upgrader Script.');

Async.series([
    function (mainCallback) {
        Async.parallel([
            function (callback) {
                Logger.info('Updating Docker Images to the latest versions.');
                return callback();
            },
            function (callback) {
                Proc.exec('docker pull pufferpanel/minecraft:latest', function (err, stdout, stderr) {
                    if (err || stderr) {
                        Logger.error('An error occured while trying to update the docker image for minecraft. Perhaps try running this command manually: "docker pull pufferpanel/minecraft:latest"', stderr);
                        return callback(err);
                    }
                    return callback();
                });
            },
            function (callback) {
                Proc.exec('docker pull pufferpanel/srcds:latest', function (err, stdout, stderr) {
                    if (err || stderr) {
                        Logger.error('An error occured while trying to update the docker image for srcds. Perhaps try running this command manually: "docker pull pufferpanel/srcds:latest"', stderr);
                        return callback(err);
                    }
                    return callback();
                });
            },
            function (callback) {
                Proc.exec('docker pull pufferpanel/pocketmine:latest', function (err, stdout, stderr) {
                    if (err || stderr) {
                        Logger.error('An error occured while trying to update the docker image for pocketmine. Perhaps try running this command manually: "docker pull pufferpanel/pocketmine:latest"', stderr);
                        return callback(err);
                    }
                    return callback();
                });
            }
        ], function (err) {
            return mainCallback(err);
        });
    },
    function (mainCallback) {

        Async.eachSeries(Servers, function (server, callback) {
            Logger.info('Updating container for ' + server.config.name);
            server.rebuildDockerContainer(function (err) {
                Logger.info('UPDATED container for ' + server.config.name);
                return callback(err);
            });
        }, function (err) {
            return mainCallback(err);
        });

    }
], function (err) {

});
