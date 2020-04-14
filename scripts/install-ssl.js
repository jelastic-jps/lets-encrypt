//@url('/${scriptName}')

var action = getParam("action", "install"),
    patchVersion  = getParam("patchVersion"),
    token  = getParam("token"),
    isTask = getParam("task"),
    baseUrl = "${baseUrl}";

function run() {
    var SSLManager = use("scripts/ssl-manager.js", {
        session          : session,
        isTask           : isTask,
        baseUrl          : baseUrl,
        action           : action,
        
        token            : "${token}",
        email            : "${email}",
        baseDir          : "${baseDir}",
        scriptName       : "${scriptName}",
        envName          : "${envName}",
        envDomain        : "${envDomain}",

        appId            : "${appId}",
        envAppid         : "${envAppid}",
        nodeId           : "${nodeId}",
        nodeIp           : "${nodeIp}",
        nodeGroup        : "${nodeGroup}",
        customDomains    : "${customDomains}",
        cronTime         : "${cronTime}",
        deployHook       : "${deployHook}",
        deployHookType   : "${deployHookType}",
        undeployHook     : "${undeployHook}",
        undeployHookType : "${undeployHookType}",
        withExtIp        : "${withExtIp}",
        fallbackToX1     : "${fallbackToX1}",
        patchVersion     : "${patchVersion}",
        setValidations   : "${setValidations}",
        test             : "${test}"
    });

    var resp = SSLManager.auth(token);

    if (resp.result === 0) {
        resp = SSLManager.invoke(action);
    }

    jelastic.local.ReturnResult(resp);
}

function use(script, config) {
    var Transport = com.hivext.api.core.utils.Transport,
        body = new Transport().get(baseUrl + "/" + script + "?_r=" + Math.random());

    return new (new Function("return " + body)())(config);
}

try {
    run();
} catch (ex) {
    var resp = {
        result : com.hivext.api.Response.ERROR_UNKNOWN,
        error: "Error: " + toJSON(ex)
    };

    if (jelastic.marketplace && jelastic.marketplace.console) {
        jelastic.marketplace.console.WriteLog(appid, signature, "ERROR: " + resp);
    }

    jelastic.local.ReturnResult(resp);
}
