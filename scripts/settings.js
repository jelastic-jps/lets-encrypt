var extIP = "environment.externalip.enabled",
   extIPperEnv = "environment.externalip.maxcount",
   extIPperNode = "environment.externalip.maxcount.per.node",
   markup = "", cur = null, text = "used", LE = true;

var quotas = jelastic.billing.account.GetQuotas(extIP + ";"+extIPperEnv+";" + extIPperNode ).array;
for (var i = 0; i < quotas.length; i++){
  var q = quotas[i], n = toNative(q.quota.name);

  if (n == extIP &&  !q.value){
    err(q, "required", 1, true);
    LE  = false; 
  }

  if (n == extIPperEnv && q.value < 1){
    if (!markup) err(q, "required", 1, true);
    LE = false;
  }

  if (n == extIPperNode && q.value < 1){
    if (!markup) err(q, "required", 1, true);
    LE = false;
  }
}

if (!LE) {
  fields["displayfield"].markup = "Some advanced features are not available. Please upgrade your account.";
  fields["displayfield"].cls = "warning";
  fields["displayfield"].hideLabel = true;
  fields["displayfield"].height = 25;
  fields["le-addon"].disabled = true;
  fields["le-addon"].value = false;
  fields["bl_count"].markup = "Let's Encrypt is not available. " + markup + "Please upgrade your account.";
  fields["bl_count"].cls = "warning";
  fields["bl_count"].hidden = false;
  fields["bl_count"].height = 30;  
}

return {
    result: 0,
    settings: settings
};
