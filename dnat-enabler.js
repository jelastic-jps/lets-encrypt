//@auth

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes
//enabled = getParam("enabled"),

IPs = [], resp = [];

for (var i = 0, n = nodes.length; i < n;) { 
      if (true) 
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id,  toJSON( [ { "command": "echo", "params": "snat-enabled >> /root/test" } ]), true, "root"));; 
      else 
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id, toJSON( [ { "command": "echo", "params": "snat-disabled >> /root/test" } ]), true, "root"));;
}


return {
    result: 0,
    responses: resp
}
