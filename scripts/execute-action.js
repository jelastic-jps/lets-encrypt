var resp;

resp = api.marketplace.app.GetAddonList(getParam("envAppid"), session, getParam("nodeGroup"), { app_id: getParam("app_id")});
if (resp.result != 0) return resp;

return api.marketplace.installation.ExecuteAction({
  appid: appid,
  session: session,
  appUniqueName: resp.apps[0].uniqueName,
  action: getParam("action")
});
