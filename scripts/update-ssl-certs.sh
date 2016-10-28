#!/bin/bash

DAYS_BEFORE_EXPIRE=14

cs_appid=$1
env_name=$2
token=$3
seconds_before_expire=$(( $DAYS_BEFORE_EXPIRE * 24 * 60 * 60 ));
wget=$(which wget);
exp_date=$(jem ssl checkdomain | python -c "import sys, json; print json.load(sys.stdin)['expiredate']");
[ -z exp_date  ] && { echo "no certificates for update"; exit 0; };
_exp_date_unixtime=$(date --date="$exp_date" "+%s");
_cur_date_unixtime=$(date "+%s");
_delta_time=$(( $_exp_date_unixtime - $_cur_date_unixtime  ));
[[ $_delta_time -le $seconds_before_expire ]] && {
    echo "$(date) - update required" >> /var/log/letsencrypt.log;
    cs_domain="${cs_appid}.app$(hostname | sed "s/$(hostname | cut -d'.' -f1)//g")";
    wget -qO- "http://${cs_domain}/${env_name}-install-ssl-script?token=$token"
}
