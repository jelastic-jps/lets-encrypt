#!/bin/bash

domain=$1
email=$2
appid=$3
appdomain=$4

#To be sure that r/w access
mkdir -p /etc/letsencrypt/
chmown -R jelastic:jelastic /etc/letsencrypt/

cd /opt/letsencrypt
git pull origin master

iptables -I INPUT -p tcp -m tcp --dport 9999 -j ACCEPT
iptables -t nat -I PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 9999

#Request for certificates - breaks certs
./letsencrypt-auto certonly --standalone --test-cert --break-my-certs $domain --standalone-supported-challenges http-01 --http-01-port 9999 --renew-by-default --email $email --agree-tos
#Request for certificates - valid certs
#./letsencrypt-auto certonly --standalone $domain --standalone-supported-challenges http-01 --http-01-port 9999 --renew-by-default --email $email --agree-tos

iptables -t nat -D PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 9999
iptables -D INPUT -p tcp -m tcp --dport 9999 -j ACCEPT

certdir=$(sed -nr '/^[[:digit:]-]{10} [[:digit:]:]{8},[[:digit:]]+:INFO:[[:alnum:]\.]*:Reporting to user: Congratulations![[:alnum:][:space:]]*([^[:blank:]]+)[/][^/[[:blank:]]+[.][[:alnum:][:space:]]*.*$/{s//\1/p}' /var/log/letsencrypt/letsencrypt.log | tail -n 1)

echo "------\n"
echo $certdir
echo "\n------"

#installing ssl cert via JEM
sed -i '/function doDownloadKeys/a return 0;#letsenctemp' /usr/lib/jelastic/modules/keystore.module
jem ssl install
sed -i  '/letsenctemp/d' /usr/lib/jelastic/modules/keystore.module
