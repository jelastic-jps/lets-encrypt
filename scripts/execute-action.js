var resp;

resp = api.dev.scripting.Eval("appstore", session, "GetApps", {
        targetAppid: "${envAppid}",
        search: {
          appstore: 1,
          app_id: "${appId}",
          nodeGroup: "${nodeGroup}"
        }
      });
if (resp.result != 0) return resp;

return api.marketplace.installation.ExecuteAction({
  appid: appid,
  session: session,
  appUniqueName: resp.response.apps[0].uniqueName,
  action: getParam("action")
});
