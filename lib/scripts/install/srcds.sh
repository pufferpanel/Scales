#!/bin/bash

# ==============================
# SRCDS Server Installer
# Written for Ubuntu Sysems
#
# ./srcds_install.sh -b /home/ -u username gameid
# ==============================

function checkResponseCode() {
    if [ $? -ne 0 ]; then
        echo -e "An error occured while installing."
        exit 1
    fi
}

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root
base="/home/"

while getopts ":b:u:" opt; do
    case "$opt" in
    b)
        base=$OPTARG
        ;;
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

if [ ! -d "${base}${username}/public" ]; then
    echo "The home directory for the user (${base}${username}/public) does not exist on the system."
    exit 1
fi;

cd ${base}${username}/public
checkResponseCode

echo "installer:~$ mkdir steamcmd && cd steamcmd"
mkdir steamcmd && cd steamcmd
checkResponseCode

echo "installer:~$ curl -O http://media.steampowered.com/installer/steamcmd_linux.tar.gz"
curl -O http://media.steampowered.com/installer/steamcmd_linux.tar.gz
checkResponseCode

echo "installer:~$ tar -xzvf steamcmd_linux.tar.gz && rm -rf steamcmd_linux.tar.gz"
tar -xzvf steamcmd_linux.tar.gz && rm -rf steamcmd_linux.tar.gz
checkResponseCode

echo "installer:~$ cd ${base}${username}/public"
cd ${base}${username}/public
checkResponseCode

echo "installer:~$ chown -R ${username}:scalesuser *"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ chmod +x steamcmd.sh"
chmod +x steamcmd/steamcmd.sh
checkResponseCode

# SteamCMD is strange about the user who installs it and where it places some files.
echo "installer:~$ docker start ${username}"
docker start ${username}
checkResponseCode

echo "installer:~$ docker exec -it ${username} steamcmd/steamcmd.sh +login anonymous +force_install_dir /home/container +app_update $1 +quit"
docker exec -it ${username} steamcmd/steamcmd.sh +login anonymous +force_install_dir /home/container +app_update $1 +quit
checkResponseCode

echo "installer:~$ docker stop ${username}"
docker stop ${username}
checkResponseCode

# Save SRCDS Run File for MD5 Checking
echo "installer:~$ cd ${base}${username}/public"
cd ${base}${username}/public
checkResponseCode

echo "installer:~$ mkdir -p .steam/sdk32"
mkdir -p .steam/sdk32
checkResponseCode

echo "installer:~$ cp steamcmd/linux32/steamclient.so .steam/sdk32/steamclient.so"
cp -v steamcmd/linux32/steamclient.so .steam/sdk32/steamclient.so
checkResponseCode

echo "installer:~$ chown -R ${username}:scalesuser *"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ exit 0"
exit 0
