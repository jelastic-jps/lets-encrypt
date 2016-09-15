//@auth
//@req(nodeGroup)

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes,
enabled = getParam("enabled"),
IPs = [], resp = [];

for (var i = 0; i < nodes.length; i++) { 
      if (nodes[i].nodeGroup != nodeGroup) continue;
      if (enabled = "true") resp.push(jelastic.env.control.execCmd(envName, session, nodes[i].id, "echo snat-enabled >> /root/test"));; 
      if (enabled = "false") resp.push(jelastic.env.control.execCmd(envName, session, nodes[i].id, "echo snat-disabled >> /root/test"));;
}


return {
    result: 0,
    responses: resp
}
