//@auth

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes,
enabled = Boolean(getParam("enabled")),
masterIP = nodes[0].address,
iptablesDnatStringEnable = 'enableForIp' + masterIP + '>> /root/test',
iptablesDnatStringDisable = 'disableForIp' + masterIP + '>> /root/test',
IPs = [], resp = [];

for (var i = 1, n = nodes.length; i < n; i++) { 

    if (enabled) {
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id,  toJSON( [ { "command": "echo", "params": iptablesDnatStringEnable } ]), true, "root"));; 
    } else {
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id, toJSON( [ { "command": "echo", "params": iptablesDnatStringDisable } ]), true, "root"));;
 
    }
}


return {
    result: 0,
    responses: resp
}
