//@url('/${SCRIPT_URL}')
//@req(token)

import com.hivext.api.core.utils.Transport;

if (token != "${TOKEN}") {
  return {result: 8, error: "wrong token", type:"error", message:"Token does not match", response: {result: 8}}
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
    scriptName = "${SCRIPT_NAME}",
    resp, 
    cleanupParams,
    debug = [],
    emailTitle = ": Let's Encrypt SSL at " + envDomain;

var baseUrlArr = urlUpdScript.split("/"); baseUrlArr.pop(); baseUrlArr.pop(); 

//uninstall logic
if (getParam("uninstall")){
  //remove auto-update cron job
  fileName = urlUpdScript.split('/').pop().split('?').shift();
  execParams = 'crontab -l | grep -v "' + fileName + '" | crontab - ';
  resp = ExecCmdById("bash", execParams); 
  debug.push(resp);
  cleanupParams = '-rf /etc/letsencrypt /opt/letsencrypt /root/auto-update-ssl-cert.sh /root/generate-ssl-cert.sh /root/letsencrypt_settings /root/install-le.sh';
  resp = ExecCmdById("rm", cleanupParams);
  debug.push(resp);
  
  //remove ssl certificate
  resp = jelastic.env.binder.RemoveSSL(envName, session);
  debug.push(resp);
  
  resp.debug = debug;
  return resp;
}

//auto-update logic 
if (getParam("auto-update")) {
  this.session = this.signature;
  
  //temporary for scheduled auto updates at platfroms with version < 4.9.5
  var version = jelastic.system.service.GetVersion().version.split("-").shift();
  if (version < '4.9.5') {
    var array = baseUrlArr.slice();
    array.push("html/update-required.html?_r=" + Math.random()); 
    return SendEmail("Action Required" + emailTitle, new Transport().get(array.join("/")));
  }
    
  //checking access to the env
  //mark of error access to a shared env  
  var errorMark = "session [xxx";
  resp = jelastic.env.control.GetEnvInfo(envName, session);
  if (resp.result != 0) {
      if (resp.result == 702 && resp.error.indexOf(errorMark) > -1) {
          var array = baseUrlArr.slice();
          array.push("html/shared-env.html?_r=" + Math.random()); 
          SendEmail("Action Required" + emailTitle, new Transport().get(array.join("/")));
          resp.debug = debug;
          return resp;
      } else {
          resp.debug = debug;
          return SendErrResp(resp);
      }
  }
}

//multi domain support - any following separator can be used: ' ' or ';' or ',' 
if (customDomain) customDomain = customDomain.split(";").join(" ").split(",").join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/gm,'').split(" ").join(" -d ");

//download and execute Let's Encrypt package installation script 
var fileName = urlLeScript.split('/').pop().split('?').shift();
var execParams = ' --no-check-certificate ' + urlLeScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName + ' && /root/' + fileName + ' >> /var/log/letsencrypt.log';
resp = ExecCmdById("wget", execParams); 
debug.push(resp);

//download ssl generation script
fileName = urlGenScript.split('/').pop().split('?').shift();
execParams = ' --no-check-certificate ' + urlGenScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
resp = ExecCmdById("wget", execParams); 
debug.push(resp);

//write configs for ssl generation
var primaryDomain = window.location.host;
execParams = '\"domain=\'' + (customDomain || envDomain) + '\'\nemail=\''+email+'\'\nappid=\''+envAppid+'\'\nappdomain=\''+envDomain+'\'\ntest=\''+ (customDomain ? false : true)+  '\'\nprimarydomain=\''+primaryDomain +  '\'\n\" >  /opt/letsencrypt/settings' 
resp = ExecCmdById("printf", execParams); 
debug.push(resp);

//redirect incoming requests to master node  
resp = manageDnat('add');
debug.push(resp);

//execute ssl generation script 
execParams = '/root/' + fileName;
var execResp = resp = ExecCmdById("bash", execParams); 
debug.push(resp);

//removing redirect
resp = manageDnat('remove');
debug.push(resp);

