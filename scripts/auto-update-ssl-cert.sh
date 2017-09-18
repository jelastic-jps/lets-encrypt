#!/bin/bash

DAYS_BEFORE_EXPIRE=30

TIME_TO_WAIT=$(($RANDOM%3600));
sleep $TIME_TO_WAIT;

auto_update_url=$1

seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));
wget=$(which wget);
[ -f "/var/lib/jelastic/SSL/jelastic.crt" ] && exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -z "$exp_date" ] && { echo "$(date) - no certificates for update" >> /var/log/letsencrypt.log; exit 0; };
_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));
[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    wget -qO- ${auto_update_url}
}
