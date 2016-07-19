import com.hivext.api.environment.Environment;

var APPID = getParam("TARGET_APPID"),
    SESSION = getParam("session"),
    NODE_GROUP = "cp",//getParam("nodeGroup");
    oEnvInfo;

oEnvInfo = new Environment(APPID, SESSION).getEnvInfo();

return oEnvInfo;
if (!oEnvInfo.isOK()) return oEnvInfo;

//read certificates
var cert_key = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/privkey.url", null, NODE_GROUP, -1);
var fullchain = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/fullchain.url", null, NODE_GROUP, -1);
var cert = jelastic.env.file.Read(oEnvInfo.env.envName, SESSION, "/tmp/cert.url", null, NODE_GROUP, -1);

//upload certificates

//apply certificates
return jelastic.env.binder.BindSSL(oEnvInfo.env.envName, SESSION, cert_key.body, cert.body, fullchain.body);