if (execResp.responses) {
  //getting "error" and "out" for the further errors processing
  var out = "" + execResp.responses[0].error + execResp.responses[0].out;
  //just cutting "out" for debug logging becuase it's too long in ssl generation output  
  resp.responses[0].out = out.substring(out.length - 400);

  //checking errors in ssl generation output  
  var errors = {
    "An unexpected error": "Please see",
    "The following errors": "appid ="
  }

  for (var start in errors) {
    var end = errors[start];
    var ind1 = out.indexOf(start);
    if (ind1 != -1){
      var ind2 = out.indexOf(end, ind1);
      var error = ind2 == -1 ? out.substring(ind1) : out.substring(ind1, ind2);
      resp = {
        result: 99,
        error: error,
        response: error,
        type: "error", 
        message: error,
        debug: debug
      }
      return SendErrResp;
    }
  }
}

//configure cron job for auto update 
if (getParam("install")) {
  //save params for Unistall and Update button actions
  var params = toJSON({appid: appid, script: scriptName, token: token});
  resp = jelastic.dev.apps.ChangeAppInfo(envAppid, "description", params);
  debug.push(resp);
  
  //create the auto update cron 
  var autoUpdateUrl = "https://"+ window.location.host + "/" + scriptName + "?appid=" + appid + "&token=" + token + "&auto-update=1";
  fileName = urlUpdScript.split('/').pop().split('?').shift();
  execParams = ' ' + urlUpdScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName;
  execParams += ' && crontab -l | grep -v "' + fileName + '" | crontab - && echo \"' + cronTime + ' /root/' + fileName + ' \'' + autoUpdateUrl +'\' >> /var/log/letsencrypt.log\" >> /var/spool/cron/root';
  resp = ExecCmdById("wget", execParams); 
  debug.push(resp);
}

//read certificates
var cert_key = jelastic.env.file.Read(envName, session, "/tmp/privkey.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, session, "/tmp/cert.url", null, null, masterId);
var chain = jelastic.env.file.Read(envName, session, "/tmp/fullchain.url", null, null, masterId);

if (cert_key.body && chain.body && cert.body){
  resp = jelastic.env.binder.BindSSL(envName, session, cert_key.body, cert.body, chain.body);
  debug.push(resp);
} else {
  var error = "Can't read ssl certificate: key=" + toJSON(cert_key) + " cert=" + toJSON(cert) + " chain=" + toJSON(chain);
  resp = {
    result: 99, 
    error: error,
    response: error,
    type: "error", 
    message: error
  }
}

resp.debug = debug;
SendResp(resp);
return resp;

//managing certificate challenge validation by routing all requests to master node with let's encrypt engine   
function manageDnat(action) {
  var dnatParams = 'a | grep -q  ' + masterIP + ' || iptables -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  return jelastic.env.control.ExecCmdByGroup(envName, session, group, toJSON([{ "command": "ip", "params": dnatParams }]), true, false, "root"); 
}

function ExecCmdById(cmd, params){
  return jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": cmd, "params": params } ]), true, "root");  
}

function SendResp(resp){
  if (resp.result != 0){
    return SendErrResp(resp);
  } else {
    var array = baseUrlArr.slice();
    array.push("html/update-success.html?_r=" + Math.random()); 
    var html = new Transport().get(array.join("/"));
    var isUpdate = getParam("auto-update");
    return SendEmail("Successful " + (isUpdate ? "Update" : "Installation") + emailTitle, html.replace("${ENV_NAME}", envName).replace("${ACTION}", isUpdate ? "updated" : "installed"));
  }
}

function SendErrResp(resp){
   var array = baseUrlArr.slice();
   array.push("html/update-error.html?_r=" + Math.random()); 
   var html = new Transport().get(array.join("/"));
   SendEmail("Error" + emailTitle, html.replace("${RESP}", resp + "").replace("${SUPPORT_EMAIL}", "support@jelastic.com"));
   return resp;
}

function SendEmail(title, message){
  return jelastic.message.email.SendToUser(appid, session, email, title, message);
}
