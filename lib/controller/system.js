/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Rfr = require('rfr');
var Logger = Rfr('lib/logger.js');
var Pty = require('pty.js');
var Proc = require('child_process');
var Util = require('util');
var StripANSI = require('strip-ansi');
var Async = require('async');
var Power = Rfr('lib/enum/power.js');
var Userid = require('userid');

var SystemControl = function (useDocker, process) {

    this.isDocker = useDocker;
    this.parent = process;
};

SystemControl.prototype.initialize = function (next) {

    var self = this;
    var user = self.parent.config.user;
    if (self.isDocker) {
        Proc.exec(Util.format('docker start %s', user), function (err, stdout, stderr) {

            if (err || stderr) {
                Logger.error(Util.format('An error occurred attempting to start docker container for %s', user), stderr);
                return next(err);
            }

            Logger.verbose(Util.format('Initialized docker container for %s', user));
        });
    }
    return next();
};

SystemControl.prototype.stop = function (next) {

    var self = this;
    var user = self.parent.config.user;
    if (self.isDocker) {
        Proc.exec(Util.format('docker stop %s', user), function (err, stdout, stderr) {

            if (err || stderr) {
                Logger.error(Util.format('An error occurred attempting to stop docker container for %s, killing it.', user), stderr);
                self._kill(null, false);
                return next(stderr);
            }

            Logger.verbose(Util.format('Detached docker container for server %s', user));
        });
    }
    return next();
};

SystemControl.prototype.kill = function (next) {

    var self = this;
    var user = self.parent.config.user;
    var process = self.parent.ps;
    Logger.verbose(Util.format('Killing server for %s (pid: %s)', user, typeof process !== 'undefined' ? process.pid : 'undefined'));
    if (self.isDocker) {
        Proc.exec(Util.format('docker kill -s 9 %s', user), function (err, stdout, stderr) {

            if (err || stderr) {
                Logger.error(Util.format('An error occurred attempting to kill docker container for %s', user), stderr);
                if (typeof next === 'function') {
                    return next(new Error('An error occurred attempting to kill the docker container.'));
                }
                return;
            }

            Logger.verbose(Util.format('Killed docker container for server %s', user));
        });
    } else {
        if (typeof process !== 'undefined') {
            process.kill('SIGINT');
        }
    }
    if (typeof next === 'function') {
        return next();
    }
};

SystemControl.prototype.delete = function (next) {

    var self = this;
    var user = self.parent.config.user;
    if (self.isDocker) {
        Proc.exec(Util.format('docker rm -vf %s', user), function (err, stdout, stderr) {

            if (err || stderr) {
                Logger.error(Util.format('An error occurred attempting to delete docker container for %s', user), stderr);
                return next(err);
            }

            Logger.verbose(Util.format('Deleted docker container for server %s', user));
        });
    }
    return next();
};

SystemControl.prototype.create = function (next) {

    var self = this;
    var parent = self.parent;
    var dockerUserId;
    if (self.isDocker) {
        Async.series([
            function (callback) {

                Logger.verbose(Util.format('Attempting to gather user information to create a container for server %s', parent.config.name));
                dockerUserId = self._dockerGetUserID();
                return callback();
            },
            function (callback) {

                // Build Port Mapping
                var portMap = Util.format('-p %s:%s:%s -p %s:%s:%s/udp',
                    parent.config.gamehost,
                    parent.config.gameport,
                    parent.config.gameport,
                    parent.config.gamehost,
                    parent.config.gameport,
                    parent.config.gameport
                );

                if (typeof parent.config.build.mapping !== 'undefined') {
                    var mappingObject = parent.config.build.mapping;
                    for (var ip in mappingObject) {
                        for (var port in mappingObject[ip]) {
                            // mapping localhost:internal to ip:external (docker --> host)
                            portMap = Util.format('%s -p %s:%s:%s -p %s:%s:%s/udp',
                                portMap,
                                ip,
                                mappingObject[ip][port],
                                port,
                                ip,
                                mappingObject[ip][port],
                                port
                            );
                        }
                    }
                }

                Logger.verbose(Util.format('Creating docker container for server %s', parent.config.name));
                try {
                    var dockerProcessParams = Util.format('create -it --name %s -h docker -m %sM --blkio-weight=%s --cpu-period=100000 --cpu-quota=%s %s -u %s -v %s:/home/container %s',
                        parent.config.user,
                        parent.config.build.memory,
                        parent.config.build.io || 500,
                        (parent.config.build.cpu <= 0) ? -1 : (parent.config.build.cpu * 1000),
                        portMap,
                        dockerUserId,
                        parent.buildPath(),
                        (parent.config.plugin === 'bungeecord' || parent.config.plugin === 'minecraft-pre') ? 'pufferpanel/minecraft:latest' : 'pufferpanel/' + parent.config.plugin + ':latest'
                    );
                } catch (ex) {
                    Logger.error('What', ex);
                }

                Logger.verbose(Util.format('Executing cmd: %s %s', 'docker', dockerProcessParams));

                parent.ps = Pty.spawn('docker', dockerProcessParams.match(/\S+/g));

                parent.ps.on('data', function (data) {

                    self.emit('installer', StripANSI(data));
                });

                parent.ps.on('exit', function (code) {

                    if (code !== 0) {
                        return callback(new Error('docker create command exited with non-zero error code [' + code + '].'));
                    }

                    Logger.verbose(Util.format('Successfully added a new docker container for %s.', parent.config.name));
                    return callback();
                });
            }
        ], function (err) {

            return next(err);
        });
    }
    return next();
};

SystemControl.prototype.start = function (next) {

    var self = this;
    try {
        self.parent.setStatus(Power.STARTING);
        var pluginStartup = self.parent.plugin.startup();
        var cmd, args;
        var opt = {};
        if (self.isDocker) {
            var cmdParams = Util.format('exec -it %s %s', self.parent.plugin.serverConfig.user, pluginStartup);
            cmd = 'docker';
            args = cmdParams.match(/\S+/g);
        } else {
            var parts = pluginStartup.match(/\S+/g);
            cmd = parts.shift();
            args = parts;
            opt = {
                'cwd': self.parent.buildPath(),
                uid: Userid.uid(self.parent.plugin.serverConfig.user),
                gid: Userid.gid('scalesuser')
            };
        }
        Logger.verbose(Util.format('Executing for startup: %s %s', cmd, args.join(' ')));
        self.parent.ps = Pty.spawn(cmd, args, opt);
        return next();
    } catch (ex) {
        self.parent.setStatus(Power.OFF);
        Logger.error(Util.format('Unable to start server process for %s due to an exception in Pty.spawn()', self.parent.config.user), ex.stack);
        return next(ex);
    }
};

SystemControl.prototype._dockerGetUserID = function () {

    var self = this;
    Proc.exec(Util.format('stat -c \'%u:%g\' %s', self.parent.buildPath()), function (err, stdout, stderr) {

        if (err || stderr) {
            throw new Error('An error occurred while trying to determine user information for a docker container.', stderr);
        }
        return stdout.replace('\n', '');
    });
};

module.exports = SystemControl;