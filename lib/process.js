/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */
var Async = require('async');
var Rfr = require('rfr');
var Logger = Rfr('lib/logger.js');
var Config = {
    global: Rfr('config.json')
};
var Pty = require('pty.js');
var Proc = require('child_process');
var Util = require('util');
var Events = require('events');
var Path = require('path');
var Querystring = require('querystring');
var StripANSI = require('strip-ansi');
var Fs = require('fs-extra');

// Set Power Variables
var OFF = 0;
var ON = 1;
var STOPPING = 2;
var STARTING = 3;
var CRASHED = 4;

var Scales = function (config) {

    var Plugin = Rfr('lib/plugins/' + config.plugin + '.js');

    this.status = 0;
    this.config = config;
    this.usageStatistics = {};
    this.lastCrash = 0;
    this.plugin = new Plugin(this.getRootPath(), this.buildPath(), this.config);
    this.logStream = false;

};

Util.inherits(Scales, Events.EventEmitter);

Scales.prototype.hasPermission = function (key, permission) {

    if (Config.global.keys.indexOf(key) > -1) {
        return true;
    }

    if (typeof permission === 'undefined' || !(key in this.config.keys)) {
        return false;
    }

    if (this.config.keys[key].indexOf(permission) < 0) {
        return false;
    }

    return true;

};

/**
 * Sets the current server status.
 * @param {int} status Should be 0-4 depending on the current status.
 */
Scales.prototype.setStatus = function (status) {

    this.status = status;
    this.emit('status', this.status);

    return this.status;

};

Scales.prototype.setLastCrash = function () {

    this.lastCrash = Math.floor(new Date().getTime() / 1000);

};

Scales.prototype.preflight = function () {

    // Add Docker Logic
    // this.plugin.preflight();
    this.power(1);

};

Scales.prototype.power = function (status, next) {

    if (status === 1) {
        this.powerOn(next);
    }

    if (status === 2) {
        this.powerCycle(next);
    }

};

/**
 * Ensures that Docker Container is started.
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
Scales.prototype.dockerInitalizeContainer = function (next) {
    Proc.exec(Util.format('docker start %s', this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to start docker container for %s', self.config.user), stderr);
            return next(err);
        }

        next();
    });
};

/**
 * Attaches to the server's docker container.
 * Access as this.pty = this.attachDockerContainer();
 * @return {object} Pty.spawn(); object
 */
Scales.prototype.dockerAttachContainer = function () {
    return Pty.spawn('docker', ['attach', this.config.user]);
};

/**
 * Detaches a server's docker containers, efectively turning off the server with a hard shutdown.
 * Does not trigger a crash warning.
 * @param {bool} status Wether or not to update the server power status. Defaults to true.
 * @return {object}
 */
Scales.prototype.dockerDetachContainer = function (status) {

    var self = this;
    if (typeof status !== 'undefined' && status === true) {
        this.setStatus(STOPPING); // Prevent crash detection
    }

    Proc.exec(Util.format('docker stop %s', this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to stop docker container for %s', self.config.name), stderr);
            return;
        }

        Logger.verbose(Util.format('Detached docker container for server %s', self.config.name), stdout);

    });
};

/**
 * Spins up the docker container and executes the server command to start the server.
 * @return {[type]}        [description]
 */
Scales.prototype.dockerExecuteServerStartup = function () {

    var startupArray = Util.format('exec -it %s %s ', this.config.user, this.plugin.settings.exe) + this.config.startup.command
        .replace('${ip}', this.config.gamehost)
        .replace('${port}', this.config.gameport)
        .replace('${memory}', this.config.build.memory);

    for (var index in this.config.startup.variables) {
        startupArray = startupArray.replace('${' + index + '}', this.config.startup.variables[index]);
    }

    Logger.verbose(Util.format('Attempting to spawn server process for %s', this.config.user));

    try {

        this.setStatus(STARTING);
        return Pty.spawn('docker', startupArray.match(/\S+/g));
    } catch (ex) {

        this.setStatus(OFF);
        Logger.error(Util.format('Unable to start server process for %s due to an exception in Pty.spawn()', this.config.user), ex.stack);
        return;
    }

};

/**
 * Turns on the specified server.
 * @param  {Function} next Callback
 * @return {Callback}
 */
