/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 */

function merge(join) {

	var base = [].slice.call(arguments, 1),
		vars = [],
		out = [];

	base.forEach(function(command) {

		for (var id in command) {
			vars[id] = command[id];
		}

	});

	for(var id in vars) {

		if(join.indexOf(id) == -1) {
			out.push(id, vars[id]);
		} else {
			out.push(id + vars[id]);
		}

	}

	return out.filter(function(ret) {
		return ret;
	});

}

exports.merge = merge;