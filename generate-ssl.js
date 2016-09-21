//@auth
//@req(urlLeScript, urlGenScript)

var envName = '${env.envName}', 
envDomain = '${env.domain}',
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes, 
masterIP, masterID, groupsMap = {}, resp = [];

for (var i = 0, n = nodes.length; i < n; i++) {
      var ng = nodes[i].nodeGroup;
      if (!groupsMap[ng]) groupsMap[ng] = []; 
      groupsMap[ng].push(nodes[i]);
}

var layerNodes = groupsMap['lb'] ? groupsMap['lb'] : (groupsMap['bl'] ? groupsMap['bl'] : groupsMap['cp']);

if (layerNodes.length == 1) {
      return {result: 0, responses: "one node in entry point layer" };      
}

for (var i = 0, n = layerNodes.length; i < n; i++) { 
      if(!layerNodes[i].extIPs) {
        jelastic.env.control.AttachExtIp(envName, session, layerNodes[i].id);
      }
      if(layerNodes[i].ismaster) {
            masterIP = layerNodes[i].address;
            masterID = layerNodes[i].id
            break;
      }
}

function manageDnat(action)
 {
      for (var i = 0, n = layerNodes.length; i < n; i++) { 
            if(layerNodes[i].ismaster) continue;
            var dnatParams = ' -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
            resp.push(jelastic.env.control.ExecCmdById(envName, session, layerNodes[i].id,  toJSON( [ { "command": "iptables", "params": dnatParams } ]), true, "root"));; 
      } 

 }

lenghtCP = computeNodes.length;
for (var i = 0; i < lenghtCP; i += 1) {
    if(!oEnvInfo.nodes[i].extIPs) {
        jelastic.env.control.AttachExtIp(oEnvInfo.env.envName, SESSION, oEnvInfo.nodes[i].id);
    }


manageDnat('add');

var execParamsLe = ' ' + urlLeScript + ' -O /root/install-le.sh && chmod +x /root/install-le.sh && /root/install-le.sh >> /var/log/letsencrypt.log';
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "wget", "params": execParamsLe } ]), true, "root"));; 
var execParamsGe = ' ' + urlGenScript + ' -O /root/generate-ssl-cert.sh && chmod +x /root/generate-ssl-cert.sh';
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "wget", "params": execParamsGe } ]), true, "root"));; 
var createSettingsParams = '\"domain=\'${env.domain}\' \n email=\'${user.email}\' \n appid=\'${env.appid}\' \n appdomain=\'${env.domain}\'\" >  /opt/letsencrypt/settings' 
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "printf", "params": createSettingsParams } ]), true, "root"));; 
var execParamsMain = '/root/generate-ssl-cert.sh'
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "bash", "params": execParamsMain } ]), true, "root"));; 
//read certificates
var cert_key = jelastic.env.file.Read(envName, session, "/tmp/privkey.url", null, null,masterID);
var fullchain = jelastic.env.file.Read(envName, session, "/tmp/fullchain.url", null, null, masterID);
var cert = jelastic.env.file.Read(envName, session, "/tmp/cert.url", null, null, masterID);

manageDnat('remove');

return jelastic.env.binder.BindSSL(envName, session, cert_key.body, cert.body, fullchain.body);

