#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./create_user.sh /home/ username password
# ==============================

adduser --home $1$2 $2
echo username:$3 | chpasswd
usermod -G scalesuser $2

chown root:root $1$2
chmod 755 $1$2

cd $1$2
mkdir public backups
chown $2:scalesuser *