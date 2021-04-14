#!/bin/bash
PATH="$PATH:/usr/local/sbin:/bin:/sbin:/usr/bin:/usr/sbin::/root/bin"
SETTING_PATH="${DIR}/opt/letsencrypt/settings"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/..";
log="${DIR}/var/log/letsencrypt.log"
function getLog(){
    [ -f $log ] && {
        echo '-------- log --------'
        tail -n 100 $log
        echo '-------- log --------'
    }
}


[[ $1 == *"verbose" ]] && {
        getLog;
}

IP=$(which ip)
[[ -z "$IP" ]] && { echo "Error: ip command not found, unable to verify IP"; exit 3 ; }

EXT_IPs=$($IP a | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p')
EXT_IPs_v6=$($IP a | sed -En 's/inet6 ::1\/128//;s/.*inet6 (addr:?)?([0-9a-f:]+)\/.*/\2/p')

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

function hasExtIPv6Only(){
  for EXT_IP in $EXT_IPs
  do  
    isLANIP $EXT_IP || return 1;
  done

  for EXT_IP in $EXT_IPs_v6
  do  
    isLANIPv6 $EXT_IP || return 0;
  done
  return 1;
}

function validateDNSSettings(){
    domain=$1;
    [ -z "$domain" ] && {
        [ -f "${SETTING_PATH}"  ] && source "${SETTING_PATH}" || { echo "Error: no settings available" ; exit 3 ; }
    }

    [ ! -z "$skipped_domains" ] && domain+=" "$skipped_domains

    domain=$(echo $domain | sed "s/-d / /g")
    for single_domain in $domain
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
    [[ $detected == 'false'  ]] && {
        echo "Incorrect DNS settings for domain $single_domain! It should be bound to containers Public IP.";
        need_skip_domains+=" "$single_domain
    } || {
        validated_domains+=" "$single_domain
    };
    done

    [ -f "${SETTING_PATH}" ] && {
        [ ! -z "$need_skip_domains" ] && {
            grep -q "skipped_domains" "${SETTING_PATH}" && sed -i "s/skipped_domains=.*/skipped_domains='$(echo $need_skip_domains | sed "s/ / -d /g")'/g" "${SETTING_PATH}" || printf "\nskipped_domains='$(echo $need_skip_domains | sed "s/ / -d /g")'" >> "${SETTING_PATH}";
        }

        [[ ! -z "$validated_domains" ]] && {
            sed -i "s/^domain=.*/domain='$(echo $validated_domains | sed "s/ / -d /g")'/g" "${SETTING_PATH}";
        } || {
            sed -i "s/^domain=.*/domain='$(echo $appdomain)'/g" "${SETTING_PATH}";
            test_params='--test-cert --break-my-certs ';
#            echo "Error: SSL certificates cannot be assigned to the available custom domains due to incorrect DNS settings. Adjust configurations within your domain admin panel."
#            exit 1 ;
        }
    }

    [[ -f "${SETTING_PATH}" ]] && source "${SETTING_PATH}"

    return 0;
}

function parseDomains() {
  failed_domains=$(echo $1 | grep -shoP "Domain: (.+?) Type: " | sed 's/Domain: //g;s/ Type: //')
  domain=${domain// -d / }
  skipped_domains=""

  while IFS= read -r line; do
    skipped_domains+=" "$line
    domain=${domain/$line}
  done <<< "$failed_domains"

  domain=$(echo $domain | xargs)
  
  [ ! -z "$skipped_domains" ] && {
  grep -q "skipped_domains" "${SETTING_PATH}" && sed -i "s/skipped_domains=.*/skipped_domains='$(echo $skipped_domains | sed "s/ / -d /g")'/g" "${SETTING_PATH}" || printf "\nskipped_domains='$(echo $skipped_domains | sed "s/ / -d /g")'" >> "${SETTING_PATH}";
  }
  
  [[ ! -z "$domain" ]] && {
      sed -i "s/^domain=.*/domain='$(echo $domain | sed "s/ / -d /g")'/g" "${SETTING_PATH}";
  } || {
      sed -i "s/^domain=.*/domain='$(echo $appdomain)'/g" "${SETTING_PATH}";
      test_params='--test-cert --break-my-certs ';
  }

  [[ -f "${SETTING_PATH}" ]] && source "${SETTING_PATH}"
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
#   validateDNSSettings
   validateCertBot
   echo "All validations are passed succesfully";
}
