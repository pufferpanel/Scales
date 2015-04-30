#!/bin/bash

# ==============================
# SRCDS Server Installer
# Written for Ubuntu Sysems
#
# ./srcds_install.sh -u username gameid
# ==============================

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root

while getopts ":u:" opt; do
    case "$opt" in
    u)
        username=$OPTARG
        ;;
    esac
done

if [ "${username}" == "root" ]; then

    echo "WARNING: Invalid Username Supplied."
    exit 1

fi;

shift $((OPTIND-1))

if [ ! -f "/srv/steamcmd/steamcmd.sh" ]; then

	mkdir -p /srv/steamcmd && cd /srv/steamcmd
	curl -O http://media.steampowered.com/installer/steamcmd_linux.tar.gz
	tar -xzvf steamcmd_linux.tar.gz && rm -rf steamcmd_linux.tar.gz

fi

cd /home/${username}/public

mkdir steamcmd

cp -R /srv/steamcmd/* /home/${username}/public/steamcmd
chown -R ${username}:scalesuser *

# mkdir -p .steam/sdk32
# cd .steam/sdk32
# ln -s /srv/steamcmd/linux32/steamclient.so

# SteamCMD is strange about the user who installs it and where it places some files.
su - ${username} -c "cd public/steamcmd && ./steamcmd.sh +login anonymous +force_install_dir /home/${username}/public +app_update $2 +quit 2>&1"

# Save SRCDS Run File for MD5 Checking
cd /home/${username}
cp public/srcds_run .

chown -R ${username}:scalesuser *

exit 0