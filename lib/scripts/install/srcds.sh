#!/bin/bash

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
useDocker="false"

while getopts ":b:u:d" opt; do
    case "$opt" in
    b)
        base=$OPTARG
        ;;
    u)
        username=$OPTARG
        ;;
    d)
        useDocker="true"
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

echo "installer:~$ rm -rf *"
rm -rf *
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

echo "installer:~$ steamcmd/steamcmd.sh +login anonymous +force_install_dir ${base}${username}/public +app_update $1 +quit"
steamcmd/steamcmd.sh +login anonymous +force_install_dir ${base}${username}/public +app_update $1 +quit
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

echo "installer:~$ chown -R ${username}:scalesuser * .steam"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ exit 0"
exit 0
