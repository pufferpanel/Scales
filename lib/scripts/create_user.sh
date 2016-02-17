#!/bin/bash

useradd -m -d $1/$2 -s /bin/false -p $(openssl passwd -1 $3) $2
usermod -G scalesuser $2

chown root:$2 $1/$2
chmod 775 $1/$2

mkdir $1/$2/public $1/$2/backups
chown $2:$2 $1/$2/*
