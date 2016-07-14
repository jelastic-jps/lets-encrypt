import com.hivext.api.environment.Environment;

var APPID = getParam("TARGET_APPID"),
    SESSION = getParam("session"),
    NODE_MISSION_COMPUTE = "cp",
    oEnvService,
    oEnvInfo,
    envInfoResponse;

oEnvService = hivext.local.exp.wrapRequest(new Environment(APPID, SESSION));
envInfoResponse = oEnvService.getEnvInfo();

if (!envInfoResponse.isOK()) {
    return envInfoResponse;
}

oEnvInfo = toNative(envInfoResponse);
domain = oEnvInfo.env.domain;

var cert_key = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/privkey.url", null, NODE_MISSION_COMPUTE, -1);
var fullchain = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/fullchain.url", null, NODE_MISSION_COMPUTE, -1);
var cert = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/cert.url", null, NODE_MISSION_COMPUTE, -1);

jelastic.env.binder.BindSSL(oEnvInfo.env.envName, SESSION, cert_key.body, cert.body, fullchain.body);

return {
    result : 0
};
