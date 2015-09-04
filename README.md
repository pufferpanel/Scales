![](http://i.imgur.com/fLutaQ1.png)

# Scales
Scales — the flexible game management daemon built for PufferPanel.

This is an alpha build of Scales 0.2.0 which changes the entire methodology for how Scales manages servers. This version will leverage Docker to contain servers within their own container to prevent users from being able to access the root file system or other user data. Docker also allows us to put stricter limits on resource usage for servers, and ensure that rogue programs cannot allocate ports and IPs that are not assigned and impact other users. Docker also allows easier suspension of services and general management.

[![Dependency Status](https://david-dm.org/PufferPanel/Scales/docker.svg?style=flat-square)](https://david-dm.org/PufferPanel/Scales/docker)
[![devDependency Status](https://david-dm.org/PufferPanel/Scales/docker/dev-status.svg?style=flat-square)](https://david-dm.org/PufferPanel/Scales/docker#info=devDependencies)
