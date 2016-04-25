# Scales
Scales — the flexible game management daemon built for PufferPanel.

[Documentation](http://scales.pufferpanel.com/docs) |
[API](http://scales.pufferpanel.com/docs/server) |
[Community Chat](https://webchat.esper.net/?nick=&channels=pufferpanel) |
[Community Forums](https://community.pufferpanel.com)

Scales is a game server management daemon, built specifically for use with PufferPanel. Scales can run game servers either directly on the system or inside docker containers, and supports a variety of servers including Minecraft, Spigot, Sponge, Forge, BungeeCord, PocketMine, and SRCDS.

### Installation
To install Scales for use with PufferPanel please follow [this guide](http://scales.pufferpanel.com/docs/getting-started). To manually install Scales you may use [this guide](http://scales.pufferpanel.com/docs/manually-installing-scales).


PufferPanel users should use the config.json created by the auto-deploy script or the one located in the panel. For those using Scales on its own here is an example config.json.

```
{
	"listen": {
		"sftp": 22,
		"rest": 5656
	},
	"urls": {
		"download": "http://192.168.1.2/auth/remote/download",
		"install": "http://192.168.1.2/auth/remote/install-progress"
	},
	"ssl": {
		"key": "https.key",
		"cert": "https.pem"
	},
	"basepath": "/home",
	"keys": [
		"e085947d-c683-4a73-9d09-2ce4fb331b9a"
	],
	"upload_maxfilesize": 100000000,
	"docker":  false 
}
```
