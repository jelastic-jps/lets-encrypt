#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";
LOG_FILE=$DIR/var/log/letsencrypt/letsencrypt.log-$(date '+%s')
KEYS_DIR="$DIR/var/lib/jelastic/keys/"
SETTINGS="$DIR/opt/letsencrypt/settings"
DOMAIN_SEP=" -d "
GENERAL_RESULT_ERROR=21
TOO_MANY_CERTS=22
WRONG_WEBROOT_ERROR=25
UPLOAD_CERTS_ERROR=26
TIME_OUT_ERROR=27
counter=1

[ -f "${SETTINGS}" ] && source "${SETTINGS}" || { echo "No settings available" ; exit 3 ; }
[ -f "${DIR}/root/validation.sh" ] && source "${DIR}/root/validation.sh" || { echo "No validation library available" ; exit 3 ; }

#To be sure that r/w access
mkdir -p /etc/letsencrypt/
#chown -R jelastic:jelastic /etc/letsencrypt/

cd "${DIR}/opt/letsencrypt"

PROXY_PORT=12345
LE_PORT=12346

#Parameters for test certificates
test_params='';
[ "$test" == "true" -o "$1" == "fake" ] && { test_params=' --test '; }

params='';
[[ ${webroot} == "true" && -z "$webrootPath" ]] && {
    [[ ! -z ${WEBROOT} ]] && { webrootPath="${WEBROOT}/ROOT/"; } || { echo "Webroot path is not set"; exit 3; }
}
[[ "$webroot" == "true" && ! -z "$webrootPath" ]] && { params="--webroot ${webrootPath}"; } || { params=" --standalone --httpport ${LE_PORT} "; }

#format domains list according to acme client
domain=$(echo $domain | sed -r 's/\s+/ -d /g');
skipped_domains=$(echo $skipped_domains | sed -r 's/\s+/ -d /g');

[[ ! -z "$skipped_domains" ]] && {
  [[ -z "$domain" ]] && domain=$skipped_domains || domain+=" -d "$skipped_domains;
}
[[ -z "$domain" ]] && domain=$appdomain;

#Kill hanged certificate requests
killall -9 tinyproxy > /dev/null 2>&1

mkdir -p $DIR/var/log/letsencrypt

[[ "$webroot" == "false" ]] && {
    service tinyproxy start || { echo "Failed to start proxy server" ; exit 3 ; }

    iptables -I INPUT -p tcp -m tcp --dport ${PROXY_PORT} -j ACCEPT
    iptables -I INPUT -p tcp -m tcp --dport ${LE_PORT} -j ACCEPT
    ip6tables -I INPUT -p tcp -m tcp --dport ${LE_PORT} -j ACCEPT
    iptables -t nat -I PREROUTING -p tcp -m tcp ! -s 127.0.0.1/32 --dport 80 -j REDIRECT --to-ports ${PROXY_PORT}
    ip6tables -t nat -I PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports ${LE_PORT} || ip6tables -I INPUT -p tcp -m tcp --dport 80 -j DROP
}
result_code=$GENERAL_RESULT_ERROR;

while [ "$result_code" != "0" ]
do
  [[ -z $domain ]] && break;
  LOG_FILE=$LOG_FILE"-"$counter

  resp=$($DIR/opt/letsencrypt/acme.sh --issue $params $test_params --listen-v6 --domain $domain --nocron -f --log-level 2 --log $LOG_FILE 2>&1)

  grep -q 'Cert success' $LOG_FILE && grep -q "BEGIN CERTIFICATE" $LOG_FILE && result_code=0 || result_code=$GENERAL_RESULT_ERROR

  [[ "$result_code" == "$GENERAL_RESULT_ERROR" ]] && {
    error=$(sed -rn 's/.*\s(.*)(DNS problem: .*?)",\"status.*/\2/p' $LOG_FILE | sed '$!d')
    [[ ! -z $error ]] && invalid_domain=$(echo $error | sed -rn 's/.* (.*) - .*/\1/p')

    [[ -z $error ]] && {
      error=$(sed -rn 's/.*\s(.*)(Invalid response from https?:\/\/.*).*/\2/p' $LOG_FILE | sed '$!d')
      [[ ! -z $error ]] && invalid_domain=$(echo $error | sed -rn 's|(.+)addressesResolved|\1|p' | sed -rn 's|(.+)hostname.*|\1|p' | sed -rn 's|.*hostname\"\:\"([^\"]*).*|\1|p')
      [[ -z $invalid_domain ]] && invalid_domain=$(echo $error | sed -rn 's|(.+)addressesResolved|\1|p' | sed -rn 's|.*hostname\":\"(.*)|\1|p' | sed -rn 's|\",.*||p')
    }

    [[ -z $error ]] && {
      error=$(sed -rn 's/.*\s(.*)(Verify error:)/\1/p' $LOG_FILE | sed '$!d')
      [[ ! -z $error ]] && invalid_domain=$(echo $error | sed  "s/:.*//")
    }

    [[ -z $error ]] && {
      error=$(sed -rn 's/.*(Cannot issue for .*)",/\1/p' $LOG_FILE | sed '$!d')
      invalid_domain=$(echo $error | sed -rn 's/Cannot issue for \\\"(.*)\\\":.*/\1/p')
    }
    
    [[ -z $error ]] && {
      error=$(sed -rn 's/.*\s(.*)(Fetching https?:\/\/.*): Error getting validation data.*/\2/p' $LOG_FILE | sed '$!d')
      invalid_domain=$(echo $error | sed -rn 's/Fetching https?:\/\/(.*)\/.well-known.*/\1/p')
    }
    
    [[ -z $error ]] && {
       error=$(sed -rn 's/(.*)(Fetching https?:\/\/.*) Timeout during connect/\2/p' $LOG_FILE | sed '$!d')
       validation_record=$(echo $error | sed -rn 's/.*validationRecord":\[\{"url":"https?\:\/\/(.*)/\1/p' | sed -rn 's/(.*)\},\{.*/\1/p')
       [[ ! -z $validation_record ]] && {
           invalid_domain=$(echo $validation_record | sed -rn 's/(.*)\/\.well-known.*/\1/p')
       } || {
           invalid_domain=$(echo $error | sed -rn 's/\},\{.*//p' | sed -rn 's/.*hostname":"(.*)","port.*/\1/p')
       }
    }

    [[ -z $error ]] && {
      error=$(sed -rn 's/.*(Error creating new order \:\: )(.*)\"\,/\2/p' $LOG_FILE | sed '$!d');
      [[ ! -z $error ]] && {
        rate_limit_exceeded=true;
        break;
      }
    }

    all_invalid_domains_errors+=$error";"
    all_invalid_domains+=$invalid_domain" "

    domain=$(echo $domain | sed 's/'${invalid_domain}'\(\s-d\s\)\?//')
    domain=$(echo $domain | sed "s/\s-d$//")
  }
  counter=$((counter + 1))