Scales.prototype.powerOn = function (next) {

    var self = this;

    this.dockerInitalizeContainer(function (err) {

        if (err) {
            return;
        }

        self.ps = self.dockerExecuteServerStartup();

        self.ps.on('data', function (data) {

            output = data.toString();
            self.emit('console', StripANSI(output));

            // Write output to specific file if defined in the plugin
            // Used by SRCDS since it's logging is a bit.. sparse.
            if (typeof self.plugin.settings.manual_log !== 'undefined' && self.plugin.settings.manual_log) {

                if (!self.logStream) {

                    // @TODO: this probably need to be fixed to not spam the console.
                    Fs.ensureFileSync(self.buildPath(self.plugin.settings.log), function (err) {
                        if (err) {

                            Logger.error('An error occured while trying to create a log file for ' + self.config.name, err);
                        } else {

                            self.logStream = fs.createWriteStream(self.buildPath(self.plugin.settings.log), {
                                flags: 'a'
                            });
                        }
                    });

                }

                if (self.logSream !== false) {
                    self.logStream.write(stripansi(data));
                }

            }

            if (self.status === STARTING) {

                // Only applies to MC Servers
                // Should consider adding a call here for self.plugin.postStart();
                if (typeof self.plugin.settings.trigger.eula !== 'undefined') {

                    if (output.indexOf(self.plugin.settings.trigger.eula) !== -1) {

                        self.setStatus(STOPPING);
                        self.emit('off');

                        Logger.warn(Util.format('Server %s has not yet accepted the EULA. Stopping server...', self.config.name));

                    }

                }

                if (typeof self.plugin.settings.trigger.started !== 'undefined' && output.indexOf(self.plugin.settings.trigger.started) > -1) {

                    self.setStatus(ON);
                    self.queryServer = setInterval(self.query, 10000);
                    Logger.verbose(Util.format('Server %s successfully started.', self.config.name));

                }

            }

        });

        // Emitted when the PTY exits
        self.ps.on('exit', function () {

            if (self.status === ON || self.status === STARTING) {

                self.emit('status', 'crashed');
                self.setStatus(CRASHED);
                self.emit('crashed');

            }

            if (self.status === STOPPING) {

                Logger.verbose(Util.format('Server process stopped for %s', self.config.name));
                self.setStatus(OFF);

                // Tell Scales the process is exited
                self.emit('off');

            }

        });

    });

    this.on('crashed', function () {

        if (self.status === CRASHED) {

            log.warn('Attempting to kill crashed process (pid: ' + self.ps.pid + ') for server ' + self.config.name);
            self.kill();

        }

    });

    // Emitted when the 'exit' event is detected from the PTY
    this.on('off', function () {

        if (self.status !== OFF && self.status !== CRASHED) {
            Logger.verbose('Stopping server process for ' + self.config.name);
            self.setStatus(OFF);
        }

        clearInterval(self.processStats);
        clearInterval(self.queryServer);

        self.usageStatistics = {};
        self.plugin.query = {};

        // Detach the container
        self.dockerDetachContainer(false);

        if (self.status === CRASHED) {

            self.setStatus(OFF);

            // Prevent rapid crash restarts from happening
            if (Math.floor(new Date().getTime() / 1000) - self.lastCrash < 60) {
                Logger.warn('Skipping server restart after crash due to frequency of crashes occuring on server ' + self.config.name);
                self.emit('console', '[Scales] [WARNING] This server has been detected as crashed by the management daemon. The restart process is being skipped due to the frequency at which this server is crashing (< 60 seconds between crashes).');
                return;
            }

            // Set time since last crash
            self.setLastCrash();

            Logger.warn('Server process for ' + self.config.name + ' killed after crash, server is now rebooting...');
            self.emit('console', '[Scales] [WARNING] This server has been detected as crashed by the management daemon. Restarting now...');
            self.preflight();

        }

        if (logStream !== false) {
            logStream = false;
        }


    });

};

Scales.prototype.powerOff = function (next) {

    if (this.status !== OFF) {

        Logger.verbose(Util.format('Stopping server process (pid: %s) for %s', this.ps.pid, this.config.name));
        this.setStatus(STOPPING);
        this.ps.write(this.plugin.settings.stop + '\r');

    } else {

        // Allows the use of restart even if the server isn't on.
        Logger.verbose(Util.format('Power off called for %s but server is already off. If a callback was defined it will continue.', this.config.name));
        if (typeof next !== 'undefined') {
            next();
        }

    }

    this.on('off', function () {

        if (typeof next !== 'undefined') {
            next();
        }

    });

};

Scales.prototype.powerCycle = function () {

    var self = this;
    Async.series([
        function (next) {
            self.powerOff(next);
        },
        function (next) {
            self.preflight();
        }
    ]);

};

Scales.prototype.kill = function () {};

