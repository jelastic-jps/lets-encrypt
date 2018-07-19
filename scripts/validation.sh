#!/bin/bash

log="/var/log/letsencrypt.log"
[[ $1 == *"verbose" ]] && {
    [ -f $log ]	&& {
	echo '-------- log --------'
    	tail -n 100 $log
	echo '-------- log --------'
    }
}

IP=$(which ip)
[[ -z "$IP" ]] && { echo "ip command not found, unable to verify IP"; exit 3 ; }

EXT_IPs=$($IP a | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p')
EXT_IPs_v6=$($IP a | sed -En 's/inet6 ::1\/128//;s/.*inet6 (addr:?)?([0-9a-f:]+)\/.*/\2/p')
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";

function isLANIP() {
    : ${1:?"Missing param: IP"};
    local ip
    local pip=${1}
    OIFS=$IFS;IFS='.';ip=(${pip});IFS=$OIFS
    [[ ${ip[0]} -eq 172 && ${ip[1]} -ge 16 && ${ip[1]} -le 31 ]] && return 0;
    [[ ${ip[0]} -eq 192 && ${ip[1]} -eq 168 ]] && return 0;
    [[ ${ip[0]} -eq 100 && ${ip[1]} -ge 64 && ${ip[1]} -le 127 ]] && return 0;
    [[ ${ip[0]} -eq 10 ]] && return 0;
    return 1
}

function isLANIPv6() {
    : ${1:?"Missing param: IP"};
    local ip
    local pip=${1}
    OIFS=$IFS;IFS=':';ip=(${pip});IFS=$OIFS
    [[ ${ip[0]} == "fc00" ]] && return 0;
    [[ ${ip[0]} == "fe80" ]] && return 0;
    [[ ${ip[0]} == "ff0[0-9a-f]" ]] && return 0;
    [[ ${ip[0]} == "2002" ]] && return 0;
    [[ ${ip[0]} == "2001" && ${ip[1]} == "db8" ]] && return 0;
    return 1
}

function validateExtIP(){
    for EXT_IP in $EXT_IPs
    do
            isLANIP $EXT_IP || HAS_EXTERNAL_v4=0;
    done
    for EXT_IP in $EXT_IPs_v6
    do
            isLANIPv6 $EXT_IP || HAS_EXTERNAL_v6=0;
    done
    [[ $HAS_EXTERNAL_v4 -eq 0 || $HAS_EXTERNAL_v6 -eq 0 ]] && return 0;
    { echo "Error: External IP is required!"; exit 1; }
}

function validateDNSSettings(){
    domain=$1;
    [ -z "$domain" ] && {
        [ -f "${DIR}/opt/letsencrypt/settings"  ] && source "${DIR}/opt/letsencrypt/settings" || { echo "Error: no settings available" ; exit 3 ; }
    }

    domain_list=$(echo $domain | sed "s/-d / /g")
        for single_domain in $domain_list
        do
            [ "$single_domain" == "-d" ] && continue;
	    detected=false
            for EXT_IP in $EXT_IPs
            do
                dig +short @8.8.8.8 A $single_domain | grep -q $EXT_IP && detected=true;
            done
            for EXT_IP in $EXT_IPs_v6
            do
                dig +short @8.8.8.8 AAAA $single_domain | grep -q $EXT_IP && detected=true;
            done
	    [[ $detected == 'false'  ]] && { echo "Error: Incorrect DNS settings for domain $single_domain! It should be bound to containers Public IP."; exit 1 ; };
        done
        return 0;
}

function validateCertBot(){
    [ -f "${DIR}/opt/letsencrypt/certbot-auto" ] && return 0  || { echo "Error: Certbot is not installed!"; exit 1 ; };
}

function validateCustomSSL() {
    export META_FILE="/etc/jelastic/metainf.conf"
    [ -f "/var/lib/jelastic/libs/envinfo.lib" ] && source "/var/lib/jelastic/libs/envinfo.lib";

    [ -z "$ssl_module_inherit" ] && {
        [[ "x${COMPUTE_TYPE}" != "xcartridge" || ! -f "${CARTRIDGE_HOME}/jelastic/scripts/ssl_manager.sh" ]] && { echo "Error: custom SSL is not available"; exit 1; }
    }

    return 0;
}

function runAllChecks(){
   validateExtIP
   validateDNSSettings
   validateCertBot
   echo "All validations are passed succesfully";
}
