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
envAppid = getParam("envAppid") || "${ENV_APPID}",
resp;

function manageDnat(action) {
  var dnatParams = 'a | grep -q  ' + masterIP + ' || iptables -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  resp = jelastic.env.control.ExecCmdByGroup(envAppid, session, group, { "command": "ip", "params": dnatParams }, true, false, "root"); 
}

manageDnat('add');

println(resp)

//download 
var execParamsLe = ' ' + urlLeScript + ' -O /root/install-le.sh && chmod +x /root/install-le.sh && /root/install-le.sh >> /var/log/letsencrypt.log';
resp = jelastic.env.control.ExecCmdById(envAppid, session, masterId,  toJSON( [ { "command": "wget", "params": execParamsLe } ]), true, "root"); 

println(resp)

var execParamsGe = ' ' + urlGenScript + ' -O /root/generate-ssl-cert.sh && chmod +x /root/generate-ssl-cert.sh';
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "wget", "params": execParamsGe } ]), true, "root"); 

println(resp)

//exec
var createSettingsParams = '\"domain=\''+envDomain+'\' \n email=\''+email+'\' \n appid=\''+envAppid+'\' \n appdomain=\''+envDomain+'\'\" >  /opt/letsencrypt/settings' 
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "printf", "params": createSettingsParams } ]), true, "root"); 

println(resp)

var execParamsMain = '/root/generate-ssl-cert.sh'
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "bash", "params": execParamsMain } ]), true, "root"); 

println(resp)

//read certificates
var cert_key = jelastic.env.file.Read(envName, session, "/tmp/privkey.url", null, null, masterId);
var fullchain = jelastic.env.file.Read(envName, session, "/tmp/fullchain.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, session, "/tmp/cert.url", null, null, masterId);

println(cert_key)
println(fullchain)
println(cert)

manageDnat('remove');

println(8)
resp = jelastic.env.binder.BindSSL(envName, session, cert_key.body, cert.body, fullchain.body);
println(resp)

return {
  result:0
}

