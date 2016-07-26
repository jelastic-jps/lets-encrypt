//@req(domain)
import com.hivext.api.environment.Environment;

var APPID = getParam("TARGET_APPID"),
    SESSION = getParam("session"),
    NODE_MISSION_COMPUTE = "cp",
    oEnvService,
    oEnvInfo,
    envInfoResponse,
    envAttachExtIpResponse,
    lenghtCP,
    envId;

oEnvService = hivext.local.exp.wrapRequest(new Environment(APPID, SESSION));
envInfoResponse = oEnvService.getEnvInfo();

if (!envInfoResponse.isOK()) {
    return envInfoResponse;
}

oEnvInfo = toNative(envInfoResponse);

var nodes = envInfoResponse.getNodes();
var iterator = nodes.iterator();
var computeNodes = [];
  
while(iterator.hasNext()) {
    var softNode = iterator.next();
    var softNodeProperties = softNode.getProperties();
      
    if (NODE_MISSION_COMPUTE.equals(softNodeProperties.getNodeMission())) {
        computeNodes.push(softNode);
    }
}

lenghtCP = computeNodes.length;
for (var i = 0; i < lenghtCP; i += 1) {
    if(!oEnvInfo.nodes[i].extIPs) {
        jelastic.env.control.AttachExtIp(oEnvInfo.env.envName, SESSION, oEnvInfo.nodes[i].id);
    }
}

var domains = "-d " + oEnvInfo.env.domain + " ";
if (domain){
    domains += "-d " + domain + " ";
}

var extDomains = oEnvInfo.env.extdomains;
if (extDomains) {
    for (var i = 0; i < extDomains.length; i += 1) {
        domains += "-d " + extDomains[i] + " ";
    }
}

callArgs = [];
callArgs.push({
    procedure : "generate-ssl-cert",
    params : {
        domains : domains
    }
});

//why we call it twice? one more time in JPS
//callArgs.push({
//    procedure : "upload-ssl-cert"
//});

return {
    result : 0,
    onAfterReturn : {
        call : callArgs
    }
};
