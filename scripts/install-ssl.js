//@url('/${SCRIPT_URL}')
//@req(token)

import com.hivext.api.core.utils.Transport;

if (token != "${TOKEN}") {
  return {result: 8, error: "wrong token", response: {result: 8}}
}

var envDomain = "${ENV_DOMAIN}",
    customDomain = "${CUSTOM_DOMAIN}",
    envName = "${ENV_NAME}",
    masterId = "${MASTER_ID}",
    masterIP = "${MASTER_IP}",
    urlLeScript = "${LE_INSTALL}",
    urlGenScript = "${LE_GENERATE_SSL}",   
    urlUpdScript = "${UPDATE_SSL}",     
    group = "${NODE_GROUP}",
    email = "${USER_EMAIL}",
    envAppid = "${ENV_APPID}",
    cronTime = "${CRON_TIME}",
    resp, 
    debug = [];

if (getParam("uninstall")){
  //remove auto-update cron job
  fileName = urlUpdScript.split('/').pop().split('?').shift();
  execParams = 'crontab -l | grep -v "' + fileName + '" | crontab - ';
  resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "bash", "params": execParams } ]), true, "root"); 
  debug.push(resp);
  
  //remove ssl certificate
  resp = jelastic.env.binder.RemoveSSL(envName, session);
  debug.push(resp);
  
  resp.debug = debug;
  return resp;
}

//temporary workaround for scheduled auto-updates
if (getParam("auto-update")) {
  var version = jelastic.system.service.GetVersion().version.split("-").shift();
  if (version > 5.0) {
    this.session = this.signature;
  } else {
    var user = jelastic.users.account.GetUserInfo(appid, signature);
    var title = "Action required: update your Let's Encrypt SSL certificate at " + envDomain;
    var array = urlUpdScript.split("/");
    array = array.slice(0, array.length - 2); 
    array.push("html/update-required.html?_r=" + Math.random()); 
    var body = new Transport().get(array.join("/"));
    var from = envDomain;
    return jelastic.message.email.SendToUser(appid, signature, email, title, body, from);
  }
}

//multi domain support - any following separator can be used: ' ' or ';' or ',' 
if (customDomain) customDomain = customDomain.split(";").join(" ").split(",").join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/gm,'').split(" ").join(" -d ");

//download and execute Let's Encrypt package installation script 
var fileName = urlLeScript.split('/').pop().split('?').shift();
var execParams = ' ' + urlLeScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName + ' && /root/' + fileName + ' >> /var/log/letsencrypt.log';
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 
debug.push(resp);

//download ssl generation script
fileName = urlGenScript.split('/').pop().split('?').shift();
execParams = ' ' + urlGenScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 
debug.push(resp);

//write configs for ssl generation
execParams = '\"domain=\'' + (customDomain || envDomain) + '\'\nemail=\''+email+'\'\nappid=\''+envAppid+'\'\nappdomain=\''+envDomain+'\'\n\" >  /opt/letsencrypt/settings' 
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "printf", "params": execParams } ]), true, "root"); 
debug.push(resp);


//execute ssl generation script 
manageDnat('add');
execParams = '/root/' + fileName;
resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "bash", "params": execParams } ]), true, "root"); 
//getting "out" for the further error processing
var out = resp.responses[0].out;
//just cutting "out" for debug logging becuase it's too long in ssl generation output  
resp.responses[0].out = out.substring(out.length - 400);
debug.push(resp);
manageDnat('remove');

//checking errors in ssl generation output  
var ind1 = out.indexOf("The following errors");
if (ind1 != -1){
  var ind2 = out.indexOf("appid =", ind1);
  var error = ind2 == -1 ? out.substring(ind1) : out.substring(ind1, ind2);
  return {
    result: 99,
    error: error,
    response: error,
    debug: debug
  }
}

//download and configure cron job for auto update script 
var autoUpdateUrl = getParam('autoUpdateUrl');
if (autoUpdateUrl) {
  autoUpdateUrl += "&auto-update=1";
  fileName = urlUpdateScript.split('/').pop().split('?').shift();
  execParams = ' ' + urlUpdateScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
  execParams += ' && crontab -l | grep -v "' + fileName + '" | crontab - && echo \"' + cronTime + ' /root/' + fileName + ' ' + autoUpdateUrl +'\" >> /var/spool/cron/root';
  resp = jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"); 
  debug.push(resp);
}

//read certificates
var cert_key = jelastic.env.file.Read(envName, session, "/tmp/privkey.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, session, "/tmp/cert.url", null, null, masterId);
var fullchain = jelastic.env.file.Read(envName, session, "/tmp/fullchain.url", null, null, masterId);

if (cert_key.body && fullchain.body && cert.body){
  resp = jelastic.env.binder.BindSSL(envName, session, cert_key.body, cert.body, fullchain.body);
  debug.push(resp);
} else {
  var error = "can't read ssl certificate";
  resp = {
    result: 99, 
    error: error,
    response: error
  }
}

resp.debug = debug;
return resp;

//managing certificate challenge validation by routing all requests to master node with let's encrypt engine   
function manageDnat(action) {
  var dnatParams = 'a | grep -q  ' + masterIP + ' || iptables -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  resp = jelastic.env.control.ExecCmdByGroup(envName, session, group, toJSON([{ "command": "ip", "params": dnatParams }]), true, false, "root"); 
  debug.push(resp);
}

