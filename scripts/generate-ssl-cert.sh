#!/bin/bash

[ -f '/opt/letsencrypt/settings'  ] && source '/opt/letsencrypt/settings' || { echo "No settings available" ; exit 3 ; }
[ -f '/root/validation.sh'  ] && source '/root/validation.sh' || { echo "No validation library available" ; exit 3 ; }
 
#To be sure that r/w access
mkdir -p /etc/letsencrypt/
#chown -R jelastic:jelastic /etc/letsencrypt/

cd /opt/letsencrypt
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

#Request for certificates
/opt/letsencrypt/letsencrypt-auto certonly --standalone $test_params --domain $domain --preferred-challenges http-01 --http-01-port 9999 --renew-by-default --email $email --agree-tos

iptables -t nat -D PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 9999
iptables -D INPUT -p tcp -m tcp --dport 9999 -j ACCEPT

#To be sure that r/w access
mkdir -p /tmp/
chmod -R 777 /tmp/
appdomain=$(cut -d"." -f2- <<< $appdomain)

certdir=$(sed -nr '/^[[:digit:]-]{10} [[:digit:]:]{8},[[:digit:]]+:.*:[[:alnum:]\.]*:Reporting to user: Congratulations![[:alnum:][:space:]].*$/{n;p}' /var/log/letsencrypt/letsencrypt.log | sed  's/\/[[:alpha:]]*.pem//'| tail -n 1 )

rm -f /var/lib/jelastic/keys/*.pem

[ ! -z $certdir ] && cp -f $certdir/* /var/lib/jelastic/keys/ && chown jelastic -R /var/lib/jelastic/keys/

echo appid = $appid
echo appdomain = $appdomain
#Upload 3 certificate files
uploadresult=$(curl -F "appid=$appid" -F "fid=privkey.pem" -F "file=@${certdir}/privkey.pem" -F "fid=fullchain.pem" -F "file=@${certdir}/chain.pem" -F "fid=cert.pem" -F "file=@${certdir}/cert.pem" http://$primarydomain/xssu/rest/upload)

#Save urls to certificate files
echo $uploadresult | awk -F '{"file":"' '{print $2}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/privkey.url
echo $uploadresult | awk -F '{"file":"' '{print $3}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/fullchain.url
echo $uploadresult | awk -F '{"file":"' '{print $4}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/cert.url

JEM_SSL_MODULE_LATEST_URL="https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module"
JEM_SSL_MODULE_PATH="/usr/lib/jelastic/modules/ssl.module"
localedef -i en_US -f UTF-8 en_US.UTF-8
wget --no-check-certificate "https://raw.githubusercontent.com/jelastic/jem/master/usr/lib/jelastic/modules/ssl.module" -O $JEM_SSL_MODULE_PATH

sed -i '/^\s*$/d' /tmp/*.url

#installing ssl cert via JEM
#sed -i '/function doDownloadKeys/a return 0;#letsenctemp' /usr/lib/jelastic/modules/keystore.module
#jem ssl install
#sed -i  '/letsenctemp/d' /usr/lib/jelastic/modules/keystore.module