Scales.prototype.checkProcessBindings = function () {};

Scales.prototype.console = function (data) {};

Scales.prototype.listDirectory = function (base) {};

Scales.prototype.returnFile = function (base) {};

Scales.prototype.writeFile = function (base, contents) {};

Scales.prototype.deleteFile = function (base) {};

Scales.prototype.logContents = function (lines) {};

/**
 * Returns the root path for the specificed Scales instance.
 * @return {string} The root path in the format of /home/username
 */
Scales.prototype.getRootPath = function () {
    return Path.join(Config.global.basepath, this.config.user);
};

/**
 * Builds a path to the specificed file or folder for the user.
 * @param  {string} extended Folder or file within the users public directory.
 * @return {string}          The full path to the file or folder within the users public folder.
 */
Scales.prototype.buildPath = function (extended) {

    var publicPath = Path.join(this.getRootPath(), '/public');

    if (typeof extended !== 'undefined' && extended !== null) {
        publicPath = Path.join(publicPath, Path.normalize(Querystring.unescape(extended)));
    }

    if (publicPath.indexOf(Config.global.basepath + this.config.user) !== 0) {

        Logger.error('API attempted to access a file outside of base directory ' + Config.global.basepath + this.config.user + '. Request denied.');
        return Path.join(this.getRootPath(), '/public');

    }

    return publicPath;

};

Scales.prototype.query = function () {

    try {

        if (this.status === ON) {

            this.plugin.queryServer();
            this.emit('query');

        }

    } catch (ex) {

        Logger.warn(Util.format('An exception occured while trying to handle server query for server %s', this.config.name), ex.stack);
    }

};

Scales.prototype.statistics = function () {};

/**
 * Returns information about the server.
 * @return {object} Returns an object containing the server status, plugin, query results, and proc stats.
 */
Scales.prototype.coreInfo = function () {

    return {
        'status': this.status,
        'plugin': this.plugin.name,
        'query': this.plugin.query,
        'proc': this.usageStatistics
    };

};

/**
 * Configures basic information for a new server on the node.
 * @param  {Object} res          The restify response object.
 * @param  {string} hash         [description]
 * @param  {string} password     [description]
 * @param  {string} build_params [description]
 * @return {bool}              [description]
 */
Scales.prototype.install = function (res, hash, password, build_params) {

    var self = this;
    Async.series([
        function (next) {

            Logger.verbose('Creating base config file for ' + self.config.name);
            fs.outputJson('data/' + s.config.name + '.json', self.config, function (err) {

                if (err) {

                    return next(err, 'Error occured while attempting to write server config to disk.');
                }

                next();

            });

        },
        function (next) {

            // Add the User
            Logger.verbose('Creating user ' + s.config.user + ' on the server.');
            proc.exec('./lib/scripts/create_user.sh ' + Config.global.basepath + ' ' + self.config.user + ' ' + password, function (err, stdout, stderr) {

                if (err) {

                    return next(err, 'Error occured trying to execute a command to add a user.');
                }

                Logger.verbose(stdout);
                Logger.verbose('User ' + self.config.user + ' created.');
                next();

            });

        },
        function (next) {

            // docker create -it --name pp-vanill_4o2fd -h docker -p 25566:25565 -m 256M -c 100 --blkio-weight=100 -v /home/pp-vanill_4o2fd/public:/data minecraft
            // Docker.createContainer({
            //     Image: 'minecraft',
            //     name: self.config.user,
            //     Mounts: [
            //         {
            //             Source: self.buildPath(),
            //             Destination: '/data'
            //         }
            //     ],
            //     HostConfig: {
            //         Memory: self.config.build.memory + 'm',
            //         MemorySwap: 0,
            //         CpuShares: self.config.build.cpu,
            //         Dns: ['8.8.8.8', '8.8.4.4']
            //     }
            // }, function (err, container) {
            //
            //     if (err) {
            //
            //         next(err, 'An error occured while attempting to create the Docker Container for this server.');
            //     }
            //
            //     next();
            //
            // });

        }
    ], function (err, response) {

        if (err) {

            Logger.error(response, err);
            res.send(500, { 'error': response });
        } else {

            Logger.verbose('Finished basic install process for new server, preparing to complete full install process.');
            res.send(204);
            // self.majorInstall(build_params);

        }

    });

};

Scales.prototype.majorInstall = function (build_params) {};

Scales.prototype.resetPassword = function (newPassword, res) {};

Scales.prototype.mergeJson = function (json, obj, overwrite, res) {};

Scales.prototype.delete = function (res) {};

module.exports = Scales;
