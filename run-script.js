//@url('/updatessl') 
//@required('token', 'targetAppid', 'url')

import com.hivext.api.core.utils.Transport;
import com.hivext.api.utils.Random;
import com.hivext.dev.scripting.Eval;

var scriptBody = new Transport().get(url);


if (token == "${TOKEN}") {
  return hivext.dev.scripting.Eval(targetAppid, session, scriptBody, params)
} else {
  return {"result": 8, "error": "wrong token"}
}
