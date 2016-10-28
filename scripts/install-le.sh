#!/bin/bash

echo Install opel-release
yum -y install epel-release git bc;

rpm -ivh https://downloads.hpdd.intel.com/public/e2fsprogs/1.42.12.wc1/el7/RPMS/x86_64/libcom_err-devel-1.42.12.wc1-4.el7.centos.x86_64.rpm;

git clone https://github.com/letsencrypt/letsencrypt /opt/letsencrypt;

/opt/letsencrypt/letsencrypt-auto --os-packages-only
