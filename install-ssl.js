//@auth
//@req(url)
import com.hivext.api.core.utils.Transport;

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

manageDnat('add');

var execParams = ' ' + url + ' -O /root/generate-ssl-cert.sh && chmod +x /root/generate-ssl-cert.sh';
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "wget", "params": execParams } ]), true, "root"));; 
var createSettingsParams = '"domain=\'${env.domain}\' \n email=\'${user.email}\' \n appid=\'${env.appid}\' \n appdomain=\'${env.domain}\'" >  /opt/letsencrypt/settings' 
\\print (createSettingsParams);
resp.push(jelastic.env.control.ExecCmdById(envName, session, masterID,  toJSON( [ { "command": "printf", "params": createSettingsParams } ]), true, "root"));; 


manageDnat('remove');

return {
    result: 0,
    responses: resp
}
