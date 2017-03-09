#!/bin/bash

echo Checking RPM database 

rpm -qa > /dev/null 2>&1  || rpm --rebuilddb

echo Install opel-release
if ! rpm -qa | grep -qw epel-release; then
    yum -y install epel-release;
fi
if ! rpm -qa | grep -qw certbot; then
    yum install -y certbot
fi

JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
wget --no-check-certificate "https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module" -O $JEM_SSL_MODULE_PATH
