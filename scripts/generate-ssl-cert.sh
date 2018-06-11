#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";

[ -f "${DIR}/opt/letsencrypt/settings"  ] && source "${DIR}/opt/letsencrypt/settings" || { echo "No settings available" ; exit 3 ; }
[ -f "${DIR}/root/validation.sh"  ] && source "${DIR}/root/validation.sh" || { echo "No validation library available" ; exit 3 ; }

#To be sure that r/w access
mkdir -p /etc/letsencrypt/
#chown -R jelastic:jelastic /etc/letsencrypt/

cd "${DIR}/opt/letsencrypt"
git reset --hard
git pull origin master

iptables -I INPUT -p tcp -m tcp --dport 9999 -j ACCEPT
iptables -t nat -I PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 9999

#Parameters for test certificates
test_params='';
[ "$test" == "true" ] && { test_params='--test-cert --break-my-certs '; }

#Validate settings
validateExtIP
validateDNSSettings
validateCertBot

#Kill hanged certificate requests
killall -9 letsencrypt-auto > /dev/null 2>&1
killall -9 letsencrypt > /dev/null 2>&1

mkdir -p $DIR/var/log/letsencrypt

#Request for certificates
$DIR/opt/letsencrypt/letsencrypt-auto certonly --standalone $test_params --domain $domain --preferred-challenges http-01 --http-01-port 9999 --renew-by-default --email $email --agree-tos --logs-dir $DIR/var/log/letsencrypt

iptables -t nat -D PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 9999
iptables -D INPUT -p tcp -m tcp --dport 9999 -j ACCEPT

#To be sure that r/w access
mkdir -p /tmp/
chmod -R 777 /tmp/
appdomain=$(cut -d"." -f2- <<< $appdomain)

certdir=$(sed -nr '/^[[:digit:]-]{10} [[:digit:]:]{8},[[:digit:]]+:.*:[[:alnum:]\.]*:Reporting to user: Congratulations![[:alnum:][:space:]].*$/{n;p}' $DIR/var/log/letsencrypt/letsencrypt.log | sed  's/\/[[:alpha:]]*.pem//'| tail -n 1 )

mkdir -p $DIR/var/lib/jelastic/keys/
rm -f $DIR/var/lib/jelastic/keys/*.pem

[ ! -z $certdir ] && cp -f $certdir/* $DIR/var/lib/jelastic/keys/ && chown jelastic -R $DIR/var/lib/jelastic/keys/

function uploadCerts() {
    local certdir="$1"
    echo appid = $appid
    echo appdomain = $appdomain
    #Upload 3 certificate files
    uploadresult=$(curl -F "appid=$appid" -F "fid=privkey.pem" -F "file=@${certdir}/privkey.pem" -F "fid=fullchain.pem" -F "file=@${certdir}/chain.pem" -F "fid=cert.pem" -F "file=@${certdir}/cert.pem" http://$primarydomain/xssu/rest/upload)

    #Save urls to certificate files
    echo $uploadresult | awk -F '{"file":"' '{print $2}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/privkey.url
    echo $uploadresult | awk -F '{"file":"' '{print $3}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/fullchain.url
    echo $uploadresult | awk -F '{"file":"' '{print $4}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/cert.url

    sed -i '/^\s*$/d' /tmp/*.url
    exit 0;
}

set -e;
validateCustomSSL || true;
[ $? -eq 0 ] && { set +e && uploadCerts $certdir; }