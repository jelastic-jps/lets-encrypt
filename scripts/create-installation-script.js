//@auth
//@required(baseDir, cronTime)

import com.hivext.api.core.utils.Transport;
import com.hivext.api.development.Scripting;
import com.hivext.api.utils.Random;

var envName = '${env.envName}',
    customDomain = '${settings.extDomain}' == 'customDomain' ? '${settings.customDomain}' : '',
    envDomain =  "${env.domain}",
    token = Random.getPswd(64),
    
    scriptName = envName + "-install-ssl-script",
    urlInstScript = baseDir + "/install-ssl-script.js?_r" + Math.random(),
    urlLeScript = baseDir + "/install-le.sh?_r" + Math.random(),
    urlGenScript = baseDir + "/generate-ssl-cert.sh?_r" + Math.random(),
    urlUpdcript = baseDir + "/auto-update-ssl-cert.sh?_r" + Math.random();    

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
scriptBody = scriptBody.replace("${CRON_TIME}", cronTime.toString());

                                                               
//delete the script if it exists already
jelastic.dev.scripting.DeleteScript(scriptName);

//create a new script 
var resp = jelastic.dev.scripting.CreateScript(scriptName, "js", scriptBody);
if (resp.result != 0) return resp;

//get app domain
var domain = jelastic.dev.apps.GetApp(appid).hosting.domain;

//eval the script 
var resp = jelastic.dev.scripting.Eval(scriptName, {
    token: token,
    autoUpdateUrl: 'http://'+ domain + '/' + scriptName + '?token=' + token
});
if (resp.result != 0) return resp;
if (resp.response.result != 0) return resp.response;

var scripting =  hivext.local.exp.wrapRequest(new Scripting({
    serverUrl : "http://" + window.location.host.replace("app", "appstore") + "/"
}));

//getting url of the success message text
var array = baseDir.split("/");
array.pop();
array.push("html/success.html?_r" + Math.random()); 
var successHtml = array.join("/")
    
//adding add-on for the further actions via dashboard 
resp = scripting.eval({
    script : "InstallApp",
    targetAppid : '${env.appid}',
    session: session, 
    manifest : {
        jpsType : "update",
        application : {
		id: "sendEmail",
		name: "Let's Encrypt SSL",
            	targetNodes: {
                	nodeGroup: group
            	},
		success: {
	        	email: new Transport().get(successHtml)
		},
		onUninstall: {
        		execScript: {
				type: "js",
				script: urlInstScript + "&unistall=1"
			}
      		}
	 }
    }
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
