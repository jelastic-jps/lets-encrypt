//auth
//@url('/install-ssl-script')
//@req(token)

if (token != "${TOKEN}") {
  return {"result": 8, "error": "wrong token"}
}

var envDomain = getParam("domain") || "${ENV_DOMAIN}",
envName = getParam("envName") || "${ENV_NAME}",
masterId = getParam("masterId") || "${MASTER_ID}",
masterIP = getParam("masterIP") || "${MASTER_IP}",
urlLeScript = getParam("urlLeScript") || "${LE_INSTALL}",
urlGenScript = getParam("urlGenScript") || "${LE_GENERATE_SSL}",   
group = getParam("group") || "${NODE_GROUP}",
email = getParam("email") || "${USER_EMAIL}",
envAppid = getParam("envAppid") || "${ENV_APPID}";

function manageDnat(action) {
  var dnatParams = 'a | grep -q  ' + masterIP + ' || iptables -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  jelastic.env.control.ExecCmdByGroup(envName, signature, group, { "command": "ip", "params": dnatParams }, true, false, "root"); 
}

manageDnat('add');

//download 
var execParamsLe = ' ' + urlLeScript + ' -O /root/install-le.sh && chmod +x /root/install-le.sh && /root/install-le.sh >> /var/log/letsencrypt.log';
jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "wget", "params": execParamsLe } ]), true, "root"); 
var execParamsGe = ' ' + urlGenScript + ' -O /root/generate-ssl-cert.sh && chmod +x /root/generate-ssl-cert.sh';
jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "wget", "params": execParamsGe } ]), true, "root"); 

//exec
var createSettingsParams = '\"domain=\''+envDomain+'\' \n email=\''+email+'\' \n appid=\''+envAppid+'\' \n appdomain=\''+envDomain+'\'\" >  /opt/letsencrypt/settings' 
jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "printf", "params": createSettingsParams } ]), true, "root"); 
var execParamsMain = '/root/generate-ssl-cert.sh'
jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "bash", "params": execParamsMain } ]), true, "root"); 

//read certificates
var cert_key = jelastic.env.file.Read(envName, signature, "/tmp/privkey.url", null, null, masterId);
var fullchain = jelastic.env.file.Read(envName, signature, "/tmp/fullchain.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, signature, "/tmp/cert.url", null, null, masterId);

manageDnat('remove');

return jelastic.env.binder.BindSSL(envName, signature, cert_key.body, cert.body, fullchain.body);

