var resp;

resp = api.dev.scripting.Eval("appstore", session, "GetApps", {
        targetAppid: getParam("envAppid"),
        search: {
          appstore: 1,
          app_id: getParam("app_id"),
          nodeGroup: getParam("nodeGroup")
        }
      });
if (resp.result != 0) return resp;

return api.marketplace.installation.ExecuteAction({
  appid: appid,
  session: session,
  appUniqueName: resp.response.apps[0].uniqueName,
  action: getParam("action")
});
