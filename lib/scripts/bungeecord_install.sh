#!/bin/bash
#
# Minecraft Installer
# Written for Ubuntu Sysems
#
# ./minecraft_install.sh -u username [-v version]

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root
bungeeVersion="lastSuccessfulBuild"

while getopts ":u:v:" opt; do
    case "$opt" in
	v)
		bungeeVersion=$OPTARG
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


cd /home/$username/public

echo "Retrieving Remote Files..."
echo "http://ci.md-5.net/job/BungeeCord/${bungeeVersion}/artifact/bootstrap/target/BungeeCord.jar"
curl -o BungeeCord.jar http://ci.md-5.net/job/BungeeCord/${bungeeVersion}/artifact/bootstrap/target/BungeeCord.jar

echo 'Fixing permissions for downloaded files...'
chown -R ${username}:scalesuser *

echo 'Exiting Installer'
exit 0