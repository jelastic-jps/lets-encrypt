function SSLManager(config) {
    /**
     * Implements Let's Encrypt SSL management of the Jelastic environment
     * @param {{
     *      appId  : {String}
     *      envName : {String}
     *      envDomain : {String}
     *      envAppid : {String}
     *      baseUrl : {String}
     *      baseDir : {String}     
     *      scriptName : {String}
     *      cronTime : {String}
     *      email : {String}
     *      [action] : {String}
     *      [session] : {String}
     *      [token] : {String}
     *      [isTask] : {Boolean}
     *      [nodeId] : {Number}
     *      [nodeIp] : {String}
     *      [nodeGroup] : {String}
     *      [customDomains] : {String}
     *      [deployHook] : {String}
     *      [deployHookType] : {String}
     *      [undeployHook] : {String}
     *      [undeployHookType] : {String}
     *      [withExtIp] : {Boolean}
     *      [webroot] : {Boolean}
     *      [webrootPath] : {String}
     *      [test] : {Boolean}
     * }} config
     * @constructor
     */

    var Response = com.hivext.api.Response,
        Transport = com.hivext.api.core.utils.Transport,
        StrSubstitutor = org.apache.commons.lang3.text.StrSubstitutor,
        ENVIRONMENT_EXT_DOMAIN_IS_BUSY = 2330,
        ANCIENT_VERSION_OF_PYTHON = 4,
        INVALID_WEBROOT_DIR = 5,
        UPLOADER_ERROR = 6,
        READ_TIMED_OUT = 7,
        VALIDATION_SCRIPT = "validation.sh",
        Random = com.hivext.api.utils.Random,
        LIGHT = "LIGHT",
        me = this,
        BL = "bl",
        LB = "lb",
        CP = "cp",
        isValidToken = false,
        patchBuild = 1,
        debug = [],
        nodeManager,
        version,
        edition,
        session;

    config = config || {};
    session = config.session || "";

    nodeManager = new NodeManager(config.envName, config.nodeId, config.baseDir);
    nodeManager.setLogPath("var/log/letsencrypt.log");
    nodeManager.setBackupPath("var/lib/jelastic/keys/letsencrypt");
    nodeManager.setCustomSettingsPath("var/lib/jelastic/keys/letsencrypt/settings-custom");

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
            "auto-update" : me.autoUpdate,
            "backup-scripts": me.backupScripts,
            "restore-scripts": me.restoreScripts,
            "check-for-update": me.checkForUpdate
        };

        if (getParam("uninstall")) {
            action = "uninstall";
        }

        if (!actions[action]) {
            return {
                result : Response.ERROR_UNKNOWN,
                error : "unknown action [" + action + "]"
            }
        }
        
        me.init();
        
        return actions[action].call(me);
    };

    me.init = function () {
        nodeManager.setValidationScriptUrl(me.getScriptUrl(VALIDATION_SCRIPT));
        nodeManager.setValidationPath(VALIDATION_SCRIPT);
    };

    me.install = function (isUpdate) {
        var resp = me.exec([
            [ me.initAddOnExtIp, config.withExtIp ],
            [ me.initWebrootMethod, config.webroot ],
            [ me.initFalbackToFake, config.fallbackToX1 ],
            [ me.initEntryPoint ],
            [ me.initCustomConfigs ],
            [ me.installLetsEncrypt ],
            [ me.generateSslConfig ],
            [ me.validateEntryPoint ],
            [ me.generateSslCerts ],
            [ me.updateGeneratedCustomDomains ]
        ]);

        if (resp.result == 0) {
            me.exec(me.scheduleAutoUpdate);
            resp = me.exec(me.deploy);
        }

        me.exec(me.sendResp, resp, isUpdate);
        me.exec(me.checkSkippedDomainsInSuccess, resp);

        return resp;
    };

    me.checkSkippedDomainsInSuccess = function checkSkippedDomainsInSuccess(resp) {
        var skippedDomains = me.getSkippedDomains();

        if (skippedDomains) {
            skippedDomains = ">**Note:** The Let’s Encrypt SSL was not issued for the following domain names: \n > * " + me.formatDomains(skippedDomains, true) + "\n > \n > Login to your domain registrar admin panel and check [DNS records](https://docs.jelastic.com/custom-domains/#how-to-configure-dns-record) for the provided domains. Ensure they point to the correct IP (environment entry point or proxy if CDN or any other external balancer is used). Alternatively, remove invalid custom domains from the [Let's Encrypt](https://jelastic.com/blog/free-ssl-certificates-with-lets-encrypt/) settings.";
        }

        resp.skippedDomains = skippedDomains || "";

        return resp;
    };

    me.logAction = function (actionName, resp) {
        var uid = getUserInfo().uid,
            oData = {
                appId: config.appId,
                email: config.email,
                envAppid : config.envAppid,
                envDomain : config.envDomain,
                nodeGroup : config.nodeGroup,
                scriptName : config.scriptName
            },
            oResp;

        if (resp && resp.result == 0) {
            oData.message = "LE add-on has been updated successfully";
        }

        oResp = jelastic.dev.scripting.Eval("appstore", session, "LogAction", {
            uid: uid,
            actionName: actionName,
            response: resp,
            data: oData || {}
        });

        //log("ActionLog: " + oResp);
    };

    me.updateGeneratedCustomDomains = function () {
        var setting = "opt/letsencrypt/settings",
            resp;

        resp = nodeManager.cmd([
            "grep -E '^domain=' %(setting) | cut -c 8-",
            "grep -E 'skipped_domains=' %(setting) | cut -c 17-"
        ], {
            setting : nodeManager.getPath(setting)
        });

        if (resp.result != 0) return resp;

        resp = resp.responses ? resp.responses[0] : resp;
        resp = resp.out.replace(/\'/g, "").split("\n");

        me.setCustomDomains(resp[0]);
        me.setSkippedDomains(resp[1]);

        return {
            result: 0
        };
    };

    me.reinstall = function reinstall(){
        var settings = {},
            resp;

        me.logAction("StartPatchLEAutoUpdate");
        nodeManager.setBackupCSScript();
        resp = me.exec(me.backupScripts);

        if (resp.result != 0) {
            me.logAction("ErrorPatchLEAutoUpdate", resp);
            return resp;
        }

        settings = {
            nodeId              : config.nodeId,
            webroot             : config.webroot || "",
            webrootPath         : config.webrootPath || "",
            withExtIp           : config.withExtIp,
            customDomains       : me.getCustomDomains(),
            nodeGroup           : config.nodeGroup || "",
            deployHook          : config.deployHook || "",
            deployHookType      : config.deployHookType || "",
            undeployHook        : config.undeployHook || "",
            undeployHookType    : config.undeployHookType || ""
        };

        resp = jelastic.marketplace.jps.install({
            appid: appid,
            session: session,
            jps: me.getFileUrl("manifest.jps"),
            envName: me.getEnvName(),
            settings: settings,
            nodeGroup: config.nodeGroup || "",
            writeOutputTasks: false
        });

        me.logAction("EndPatchLEAutoUpdate", resp);

        if (resp.result != 0) {
            me.exec(me.restoreDataIfNeeded);
        }

        return resp;
    };

    me.uninstall = function () {
        var autoUpdateScript = nodeManager.getScriptPath("auto-update-ssl-cert.sh");

        return me.execAll([
            [ me.cmd, "crontab -l 2>/dev/null | grep -v '%(scriptPath)' | crontab -", {
                scriptPath : autoUpdateScript
            }],
            [ me.initAddOnExtIp, config.withExtIp ],

            me.undeploy,

            [ me.cmd, 'rm -rf %(paths)', {
                paths : [
                    // "/etc/letsencrypt",
                    nodeManager.getPath("opt/letsencrypt"),
                    nodeManager.getScriptPath("generate-ssl-cert.sh"),
                    nodeManager.getScriptPath("letsencrypt_settings"),
                    nodeManager.getScriptPath("install-le.sh"),
                    nodeManager.getScriptPath(VALIDATION_SCRIPT),
                    autoUpdateScript
                ].join(" ")
            }]
        ]);
    };

    me.backupEffPackages = function() {
        var backupPath = nodeManager.getBackupPath(),
            logPath = nodeManager.getLogPath();

        return me.exec([
            [ me.cmd, "[ -d '%(effPath)' ] && { cd %(effPath); hash tar 2>/dev/null && echo tar || yum install tar -y; tar -czvf eff.org.tar . >> %(logPath); mv eff.org.tar %(backupPath); rm -rf %(effPath); } || echo 0;", {
                logPath: logPath,
                backupPath: backupPath,
                effPath: nodeManager.getPath("opt/eff.org")
            }],
        ]);
    };

    me.backupScripts = function backupScripts() {
        var backupPath = nodeManager.getBackupPath(),
            logPath = nodeManager.getLogPath();

        return me.exec([
            [ me.cmd, "mkdir -p %(backupPath)", {
                backupPath: backupPath
            }],

            [ me.cmd, "cd %(letsencryptPath); hash tar 2>/dev/null && echo tar || yum install tar -y; tar -czvf backup.tar . >> %(logPath); mv backup.tar %(backupPath)", {
                logPath: logPath,
                backupPath: backupPath,
                letsencryptPath: nodeManager.getPath("opt/letsencrypt")
            }],

            [ me.cmd, "cat /var/spool/cron/root | grep letsencrypt-ssl > %(backupPath)/letsencrypt-cron", {
                backupPath: backupPath
            }],

            [ me.cmd, "\\cp -r {%(scriptToBackup)} %(backupPath)", {
                backupPath: backupPath,
                scriptToBackup: [
                    nodeManager.getScriptPath("auto-update-ssl-cert.sh"),
                    nodeManager.getScriptPath("install-le.sh"),
                    nodeManager.getScriptPath(VALIDATION_SCRIPT)
                ].join(",")
            }]
        ])
    };

    me.restoreScripts = function restoreScripts() {
        var backupPath = nodeManager.getBackupPath(),
            logPath = nodeManager.getLogPath();

        return me.execAll([
            [ me.cmd, "cat %(backupPath)/letsencrypt-cron >> /var/spool/cron/root", {
                backupPath: backupPath
            }],

            [ me.cmd, "hash tar 2>/dev/null && echo tar || yum install tar -y; mkdir -p %(settingsPath) && cd %(settingsPath) && tar -xzvf %(backupPath)/backup.tar > %(logPath)", {
                backupPath: backupPath,
                logPath: logPath,
                settingsPath: nodeManager.getPath("opt/letsencrypt"),
            }],

            [ me.cmd, "cp -r %(backupPath)/{%(files)} %(rootPath)", {
                backupPath: backupPath,
                rootPath: nodeManager.getPath("root"),
                files: [
                    "auto-update-ssl-cert.sh",
                    "install-le.sh",
                    VALIDATION_SCRIPT
                ].join(",")
            }]
        ])
    };

    me.restoreCron = function restoreCron() {
        me.logAction("AutoPatchLECronRestore");

        return me.exec(me.cmd, "cat %(backupPath)/letsencrypt-cron >> /var/spool/cron/root", {
            backupPath: nodeManager.getBackupPath()
        });
    };

    me.checkForUpdate = function checkForUpdate() {
        var fileName = "auto-update-ssl-cert.sh";

        me.logAction("CheckForUpdateLE");

        return me.exec(me.cmd, "%(path) '%(url)'", {
            path : nodeManager.getScriptPath(fileName),
            url : me.getAutoUpdateUrl()
        });
    };

    me.autoUpdate = function () {
        var resp;

        if (getPlatformVersion() < "4.9.5") {
            return me.exec(me.sendEmail, "Action Required", "html/update-required.html");
        }

        if (!config.isTask) {
            me.logAction("StartUpdateLEFromContainer");

            if (!session && me.hasValidToken()) {
                session = signature;
            }

            resp = nodeManager.getEnvInfo();

            if (resp.result == 0) {
                resp = log("checkPermissions");
            }

            if (resp && resp.result != 0) {
                return me.checkEnvAccessAndUpdate(resp);
            }
        }

        if (config.patchVersion == patchBuild) {
            resp = me.install(true);
        } else {
            resp = me.reinstall();
        }

        me.logAction("EndUpdateLEFromContainer", resp);

        return resp;
    };

    me.restoreCSScript = function restoreCSScript() {
        var oResp,
            sCode = nodeManager.getCSScriptCode();

        me.logAction("AutoPatchLEScriptRestore");
        return jelastic.dev.scripting.CreateScript(config.scriptName, "js", sCode);
    };

    me.restoreDataIfNeeded = function () {
        var oResp = getScript(config.scriptName);

        if (oResp.result == Response.SCRIPT_NOT_FOUND) {
            me.logAction("AutoPatchLEAddOnRemoved");

            if (nodeManager.getCSScriptCode()) {
                me.exec([
                    [ me.restoreCSScript ],
                    [ me.restoreScripts ]
                ]);
            }
        }

        return { result : 0 };
    };

    me.checkEnvAccessAndUpdate = function (errResp) {
        var errorMark = "session [xxx"; //mark of error access to a shared env

        if (errResp.result == Response.USER_NOT_AUTHENTICATED && errResp.error.indexOf(errorMark) > -1) {
            //creating new session using Scheduler
            return me.exec(me.addAutoUpdateTask);
        }

        return me.exec(me.sendErrResp, errResp);
    };

    me.addAutoUpdateTask = function addAutoUpdateTask() {
        me.logAction("AddLEAutoUpdateTask");

        return jelastic.utils.scheduler.AddTask({
            appid: appid,
            session: session,
            script: config.scriptName,
            trigger: "once_delay:1000",
            description: "update LE sertificate",
            params: { token: config.token, task: 1, action : "auto-update" }
        });
    };

    me.hasValidToken = function () {
        return isValidToken;
    };

    me.creteScriptAndInstall = function createInstallationScript() {
        return me.exec([
            [ me.initAddOnExtIp, config.withExtIp ],
            [ me.initWebrootMethod, config.webroot ],
            [ me.initFalbackToFake, config.fallbackToX1 ],
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
            domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9-]{2,24}(\n|$)/;

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

    me.setSkippedDomains = function (domains) {
        config.skippedDomains = domains;
    };

    me.getSkippedDomains = function () {
        return config.skippedDomains || "";
    };

    me.formatDomains = function (domains, bList) {

        if (bList) {
            return domains.replace(/ -d /g, '\n > * ');
        }

        return domains ? domains.replace(/ -d/g, ', ') : "";
    };

    me.getEnvName = function () {
        return config.envName || "";
    };

    me.getFileUrl = function (filePath) {
        return config.baseUrl + "/" + filePath + "?_r=" + Math.random();
    };

    me.getScriptUrl = function (scriptName) {
        return me.getFileUrl("scripts/" + scriptName);
    };

    me.getConfigUrl = function (configName) {
        return me.getFileUrl("configs/" + configName);
    };

    me.initCustomConfigs = function initCustomConfigs() {
        var CUSTOM_CONFIG = nodeManager.getCustomSettingsPath(),
            properties = new java.util.Properties(),
            stringReader,
            propNames,
            propName,
            resp;

        resp = me.cmd("[[ -f \"" + CUSTOM_CONFIG + "\" ]] && echo true || echo false");
        if (resp.result != 0) return resp;

        if (resp.responses[0].out == "true") {
            resp = nodeManager.readFile(CUSTOM_CONFIG, config.nodeGroup);
            if (resp.result != 0) return resp;

            stringReader = new java.io.StringReader(resp.body.toString());
            properties.load(stringReader);
            propNames = properties.propertyNames();

            while (propNames.hasMoreElements()) {
                propName = propNames.nextElement().toString();
                config[propName] = String(properties.getProperty(propName));
            }
        }

        return { result: 0 };
    };

    me.initBoolValue = function initBoolValue(value) {
        return typeof value == "boolean" ? value : String(value) != "false";
    };

    me.initFalbackToFake = function initFalbackToFake(fake) {
        config.fallbackToX1 = me.initBoolValue(fake);
        return { result: 0 };
    };

    me.initAddOnExtIp = function initAddOnExtIp(withExtIp) {
        config.withExtIp = me.initBoolValue(withExtIp) || !jelastic.env.binder.GetExtDomains;

        edition = edition || getPlatformEdition();
        config.withExtIp = (edition == LIGHT) ? false : config.withExtIp;

        return { result: 0 };
    };

    me.initWebrootMethod = function initWebrootMethod(webroot) {
        webroot = webroot || false;
        config.webroot = me.initBoolValue(webroot);
        return { result: 0 };
    };

    me.initBindedDomains = function() {
        var domains = [],
            domain,
            resp;

        if (config.bindedDomains) return config.bindedDomains;

        resp = jelastic.env.binder.GetExtDomains(config.envName, session);
        if (resp.result != 0) return resp;

        for (var i = 0, n = resp.extDomains.length; i < n; i++) {
            domain = resp.extDomains[i];
            domains.push(resp.extDomains[i].domain);
        }

        config.bindedDomains = domains.join(",");

        return { result: 0 };
    };

    me.bindExtDomains = function bindExtDomains() {
        var customDomains = config.customDomains,
            bindedDomains = config.bindedDomains,
            readyToGenerate = [],
            busyDomains = [],
            freeDomains = [],
            domain,
            resp;

        if (customDomains) {
            customDomains = me.parseDomains(customDomains);
        }

        for (var i = 0, n = customDomains.length; i < n; i++) {
            domain = customDomains[i];

            if (bindedDomains.indexOf(domain) != -1) {
                readyToGenerate.push(domain);
                continue;
            }

            if (me.isBusyExtDomain(domain)) {
                busyDomains.push(domain);
            } else {
                readyToGenerate.push(domain);
                freeDomains.push(domain);
            }
        }

        me.setSkippedDomains(busyDomains.join(" "));
        me.setCustomDomains(readyToGenerate.join(" "));

        if (freeDomains.length) {
            return jelastic.env.binder.BindExtDomains({
                envName: config.envName,
                session: session,
                extDomains: freeDomains.join(";")
            });
        }

        return { result: 0 };
    };

    me.isBusyExtDomain = function (domain) {
        var BUSY_RESULT = ENVIRONMENT_EXT_DOMAIN_IS_BUSY,
            resp;

        resp = jelastic.environment.binder.CheckExtDomain({
            appid: config.envName,
            session: session,
            extdomain: domain
        });

        if (resp.result != 0 && resp.result != BUSY_RESULT) return resp;
        return !!(resp.result == BUSY_RESULT);
    };

    me.initEntryPoint = function initEntryPoint() {
        var group = config.nodeGroup,
            id = config.nodeId,
            targetNode,
            nodes,
            resp;

        if ((!id && !group) || nodeManager.isComputeLayer(group) || (id && group && !nodeManager.isNodeExists())) {
            resp = nodeManager.getEntryPointGroup();
            if (resp.result != 0) return resp;

            group = resp.group;
            config.nodeGroup = group;
        }

        me.initAddOnExtIp(config.withExtIp);

        resp = nodeManager.getEnvInfo();
        if (resp.result != 0) return resp;
        nodes = resp.nodes;

        for (var j = 0, node; node = nodes[j]; j++) {
            if (node.nodeGroup != group) continue;
            
            node = (config.webroot && !targetNode && nodeManager.getBalancerMasterNode()) ? nodeManager.getBalancerMasterNode() : node;

            if (config.withExtIp && !nodeManager.isIPv6Exists(node)) {
                resp = config.webroot ? me.attachExtIpToGroupNodes(node.nodeGroup) : me.attachExtIpIfNeed(node);
                if (resp.result != 0) return resp;
                nodeManager.updateEnvInfo();
            } else {
                me.exec([
                    [ me.initBindedDomains ],
                    [ me.bindExtDomains ]
                ]);
            }

            if ((id && id == node.id) || node.ismaster) {
                config.nodeId = node.id;
                config.nodeIp = node.address;

                nodeManager.setNodeId(config.nodeId);
                nodeManager.setNodeIp(config.nodeIp);

                if (nodeManager.isExtraLayer(group) && node.url) {
                    nodeManager.setEnvDomain(node.url.replace(/https?:\/\//, ''));
                }
            }

            if (id) break;
        }

        return { result : 0 };
    };

    me.attachExtIpToGroupNodes = function(group) {
        var nodes = nodeManager.getNodes(),
            resp;

        for (var i = 0, n = nodes.length; i < n; i++) {
            if (nodes[i].nodeGroup == group) {
                resp = me.attachExtIpIfNeed(nodes[i]);
                if (resp.result != 0) return resp;
            }
        }

        return { result: 0 };
    };

    me.attachExtIpIfNeed = function (node) {
        if (!node.extIPs || node.extIPs.length == 0) {
            return me.exec.call(nodeManager, nodeManager.attachExtIp, node.id);
        }

        return { result: 0 };
    };

    me.validateEntryPoint = function validateEntryPoint() {
        var fileName = VALIDATION_SCRIPT,
            url = me.getScriptUrl(fileName),
            VALIDATE_IP = "validateExtIP",
            VALIDATE_DNS = "validateDNSSettings '%(domain)'",
            validateNodeId,
            balancerNode;

        balancerNode =  nodeManager.getBalancerMasterNode();
        validateNodeId = balancerNode ? balancerNode.id : config.nodeId;

        var resp = nodeManager.cmd([
            "mkdir -p $(dirname %(path))",
            "mkdir -p $(dirname %(logPath))",
            "wget --no-check-certificate '%(url)' -O '%(path)'",
            "chmod +x %(path) >> %(log)"
        ], {
            url : url,
            logPath : nodeManager.getLogPath(),
            path : nodeManager.getScriptPath(fileName),
            nodeId: validateNodeId
        });
        if (resp.result != 0) return resp;

        if (!config.withExtIp) return { result: 0 };

        resp = nodeManager.cmd([
            "source %(path)",
            VALIDATE_IP
            // VALIDATE_DNS
        ], {
            domain : config.customDomains || config.envDomain,
            path : nodeManager.getScriptPath(fileName),
            nodeId : validateNodeId
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
            config.patchVersion = patchBuild;

            scriptBody = me.replaceText(scriptBody, config);

            //delete the script if it already exists
            jelastic.dev.scripting.DeleteScript(scriptName);

            //create a new script
            resp = jelastic.dev.scripting.CreateScript(scriptName, "js", scriptBody);

            java.lang.Thread.sleep(1000);

            //build script to avoid caching
            jelastic.dev.scripting.Build(scriptName);
        } catch (ex) {
            resp = error(Response.ERROR_UNKNOWN, toJSON(ex));
        }

        return resp;
    };

    me.evalScript = function evalScript(action) {
        var params = { token : config.token };

        if (action) params.action = action;
        params.fallbackToX1 = config.fallbackToX1;

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
                "primarydomain='%(primarydomain)'",
                "withExtIp='%(withExtIp)'",
                "webroot='%(webroot)'",
                "webrootPath='%(webrootPath)'",
                "skipped_domains='%(skipped)'"
            ].join("\n"), {
                domain: customDomains || envDomain,
                email : config.email || "",
                appid : config.envAppid || "",
                baseDir : config.baseDir,
                appdomain : envDomain || "",
                test : config.test || !customDomains,
                primarydomain: primaryDomain,
                letsEncryptEnv : config.letsEncryptEnv || "",
                withExtIp : config.withExtIp,
                webroot : config.webroot,
                webrootPath : config.webrootPath || "",
                skipped : config.skippedDomains || ""
            }),
            path : nodeManager.getPath(path)
        });
    };

    me.generateSslCerts = function generateSslCerts() {
        var fileName = "generate-ssl-cert.sh",
            url = me.getScriptUrl(fileName),
            validationFileName = VALIDATION_SCRIPT,
            generateSSLScript = nodeManager.getScriptPath(fileName),
            proxyConfigName = "tinyproxy.conf",
            bUpload,
            text,
            resp;

        me.execAll([
            //download SSL generation script
            [ me.cmd, [
                "wget --no-check-certificate '%(url)' -O %(path)",
                "chmod +x %(path)",
                "wget --no-check-certificate '%(validationUrl)' -O %(validationPath)",
                "chmod +x %(validationPath)",
                "wget --no-check-certificate '%(proxyConfigUrl)' -O /etc/tinyproxy/tinyproxy.conf",
            ], {
                validationUrl : me.getScriptUrl(validationFileName),
                validationPath : nodeManager.getScriptPath(validationFileName),
                proxyConfigUrl : me.getConfigUrl(proxyConfigName),
                url : url,
                path : generateSSLScript
            }]
        ]);

        if (!config.withExtIp) {
            resp = me.exec(me.checkEnvSsl);
            if (resp.result != 0) return resp;
        }

        if (!config.webroot) {
            //redirect incoming requests to master node
            me.exec(me.manageDnat, "add");
        }

        bUpload = nodeManager.checkCustomSSL();

        //execute ssl generation script
        resp = me.analyzeSslResponse(
            me.exec(me.cmd, generateSSLScript + (bUpload ? "" : " --no-upload-certs"))
        );

        if (config.action == "install" && config.fallbackToX1 && !me.getOnlyCustomDomains() && resp.result != 0) {
            resp = me.analyzeSslResponse(
                me.exec(me.cmd, generateSSLScript + (bUpload ? "" : " --no-upload-certs") + (config.fallbackToX1 ? " fake" : ""))
            );
        }

        if (!config.webroot) {
            //removing redirect
            me.exec(me.manageDnat, "remove");
        }

        if (resp.result && resp.result == ANCIENT_VERSION_OF_PYTHON) {
            log("WARNING: Ancient version of Python");
            resp = me.exec(me.tryRegenerateSsl);
        }

        if (resp.result && resp.result == INVALID_WEBROOT_DIR) {
            text = "webroot_path does not exist or is not a directory";
            return {
                result: INVALID_WEBROOT_DIR,
                error: text,
                response: text,
                type: "warning",
                message: text
            };
        }

        if (resp.result && resp.result == UPLOADER_ERROR) {
            text = "There was an error while uploading certificates. Please contact our support team.";
            return {
                result: UPLOADER_ERROR,
                error: text,
                response: text,
                type: "warning",
                message: text
            };
        }
        
        if (resp.result && resp.result == READ_TIMED_OUT) {
            text = "The Let's Encrypt service is currently unavailable. Check the /var/log/letsencrypt log for more details or try again in a few minutes.";
            return {
                result: READ_TIMED_OUT,
                error: text,
                response: text,
                type: "warning",
                message: text
            };
        }

        return resp;
    };
    
    me.getOnlyCustomDomains = function () {
        var regex = new RegExp("\\s*" + config.envDomain + "\\s*");
        return String(java.lang.String(config.customDomains.replace(regex, " ")).trim());
    };

    me.tryRegenerateSsl = function tryRegenerateSsl() {
        return me.execAll([
            [ me.backupEffPackages ],
            [ me.installLetsEncrypt ],
            [ me.generateSslCerts ]
        ]);
    };

    me.analyzeSslResponse = function (resp) {
        var out,
            errors;

        if (resp.responses) {
            resp = resp.responses[0];
            out = resp.error + resp.errOut + resp.out;

            if (resp) {
                if (resp.exitStatus == ANCIENT_VERSION_OF_PYTHON) return {result: ANCIENT_VERSION_OF_PYTHON };
                if (resp.exitStatus == INVALID_WEBROOT_DIR) return { result: INVALID_WEBROOT_DIR}
                if (resp.exitStatus == UPLOADER_ERROR) return { result: UPLOADER_ERROR}
                if (resp.exitStatus == READ_TIMED_OUT) return { result: READ_TIMED_OUT}
            }

            //just cutting "out" for debug logging because it's too long in SSL generation output
            resp.out = out.substring(out.length - 400);

            errors = {
                "An unexpected error": "Please see",
                "The following errors": "appid =",
                "Error: ": null
            };

            for (var start in errors) {
                var end = errors[start];
                var ind1 = out.indexOf(start);

                if (ind1 != -1) {
                    var ind2 = end ? out.indexOf(end, ind1) : -1;
                    var message = ind2 == -1 ? out.substring(ind1).replace(start, "") : out.substring(ind1, ind2); //removed duplicated words in popup
                    message += "\n \n[More info](https://jelastic.com/blog/free-ssl-certificates-with-lets-encrypt/)";
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
            "ip a | grep -q  '%(nodeIp)' || { iptables -t nat %(action) PREROUTING -p tcp --dport 80 -j DNAT --to-destination %(nodeIp):80; iptables %(action) FORWARD -p tcp -j ACCEPT;  iptables -t nat %(action) POSTROUTING -d %(nodeIp) -j MASQUERADE; }",
            {
                nodeGroup : config.nodeGroup,
                nodeIp    : config.nodeIp,
                action    : action == 'add' ? '-I' : '-D'
            }
        );
    };

    me.checkEnvSsl = function checkEnvSsl() {
        return nodeManager.checkEnvSsl();
    };

    me.getAutoUpdateUrl = function () {
        return _(
            "https://%(host)/%(scriptName)?appid=%(appid)&token=%(token)&action=auto-update",
            {
                host : window.location.host,
                scriptName : config.scriptName,
                appid : appid,
                token : config.token
            }
        ) || "";
    };

    me.scheduleAutoUpdate = function scheduleAutoUpdate() {
        var fileName = "auto-update-ssl-cert.sh",
            scriptUrl = me.getScriptUrl(fileName);

        return nodeManager.cmd([
            "wget --no-check-certificate '%(url)' -O %(scriptPath)",
            "chmod +x %(scriptPath)",
            "crontab -l | grep -v '%(scriptPath)' | crontab -",
            "echo \"%(cronTime) su - root -c \\\"%(scriptPath) '%(autoUpdateUrl)' >> %(log)\\\"\" >> /var/spool/cron/root"
        ], {
            url : scriptUrl,
            cronTime : config.cronTime,
            scriptPath : nodeManager.getScriptPath(fileName),
            autoUpdateUrl : me.getAutoUpdateUrl()
        });
    };

    me.deploy = function deploy() {
        if (config.deployHook) {
            return me.evalHook(config.deployHook, config.deployHookType);
        }

        if (nodeManager.checkCustomSSL() || !config.withExtIp) {
            return me.exec(me.bindSSL);
        }

        return { result : 0 };
    };

    me.undeploy = function undeploy() {
        if (config.patchVersion != patchBuild || me.exec(me.isMoreLEAppInstalled)) {
            return { result : 0 };
        }

        if (config.undeployHook) {
            return me.evalHook(config.undeployHook, config.undeployHookType);
        }

        if (nodeManager.checkCustomSSL()) {
            return config.withExtIp ? me.exec(me.removeSSL) : me.exec(me.removeSSLCert);
        }

        return { result : 0 };
    };

    me.evalHook = function evalHook(hook, hookType) {
        var urlRegex = new RegExp("^[a-z]+:\\/\\/"),
            hookBody;

        if (urlRegex.test(hook)) {
            try {
                hookBody = new Transport().get(hook);
            } catch (ex) {
                return error(Response.ERROR_UNKNOWN, toJSON(ex));
            }
        } else {
            hookBody = hook;
        }

        if (hookType == "js") {
            return me.exec(me.evalCode, hookBody, config);
        }

        return me.exec(me.cmd, "/bin/bash %(hook) >> %(log)", { hook : hookBody });
    };

    me.evalCode = function evalCode(code, params) {
        var resp = jelastic.dev.scripting.EvalCode(appid, session, code, "js", "", params || {});

        return resp.response || resp
    };

    me.bindSSLCerts = function bindSSLCerts() {
        var SLB = "SLB",
            resp;

        resp = jelastic.env.binder.GetSSLCerts(config.envName, session);
        if (resp.result != 0) return resp;

        return jelastic.env.binder.BindSSLCert({
            envName: config.envName,
            session: session,
            certId: resp.responses[resp.responses.length - 1].id,
            entryPoint: SLB,
            extDomains: me.formatDomains(config.customDomains).replace(/ /g, "")
        });
    };

    me.bindSSL = function bindSSL() {
        var cert_key = nodeManager.readFile("/tmp/privkey.url"),
            cert     = nodeManager.readFile("/tmp/cert.url"),
            chain    = nodeManager.readFile("/tmp/fullchain.url"),
            resp;

        if (cert_key.body && chain.body && cert.body) {
            if (config.withExtIp) {

                if (nodeManager.isExtraLayer(config.nodeGroup)) {
                    resp = me.exec(me.bindSSLOnExtraNode, cert_key.body, cert.body, chain.body);
                } else {
                    resp = jelastic.env.binder.BindSSL({
                        "envName": config.envName,
                        "session": session,
                        "cert_key": cert_key.body,
                        "cert": cert.body,
                        "intermediate": chain.body
                    });
                }
            } else {
                resp = jelastic.env.binder.AddSSLCert({
                    envName: config.envName,
                    session: session,
                    key: cert_key.body,
                    cert: cert.body,
                    interm: chain.body
                });
                me.exec(me.bindSSLCerts);
            }
        } else {
            resp = error(Response.ERROR_UNKNOWN, "Can't read SSL certificate: key=%(key) cert=%(cert) chain=%(chain)", {
                key   : cert_key,
                cert  : cert,
                chain : chain
            });
        }

        return resp;
    };

    me.bindSSLOnExtraNode = function bindSSLOnExtra(key, cert, intermediate) {
        return me.cmd([
                'SSL_CONFIG_DIR="/var/lib/jelastic/SSL"',
                '[ ! -d "${SSL_CONFIG_DIR}" ] && mkdir -p ${SSL_CONFIG_DIR} || echo "SSL dir exists"',
                'echo "key=%(key)\n\ncert=%(cert)\n\nintermediate=%(intermediate)\n\n" > "${SSL_CONFIG_DIR}/customssl.conf"',
                'jem ssl install'
            ],
            {
                key: key,
                cert: cert,
                intermediate: intermediate,
                nodeGroup: config.nodeGroup
            });
    };

    me.removeSSL = function removeSSL() {
        return jelastic.env.binder.RemoveSSL(config.envName, session);
    };

    me.removeSSLCert = function removeSSLCert() {
        var resp,
            sslCerts;

        resp = jelastic.env.binder.GetSSLCerts(config.envName, session);
        if (resp.result != 0) return resp;

        sslCerts = resp.responses;

        return jelastic.env.binder.RemoveSSLCerts(config.envName, session, sslCerts[sslCerts.length - 1].id);
    };

    me.sendResp = function sendResp(resp, isUpdate) {
        var action = isUpdate ? "updated" : "installed",
            skippedDomains = me.getSkippedDomains();

        if (resp.result != 0) {
            return me.sendErrResp(resp);
        }

        return me.sendEmail(
            "Successful " + (isUpdate ? "Update" : "Installation"),
            "html/update-success.html", {
                ENVIRONMENT : config.envDomain,
                ACTION : action,
                UPDATED_DOMAINS: "Successfully " + action + " custom domains: <b>" + me.formatUpdatedDomains() + "</b>",
                SKIPPED_DOMAINS: skippedDomains ? "<br><br>Please note that Let’s Encrypt cannot assign SSL certificates for the following domain names: <b>" + me.formatDomains(skippedDomains) + "</b>.<br>" + "Login to your domain registrar admin panel and check <a href='https://docs.jelastic.com/custom-domains/#how-to-configure-dns-record' target='_blank'>DNS records</a> for the provided domains. Ensure they point to the correct IP (environment entry point or proxy if CDN or any other external balancer is used). Alternatively, remove invalid custom domains from the <a href='https://jelastic.com/blog/free-ssl-certificates-with-lets-encrypt/'>Let's Encrypt settings</a>." : ""
            }
        );
    };

    me.formatUpdatedDomains = function formatUpdatedDomains() {
        var sDomains = me.formatDomains(me.getCustomDomains()),
            aDomains = [],
            sDomain,
            sResp = "";

        aDomains = sDomains.split(", ");

        for (var i = 0, n = aDomains.length; i < n; i++) {
            sDomain = aDomains[i];
            sResp += "<a href=\"https://" + sDomain + "/\">" + sDomain + "</a>";

            sResp = (n > i + 1) ? sResp += ", " : sResp;
        }

        return sResp || "";
    };

    me.isMoreLEAppInstalled = function isMoreLEAppInstalled () {
        var resp;

        resp = jelastic.dev.scripting.Eval("appstore", session, "GetApps", {
            targetAppid: config.envAppid,
            search: {"appstore":"1","app_id":"letsencrypt-ssl-addon", "nodeGroup": {"!=":config.nodeGroup}}
        });

        me.logAction("isMoreLEAppInstalled", resp);
        if (resp.result != 0) {
            return true; // don't removeSSL if GetApps fails
        }

        resp = resp.response;
        return !!(resp && resp.apps && resp.apps.length);
    };

    me.sendErrResp = function sendErrResp(resp) {
        resp = resp || {};

        if (!me.getCustomDomains() && me.getSkippedDomains()) {
            resp = "Please note that the SSL certificates cannot be assigned to the available custom domains due to incorrect DNS settings.\n\n" +
                "You can fix the issues with DNS records (IP addresses) via your domain admin panel or by removing invalid custom domains from Let's Encrypt settings.\n\n" +
                "In case you no longer require SSL certificates within <b>" + config.envDomain + "</b> environment, feel free to delete Let’s Encrypt add-on to stop receiving error messages.";
        } else {
            resp = { 
                result: resp.result || Response.ERROR_UNKNOWN, 
                error: resp.error || "unknown error",
                debug: debug
            };            
        }

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
                me.logAction("InstallLE-" + fn.name, resp);
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
            sCustomSettingsPath,
            sValidationPath,
            sValidationUrl,
            oBackupScript,
            oBLMaster,
            sBackupPath,
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

        me.setBackupPath = function (path) {
            sBackupPath = baseDir + path;
        };

        me.getBackupPath = function () {
            return sBackupPath;
        };

        me.setCustomSettingsPath = function (path) {
            sCustomSettingsPath = baseDir + path;
        };

        me.getCustomSettingsPath = function() {
            return sCustomSettingsPath;
        };

        me.setValidationScriptUrl = function(url) {
            sValidationUrl = url;
        };
        
        me.getValidationScriptUrl = function() {
            return sValidationUrl;
        };
        
        me.setValidationPath = function(scriptName) {
            sValidationPath = me.getScriptPath(scriptName);
        };
        
        me.getValidationPath = function() {
            return sValidationPath;
        };

        me.setNodeId = function (id) {
            config.nodeId = nodeId = id;
        };

        me.setNodeIp = function (ip) {
            config.nodeIp = nodeIp = ip;
        };

        me.setNodeGroup = function (group) {
            config.nodeGroup = group;
        };

        me.setEnvDomain = function (envDomain) {
            config.envDomain = envDomain;
        };

        me.setBackupCSScript = function () {
            oBackupScript = getScript(config.scriptName);
        };

        me.getBackupCSScript = function () {
            return oBackupScript || {};
        };

        me.getCSScriptCode = function () {
            var oScript = me.getBackupCSScript().script;

            return oScript ? oScript.code : "";
        };

        me.isExtraLayer = function (group) {
            return !(group == BL || group == LB || group == CP);
        };

        me.isBalancerLayer = function (group) {
            return !!(group == LB || group == BL);
        };
        
        me.isComputeLayer = function (group) {
            return !!(group == CP);
        };

        me.setBalancerMasterNode = function (node) {
            oBLMaster = node;
        };

        me.getBalancerMasterNode = function () {
            return oBLMaster;
        };

        me.getEntryNodeIps = function getEntryNodeIps() {
            var resp = nodeManager.cmd([
                "IP=$(which ip)",
                "EXT_IPs=$($IP a | sed -En \'s/127.0.0.1//;s\/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p\')",
                "EXT_IPs_v6=$($IP a | sed -En \'s/inet6 ::1\/128//;s\/.*inet6 (addr:?)?([0-9a-f:]+)\/.*/\2/p\')",
                "echo \"IP4-$EXT_IPs\"",
                "echo \"IP6-$EXT_IPs_v6\""
            ]);

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

        me.getNodes = function() {
            var resp = me.getEnvInfo();
            if (resp.result != 0) return resp;

            return resp.nodes;
        };

        me.getNode = function () {
            var nodes;

            if (!node && nodeId) {
                nodes = me.getNodes();

                for (var i = 0, n = nodes.length; i < n; i++) {
                    if (nodes[i].id == nodeId) {
                        node = nodes[i];
                        break;
                    }
                }
            }

            return { result : 0, node : node };
        };
        
        me.isIPv6Exists = function isIPv6Exists(node) {
            return !!(node.extipsv6 && node.extipsv6.length);
        }; 
        
        me.isNodeExists = function isNodeExists() {
            var resp,
                nodes,
                node;

            nodes = me.getNodes();

            for (var i = 0, n = nodes.length; i < n; i++) {
                node = nodes[i];
                if (node.id == config.nodeId && node.nodeGroup == config.nodeGroup) return true;
            }

            return false;
        };

        me.getEnvInfo = function (reload) {
            var resp;

            if (!envInfo || reload) {
                resp = jelastic.env.control.GetEnvInfo(envName, session);
                if (resp.result != 0) return resp;

                envInfo = resp;
            }

            return envInfo;
        };
        
        me.updateEnvInfo = function updateEnvInfo() {
            return me.getEnvInfo(true);
        };

        me.getEntryPointGroup = function () {
            var group,
                nodes;

            nodes = me.getNodes();
            for (var i = 0, node; node = nodes[i]; i++) {
                if (nodeManager.isBalancerLayer(node.nodeGroup) && node.ismaster) {
                    if (!nodeManager.checkCustomSSL(node)) break;

                    nodeManager.setBalancerMasterNode(node);
                    group = config.webroot ? config.nodeGroup : node.nodeGroup;
                    break;
                }
            }

            return { result : 0, group : group || CP };
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
                resp = jelastic.env.control.ExecCmdById(envName, session, values.nodeId ||nodeId, toJSON([{ command: command }]), true, "root");
            }

            return resp;
        };

        me.readFile = function (path, group) {
            return jelastic.env.file.Read(envName, session, path, null, group || null, nodeId);
        };

        me.checkCustomSSL = function (targetNode) {
            var node = targetNode || "";

            if (!isDefined(bCustomSSLSupported) || targetNode) {
                if (!node) {
                    var resp = me.getNode();

                    if (resp.result != 0) {
                        log("ERROR: getNode() = " + resp);
                    }
                    node = resp.node ? resp.node : "";
                }

                if (node) {
                    bCustomSSLSupported = node.isCustomSslSupport;

                    if ((!isDefined(bCustomSSLSupported) || node.type != "DOCKERIZED") && node.nodemission != "docker") {
                        resp = me.cmd([
                            "wget --no-check-certificate '%(url)' -O '%(path)'",
                            "source %(path)",
                            "validateCustomSSL"
                        ], {
                            url : nodeManager.getValidationScriptUrl(),
                            path : nodeManager.getValidationPath()
                        });

                        bCustomSSLSupported = (resp.result == 0);
                    }
                }

                bCustomSSLSupported = !!bCustomSSLSupported;
            }

            return bCustomSSLSupported;
        };

        me.checkEnvSsl = function () {
            var resp = me.getEnvInfo();
            if (resp.result != 0) return resp;

            var env = resp.env || {};

            if (!env.sslstate) {
                return jelastic.env.control.EditEnvSettings(envName, session, { sslstate: true });
            }

            return { result : 0 };
        };
    }

    function _(str, values) {
        return new StrSubstitutor(values || {}, "%(", ")").replace(str);
    }

    function isDefined(value) {
        return typeof value !== "undefined";
    }

    function getVersion() {
        version = version || jelastic.system.service.GetVersion();
        return version;
    }

    function getPlatformVersion() {
        return getVersion().version.split("-").shift();
    }

    function getPlatformEdition() {
        return getVersion().edition;
    }

    function getScript(name) {
        return jelastic.dev.scripting.GetScript(name);
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
        if (jelastic.marketplace && jelastic.marketplace.console && message) {
            return jelastic.marketplace.console.WriteLog(appid, session, message);
        }

        return { result : 0 };
    }

    function getUserInfo() {
        return jelastic.users.account.GetUserInfo(appid, session);
    }
}
