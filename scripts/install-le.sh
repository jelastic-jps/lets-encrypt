#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";
WGET=$(which wget);
RAW_REPO_SCRIPS_URL="https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/scripts/"

echo Checking RPM database
{
  rpm -qa > /dev/null 2>&1  || rpm --rebuilddb
} &> /dev/null


echo "Installing required packages"
{
  yum-config-manager --save --setopt=\*.retries=5 --setopt=\*.skip_if_unavailable=true --setopt=\*.timeout=5
  yum -y install epel-release git bc nss;
  yum -y install tinyproxy --enablerepo='epel';
  
  mkdir -p ${DIR}/opt;
  [ ! -d "${DIR}/opt/letsencrypt" ] && git clone https://github.com/certbot/certbot ${DIR}/opt/letsencrypt;
  cd $DIR/opt/letsencrypt/
  git reset --merge
  git checkout 02a5d000cb1684619650677a2d3fa4972dfd576f
  ${DIR}/opt/letsencrypt/letsencrypt-auto --os-packages-only
}

[ ! -f "${DIR}/root/validation.sh" ] && {
    $WGET --no-check-certificate $RAW_REPO_SCRIPS_URL/validation.sh -O ${DIR}/root/validation.sh
    chmod +x ${DIR}/root/validation.sh
}

[ -f "/usr/lib/jelastic/modules/ssl.module" ] && {
    JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
    JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
    localedef -i en_US -f UTF-8 en_US.UTF-8
    wget --no-check-certificate "${JEM_SSL_MODULE_LATEST_URL}" -O $JEM_SSL_MODULE_PATH

    grep -q '^jelastic:' /etc/passwd && JELASTIC_UID=$(id -u jelastic) || JELASTIC_UID="700"
    [ -d "/var/www/" ] && chown ${JELASTIC_UID}:${JELASTIC_UID} /var/www/ /var/www/* 2> /dev/null
}

exit 0
