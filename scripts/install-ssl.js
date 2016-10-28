//auth
//@url('/${SCRIPT_URL}')
//@req(token)

if (token != "${TOKEN}") {
  return {result: 8, error: "wrong token", response: {result: 8}}
}

if (!session) session = signature;

var envDomain = getParam("domain") || "${ENV_DOMAIN}",
customDomain = getParam("customDomain") || "${CUSTOM_DOMAIN}",
envName = getParam("envName") || "${ENV_NAME}",
masterId = getParam("masterId") || "${MASTER_ID}",
masterIP = getParam("masterIP") || "${MASTER_IP}",
urlLeScript = getParam("urlLeScript") || "${LE_INSTALL}",
urlGenScript = getParam("urlGenScript") || "${LE_GENERATE_SSL}",   
urlUpdateScript = getParam("urlUpdateScript") || "${UPDATE_SSL}",     
group = getParam("group") || "${NODE_GROUP}",
email = getParam("email") || "${USER_EMAIL}",
envAppid = getParam("envAppid") || "${ENV_APPID}",
resp;

function manageDnat(action) {
  var dnatParams = 'a | grep -q  ' + masterIP + ' || iptables -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  resp = jelastic.env.control.ExecCmdByGroup(envAppid, session, group, toJSON([{ "command": "ip", "params": dnatParams }]), true, false, "root"); 
}

manageDnat('add');

//download and execute Let's Encrypt package installation script 
var fileName = urlLeScript.split('/').pop();
var execParams = ' ' + urlLeScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName + ' && /root/' + fileName + ' >> /var/log/letsencrypt.log';
resp = jelastic.env.control.ExecCmdById(envAppid, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 

//download SSL generation script
fileName = urlGenScript.split('/').pop();
execParams = ' ' + urlGenScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 

//write configs for SSL generation
execParams = '\"domain=\''+(envDomain)+'\' \n email=\''+email+'\' \n appid=\''+envAppid+'\' \n appdomain=\''+envDomain+'\'\" >  /opt/letsencrypt/settings' 
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "printf", "params": execParams } ]), true, "root"); 

//execute SSL generation script 
execParams = '/root/' + fileName;
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "bash", "params": execParams } ]), true, "root"); 

//download and configure cron job for auto update script 
var autoUpdateUrl = getParam('autoUpdateUrl');
if (autoUpdateUrl) {
  fileName = urlUpdateScript.split('/').pop();
  execParams = ' ' + urlUpdateScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
  execParams += ' && crontab -l | grep -v "' + fileName + '" | crontab - && echo \"0 04 * * * /root/' + fileName + ' ' + autoUpdateUrl +'\" >> /var/spool/cron/root';
  resp = jelastic.env.control.ExecCmdById(envAppid, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 
}

//read certificates
var cert_key = jelastic.env.file.Read(envName, session, "/tmp/privkey.url", null, null, masterId);
var fullchain = jelastic.env.file.Read(envName, session, "/tmp/fullchain.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, session, "/tmp/cert.url", null, null, masterId);

manageDnat('remove');

resp = jelastic.env.binder.BindSSL(envName, session, cert_key.body, cert.body, fullchain.body);

return {
  result:0
}

