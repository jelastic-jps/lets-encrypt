//@auth
//@required('url', 'scriptName', 'scriptType', urlLeScript, urlGenScript)

import com.hivext.api.core.utils.Transport;
import com.hivext.api.utils.Random;

var envName = '${env.envName}';

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
      if(!nodes[i].extIPs) jelastic.env.control.AttachExtIp(envName, session, nodes[i].id);
      if(nodes[i].ismaster) { 
            masterId = nodes[i].id;
            masterIP = nodes[i].address;
      }
}

//reading script from URL
var scriptBody = new Transport().get(url);

//inject token
var token = Random.getPswd(64);
scriptBody = scriptBody.replace("${TOKEN}", token);
scriptBody = scriptBody.replace("${ENV_DOMAIN}", '${settings.customdomain}');
scriptBody = scriptBody.replace("${USER_EMAIL}", "${user.email}");
scriptBody = scriptBody.replace("${ENV_APPID}", "${env.appid}");
scriptBody = scriptBody.replace("${ENV_NAME}", envName);
scriptBody = scriptBody.replace("${LE_INSTALL}", urlLeScript.toString());
scriptBody = scriptBody.replace("${LE_GENERATE_SSL}", urlGenScript.toString());
scriptBody = scriptBody.replace("${NODE_GROUP}", group.toString());
scriptBody = scriptBody.replace("${MASTER_IP}", masterIP.toString());
scriptBody = scriptBody.replace("${MASTER_ID}", masterId.toString());


//delete the script if it exists already
jelastic.dev.scripting.DeleteScript(scriptName);

//create a new script 
var resp = hivext.dev.scripting.CreateScript(scriptName, scriptType, scriptBody);
if (resp.result != 0) return resp;

//get app domain
var domain = jelastic.dev.apps.GetApp(appid).hosting.domain;

//eval the script 
var resp = hivext.dev.scripting.Eval(scriptName, {
    token: token
});
return resp;
    
//     "cmd": "wget -qO http://${this.domain}/install-ssl-script?token=${this.token}&domain=${settings.customdomain}&urlLeScript=https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/install-le.sh&urlGenScript=https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/generate-ssl-cert.sh >> /var/log/run.log"

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
