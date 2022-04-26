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
        return api.marketplace.installation.ExecuteAction({
          appid: appid,
          session: session,
          appUniqueName: resp.response.apps[0].uniqueName,
          action: action
        });
    }            
}

return { result: 0 }