done

all_invalid_domains_errors=${all_invalid_domains_errors%?}

[[ ! -z $all_invalid_domains ]] && {
  all_invalid_domains=$(echo $all_invalid_domains | sed -r "s/\s-d//g")
  sed -i "s|skipped_domains=.*|skipped_domains='${all_invalid_domains}'|g" ${SETTINGS}
}
domain=$(echo $domain | sed -r "s/\s-d//g");
sed -i "s|^domain=.*|domain='${domain}'|g" ${SETTINGS};

[[ "$webroot" == "false" ]] && {
    iptables -t nat -D PREROUTING -p tcp -m tcp ! -s 127.0.0.1/32 --dport 80 -j REDIRECT --to-ports ${PROXY_PORT}
    ip6tables -t nat -D PREROUTING -p tcp -m tcp --dport 80 -j REDIRECT --to-ports ${LE_PORT} || ip6tables -I INPUT -p tcp -m tcp --dport 80 -j ACCEPT
    iptables -D INPUT -p tcp -m tcp --dport ${PROXY_PORT} -j ACCEPT
    iptables -D INPUT -p tcp -m tcp --dport ${LE_PORT} -j ACCEPT
    ip6tables -D INPUT -p tcp -m tcp --dport ${LE_PORT} -j ACCEPT

    service tinyproxy stop || echo "Failed to stop proxy server"
    chkconfig tinyproxy off
}

if [ "$result_code" != "0" ]; then
    [[ $resp == *"does not exist or is not a directory"* ]] && invalid_webroot_dir=true
    [[ $resp == *"Read timed out"* ]] && timed_out=true
fi

[[ $invalid_webroot_dir == true ]] && exit $WRONG_WEBROOT_ERROR;
[[ $timed_out == true ]] && exit $TIME_OUT_ERROR;
[[ $rate_limit_exceeded == true ]] && { echo "$error"; exit $TOO_MANY_CERTS; }
[[ $result_code != "0" ]] && { echo "$all_invalid_domains_errors"; exit $GENERAL_RESULT_ERROR; }

#To be sure that r/w access
mkdir -p /tmp/
chmod -R 777 /tmp/
appdomain=$(cut -d"." -f2- <<< $appdomain)

certspath=$(sed -n 's/.*][[:space:][:digit:]{4}[:space:]]Your[[:space:]]cert[[:space:]]is[[:space:]]in[[:space:]]\{2\}\(.*\)./\1/p' $LOG_FILE)
certdir=$(echo $certspath | sed 's/[^\/]*\.cer$//' | tail -n 1)
certname=$(echo $certspath | sed 's/.*\///' | tail -n 1)
certdomain=$(echo $certspath | sed 's/.*\///' | sed 's/\.cer$//')

mkdir -p $KEYS_DIR

[ ! -z $certdir ] && {
  cp -f $certdir/* $KEYS_DIR && chown jelastic -R $KEYS_DIR
  cp -f ${certdir}/${certdomain}.key $KEYS_DIR/privkey.pem
  cp -f ${certdir}/${certdomain}.cer $KEYS_DIR/cert.pem
  cp -f ${certdir}/fullchain.cer $KEYS_DIR/fullchain.pem
}

function uploadCerts() {
    local certdir="$1"
    echo appid = $appid
    echo appdomain = $appdomain
    #Upload 3 certificate files
    uploadresult=$(curl -F "appid=$appid" -F "fid=privkey.pem" -F "file=@${certdir}/${certdomain}.key" -F "fid=fullchain.pem" -F "file=@${certdir}/ca.cer" -F "fid=cert.pem" -F "file=@${certdir}/${certdomain}.cer" http://$primarydomain/xssu/rest/upload)

    result_code=$?;
    [[ $result_code != 0 ]] && { echo "$uploadresult" && exit $UPLOAD_CERTS_ERROR; }
    
    #Save urls to certificate files
    echo $uploadresult | awk -F '{"file":"' '{print $2}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/privkey.url
    echo $uploadresult | awk -F '{"file":"' '{print $3}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/fullchain.url
    echo $uploadresult | awk -F '{"file":"' '{print $4}' | awk -F ":\"" '{print $1}' | sed 's/","name"//g' > /tmp/cert.url

    sed -i '/^\s*$/d' /tmp/*.url
    exit 0;
}

while [[ "$1" != "" ]]; do
    case "$1" in
        -n|--no-upload-certs )
            shift;
            exit 0;
            ;;
    esac
    shift
done

uploadCerts $certdir;
#[ "$withExtIp" == "true" ] && { uploadCerts $certdir; }
