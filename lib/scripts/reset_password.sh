#!/bin/bash

# ==============================
# Scales User Management Script
# Written for Ubuntu Sysems
#
# ./reset_password.sh username new_password
# ==============================

echo -e "$2\n$2" | (passwd $1)