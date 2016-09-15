//@auth

var envName = '${env.envName}', 
nodes = jelastic.env.control.GetEnvInfo(envName, session).nodes,
action = getParam("action"), masterIP,
groups = [], selectedGroup, selectedGroupLenght,
dnatEnableParams,dnatDisableParams,
IPs = [], resp = [];

for (var i = 0, n = nodes.length; i < n; i++) { 
      groups.push(nodes[i].nodeGroup)
    }
    
if(groups.toString().indexOf("bl") > -1) { selectedGroup = 'bl';selectedGroupLenght = '${nodes.bl.length}'; }
   else if(groups.toString().indexOf("lb") > -1) { selectedGroup = 'lb'; selectedGroupLenght = '${nodes.lb.length}'; }
      else { selectedGroup ='cp' ; selectedGroupLenght = '${nodes.lb.length}'; }

if(selectedGroupLenght == 1) return {result: 0, responses: "alone node in entry point layer" };
       
for (var i = 0, n = nodes.length; i < n; i++) { 
      
      if(nodes[i].nodeGroup != selectedGroup) continue;
      if(!masterIP){ masterIP = nodes[i].address; continue; }
print (masterIP);

      if (action == 'add') {
            dnatEnableParams = ' -t nat -I PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443',
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id,  toJSON( [ { "command": "iptables", "params": dnatEnableParams } ]), true, "root"));; 
      } else {
            dnatDisableParams = ' -t nat -D PREROUTING -p tcp --dport 443 -j DNAT --to-destination ' + masterIP + ':443',
            resp.push(jelastic.env.control.ExecCmdById(envName, session, nodes[i].id, toJSON( [ { "command": "iptables", "params": dnatDisableParams } ]), true, "root"));;
      }
} 

print (dnatEnableParams + dnatDisableParams)

return {
    result: 0,
    responses: resp
}
