//@req(action)

let resp = api.dev.scripting.Eval("appstore", session, "GetApps", {
    targetAppid: "${envAppid}",
    search: {
        appstore: 1,
        app_id: "${appId}",
        nodeGroup: "${nodeGroup}"
    }
});
if (resp.result != 0) return resp;

if (resp.response) {
    let addon = resp.response.apps && resp.response.apps[0];

    if (addon && addon.isInstalled) {
        let CONFIGURE_ACTION = "configure";

        if (!hasFullCollaborationSupport(addon)) {
            action = CONFIGURE_ACTION;
        }

        let actionParams = {
            appid: appid,
            session: session,
            appUniqueName: addon.uniqueName,
            action: action
        };

        if (action == CONFIGURE_ACTION) {
            actionParams.settingsId = "main";
            actionParams.params = (addon.settings || {}).data || {
                customDomains: getParam("customDomains") || ""
            };
        }

        return api.marketplace.installation.ExecuteAction(actionParams);
    }
}

function hasFullCollaborationSupport(addon) {
    let resp = api.marketplace.installation.GetInfo({ appUniqueName: addon.uniqueName });

    if (resp.result !== 0) {
        api.marketplace.console.WriteLog("[WARNING]: api.marketplace.installation.GetInfo = " + resp);
    }

    return String((resp.app || {}).jps).indexOf("CreatePersistence") > -1;
}

return { result: 0 };
