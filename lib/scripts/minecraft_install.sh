#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./srcds_install.sh username
# ==============================

cd /home/$1/public

curl -o server.jar https://s3.amazonaws.com/Minecraft.Download/versions/1.8.4/minecraft_server.1.8.4.jar

exit 0