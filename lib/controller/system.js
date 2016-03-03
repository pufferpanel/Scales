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
        var process = Proc.execSync(Util.format('docker start %s', user));

        if (process.err || process.stderr) {
            Logger.error(Util.format('An error occurred attempting to start docker container for %s', user), stderr);
            return next(err);
        }

        Logger.verbose(Util.format('Initialized docker container for %s', user));
    }
    return next();
};

SystemControl.prototype.stop = function (next) {

    var self = this;
    var user = self.parent.config.user;
    if (self.isDocker) {
        var process = Proc.execSync(Util.format('docker stop %s', user));

        if (process.err || process.stderr) {
            Logger.error(Util.format('An error occurred attempting to stop docker container for %s, killing it.', user), process.stderr);
            self._kill(null, false);
            return next(process.stderr);
        }

        Logger.verbose(Util.format('Detached docker container for server %s', user));
    }
    return next();
};

SystemControl.prototype.kill = function (next) {

    var self = this;
    var user = self.parent.config.user;
    var serverProcess = self.parent.ps;
    Logger.verbose(Util.format('Killing server for %s (pid: %s)', user, typeof serverProcess !== 'undefined' ? serverProcess.pid : 'undefined'));
    if (self.isDocker) {
        var process = Proc.execSync(Util.format('docker kill -s 9 %s', user));
        if (process.err || process.stderr) {
            Logger.error(Util.format('An error occurred attempting to kill docker container for %s', user), process.stderr);
            if (typeof next === 'function') {
                return next(new Error('An error occurred attempting to kill the docker container.'));
            }
            return;
        }
        Logger.verbose(Util.format('Killed docker container for server %s', user));
    } else {
        if (typeof serverProcess !== 'undefined') {
            Proc.execSync(Util.format('kill -9 $(pgrep -P $(pgrep -P %s))', serverProcess.pid));
            //serverProcess.kill('SIGINT');
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
        var process = Proc.execSync(Util.format('docker rm -vf %s', user));
        if (process.err || process.stderr) {
            Logger.error(Util.format('An error occurred attempting to delete docker container for %s', user), process.stderr);
            return next(err);
        }
        Logger.verbose(Util.format('Deleted docker container for server %s', user));
    }
    return next();
};

SystemControl.prototype.create = function (next) {

    var self = this;
    var parent = self.parent;
    if (self.isDocker) {
        Async.series([
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

                var mappingObject = parent.config.build.mapping;
                if (typeof mappingObject !== 'undefined') {
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
                var dockerProcessParams = "";
                try {
                    if (parent.config.build.cpu > 0) {
                        dockerProcessParams = Util.format('create -it --name %s -h docker -m %sM --blkio-weight=%s --cpu-period=100000 --cpu-quota=%s %s -u %s -v %s:/home/container %s',
                            parent.config.user,
                            parent.config.build.memory,
                            parent.config.build.io || 500,
                            parent.config.build.cpu * 1000,
                            portMap,
                            Userid.uid(parent.config.user),
                            parent.buildPath(),
                            (parent.config.plugin === 'bungeecord' || parent.config.plugin === 'minecraft-pre') ? 'pufferpanel/minecraft:latest' : 'pufferpanel/' + parent.config.plugin + ':latest'
                        );
                    } else {
                        dockerProcessParams = Util.format('create -it --name %s -h docker -m %sM --blkio-weight=%s %s -u %s -v %s:/home/container %s',
                            parent.config.user,
                            parent.config.build.memory,
                            parent.config.build.io || 500,
                            portMap,
                            Userid.uid(parent.config.user),
                            parent.buildPath(),
                            (parent.config.plugin === 'bungeecord' || parent.config.plugin === 'minecraft-pre') ? 'pufferpanel/minecraft:latest' : 'pufferpanel/' + parent.config.plugin + ':latest'
                        );
                    }
                } catch (ex) {
                    Logger.error('Error on attempting to create container', ex);
                }

                Logger.verbose(Util.format('Executing cmd: %s %s', 'docker', dockerProcessParams));

                parent.ps = Pty.spawn('docker', dockerProcessParams.match(/\S+/g));

                parent.ps.on('data', function (data) {

                    parent.emit('installer', StripANSI(data));
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
    } else {
        return next();
    }
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
            cmd = 'su';
            args = [
                '-s',
                '/bin/bash',
                '-l',
                self.parent.plugin.serverConfig.user,
                '-c',
                'cd ' + self.parent.plugin.settings.start_dir + ' && ' + pluginStartup
            ];
        }
        Logger.verbose(Util.format('Executing for startup: %s %s', cmd, args.join(' ')));
        self.parent.ps = Pty.spawn(cmd, args, opt);
        Logger.verbose('Process started with pid ' + self.parent.ps.pid);
        return next();
    } catch (ex) {
        self.parent.setStatus(Power.OFF);
        Logger.error(Util.format('Unable to start server process for %s', self.parent.config.user), ex.stack);
        return next(ex);
    }
};

module.exports = SystemControl;