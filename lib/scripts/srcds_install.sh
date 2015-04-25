#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./srcds_install.sh username gameid
# ==============================

# Allows enough time for PufferPanel to get the Feed
sleep 5

if [ ! -f "/srv/steamcmd/steamcmd.sh" ]; then

	mkdir -p /srv/steamcmd && cd /srv/steamcmd
	curl -O http://media.steampowered.com/installer/steamcmd_linux.tar.gz
	tar -xzvf steamcmd_linux.tar.gz && rm -rf steamcmd_linux.tar.gz

fi

cd /home/$1/public

mkdir steamcmd

cp -R /srv/steamcmd/* /home/$1/public/steamcmd

# mkdir -p .steam/sdk32
# cd .steam/sdk32
# ln -s /srv/steamcmd/linux32/steamclient.so

# SteamCMD is strange about the user who installs it and where it places some files.
su - $1 -c "cd public/steamcmd && ./steamcmd.sh +login anonymous +force_install_dir /home/$1/public +app_update $2 +quit 2>&1"

# Save SRCDS Run File for MD5 Checking
cp srcds_run ../

chown -R $1:scalesuser *

exit 0