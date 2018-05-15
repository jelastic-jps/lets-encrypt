#!/bin/bash

DAYS_BEFORE_EXPIRE=30

[ -f '/opt/letsencrypt/settings'  ] && source '/opt/letsencrypt/settings' || { echo "No settings available" ; exit 3 ; }
[ -f '/root/validation.sh'  ] && source '/root/validation.sh' || { echo "No validation library available" ; exit 3 ; }

validateExtIP
validateDNSSettings

TIME_TO_WAIT=$(($RANDOM%3600));
sleep $TIME_TO_WAIT;

auto_update_url=$1
jerror_url=$(awk -F "/" '{ print $1"//"$2$3"/1.0/environment/jerror/rest"}' <<< $auto_update_url )

seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));

wget=$(which wget);
[ -f "/var/lib/jelastic/SSL/jelastic.crt" ] && exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -z "$exp_date" ] && { echo "$(date) - no certificates for update" >> /var/log/letsencrypt.log; exit 0; };
_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));
[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    resp=$(wget --no-check-certificate -qO- ${auto_update_url});
    { echo $resp | sed 's/"//g' | grep -q 'result:0' ;} || wget -qO- "${jerror_url}/jerror?appid=$appid&actionname=updatefromcontainer&callparameters=$auto_update_url&email=$email&errorcode=4121&errormessage=$resp&priority=high"
}
