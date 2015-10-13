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

Logger.info('Running Conversion Script.');

// Read all servers into memory.
Fs.readdir('./data/', function (err, files) {

    if (err) {

        Logger.error('An error occured while trying to load files into memory.', err);
        throw err;
    }

    Async.each(files, function (file, next) {

        if (Path.extname(file) !== '.json') {
            return next();
        }

        Fs.readJson('./data/' + file, function (err, json) {

            if (err) {
                return next(err);
            }

            if (json === null) {
                Logger.warn(Util.format('File %s detected as invalid JSON data. Skipping.', file));
                return next();
            }

            // Add Docker Container
            var dockerUserInfo;
            Async.series([
                function (callback) {
                    Proc.exec(Util.format('stat -c \'%u:%g\' %s', Path.join(GlobalConfig.basepath, json.user, 'public')), function (err, stdout, stderr) {

                        if (err || stderr) {
                            Logger.error('An error occured while trying to determine user information for a docker container.', stderr);
                            return next(err);
                        }

                        dockerUserInfo = stdout.replace('\n', '');
                        return callback();

                    });
                },
                function (callback) {

                    this.ports = {
                        'minecraft': 25565,
                        'bungeecord': 25565,
                        'srcds': 27015
                    };

                    Logger.verbose(Util.format('Creating docker container for %s. This could take a few minutes if the container images are not on the server already.', json.name));
                    dockerProcessParams = [
                        'create',
                        '-it',
                        '--name',
                        json.user,
                        '-h',
                        'docker',
                        '-p',
                        json.gamehost + ':' + json.gameport + ':' + (this.ports[json.plugin] || 8080),
                        '-p',
                        json.gamehost + ':' + json.gameport + ':' + (this.ports[json.plugin] || 8080) + '/udp',
                        '-m',
                        json.build.memory + 'M',
                        '--blkio-weight=' + (json.build.io || 500),
                        '-u',
                        dockerUserInfo,
                        '-v',
                        Path.join(GlobalConfig.basepath, json.user, 'public') + ':/home/container',
                        (json.plugin === 'bungeecord') ? 'pufferpanel/minecraft' : 'pufferpanel/' + json.plugin
                    ];

                    var dockerProcess = Pty.spawn('docker', dockerProcessParams);

                    dockerProcess.on('data', function (data) {
                        Logger.info(data);
                    });

                    dockerProcess.on('exit', function () {

                        Logger.info(Util.format('Successfully added a new docker container for %s.', json.name));
                        return next();

                    });

                }]);

        });

    }, function (err) {

        if (err) {
            Logger.error('An error occured while attempting to migrate servers to new docker container setup.');
            Logger.error(err.stack);
            process.exit(1);
        }

        Logger.info('All servers successfully migrated to new docker container setup.');
        process.exit(0);

    });

});
