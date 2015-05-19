#!/bin/bash
#
# MCServer Installer
# Written for Ubuntu Sysems
#
# ./mcserver_install.sh -b /home/ -u username

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

if [ ! -d "${base}${username}/public" ]; then
    echo "The home directory for the user (${base}${username}/public) does not exist on the system."
    exit 1
fi;

cd ${base}${username}
mkdir temp
cd temp

echo "Cloning https://github.com/mc-server/MCServer.git into ${base}${username}/temp"
git clone https://github.com/mc-server/MCServer.git .
git submodule init
git submodule update

echo 'Preparing to build...'
mkdir Release
cd Release
cmake -DCMAKE_BUILD_TYPE=RELEASE ..

echo "Running 'make' to compile and build MCServer"
make

echo "Copying build files from ${base}${username}/temp/MCServer to ${base}${username}/public"
cd ${base}${username}/public
cp -R ${base}${username}/temp/MCServer/* .

echo "Fixing Permissions"
chown -R ${username}:scalesuser *

echo "Cleaning Up..."
rm -rf ${base}${username}/temp

echo "Exiting Installer"
exit 0