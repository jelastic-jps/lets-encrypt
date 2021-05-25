//@url('/${scriptNameAutoUpdate}')
return jelastic.marketplace.jps.ExecuteAppAction(appid, session, getParam("appUniqueName"), "auto-update");