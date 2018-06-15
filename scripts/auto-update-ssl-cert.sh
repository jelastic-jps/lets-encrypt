#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";
DAYS_BEFORE_EXPIRE=30
WGET=$(which wget);
OPENSSL=$(which openssl)
GREP=$(which grep)
SED=$(which sed)

[ -f "${DIR}/opt/letsencrypt/settings"  ] && source "${DIR}/opt/letsencrypt/settings" || { echo "No settings available" ; exit 3 ; }
[ -f "${DIR}/root/validation.sh"  ] && source "${DIR}/root/validation.sh" || { echo "No validation library available" ; exit 3 ; }

validateExtIP
validateDNSSettings

TIME_TO_WAIT=$(($RANDOM%3600));
sleep $TIME_TO_WAIT;

auto_update_url=$1
jerror_url=$(awk -F "/" '{ print $1"//"$2$3"/1.0/environment/jerror/rest"}' <<< $auto_update_url )

seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));


#[ -f "${DIR}var/lib/jelastic/SSL/jelastic.crt" ] && exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -f "${DIR}/var/lib/jelastic/cert.pem" ] && {
    exp_date_raw=$($OPENSSL x509 -text -noout -in "${DIR}/var/lib/jelastic/keys/cert.pem" -subject -enddate | $GREP notAfter | $SED 's/^notAfter=//');
    exp_date=$(date --utc --date="$exp_date_raw" "+%Y-%m-%d %H:%M:%S");
}

[ -z "$exp_date" ] && { echo "$(date) - no certificates for update" >> /var/log/letsencrypt.log; exit 0; };

_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));

[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    resp=$($WGET --no-check-certificate -qO- "${auto_update_url}");
    { echo "${resp#*response*}" | sed 's/"//g' | grep -q 'result:0' ;} || $WGET -qO- "${jerror_url}/jerror?appid=$appid&actionname=updatefromcontainer&callparameters=$auto_update_url&email=$email&errorcode=4121&errormessage=$resp&priority=high"
}
