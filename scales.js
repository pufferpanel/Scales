#!/usr/bin/env node
/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */

require('colors');
var Proc = require('child_process');
var Fs = require('fs-extra');

var getRunningPid = function (callback) {

    Fs.readFile(__dirname + '/scales.pid', {
        encoding: 'utf-8'
    }, function (err, text) {

        if (err) {
            return callback(err);
        }

        try {
            var pid = parseInt(text);
            process.kill(parseInt(pid), 0);
            return callback(undefined, pid);
        } catch (e) {
            return callback(e);
        }
    });
};

switch (process.argv[2]) {

    case 'start':
    {
        console.log('Starting Scales');

        getRunningPid(function (err, pid) {
            if (pid) {
                console.log('Process already running: ' + pid);
                process.exit(1);
            }

            Proc.fork(__dirname + '', {
                env: process.env
            });
        });

        break;
    }
    case 'stop':
    {
        console.log('Stopping Scales');
        getRunningPid(function (err, pid) {
            if (err) {
                console.error('Error reading PID, was Scales even running?', err.message);
            }

            process.kill(pid, 'SIGINT');

            var waiting = function () {
                try {
                    process.kill(pid, 0);
                    process.stdout.write('.');
                    setTimeout(waiting, 50);
                } catch (e) {
                    process.stdout.write('\n');
                }
            };
            waiting();
        });
        break;
    }
    case 'start':
    {
        console.log('Starting Scales');
        Proc.fork(__dirname, {
            env: process.env
        });
        break;
    }
    case 'debug':
    {
        console.log('Starting Scales with debug view');
        Proc.fork(__dirname, ['--consoleLevel=verbose', '--showMeta', '--nodaemon'], {
            env: process.env
        });
        break;
    }
    case 'status':
    {
        getRunningPid(function (err, pid) {
            if (err) {
                console.log('Scales is not running');
            } else {
                console.log('Scales is running (pid: ' + pid + ')');
            }
        });
        break;
    }
    default:
    {
        console.log('Scales - PufferPanel Daemon');
        console.log('Usage:');
        console.log('./scales {start|stop|status|debug}');
        console.log('    start  - Starts the Scales service');
        console.log('    stop   - Stops the Scales service');
        console.log('    status - Shows the status of the Scales service');
        console.log('    debug  - Run the Scales service in a debug view');
        break;
    }
}
