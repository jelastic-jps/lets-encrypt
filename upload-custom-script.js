//@auth
//@required('url', 'scriptName', 'scriptType')

import com.hivext.api.core.utils.Transport;
import com.hivext.api.utils.Random;

//reading script from URL
var scriptBody = new Transport().get(url)

//inject token
var token = Random.getPswd(64);
scriptBody = scriptBody.replace("${TOKEN}", token);

//delete the script if it exists already
jelastic.dev.scripting.DeleteScript(scriptName);

//create a new script 
var resp = hivext.dev.scripting.CreateScript(scriptName, scriptType, scriptBody);
if (resp.result != 0) return resp;

return {"result": 0, "message": "Script uploaded"}
