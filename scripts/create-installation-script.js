//@auth
//@required(baseUrl, cronTime)

var baseDir        = getParam("baseDir", "/"),
    customDomains  = getParam("customDomains"),
    scriptName     = getParam("scriptName", "${env.envName}-letsencrypt-ssl"),
    nodeId         = getParam("nodeId", ""),
    nodeGroup      = getParam("nodeGroup", ""),
    deployHook     = getParam("deployHook", ""),
    undeployHook   = getParam("undeployHook", ""),
    test           = getParam("test", "");

function run() {
    var SSLManager = use("scripts/ssl-manager.js", {
        session        : session,
        cronTime       : cronTime,
        baseUrl        : baseUrl,
        baseDir        : baseDir,
        customDomains  : customDomains,
        scriptName     : scriptName,
        nodeId         : replace(String(nodeId)),
        nodeGroup      : replace(nodeGroup),
        deployHook     : replace(deployHook),
        undeployHook   : replace(undeployHook),
        test           : test,
        envName        : "${env.envName}",
        envDomain      : "${env.domain}",
        envAppid       : "${env.appid}",
        email          : "${user.email}"
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
