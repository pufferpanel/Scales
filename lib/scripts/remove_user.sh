#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./remove_user.sh /home/ username
# ==============================

userdel $2
rm -rf $1$2