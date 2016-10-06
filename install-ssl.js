//auth
//@url('/install-ssl-script')
//@req(token, envName, urlLeScript, urlGenScript, group)

if (token != "${TOKEN}") {
  return {"result": 8, "error": "wrong token"}
}

var envDomain = getParam("domain") || "${ENV_DOMAIN}";
var masterId = getParam("masterId") || "${MASTER_ID}"

/*
var nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes, 
masterIP, masterID, groupsMap = {}, resp = [], envDomain;

/*
for (var i = 0, n = nodes.length; i < n; i++) {
      var ng = nodes[i].nodeGroup;
      if (!groupsMap[ng]) groupsMap[ng] = []; 
      groupsMap[ng].push(nodes[i]);
}

var layerNodes = groupsMap['lb'] ? groupsMap['lb'] : (groupsMap['bl'] ? groupsMap['bl'] : groupsMap['cp']);

if (layerNodes.length == 1) {
      return {result: 0, responses: "one node in entry point layer" };      
}

/*
for (var i = 0, n = layerNodes.length; i < n; i++) { 
      if(!layerNodes[i].extIPs) {
        jelastic.env.control.AttachExtIp(envName, signature, layerNodes[i].id);
      }
}
*/

function manageDnat(action)
  var dnatParams = ' -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
  resp.push(jelastic.env.control.ExecCmdByGroup(envName, signature, group,  toJSON( [ { "command": "iptables", "params": dnatParams } ]), true, "root"));; 
}

manageDnat('add');


//download 
var execParamsLe = ' ' + urlLeScript + ' -O /root/install-le.sh && chmod +x /root/install-le.sh && /root/install-le.sh >> /var/log/letsencrypt.log';
resp.push(jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "wget", "params": execParamsLe } ]), true, "root"));; 
var execParamsGe = ' ' + urlGenScript + ' -O /root/generate-ssl-cert.sh && chmod +x /root/generate-ssl-cert.sh';
resp.push(jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "wget", "params": execParamsGe } ]), true, "root"));; 

//exec
var createSettingsParams = '\"domain=\''+envDomain+'\' \n email=\'${USER_EMAIL}\' \n appid=\'${ENV_APPID}\' \n appdomain=\'${ENV_DOMAIN}\'\" >  /opt/letsencrypt/settings' 
resp.push(jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "printf", "params": createSettingsParams } ]), true, "root"));; 
var execParamsMain = '/root/generate-ssl-cert.sh'
resp.push(jelastic.env.control.ExecCmdById(envName, signature, masterId,  toJSON( [ { "command": "bash", "params": execParamsMain } ]), true, "root"));; 

//read certificates
var cert_key = jelastic.env.file.Read(envName, signature, "/tmp/privkey.url", null, null, masterId);
var fullchain = jelastic.env.file.Read(envName, signature, "/tmp/fullchain.url", null, null, masterId);
var cert = jelastic.env.file.Read(envName, signature, "/tmp/cert.url", null, null, masterId);

manageDnat('remove');

return jelastic.env.binder.BindSSL(envName, signature, cert_key.body, cert.body, fullchain.body);

