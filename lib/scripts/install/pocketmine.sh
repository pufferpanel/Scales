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
pocketVersion="stable"
base="/home/"

while getopts ":b:u:v:" opt; do
    case "$opt" in
    b)
        base=$OPTARG
        ;;
	v)
		pocketVersion=$OPTARG
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

echo "installer:~$ cd ${base}${username}/public"
cd ${base}${username}/public
checkResponseCode

echo "installer:~$ rm -rf *"
rm -rf *
checkResponseCode

echo "installer:~$ curl -L -o install.sh https://get.pocketmine.net/"
curl -L -o install.sh https://get.pocketmine.net/
checkResponseCode

echo "installer:~$ chmod +x installer.sh"
chmod +x install.sh
checkResponseCode

echo "installer:~$ docker start ${username}"
docker start ${username}
checkResponseCode

echo "installer:~$ docker exec -it ${username} ./installer.sh -v ${pocketVersion}"
docker exec -it ${username} ./install.sh -v ${pocketVersion}
checkResponseCode

echo "installer:~$ docker stop ${username}"
docker stop ${username}
checkResponseCode

echo "installer:~$ chown -R ${username}:scalesuser *"
chown -R ${username}:scalesuser *
checkResponseCode

echo "installer:~$ exit 0"
exit 0
