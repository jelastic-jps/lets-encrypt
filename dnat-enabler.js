//@auth

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes,
enabled = getParam("enabled"),
IPs = [], resp = [];

for (var i = 0; i < nodes.length; i++) { 
      if (enabled) 
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id, [ { "command": "echo", "params": "snat-enabled >> /root/test" } ], true, "root"));;
      else 
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id, "echo snat-disabled >> /root/test", true, "root"));;
}


return {
    result: 0,
    responses: resp
}
