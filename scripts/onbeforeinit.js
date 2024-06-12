let extIP = "environment.externalip.enabled";
let extIPperEnv = "environment.externalip.maxcount";
let extIPperNode = "environment.externalip.maxcount.per.node";
let FIELD_NAME = 'withExtIp';
let markup = "", ext_ip = true, quotas;
let hasCollaboration = (parseInt('${fn.compareEngine(7.0)}', 10) >= 0);

if (hasCollaboration) {
  quotas = [
    { quota : { name: extIP }, value: parseInt('${quota.environment.externalip.enabled}', 10) },
    { quota : { name: extIPperEnv }, value: parseInt('${quota.environment.externalip.maxcount}', 10) },
    { quota : { name: extIPperNode }, value: parseInt('${quota.environment.externalip.maxcount.per.node}', 10) }
  ];
} else {
  resp = jelastic.billing.account.GetQuotas(extIP + ";"+extIPperEnv+";" + extIPperNode );
  if (resp.result != 0) return resp;
  quotas = resp.array;
}

for (var i = 0; i < quotas.length; i++) {
  var q = quotas[i], n = toNative(q.quota.name);

  if (n == extIP && !q.value) {
    ext_ip = false;
    err(q, false);
  }

  if (n == extIPperEnv && q.value < 1) {
    ext_ip = false;
    err(q, false);
  }

  if (n == extIPperNode && q.value < 1) {
    ext_ip = false;
    err(q, false);
  }
}

function err(e, override) {
  let m = (e.quota.description || e.quota.name) + " - " + e.value + "; ";
  if (override) markup = m; else markup += m;
}

if (!ext_ip) {
  jps.settings.fields.push({
    name: FIELD_NAME,
    value: 'false',
    hidden: true
  });
  jps.settings.fields.push({"type": "displayfield", "cls": "warning", "height": 30, "hideLabel": true, "markup": "Using of public IP's is not possible because of such quota's values: " + markup});
}

return {
  result: 0,
  settings: jps.settings
};