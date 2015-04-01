#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./create_user.sh /home/ username password
# ==============================

useradd -m -d $1$2 -p $(openssl passwd -1 $3) $2
usermod -G scalesuser $2

chown root:root $1$2
chmod 755 $1$2

cd $1$2
mkdir public backups
chown $2:scalesuser *