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
var Extend = require('node.extend');
var Request = require('request');

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

    var self = this;
    Async.series({
        permissions: function (next) {
            Proc.exec(Util.format('chown -R %s:scalesuser %s', self.config.user, self.buildPath()), function (err, stdout, stderr) {

                if (err) {

                    Logger.error('Unable to complete preflight for server ' + self.config.name + ' due to a permissions error.', stdout);
                    return next(stderr);
                }

                Logger.verbose('Completed permissions preflight for server ' + self.config.name);
                return next();

            });
        },
        preflight: function (next) {
            self.plugin.preflight(next);
        },
        startup: function (next) {
            self.powerOn(next);
        }
    }, function (err, response) {

        if (results.preflight && results.preflight === 1) {

            // User needs to restart server
            Async.series([
                function (next) {
                    self.powerOff(next);
                },
                function (next) {
                    self.emit('console', '\n==============================================\n');
                    self.emit('console', '          PUFFERPANEL STARTUP NOTICE          \n');
                    self.emit('console', '==============================================\n');
                    self.emit('console', 'Please restart your server now to officially start it.\nWe needed to generate some server files\nbefore we could run this server for you.');
                }
            ]);

        }

        if (err) {
            Logger.error(err);
            self.emit('console', '[ERROR] ' + err);
        }

    });

};

/**
 * Ensures that Docker Container is started.
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
Scales.prototype.dockerInitalizeContainer = function (next) {

    var self = this;
    Proc.exec(Util.format('docker start %s', this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to start docker container for %s', self.config.user), stderr);
            return next(err);
        }

        return next();
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
Scales.prototype.dockerDetachContainer = function (status, next) {

    var self = this;
    if (typeof status !== 'undefined' && status === true) {
        this.setStatus(STOPPING); // Prevent crash detection
    }

    Proc.exec(Util.format('docker stop %s', this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to stop docker container for %s', self.config.name), stderr);
            return next(stderr);
        }

        Logger.verbose(Util.format('Detached docker container for server %s', self.config.name), stdout);
        return next(null);

    });
};

/**
 * Kills a running docker container.
 * @param  {string} signal The signal to kill the running container with.
 * @return {[type]}        [description]
 */
Scales.prototype.dockerKillContainer = function (signal) {

    var self = this;
    if (typeof signal === 'undefined') {
        signal = 9;
    }

    Proc.exec(Util.format('docker kill -s %d %s', signal, this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to kill docker container for %s', self.config.name), stderr);
            return;
        }

        Logger.verbose(Util.format('Killed docker container for server %s', self.config.name), stdout);

    });

};

/**
 * Deletes a Docker Container.
 * @param  {string} signal The signal to kill the running container with.
 * @return {[type]}        [description]
 */
