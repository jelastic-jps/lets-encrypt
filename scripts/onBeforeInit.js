let EXT_IP = 'environment.externalip.enabled';
let FIELD_NAME = 'withExtIp';
let isFieldExists = false;

let resp = api.billing.account.GetQuotas(EXT_IP);
if (resp.result != 0) return resp;

if (jps && jps.settings && jps.settings.fields) {
  for (let i = 0, n = jps.settings.fields.length; i < n; i++) {
    let field = jps.settings.fields[i];

    if (field && field['name'] == FIELD_NAME) {
      isFieldExists = true;

      if (resp.array[0].value == 0) {
        field['value'] = 'false';
      }
      break;
    }
  }
}

if (!isFieldExists && resp.array[0].value == 0) {
  jps.settings = jps.settings || {};
  jps.settings.fields = jps.settings.fields || [];
  jps.settings.fields.push({
    name: FIELD_NAME,
    value: 'false',
    hidden: true
  });
  jps.settings.fields.push(
    {"type": "displayfield", "cls": "warning", "height": 30, "hideLabel": true, "markup": "Using of public IP's is not possible because of such quota's value: 'environment.externalip.enabled'"}
  );
}

return { result: 0, settings: jps.settings}
