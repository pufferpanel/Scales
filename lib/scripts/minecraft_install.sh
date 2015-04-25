#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./srcds_install.sh username [-r remote_link -d]
# ==============================

# Allows enough time for PufferPanel to get the Feed
sleep 5

cd /home/$1/public

remote=false
decompress=false

while getopts "rd" opt; do
    case "$opt" in
	r)
		remote=$OPTARG;
		;;
	d)
		decompress=true;
	esac
done

if [ "$remote" = false ]; then

	echo "Downloading Remote File..."
	echo "https://s3.amazonaws.com/Minecraft.Download/versions/1.8.4/minecraft_server.1.8.4.jar"
	curl -o server.jar https://s3.amazonaws.com/Minecraft.Download/versions/1.8.4/minecraft_server.1.8.4.jar

else

	if [ "$decompress" = true ]; then

		echo 'Downloading Remote File...'
		echo remote
		curl -o download.zip remote

		if [ file --mime-type "download.zip" | grep -q zip$ ]; then

			echo 'Unzipping downloaded file...'
			unzip download.zip

		elif [ file --mime-type "download.zip" | grep -q gzip$ ]; then

			echo 'Decompressing downloaded tarGZ file...'
			tar -xzvf download.zip

		fi

	else

		echo 'Downloading Remote File...'
		echo remote
		curl -O remote

	fi

fi

echo 'Fixing permissions for file.'
chown -R $1:scalesuser *

exit 0