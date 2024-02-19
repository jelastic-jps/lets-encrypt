//@reg(action)

var resp = api.dev.scripting.Eval("appstore", session, "GetApps", {
    targetAppid: "${envAppid}",
    search: {
        appstore: 1,
        app_id: "${appId}",
        nodeGroup: "${nodeGroup}"
    }
});
if (resp.result != 0) return resp;

if (resp.response) {
    if (resp.response.apps && resp.response.apps[0] && resp.response.apps[0].isInstalled) {
        var actionParams = {
            appid: appid,
            session: session,
            appUniqueName: resp.response.apps[0].uniqueName,
            action: action
        };

        if (action == "configure") {
            actionParams.settingsId = "main";
            actionParams.params = (resp.response.apps[0].settings || {}).data || {
                customDomains: getParam("customDomains") || ""
            };
        }

        return api.marketplace.installation.ExecuteAction(actionParams);
    }
}

return { result: 0 }
