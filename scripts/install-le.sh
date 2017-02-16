#!/bin/bash

echo Install opel-release
yum -y install epel-release;

yum install -y certbot

JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
wget --no-check-certificate "https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module" -O $JEM_SSL_MODULE_PATH
