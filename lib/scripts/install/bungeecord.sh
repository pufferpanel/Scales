#!/bin/bash

function checkResponseCode() {
    if [ $? -ne 0 ]; then
        echo -e "An error occurred while installing."
        exit 1
    fi
}

# Allows enough time for PufferPanel to get the Feed
sleep 5

username=root
bungeeVersion="lastSuccessfulBuild"
base="/home/"
useDocker="false"

while getopts ":b:u:v:d" opt; do
    case "$opt" in
    b)
        base=$OPTARG
        ;;
	v)
		bungeeVersion=$OPTARG
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

echo "installer:~$ cd ${base}${username}/public"
cd ${base}${username}/public
checkResponseCode

echo "installer:~$ rm -rf *"
rm -rf *
checkResponseCode

echo "installer:~$ curl -o BungeeCord.jar http://ci.md-5.net/job/BungeeCord/${bungeeVersion}/artifact/bootstrap/target/BungeeCord.jar"
curl -o BungeeCord.jar http://ci.md-5.net/job/BungeeCord/${bungeeVersion}/artifact/bootstrap/target/BungeeCord.jar
checkResponseCode

echo "installer:~$ chown -R ${username}:scalesuser *"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ exit 0"
exit 0
