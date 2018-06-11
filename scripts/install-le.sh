#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";

echo Checking RPM database
{
  rpm -qa > /dev/null 2>&1  || rpm --rebuilddb
} &> /dev/null


echo "Installing required packages"
{
  yum -y install epel-release git bc;
  mkdir -p ${DIR}/opt
  [ ! -d "${DIR}/opt/letsencrypt" ] && git clone https://github.com/letsencrypt/letsencrypt ${DIR}/opt/letsencrypt;
  ${DIR}/opt/letsencrypt/letsencrypt-auto --os-packages-only

} &> /dev/null

[ -f "/usr/lib/jelastic/modules/ssl.module" ] && {
    JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
    JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
    localedef -i en_US -f UTF-8 en_US.UTF-8
    wget --no-check-certificate "${JEM_SSL_MODULE_LATEST_URL}" -O $JEM_SSL_MODULE_PATH
}

[ -d "/var/www/" ] && chown -R 700:700 "/var/www/" 2> /dev/null
exit 0
#test -f /usr/lib/jelastic/modules/ssl.module