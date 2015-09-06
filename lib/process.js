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

    return;

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
    if (typeof status !== 'undefined' && status === true) {
        this.setStatus(STOPPING); // Prevent crash detection
    }
    return Pty.spawn('docker', ['stop', this.config.user]);
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

    return Pty.spawn('docker', startupArray.match(/\S+/g));

};

Scales.prototype.powerOn = function (next) {

    var self = this;

    this.dockerInitalizeContainer(function (err) {

        if (err) {
            return;
        }

        self.ps = self.dockerExecuteServerStartup();

        self.ps.on('data', function (data) {
            console.log(data.toString());
        });

        self.ps.on('exit', function () {

            console.log('PROCESS EXITED');
            if (self.status === ON || self.status === STARTING) {

                self.emit('status', 'crashed');
                self.setStatus(CRASHED);
                self.emit('crashed');

            }

            if (self.status === STOPPING) {

                Logger.verbose('Server process stopped for ' + s.config.name);
                self.setStatus(OFF);
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

    this.on('off', function () {

        if (self.status !== OFF && self.status !== CRASHED) {
            Logger.verbose('Stopping server process for ' + s.config.name);
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
                self.emit('console', '[WARNING] This server has been detected as crashed by the management daemon. The restart process is being skipped due to the frequency at which this server is crashing (< 60 seconds between crashes).');
                return;
            }

            // Set time since last crash
            self.setLastCrash();

            Logger.warn('Server process for ' + self.config.name + ' killed after crash, server is now rebooting...');
            self.emit('console', '[WARNING] This server has been detected as crashed by the management daemon. Restarting now...');
            self.preflight();

        }

        if (logStream !== false) {
            logStream = false;
        }


    });

};

Scales.prototype.powerOff = function (next) {

    if (this.status !== OFF) {

        Logger.verbose('Stopping server process (pid: ' + this.ps.pid + ') for ' + this.config.name);
        this.setStatus(STOPPING);
        this.ps.write(this.plugin.stop + '\r');

    } else {

        // Allows the use of restart even if the server isn't on.
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
            s.powerOff(next);
        },
        function (next) {
            s.preflight();
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

Scales.prototype.query = function (s) {};

Scales.prototype.statistics = function (s) {};

/**
 * Returns information about the server.
 * @return {object} Returns an object containing the server status, plugin, query results, and proc stats.
 */
Scales.prototype.coreInfo = function () {

    return {
        'status': this.status,
        'plugin': this.plugin.name,
        'query': this.plugin.lastQuery,
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

            // docker run -it --name pp-vanill_4o2fd -h docker -p 25566:25565 -m 256M -c 100 --blkio-weight=100 -v /home/pp-vanill_4o2fd/public:/data minecraft bash
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
