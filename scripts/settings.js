  var extIP = "environment.externalip.enabled",
   extIPperEnv = "environment.externalip.maxcount",
   extIPperNode = "environment.externalip.maxcount.per.node",
   markup = "", cur = null, text = "used", LE = true, fields = [];

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
    for (var i = 0, field; field = jps.settings.fields[i]; i++) {
      if (field.name == "ext_ip") {
        field.markup = "Let's Encrypt is not available. " + markup + "Please upgrade your account.";
        field.cls = "warning";
        field.hidden = false;
        field.height = 30; 
        field.required = true;
      }
    }
    jps.settings.fields.push({"type": "compositefield","height": 0,"hideLabel": true,"width": 0,"items": [{"height": 0,"type": "string","required": true}]});
  }
  
  function err(e, text, cur, override){
    var m = (e.quota.description || e.quota.name) + " - " + e.value + ", " + text + " - " + cur + ". ";
    if (override) markup = m; else markup += m;
  }

  return {
      result: 0,
      settings: jps.settings
  };
