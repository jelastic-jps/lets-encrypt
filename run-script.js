//@url('/updatessl')
//@required('token', 'targetAppid', 'url')

import com.hivext.api.core.utils.Transport;
import com.hivext.api.utils.Random;

var scriptBody = new Transport().get(url);
var params = {
    urlLeScript : "https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/install-le.sh",
    urlGenScript : "https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/generate-ssl-cert.sh"
}

if (token == "${TOKEN}") {
  return hivext.dev.scripting.EvalCode(appid, signature, scriptBody, "js", null, params)
} else {
  return {"result": 8, "error": "wrong token"}
}

