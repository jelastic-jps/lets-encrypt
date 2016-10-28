//@auth
//@required('url', 'scriptName', 'scriptType', urlLeScript, urlGenScript, urlUpdateScript)

import com.hivext.api.core.utils.Transport;
import com.hivext.api.utils.Random;

var envName = '${env.envName}';
var customDomain = '${settings.customdomain}';
var envDomain =  "${env.domain}"

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

var scriptUrl = envName + '-' + scriptName,
    token = Random.getPswd(64);

//reading script from URL
var scriptBody = new Transport().get(url);

scriptBody = scriptBody.replace("${TOKEN}", token);
scriptBody = scriptBody.replace("${USER_EMAIL}", "${user.email}");
scriptBody = scriptBody.replace("${ENV_APPID}", "${env.appid}");
scriptBody = scriptBody.replace("${ENV_NAME}", envName.toString());
scriptBody = scriptBody.replace("${ENV_DOMAIN}", envDomain.toString());
scriptBody = scriptBody.replace("${CUSTOM_DOMAIN}", customDomain.toString());
scriptBody = scriptBody.replace("${LE_INSTALL}", urlLeScript.toString());
scriptBody = scriptBody.replace("${LE_GENERATE_SSL}", urlGenScript.toString());
scriptBody = scriptBody.replace("${UPDATE_SSL}", urlUpdateScript.toString());
scriptBody = scriptBody.replace("${NODE_GROUP}", group.toString());
scriptBody = scriptBody.replace("${MASTER_IP}", masterIP.toString());
scriptBody = scriptBody.replace("${MASTER_ID}", masterId.toString());
scriptBody = scriptBody.replace("${SCRIPT_URL}", scriptUrl.toString());

                                                               
//delete the script if it exists already
jelastic.dev.scripting.DeleteScript(scriptUrl);

//create a new script 
var resp = jelastic.dev.scripting.CreateScript(scriptUrl, scriptType, scriptBody);
if (resp.result != 0) return resp;

//get app domain
var domain = jelastic.dev.apps.GetApp(appid).hosting.domain;

//eval the script 
var resp = jelastic.dev.scripting.Eval(scriptUrl, {
    token: token,
    autoUpdateUrl: 'http://'+ domain + '/' + scriptUrl + '?token=' + token;
});

return resp;

/*
return {
    result: 0,
    onAfterReturn : {
        call : {
            procedure : next,
            params : {
                domain : domain,
                token : token
            }
        }
    }
}
*/
