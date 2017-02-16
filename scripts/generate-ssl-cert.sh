#!/bin/bash

iptables -I INPUT -p tcp -m tcp --dport 9999 -j ACCEPT
iptables -t nat -I PREROUTING -p tcp -m tcp --dport 443 -j REDIRECT --to-ports 9999

#Parameters for test certificates
test_params='';
[ "$test" == "true" ] && { test_params='--test-cert --break-my-certs '; }

#Request for certificates
certbot certonly --standalone $test_params --domain $domain --preferred-challenges tls-sni-01 --tls-sni-01-port 9999 --renew-by-default --email $email --agree-tos

iptables -t nat -D PREROUTING -p tcp -m tcp --dport 443 -j REDIRECT --to-ports 9999
iptables -D INPUT -p tcp -m tcp --dport 9999 -j ACCEPT

#To be sure that r/w access
mkdir -p /tmp/
chmod -R 777 /tmp/
appdomain=$(cut -d"." -f2- <<< $appdomain)

certdir=$(sed -nr '/^[[:digit:]-]{10} [[:digit:]:]{8},[[:digit:]]+:.*:[[:alnum:]\.]*:Reporting to user: Congratulations![[:alnum:][:space:]]*([^[:blank:]]+)[/][^/[[:blank:]]+[.][[:alnum:][:space:]]*.*$/{s//\1/p}' /var/log/letsencrypt/letsencrypt.log | tail -n 1)


echo appid = $appid
echo appdomain = $appdomain
#Upload 3 certificate files
uploadresult=$(curl -F "appid=$appid" -F "fid=privkey.pem" -F "file=@${certdir}/privkey.pem" -F "fid=fullchain.pem" -F "file=@${certdir}/fullchain.pem" -F "fid=cert.pem" -F "file=@${certdir}/cert.pem" http://$primarydomain/xssu/rest/upload)

#Save urls to certificate files
echo $uploadresult | awk -F '{"file":"' '{print $2}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/privkey.url
echo $uploadresult | awk -F '{"file":"' '{print $3}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/fullchain.url
echo $uploadresult | awk -F '{"file":"' '{print $4}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/cert.url

sed -i '/^\s*$/d' /tmp/*.url
