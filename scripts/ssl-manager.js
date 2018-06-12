function SSLManager(config) {
    /**
     * Implements Let's Encrypt SSL management of the Jelastic environment
     * @param {{
     *      envName : {String}
     *      envDomain : {String}
     *      envAppid : {String}
     *      baseUrl : {String}
     *      baseDir : {String}
     *      scriptName : {String}
     *      cronTime : {String}
     *      email : {String}
     *      [session] : {String}
     *      [token] : {String}
     *      [isTask] : {Boolean}
     *      [nodeId] : {Number}
     *      [nodeIp] : {String}
     *      [nodeGroup] : {String}
     *      [customDomains] : {String}
     *      [deployHook] : {String}
     *      [undeployHook] : {String}
     *      [test] : {Boolean}
     * }} config
     * @constructor
     */

    var Response = com.hivext.api.Response,
        Transport = com.hivext.api.core.utils.Transport,
        StrSubstitutor = org.apache.commons.lang3.text.StrSubstitutor,
        Random = com.hivext.api.utils.Random,
        me = this,
        isValidToken = false,
        debug = [],
        nodeManager,
        baseUrl,
        session;

    config = config || {};
    session = config.session || "";

    nodeManager = new NodeManager(config.envName, config.nodeId, config.baseDir);
    nodeManager.setLogPath("var/log/letsencrypt.log");

    me.auth = function (token) {
        if (!config.session && String(token).replace(/\s/g, "") != config.token) {
            return {
                result: Response.PERMISSION_DENIED,
                error: "wrong token",
                type:"error",
                message:"Token [" + token + "] does not match",
                response: { result: Response.PERMISSION_DENIED }
            };
        } else {
            isValidToken = true;
        }

        return { result : 0 };
    };

    me.invoke = function (action) {
        var actions = {
            "install"     : me.install,
            "uninstall"   : me.uninstall,
            "auto-update" : me.autoUpdate
        };

        if (!actions[action]) {
            return {
                result : Response.ERROR_UNKNOWN,
                error : "unknown action [" + action + "]"
            }
        }

        return actions[action].call(me);
    };

    me.install = function (isUpdate) {
        var resp;

        me.execAll([
            me.installLetsEncrypt,
            me.generateSslConfig
        ]);

        resp = me.exec(me.generateSslCerts);

        if (resp.result == 0) {
            me.exec(me.scheduleAutoUpdate);
            resp = me.exec(me.deploy);
        }

        me.exec(me.sendResp, resp, isUpdate);

        return resp;
    };

    me.uninstall = function () {
        var autoUpdateScript = nodeManager.getScriptPath("auto-update-ssl-cert.sh");

        return me.execAll([
            [ me.cmd, "crontab -l 2>/dev/null | grep -v '%(scriptPath)' | crontab -", {
                scriptPath : autoUpdateScript
            }],

            me.undeploy,

            [ me.cmd, 'rm -rf %(paths)', {
                paths : [
                    // "/etc/letsencrypt",
                    nodeManager.getPath("opt/letsencrypt"),
                    nodeManager.getScriptPath("generate-ssl-cert.sh"),
                    nodeManager.getScriptPath("letsencrypt_settings"),
                    nodeManager.getScriptPath("install-le.sh"),
                    nodeManager.getScriptPath("validation.sh"),
                    autoUpdateScript
                ].join(" ")
            }]
        ]);
    };

    me.autoUpdate = function () {
        var resp;

        if (getPlatformVersion() < "4.9.5") {
            return me.exec(me.sendEmail, "Action Required", "html/update-required.html");
        }

        if (!config.isTask) {
            if (me.hasValidToken()) {
                session = signature;
            }

            return me.exec(me.addAutoUpdateTask);
            // resp = nodeManager.getEnvInfo();
            //
            // if (resp.result != 0) {
            //     return me.checkEnvAccessAndUpdate(resp);
            // }
        }

        return me.install(true);
    };

    this.checkEnvAccessAndUpdate = function (errResp) {
        var errorMark = "session [xxx"; //mark of error access to a shared env

        if (errResp.result == Response.USER_NOT_AUTHENTICATED && errResp.error.indexOf(errorMark) > -1) {
            //creating new session using Scheduler
            return me.exec(me.addAutoUpdateTask);
        }

        return me.exec(me.sendErrResp, errResp);
    };

    me.addAutoUpdateTask = function addAutoUpdateTask() {
        return jelastic.utils.scheduler.AddTask({
            appid: appid,
            session: session,
            script: config.scriptName,
            trigger: "once_delay:1000",
            description: "update LE sertificate",
            params: { token: config.token, task: 1, "auto-update": 1 }
        });
    };

    me.hasValidToken = function () {
        return isValidToken;
    };

    me.creteScriptAndInstall = function createInstallationScript() {
        return me.exec([
            [ me.applyCustomDomains, config.customDomains ],
            [ me.initEntryPoint ],
            [ me.validateEntryPoint ],
            [ me.createScript ],
            [ me.evalScript, "install" ]
        ]);
    };

    me.parseDomains = function (domains) {
        return (domains || "").replace(/^\s+|\s+$/gm , "").split(/\s*[;,\s]\s*/);
    };

    me.applyCustomDomains = function applyCustomDomains(domains) {
        var domainRegex;

        if (domains) {
            domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}(\n|$)/;

            domains = me.parseDomains(domains);

            for (var i = domains.length; i--;) {
                if (!domainRegex.test(domains[i])) {
                    return {
                        result: Response.ERROR_UNKNOWN,
                        type: "error",
                        message: "Domain " + domains[i] + " is invalid. Please double check specified domains in the External Domains field."
                    };
                }
            }

            me.setCustomDomains(domains.join(" "));
        }

        return { result : 0 };
    };

    me.setCustomDomains = function (domains) {
        config.customDomains = domains;
    };

    me.getCustomDomains = function () {
        return config.customDomains;
    };

    me.getFileUrl = function (filePath) {
        return config.baseUrl + "/" + filePath + "?_r=" + Math.random();
    };

    me.getScriptUrl = function (scriptName) {
        return me.getFileUrl("scripts/" + scriptName);
    };

    me.initEntryPoint = function initEntryPoint() {
        var group = config.nodeGroup,
            id = config.nodeId,
            nodes,
            resp;

        if (!id && !group) {
            resp = nodeManager.getEntryPointGroup();
            if (resp.result != 0) return resp;

            group = resp.group;
            config.nodeGroup = group;
        }

        resp = nodeManager.getEnvInfo();

        if (resp.result != 0) return resp;
        nodes = resp.nodes;

        for (var j = 0, node; node = nodes[j]; j++) {
            if ((id && node.id != id) ||
                (!id && node.nodeGroup != group)) continue;

            if (!node.extIPs || node.extIPs.length == 0) {
                resp = me.exec.call(nodeManager, nodeManager.attachExtIp, node.id);
                if (resp.result != 0) return resp;
            }

            if (id || node.ismaster) {
                config.nodeId = node.id;
                config.nodeIp = node.address;

                nodeManager.setNodeId(config.nodeId);
                nodeManager.setNodeIp(config.nodeIp);
            }

            if (id) break;
        }

        return { result : 0 };
    };

    me.validateEntryPoint = function validateEntryPoint() {
        var fileName = "validation.sh",
            url = me.getScriptUrl(fileName);

        var resp = nodeManager.cmd([
            "mkdir -p $(dirname %(path))",
            "mkdir -p $(dirname %(logPath))",
            "wget --no-check-certificate '%(url)' -O '%(path)'",
            "chmod +x %(path) >> %(log)",
            "source %(path)",
            "validateExtIP",
            "validateDNSSettings '%(domain)'"
        ], {
            url : url,
            logPath : nodeManager.getLogPath(),
            path : nodeManager.getScriptPath(fileName),
            domain : config.customDomains || config.envDomain
        });

        if (resp.result == Response.JEM_OPERATION_COULD_NOT_BE_PERFORMED) {
            resp = resp.responses[0];
            var error = resp.out + "\n" + (resp.errOut || resp.error || "");

            resp = {
                result: Response.JEM_OPERATION_COULD_NOT_BE_PERFORMED,
                type: "error",
                error: error,
                response: error,
                message: error
            };
        }

        return resp;
    };

    me.createScript = function createScript() {
        var url = me.getScriptUrl("install-ssl.js"),
            scriptName = config.scriptName,
            scriptBody,
            resp;

        try {
            scriptBody = new Transport().get(url);

            config.token = Random.getPswd(64);

            scriptBody = me.replaceText(scriptBody, config);

            //delete the script if it already exists
            jelastic.dev.scripting.DeleteScript(scriptName);

            //create a new script
            resp = jelastic.dev.scripting.CreateScript(scriptName, "js", scriptBody);

            java.lang.Thread.sleep(1000);
        } catch (ex) {
            resp = error(Response.ERROR_UNKNOWN, toJSON(ex));
        }

        return resp;
    };

    me.evalScript = function evalScript(action) {
        var params = { token : config.token };

        if (action) params.action = action;

        var resp = jelastic.dev.scripting.Eval(config.scriptName, params);

        if (resp.result == 0 && typeof resp.response === "object" && resp.response.result != 0) {
            resp = resp.response;
        }

        return resp;
    };

    me.installLetsEncrypt = function installLetsEncrypt() {
        var fileName = "install-le.sh",
            url = me.getScriptUrl(fileName);

        return nodeManager.cmd([
            "wget --no-check-certificate '%(url)' -O '%(path)'",
            "chmod +x %(path)",
            "%(path) >> %(log)"
        ], {
            url : url,
            path : nodeManager.getScriptPath(fileName)
        });
    };

    me.generateSslConfig = function generateSslConfig() {
        var path = "opt/letsencrypt/settings",
            primaryDomain = window.location.host,
            envDomain = config.envDomain,
            customDomains = config.customDomains;

        if (customDomains) {
            customDomains = me.parseDomains(customDomains).join(" -d ");
        }

        return nodeManager.cmd('printf "%(params)" > %(path)', {
            params : _([
                "domain='%(domain)'",
                "email='%(email)'",
                "appid='%(appid)'",
                "appdomain='%(appdomain)'",
                "baseDir='%(baseDir)'",
                "test='%(test)'",
                "primarydomain='%(primarydomain)'"
            ].join("\n"), {
                domain: customDomains || envDomain,
                email : config.email || "",
                appid : config.envAppid || "",
                baseDir : config.baseDir,
                appdomain : envDomain || "",
                test : config.test || !customDomains,
                primarydomain: primaryDomain,
                letsEncryptEnv : config.letsEncryptEnv || ""
            }),
            path : nodeManager.getPath(path)
        });
    };

    me.generateSslCerts = function generateSslCerts() {
        var fileName = "generate-ssl-cert.sh",
            url = me.getScriptUrl(fileName),
            generateSSLScript = nodeManager.getScriptPath(fileName),
            bUpload,
            resp;

        me.execAll([
            //download SSL generation script
            [ me.cmd, [
                "wget --no-check-certificate '%(url)' -O %(path)",
                "chmod +x %(path)"
            ], { url : url, path : generateSSLScript } ],

            //redirect incoming requests to master node
            [ me.manageDnat, "add" ]
        ]);

        bUpload = nodeManager.checkCustomSSL();

        //execute ssl generation script
        resp = me.analyzeSslResponse(
            me.exec(me.cmd, generateSSLScript + (bUpload ? " --upload-certs" : ""))
        );

        //removing redirect
        me.exec(me.manageDnat, "remove");

        return resp;
    };

    me.analyzeSslResponse = function (resp) {
        var out,
            errors;

        if (resp.responses) {
            resp = resp.responses[0];
            out = resp.error + resp.errOut + resp.out;

            //just cutting "out" for debug logging because it's too long in SSL generation output
            resp.out = out.substring(out.length - 400);

            errors = {
                "An unexpected error": "Please see",
                "The following errors": "appid =",
                "Error:": null
            };

            for (var start in errors) {
                var end = errors[start];
                var ind1 = out.indexOf(start);

                if (ind1 != -1) {
                    var ind2 = end ? out.indexOf(end, ind1) : -1;
                    var message = ind2 == -1 ? out.substring(ind1) : out.substring(ind1, ind2);
                    resp = error(Response.ERROR_UNKNOWN, message);
                    break;
                }
            }
        }

        return resp;
    };

    //managing certificate challenge validation by routing all requests to master node with let's encrypt engine
    me.manageDnat = function manageDnat(action) {
        return nodeManager.cmd(
            "ip a | grep -q  '%(nodeIp)' || iptables -t nat %(action) PREROUTING -p tcp --dport 80 -j DNAT --to-destination %(nodeIp):80",
            {
                nodeGroup : config.nodeGroup,
                nodeIp    : config.nodeIp,
                action    : action == 'add' ? '-I' : '-D'
            }
        );
    };

    me.scheduleAutoUpdate = function scheduleAutoUpdate() {
        var fileName = "auto-update-ssl-cert.sh",
            scriptUrl = me.getScriptUrl(fileName),
            autoUpdateUrl;

        autoUpdateUrl = _(
            "https://%(host)/%(scriptName)?appid=%(appid)&token=%(token)&action=auto-update",
            {
                host : window.location.host,
                scriptName : config.scriptName,
                appid : appid,
                token : config.token
            }
        );

        return nodeManager.cmd([
            "wget --no-check-certificate '%(url)' -O %(scriptPath)",
            "chmod +x %(scriptPath)",
            "crontab -l  >/dev/null | grep -v '%(scriptPath)' | crontab -",
            "echo \"%(cronTime) %(scriptPath) '%(autoUpdateUrl)' >> %(log)\" >> /var/spool/cron/root"
        ], {
            url : scriptUrl,
            cronTime : config.cronTime,
            scriptPath : nodeManager.getScriptPath(fileName),
            autoUpdateUrl : autoUpdateUrl
        });
    };

    me.deploy = function deploy() {
        if (config.deployHook) {
            return me.exec(me.cmd, [
                "/bin/bash %(hook) >> %(log)"
            ], { hook : config.deployHook });
        }

        if (nodeManager.checkCustomSSL()) {
            return me.exec(me.bindSSL);
        }

        return { result : 0 };
    };

    me.undeploy = function undeploy() {
        if (config.undeployHook) {
            return me.exec(me.cmd, [
                "/bin/bash %(hook) >> %(log)"
            ], { hook : config.undeployHook });
        }

        if (nodeManager.checkCustomSSL()) {
            return me.exec(me.bindSSL);
        }

        return { result : 0 };
    };

    me.bindSSL = function bindSSL() {
        var cert_key = nodeManager.readFile("/tmp/privkey.url"),
            cert     = nodeManager.readFile("/tmp/cert.url"),
            chain    = nodeManager.readFile("/tmp/fullchain.url"),
            resp;

        if (cert_key.body && chain.body && cert.body) {
            resp = jelastic.env.binder.BindSSL(config.envName, session, cert_key.body, cert.body, chain.body);
        } else {
            resp = error(Response.ERROR_UNKNOWN, "Can't read SSL certificate: key=%(key) cert=%(cert) chain=%(chain)", {
                key   : cert_key,
                cert  : cert,
                chain : chain
            });
        }

        return resp;
    };

    me.removeSSL = function removeSSL() {
        return jelastic.env.binder.RemoveSSL(config.envName, session);
    };

    me.sendResp = function sendResp(resp, isUpdate) {
        if (resp.result != 0) {
            return me.sendErrResp(resp);
        }

        return me.sendEmail(
            "Successful " + (isUpdate ? "Update" : "Installation"),
            "html/update-success.html", {
                ENVIRONMENT : config.envName,
                ACTION : isUpdate ? "updated" : "installed"
            }
        );
    };

    me.sendErrResp = function sendErrResp(resp) {
        resp = resp || {};
        resp.debug = debug;

        return me.sendEmail("Error", "html/update-error.html", {
            SUPPORT_EMAIL : "support@jelastic.com",
            RESP : resp || ""
        });
    };

    me.getEmailTitle = function (title) {
        return title + ": Let's Encrypt SSL at " + config.envDomain;
    };

    me.sendEmail = function (title, filePath, values) {
        var email = config.email,
            resp,
            html;

        try {
            html = new Transport().get(me.getFileUrl(filePath));

            if (values) {
                html = me.replaceText(html, values);
            }

            resp = jelastic.message.email.Send(appid, session, null, email, email, me.getEmailTitle(title), html);
        } catch (ex) {
            resp = error(Response.ERROR_UNKNOWN, toJSON(ex));
        }

        return resp;
    };

    me.exec = function (methods, onFail, bBreakOnError) {
        var resp, fn, args;

        if (!methods.push) {
            methods = [ Array.prototype.slice.call(arguments) ];
            onFail = null;
            bBreakOnError = true;
        }

        for (var i = 0, n = methods.length; i < n; i++) {
            if (!methods[i].push) {
                methods[i] = [ methods[i] ];
            }

            fn = methods[i][0];
            methods[i].shift();

            log(fn.name + (methods[i].length > 0 ?  ": " + methods[i] : ""));

            resp = fn.apply(this, methods[i]);
            debug.push(resp);

            log(fn.name + ".response: " + resp);

            if (resp.result != 0) {
                resp.method = fn.name;
                if (onFail) onFail(resp);
                if (bBreakOnError !== false) break;
            }
        }

        return resp;
    };

    me.execAll = function (methods, onFail) {
        return me.exec(methods, onFail, false);
    };

    me.cmd = function cmd(commands, values, sep) {
        return nodeManager.cmd(commands, values, sep, true);
    };

    me.replaceText = function (text, values) {
        return new StrSubstitutor(values, "${", "}").replace(text);
    };

    function NodeManager(envName, nodeId, baseDir, logPath) {
        var me = this,
            bCustomSSLSupported,
            envInfo,
            nodeIp,
            node;

        baseDir = baseDir || "/";

        me.getPath = function (path) {
            return baseDir + (path || "");
        };

        me.getPathByUrl = function (url, path) {
            return me.getPath(path) + me.getFileName(url);
        };

        me.getScriptPath = function (scriptName) {
            return me.getPath("root" + (scriptName ? "/" + scriptName : ""));
        };

        me.getFileName = function (url) {
            return url.match(/.*\/([^?]+).*$/)[1] || url;
        };

        me.setBaseDir = function (path) {
            baseDir = path;
        };

        me.getLogPath = function () {
            return logPath;
        };

        me.setLogPath = function (path) {
            logPath = baseDir + path;
        };

        me.setNodeId = function (id) {
            nodeId = id;
        };

        me.setNodeIp = function (ip) {
            nodeIp = ip;
        };

        me.getNode = function () {
            var resp,
                nodes;

            if (!node && nodeId) {
                resp = me.getEnvInfo();

                if (resp.result != 0) return resp;

                nodes = resp.nodes;

                for (var i = 0, n = nodes.length; i < n; i++) {
                    if (nodes[i].id == nodeId) {
                        node = nodes[i];
                        break;
                    }
                }
            }

            return { result : 0, node : node };
        };

        me.getEnvInfo = function () {
            var resp;

            if (!envInfo) {
                resp = jelastic.env.control.GetEnvInfo(envName, session);
                if (resp.result != 0) return resp;

                envInfo = resp;
            }

            return envInfo;
        };

        me.getEntryPointGroup = function () {
            var group,
                nodes;

            var resp = me.getEnvInfo();
            if (resp.result != 0) return resp;

            nodes = resp.nodes;

            for (var i = 0, node; node = nodes[i]; i++) {
                if (node.nodeGroup == 'lb' || node.nodeGroup == 'bl') {
                    group = node.nodeGroup;
                    break;
                }
            }

            return { result : 0, group : group || "cp" };
        };

        me.attachExtIp = function attachExtIp(nodeId) {
            var platformVersion = getPlatformVersion();

            if (compareVersions(platformVersion, '4.9.5') >= 0 || platformVersion.indexOf('trunk') != -1) {
                return jelastic.env.control.AttachExtIp({ envName : envName, session : session, nodeid : nodeId });
            }

            return jelastic.env.control.AttachExtIp(envName, session, nodeId);
        };

        me.cmd = function (cmd, values, sep, disableLogging) {
            var resp,
                command;

            values = values || {};
            values.log = values.log || logPath;
            cmd = cmd.join ? cmd.join(sep || " && ") : cmd;

            command = _(cmd, values);

            if (!disableLogging) {
                log("cmd: " + command);
            }

            if (values.nodeGroup) {
                resp = jelastic.env.control.ExecCmdByGroup(envName, session, values.nodeGroup, toJSON([{ command: command }]), true, false, "root");
            } else {
                resp = jelastic.env.control.ExecCmdById(envName, session, nodeId, toJSON([{ command: command }]), true, "root");
            }

            return resp;
        };

        me.readFile = function (path) {
            return jelastic.env.file.Read(envName, session, path, null, null, nodeId);
        };

        me.checkCustomSSL = function () {
            var node;

            if (!isDefined(bCustomSSLSupported)) {
                var resp = me.getNode();

                if (resp.result != 0) {
                    log("ERROR: getNode() = " + resp);
                }

                if (resp.node) {
                    node = resp.node;

                    bCustomSSLSupported = node.isCustomSslSupport;

                    if (!isDefined(bCustomSSLSupported) && node.nodemission != "docker") {
                        resp = me.cmd([
                            "source %(path)",
                            "validateCustomSSL"
                        ], { path : nodeManager.getScriptPath("validation.sh") });

                        bCustomSSLSupported = (resp.result == 0);
                    }
                }

                bCustomSSLSupported = !!bCustomSSLSupported;
            }

            return bCustomSSLSupported;
        };
    }

    function _(str, values) {
        return new StrSubstitutor(values || {}, "%(", ")").replace(str);
    }

    function isDefined(value) {
        return typeof value !== "undefined";
    }

    function getPlatformVersion() {
        return jelastic.system.service.GetVersion().version.split("-").shift();
    }

    function compareVersions(a, b) {
        a = a.split("."); b = b.split(".");
        for (var i = 0, l = Math.max(a.length, b.length), x, y; i < l; i++) {x = parseInt(a[i], 10) || 0; y = parseInt(b[i], 10) || 0; if (x != y) return x > y ? 1 : -1 }
        return 0;
    }

    function error(result, text, values) {
        text = _(text, values);
        return { result: result, error: text, response: text, type: "error", message: text };
    }

    function log(message) {
        if (jelastic.marketplace && jelastic.marketplace.console) {
            jelastic.marketplace.console.WriteLog(message);
        }
    }
}