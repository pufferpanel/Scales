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
var Util = require('util');
var Events = require('events');
var Path = require('path');
var Querystring = require('querystring');
var DockerConnection = require('dockerode');
var Docker = new DockerConnection(); // https://github.com/apocas/dockerode

// Set Power Variables
var OFF = 0;
var ON = 1;
var STOPPING = 2;
var STARTING = 3;
var CRASHED = 4;

var Scales = function (config) {

    this.status = 0;
    this.config = config;
    this.usageStatistics = {};
    this.lastCrash = 0;
    this.container = {};
    this.container = Docker.getContainer(this.config.docker.containerId);

    var Plugin = Rfr('lib/plugins/' + this.config.plugin + '.js');
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
    this.plugin.preflight();
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

Scales.prototype.powerOn = function (next) {

    // Add Docker Logic
    this.container.inspect(function (err, data) {
        console.log(err);
        console.log(data);
    });

};

Scales.prototype.powerOff = function (next) {};

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
 * Returns information about the Docker Container for the server.
 * @param {callback} next
 * @return {object}
 */
Scales.prototype.dockerContainerInfo = function (next) {

    this.container.inspect(function (err, data) {

        if (err) {

            Logger.error(err);
            return next(err);
        }

        return next(null, data);

    });

};

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

            Docker.createContainer({
                Image: 'minecraft',
                name: self.config.user,
                Mounts: [
                    {
                        Source: self.buildPath(),
                        Destination: '/data'
                    }
                ],
                HostConfig: {
                    Memory: self.config.build.memory + 'm',
                    MemorySwap: 0,
                    CpuShares: self.config.build.cpu,
                    Dns: ['8.8.8.8', '8.8.4.4']
                }
            }, function (err, container) {

                if (err) {

                    next(err, 'An error occured while attempting to create the Docker Container for this server.');
                }

                next();

            });

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