Scales.prototype.dockerDeleteContainer = function (next) {

    var self = this;

    Proc.exec(Util.format('docker rm -vf %s', this.config.user), function (err, stdout, stderr) {

        if (err || stderr) {

            Logger.error(Util.format('An error occured attempting to delete docker container for %s', self.config.name), stderr);
            return next(err);

        }

        Logger.verbose(Util.format('Deleted docker container for server %s', self.config.name), stdout);
        return next(null);

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

                            self.logStream = Fs.createWriteStream(self.buildPath(self.plugin.settings.log), {
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
                    self.queryServerInterval = setInterval(self.query, 10000);
                    Logger.verbose(Util.format('Server %s successfully started.', self.config.name));

                }

            }

        });

        // Emitted when the PTY exits
        self.ps.on('exit', function () {

            self.dockerDetachContainer(false, function (err) {

                // @TODO: How do we even handle a detachDockerContainer error?
                // If it won't detach we have an issue.
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

    });

    this.on('crashed', function () {

        if (self.status === CRASHED) {

            Logger.warn('Attempting to kill crashed process (pid: ' + self.ps.pid + ') for server ' + self.config.name);
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
        clearInterval(self.queryServerInterval);

        self.usageStatistics = {};
        self.plugin.query = {};

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

        if (self.logStream !== false) {
            self.logStream = false;
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
            return next();
        }

    }

    this.on('off', function () {

        if (typeof next !== 'undefined') {
            return next();
        }

    });

};

Scales.prototype.powerCycle = function () {

    // @TODO: This is super broken. It will randomly just not restart the server.
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

Scales.prototype.kill = function () {

    if (typeof this.ps !== 'undefined' && typeof this.ps.pid !== 'undefined') {

        this.dockerKillContainer();
        this.emit('off');

    }

};

Scales.prototype.console = function (data) {

    // Server is already stopping or stopped, don't send the data.
    if ([OFF, STOPPING].indexOf(this.status) >= 0) {
        return false;
    }

    // Prevent Scales from thinking server has crashed if user sends stop command
    if (data === this.plugin.settings.stop) {
        this.setStatus(STOPPING);
    }

    this.ps.write(data + '\r');

};

Scales.prototype.listDirectory = function (base) {

    var directory = this.buildPath(base);
    var files = [];

    if (!Fs.existsSync(directory)) {
        return false;
    }

    Fs.readdirSync(directory).forEach(function (filename) {

        stat = Fs.statSync(Path.join(directory, filename));
        files.push({
            'name': filename,
            'created': stat.ctime,
            'modified': stat.mtime,
            'size': stat.size,
            'file': stat.isFile(),
            'symlink': stat.isSymbolicLink()
        });

    });

    return files;

};

Scales.prototype.returnFile = function (base) {

    var filepath = this.buildPath(base);

    if (!Fs.existsSync(filepath) || !Fs.statSync(filepath).isFile()) {
        return false;
    }

    return Fs.readFileSync(filepath, 'UTF-8');

};

Scales.prototype.writeFile = function (base, contents) {

    var filepath = this.buildPath(base);

    try {
        Fs.outputFileSync(filepath, contents);
        return true;
    } catch (ex) {
        Logger.error(Util.format('An exception occured while trying to write a file to %s for %s', filepath, this.config.name), ex.stack);
        return false;
    }

};

Scales.prototype.deleteFile = function (base) {

    var filepath = this.buildPath(base);

    try {
        Fs.removeSync(filepath);
        return true;
    } catch (ex) {
        Logger.error(Util.format('An exception occured while trying to delete %s for %s', filepath, this.config.name), ex.stack);
        return false;
    }

};

Scales.prototype.logContents = function (parseLines) {

    var out = '';
    var lines = '';

    try {
        lines = Fs.readFileSync(this.buildPath(this.plugin.settings.log)).toString().split('\n');
    } catch (ex) {
        console.log(this.buildPath(this.plugin.settings.log));
        console.log(ex.stack);
        // Logger.warn(Util.format('No log was found to read from for %s', this.config.name), ex.stack);
        return 'No log was found to read from. [' + this.plugin.settings.log + ']';
    }

    parseLines = parseInt(parseLines) + parseInt(1);
    parseLines = (parseLines < 0) ? 1 : parseLines;
    for (i = lines.length - parseLines; i < lines.length; i++){
        if (lines[i] !== undefined) {
            out += lines[i] + '\n';
        }
    }

    return out.trim() + '\n';

};

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

    if (publicPath.indexOf(Path.join(Config.global.basepath, this.config.user, 'public')) !== 0) {

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
        'plugin': this.plugin.settings.name,
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
            Fs.outputJson('./data/' + self.config.name + '.json', self.config, function (err) {

                if (err) {

                    return next(err, 'Error occured while attempting to write server config to disk.');
                }

                return next();

            });

        },
        function (next) {

            // Add the User
            Logger.verbose('Creating user ' + self.config.user + ' on the server.');
            Proc.exec(Util.format('./lib/scripts/create_user.sh %s %s %s', Config.global.basepath, self.config.user, password), function (err, stdout, stderr) {

                if (err) {

                    return next(err, 'Error occured trying to execute a command to add a user.');
                }

                Logger.verbose(stdout);
                Logger.verbose('User ' + self.config.user + ' created.');
                return next();

            });

        }
    ], function (err, response) {

        if (err) {

            Logger.error(response, err);
            res.send(500, { 'error': response });
        } else {

            Logger.verbose('Finished basic install process for new server, preparing to complete full install process.');
            res.send(204);
            self.majorInstall(build_params);

        }

    });

};

Scales.prototype.majorInstall = function (buildParams) {

    var self = this;
    var processParams = [];
    var dockerProcessParams = [];
    var dockerUserInfo;

    Async.series([
        function (next) {
            Proc.exec(Util.format('stat -c \'%u:%g\' %s', self.buildPath()), function (err, stdout, stderr) {

                if (err || stderr) {
                    Logger.error('An error occured while trying to determine user information for a docker container.', stderr);
                    return next(err);
                }

                dockerUserInfo = stdout.replace('\n', '');
                return next();

            });
        },
        function (next) {

            // Add Docker Container
            Logger.verbose(Util.format('Creating docker container for %s. This could take a few minutes if the container images are not on the server already.', self.config.name));
            dockerProcessParams = [
                'create',
                '-it',
                '--name',
                self.config.user,
                '-h',
                'docker',
                '-p',
                self.config.gamehost + ':' + self.config.gameport + ':' + (self.plugin.settings.ports.listen || 8080),
                '-m',
                self.config.build.memory + 'M',
                '-c',
                self.config.build.cpu,
                '--blkio-weight=' + (self.config.build.io || 500),
                '-u',
                dockerUserInfo,
                '-v',
                self.buildPath() + ':/home/container',
                'pufferpanel/' + self.config.plugin
            ];

            var dockerProcess = Pty.spawn('docker', dockerProcessParams);

            dockerProcess.on('data', function (data) {
                self.emit('installer', StripANSI(data));
            });

            dockerProcess.on('exit', function () {

                Logger.verbose(Util.format('Successfully added a new docker container for %s.', self.config.name));
                return next();

            });

        },
        function (next) {

            if (typeof self.plugin.settings.install_script === undefined) {
                return next('no script');
            }

            return next();

        },
        function (next) {

            Logger.verbose('Running major installer process for ' + self.config.name + ' which could take a few minutes to complete. Do not stop Scales during this process.');

            if (typeof buildParams !== undefined && buildParams !== '' && buildParams) {
                processParams = Util.format('-b %s -u %s %s', Config.global.basepath, self.config.user, buildParams).match(/\S+/g);
            } else {
                processParams = Util.format('-b %s -u %s', Config.global.basepath, self.config.user).match(/\S+/g);
            }

            var installerProcess = Pty.spawn('./lib/scripts/' + self.plugin.settings.install_script, processParams);

            installerProcess.on('data', function (data) {
                self.emit('installer', StripANSI(data));
            });

            installerProcess.on('exit', function () {

                Logger.verbose('Installer process has completed for for ' + self.config.name);
                next();

            });

        }
    ], function (err) {

        if (err && err !== 'no script') {

            // Error (todo: add graceful fallback to PP to alert admins)
            Logger.error('Unable to complete the installer process. Hanging server until this is looked at...');
            self.emit('installer', 'error: unable to contact remote service to alert to completed install process.');

        } else {

            // Update PufferPanel
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
            Request.post({
                url: Config.global.urls.install,
                formData: {
                    server: self.config.name
                }
            }, function onFinish (err, httpResponse, body) {

                if (err) {
                    return Logger.error('Failed to alert PufferPanel of completed install status. [PufferPanel said: ' + body + ']', err);
                }

                self.emit('installer', 'Install completed successfully.');
                Logger.verbose('Major install process completed and PufferPanel notified.');

            });

        }

    });

};

Scales.prototype.resetPassword = function (newPassword, res) {

    var self = this;
    Logger.verbose(Util.format('Resetting account SFTP password for %s', this.config.user));

    Proc.exec(Util.format('./lib/scripts/reset_password.sh %s %s', self.config.user, newPassword), function (err, stdout, stderr) {

        if (err) {

            Logger.error('Error occured trying to reset account password for ' + s.config.user + ' on the server.', stderr);
            res.send(500);
        } else {

            Logger.verbose(Util.format('SFTP password for %s was reset.', self.config.user));
            res.send(204);
        }

    });

};

/**
 * Merges two JSON structures for the Server Data
 * Deprecated as of v0.2.0, please use Scales.prototype.updateConfig();
 * @deprecated since Scales version 0.2.0; PufferPanel version 0.9.0
 * @param  {[type]} json      [description]
 * @param  {[type]} obj       [description]
 * @param  {[type]} overwrite [description]
 * @param  {[type]} res       [description]
 * @return {[type]}           [description]
 */
Scales.prototype.mergeJson = function (json, obj, overwrite, res) {

    var finalObject = this.config;
    var self = this;

    if (!obj) {

        if (!overwrite) {
            finalObject = Extend({}, this.config, JSON.parse(json));
        } else {
            finalObject = JSON.parse(json);
        }

    } else {

        var object = obj.split(':');
        if (object[1] !== undefined) {
            finalObject = this.config[object[1]];
        }

        if (!overwrite) {
            finalObject[object[0]] = Extend({}, this.config[object[0]], JSON.parse(json));
        } else {
            finalObject[object[0]] = JSON.parse(json);
        }

    }

    Fs.writeFile('./data/' + this.config.name + '.json', JSON.stringify(finalObject, null, 4), function (err) {

        if (err) {

            Logger.error('An error occured while trying to update the config for a server.', err);
            res.send(500);
        } else {

            Logger.verbose('Config for server ' + self.config.name + ' has been updated by a remote source.');
            self.config = finalObject;
            res.send(204);
        }

    });

};

/**
 * Replaces deprecated mergeJson function.
 * @param  {[type]} json [description]
 * @return {[type]}      [description]
 */
Scales.prototype.updateConfig = function (json) {

};

Scales.prototype.delete = function (res) {

    if (this.status !== OFF) {
        this.kill();
    }

    var self = this;

    Async.series([
        function (next) {
            Proc.exec(Util.format('./lib/scripts/remove_user.sh %s %s', Config.global.basepath, self.config.user), function (err, stdout, stderr) {

                if (err) {

                    Logger.error('Error occured trying to execute a command to remove a user.', stderr);
                    return next('Error occured trying to execute a command to remove a user.');
                }

                Logger.verbose(Util.format('User %s was deleted from the system.', self.config.user));
                return next();

            });
        },
        function (next) {

            Fs.remove('./data/' + self.config.name + '.json', function (err) {

                if (err) {

                    Logger.error('An error occured while trying to remove the server data JSON file.', err);
                    return next(err);
                }

                return next();

            });

        }
    ], function (err) {

        if (err) {
            res.send(500, { 'message': error });
        } else {
            self.dockerDeleteContainer(function (err) {
                res.send(204);
            });
        }

    });

};

module.exports = Scales;
