#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./srcds_install.sh username gameid
# ==============================

if [ ! -f "/srv/steamcmd/steamcmd.sh" ]; then

	mkdir -p /srv/steamcmd && cd /srv/steamcmd
	curl -O http://media.steampowered.com/installer/steamcmd_linux.tar.gz
	tar -xzvf steamcmd_linux.tar.gz && rm -rf steamcmd_linux.tar.gz

fi

cd /home/$1/public

# We run it like this to prevent a malicious user from changing the steamcmd.sh file, also keeps everything centralized for this.
/srv/steamcmd/steamcmd.sh +login anonymous +force_install_dir /home/$1/public +app_update $2 +quit

# Save SRCDS Run File for MD5 Checking
cp srcds_run ../

chown -R $1:scalesuser *

exit 0