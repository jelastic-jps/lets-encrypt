#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";
DAYS_BEFORE_EXPIRE=30
WGET=$(which wget);
OPENSSL=$(which openssl)
GREP=$(which grep)
SED=$(which sed)
GIT=$(which git);
BASE_REPO_URL="https://github.com/jelastic-jps/lets-encrypt"
RAW_REPO_SCRIPS_URL="https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/scripts/"

[[ -z "$WGET" || -z "$OPENSSL" || -z "$GREP" || -z "$SED" || -z "$GIT" ]] && { echo "PATH not set with neccessary commands"; exit 3 ; }

[ -f "${DIR}/opt/letsencrypt/settings"  ] && source "${DIR}/opt/letsencrypt/settings" || { echo "No settings available" ; exit 3 ; }
[ -f "${DIR}/root/validation.sh"  ] && source "${DIR}/root/validation.sh" || { echo "No validation library available" ; exit 3 ; }

validateExtIP
validateDNSSettings

TIME_TO_WAIT=$(($RANDOM%3600));
#sleep $TIME_TO_WAIT;   

auto_update_url=$1
jerror_url=$(awk -F "/" '{ print $1"//"$2$3"/1.0/environment/jerror/rest"}' <<< $auto_update_url )

seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));


[ -f "/var/lib/jelastic/SSL/jelastic.crt" ] && exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -f "${DIR}/var/lib/jelastic/cert.pem" ] && {
    exp_date_raw=$($OPENSSL x509 -text -noout -in "${DIR}/var/lib/jelastic/keys/cert.pem" -subject -enddate | $GREP notAfter | $SED 's/^notAfter=//');
    exp_date=$(date --utc --date="$exp_date_raw" "+%Y-%m-%d %H:%M:%S");
}

function validateLatestVersion(){
   local revision_state_path="/root/.lerevision";
   local latest_revision=$($GIT ls-remote $BASE_REPO_URL | grep master | awk '{ print $1}');
   [ -f "$revision_state_path" ] && current_revision=$(cat $revision_state_path);
   [ "$latest_revision" != "$current_revision" ] && {
        $WGET  --no-check-certificate $RAW_REPO_SCRIPS_URL/auto-update-ssl-cert.sh -O /tmp/auto-update-ssl-cert.sh
        $WGET  --no-check-certificate $RAW_REPO_SCRIPS_URL/install-le.sh -O /tmp/install-le.sh
        $WGET  --no-check-certificate $RAW_REPO_SCRIPS_URL/validation.sh -O /tmp/validation.sh
        $WGET  --no-check-certificate $RAW_REPO_SCRIPS_URL/generate-ssl-cert.sh -O /tmp/generate-ssl-cert.sh
        [  -s /tmp/auto-update-ssl-cert.sh -a -s /tmp/install-le.sh -a -s /tmp/validation.sh -a -s /tmp/generate-ssl-cert.sh ] && {
            mv /tmp/install-le.sh /root/install-le.sh
            mv /tmp/auto-update-ssl-cert.sh  /root/auto-update-ssl-cert.sh
            mv /tmp/generate-ssl-cert.sh /root/generate-ssl-cert.sh
            mv /tmp/validation.sh /root/validation.sh
            chmod +x /root/*.sh
            echo $latest_revision > $revision_state_path
        }
   }
}


[ -z "$exp_date" ] && { echo "$(date) - no certificates for update" >> /var/log/letsencrypt.log; exit 0; };

_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));

[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    validateLatestVersion
    resp=$($WGET --no-check-certificate -qO- "${auto_update_url}");
    { echo "${resp#*response*}" | sed 's/"//g' | grep -q 'result:0' ;} || $WGET -qO- "${jerror_url}/jerror?appid=$appid&actionname=updatefromcontainer&callparameters=$auto_update_url&email=$email&errorcode=4121&errormessage=$resp&priority=high"
}
