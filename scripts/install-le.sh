#!/bin/bash

echo Checking RPM database 

rpm -qa > /dev/null 2>&1  || rpm --rebuilddb

echo Install opel-release
yum -y install epel-release git bc;

rpm -qa  | grep -q libcom_err || rpm -ivh https://downloads.hpdd.intel.com/public/e2fsprogs/1.42.12.wc1/el7/RPMS/x86_64/libcom_err-devel-1.42.12.wc1-4.el7.centos.x86_64.rpm;
[ ! -d '/opt/letsencrypt' ] && git clone https://github.com/letsencrypt/letsencrypt /opt/letsencrypt;

/opt/letsencrypt/letsencrypt-auto --os-packages-only


JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
wget --no-check-certificate "https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module" -O $JEM_SSL_MODULE_PATH
