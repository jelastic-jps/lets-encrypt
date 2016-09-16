//@auth
//@req(action)

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes, 
masterIP, groupsMap = {}, resp = [];

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
            break;
      }
}

for (var i = 0, n = layerNodes.length; i < n; i++) { 
      if(layerNodes[i].ismaster) continue;
      var dnatParams = ' -t nat ' + (action == 'add' ? '-I' : '-D') + ' PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443';
      resp.push(jelastic.env.control.ExecCmdById(envName, session, layerNodes[i].id,  toJSON( [ { "command": "iptables", "params": dnatParams } ]), true, "root"));; 
} 

return {
    result: 0,
    responses: resp
}
