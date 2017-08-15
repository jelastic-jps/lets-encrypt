//@auth
//@required(baseDir, cronTime)

import com.hivext.api.core.utils.Transport;
import com.hivext.api.development.Scripting;
import com.hivext.api.utils.Random;

var envName = '${env.envName}',
    customDomain = '${settings.extDomain}' == 'customDomain' ? '${settings.customDomain}' : '',
    envDomain =  "${env.domain}",
    token = Random.getPswd(64),
    rnd = "?_r=" + Math.random(),
    scriptName = envName + "-letsencrypt-ssl",
    urlInstScript = baseDir + "/install-ssl.js" + rnd,
    urlLeScript = baseDir + "/install-le.sh" + rnd,
    urlGenScript = baseDir + "/generate-ssl-cert.sh" + rnd,
    urlUpdScript = baseDir + "/auto-update-ssl-cert.sh" + rnd;    

//get nodeGroup 
var nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes, 
    group = 'cp';

for (var i = 0, n = nodes.length; i < n; i++) {
      if (nodes[i].nodeGroup == 'lb' || nodes[i].nodeGroup == 'bl') {
          group = nodes[i].nodeGroup;
          break;
      }
}

var masterId, masterIP;
for (var i = 0, n = nodes.length; i < n; i++) {
      if (nodes[i].nodeGroup != group) continue;
      if (!nodes[i].extIPs) jelastic.env.control.AttachExtIp(envName, session, nodes[i].id); 
      if (nodes[i].ismaster) { 
            masterId = nodes[i].id;
            masterIP = nodes[i].address;
      }
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

//eval the script 
var resp = jelastic.dev.scripting.Eval(scriptName, {
    token: token,
    install: 1
});

return resp;
