//@auth
//@required(baseDir, cronTime)

import com.hivext.api.core.utils.Transport;
import com.hivext.api.development.Scripting;
import com.hivext.api.utils.Random;

var envName = '${env.envName}',
    customDomain = (getParam('customDomain') || '').replace(/^\s+|\s+$/g, ''),
    envDomain =  "${env.domain}",
    token = Random.getPswd(64),
    rnd = "?_r=" + Math.random(),
    scriptName = envName + "-letsencrypt-ssl",
    urlInstScript = baseDir + "/install-ssl.js" + rnd,
    urlLeScript = baseDir + "/install-le.sh" + rnd,
    urlGenScript = baseDir + "/generate-ssl-cert.sh" + rnd,
    urlUpdScript = baseDir + "/auto-update-ssl-cert.sh" + rnd;    
    urlValidationScript = baseDir + "/validation.sh" + rnd;

if (customDomain) {
    customDomain = customDomain.split(";").join(" ").split(",").join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/gm,'').split(" ");
    var regex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}(\n|$)/
    for (var i = 0; i < customDomain.length; i++) {
        if (!regex.test(customDomain[i])) return {result: 99, type:"error", message: "Domain " + customDomain[i] + " is invalid. Please double check specified domains in the External Domains field."}
    }
    customDomain = customDomain.join(" ");
}

//get nodeGroup 
var resp = jelastic.env.control.GetEnvInfo(envName, session);
if (resp.result != 0) return resp;

var nodes = resp.nodes, 
    group = 'cp';

for (var i = 0, n = nodes.length; i < n; i++) {
      if (nodes[i].nodeGroup == 'lb' || nodes[i].nodeGroup == 'bl') {
          group = nodes[i].nodeGroup;
          break;
      }
}

var version = jelastic.system.service.GetVersion().version.split("-").shift();

var masterId, masterIP;
for (var i = 0, n = nodes.length; i < n; i++) {
      if (nodes[i].nodeGroup != group) continue;
      if (!nodes[i].extIPs || nodes[i].extIPs.length == 0) {
          var resp;
          if (compareVersions(version, '4.9.5') >= 0 || version.indexOf('trunk') != -1) {
              resp = jelastic.env.control.AttachExtIp({ envName : envName, session : session, nodeid : nodes[i].id }); 
          } else {
              resp = jelastic.env.control.AttachExtIp(envName, session,nodes[i].id); 
          }
          if (resp.result != 0) return resp;
      }
      if (nodes[i].ismaster) { 
            masterId = nodes[i].id;
            masterIP = nodes[i].address;
      }
}

//download & execute validation script -> validateExtIP && validateDNSSettings
var fileName = urlValidationScript.split('/').pop().split('?').shift();
var execParams = ' --no-check-certificate ' + urlValidationScript + ' -O /root/' + fileName + ' && chmod +x /root/' + fileName + ' >> /var/log/letsencrypt.log && source /root/' + fileName + ' && validateExtIP && validateDNSSettings "' + (customDomain || envDomain) + '"';
resp = ExecCmdById("wget", execParams);

if (resp.result == 4109) {
      var error = resp.responses[0].out;
      resp = {
        result: 4109,
        type: "error", 
        error: error,
        response: error,
        message: error
      }
      return resp;
}

//getting script body
var scriptBody = new Transport().get(urlInstScript);

scriptBody = scriptBody.replace("${TOKEN}", token);
scriptBody = scriptBody.replace("${USER_EMAIL}", "${user.email}");
scriptBody = scriptBody.replace("${ENV_APPID}", "${env.appid}");
scriptBody = scriptBody.replace("${ENV_NAME}", envName.toString());
scriptBody = scriptBody.replace("${ENV_DOMAIN}", envDomain.toString());
scriptBody = scriptBody.replace("${CUSTOM_DOMAIN}", customDomain.toString());
scriptBody = scriptBody.replace("${LE_INSTALL}", urlLeScript.toString());
scriptBody = scriptBody.replace("${LE_GENERATE_SSL}", urlGenScript.toString());
scriptBody = scriptBody.replace("${UPDATE_SSL}", urlUpdScript.toString());
scriptBody = scriptBody.replace("${NODE_GROUP}", group.toString());
scriptBody = scriptBody.replace("${MASTER_IP}", masterIP.toString());
scriptBody = scriptBody.replace("${MASTER_ID}", masterId.toString());
scriptBody = scriptBody.replace("${SCRIPT_URL}", scriptName.toString());
scriptBody = scriptBody.replace("${SCRIPT_NAME}", scriptName.toString());
scriptBody = scriptBody.replace("${CRON_TIME}", cronTime.toString());

                                                               
//delete the script if it exists already
jelastic.dev.scripting.DeleteScript(scriptName);

//create a new script 
var resp = jelastic.dev.scripting.CreateScript(scriptName, "js", scriptBody);
if (resp.result != 0) return resp;

java.lang.Thread.sleep(1000);

//eval the script 
var resp = jelastic.dev.scripting.Eval(scriptName, {
    token: token,
    install: 1
});

if (resp.result == 0 && typeof resp.response === "object" && resp.response.result != 0) resp = resp.response;

function compareVersions(a, b) {
  a = a.split("."), b = b.split(".")
  for (var i = 0, l = Math.max(a.length, b.length); i < l; i++) {x = parseInt(a[i], 10) || 0; y = parseInt(b[i], 10) || 0; if (x != y) return x > y ? 1 : -1 }
  return 0;
}

function ExecCmdById(cmd, params){
  return jelastic.env.control.ExecCmdById(envName, session, masterId,  toJSON( [ { "command": cmd, "params": params } ]), true, "root");  
}

return resp;
