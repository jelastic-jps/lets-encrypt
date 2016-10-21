#!/bin/bash

DAYS_BEFORE_EXPIRE=14

env_domain=$1
env_name=$2
token=$3
seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));
wget=$(which wget);
exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -z exp_date  ] && echo "no certificates for update";
_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));
[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    wget -qO- "http://${env_domain}/${env_name}-install-ssl-script?token=$token"
}
