//@auth
//@required(baseUrl, cronTime)

var baseDir          = getParam("baseDir", "/"),
    customDomains    = getParam("customDomains"),
    scriptName       = getParam("scriptName", "${env.envName}-letsencrypt-ssl"),
    nodeId           = getParam("nodeId", ""),
    nodeGroup        = getParam("nodeGroup", ""),
    deployHook       = getParam("deployHook", ""),
    deployHookType   = getParam("deployHookType", ""),
    undeployHook     = getParam("undeployHook", ""),
    undeployHookType = getParam("undeployHookType", ""),
    //withExtIp        = getParam("withExtIp", "true"),
    appId            = getParam("appId", "letsencrypt-ssl-addon"),
    test             = getParam("test", "");

function run() {
    var SSLManager = use("scripts/ssl-manager.js", {
        appId            : appId,
        session          : session,
        cronTime         : cronTime,
        baseUrl          : baseUrl,
        baseDir          : baseDir,
        scriptName       : scriptName,
        customDomains    : replace(customDomains),
        nodeId           : replace(String(nodeId)),
        nodeGroup        : replace(nodeGroup),
        deployHook       : replace(deployHook),
        deployHookType   : replace(deployHookType),
        undeployHook     : replace(undeployHook),
        undeployHookType : replace(undeployHookType),
        //withExtIp        : withExtIp,
        test             : test,
        envName          : "${env.envName}",
        envDomain        : "${env.domain}",
        envAppid         : "${env.appid}",
        email            : "${user.email}"
    });

    jelastic.local.ReturnResult(
        SSLManager.creteScriptAndInstall()
    );
}

function use(script, config) {
    var Transport = com.hivext.api.core.utils.Transport,
        body = new Transport().get(baseUrl + "/" + script + "?_r=" + Math.random());

    return new (new Function("return " + body)())(config);
}

function replace(str) {
    return str.replace(/^\${.*}$/, "");
}

try {
    run();
} catch (ex) {
    var resp = {
        result : com.hivext.api.Response.ERROR_UNKNOWN,
        error: "Error: " + toJSON(ex)
    };

    if (jelastic.marketplace && jelastic.marketplace.console) {
        jelastic.marketplace.console.WriteLog("ERROR: " + resp);
    }

    jelastic.local.ReturnResult(resp);
}
