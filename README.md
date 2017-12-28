# Free SSL Let’s Encrypt Add-On

Let’s Encrypt Add-on for Automatic SSL Configuration of Your Jelastic Environment

![Let’s Encrypt Add-on](/images/letsencrypt-jelastic-ssl.png)

**[Let’s Encrypt](https://letsencrypt.org/)** is a free and open Certificate Authority, that simplifies and automates processes of browser-trusted SSL certificates issuing and appliance. This is achieved through obtaining a browser-trusted SSL certificate from Let's Encrypt and attaching it to environment entry point (i.e. either compute node or load balancer). Upon integrating such certificate into your application, it will start supporting secure connection via the _HTTPS_ protocol. 

## SSL Configuration with Jelastic Let’s Encrypt Add-On

This solution can be installed to any environment with one of the following Jelastic certified or dockerized containers as an entry point:
* Load Balancers - _NGINX_, _Apache LB_, _HAProxy_, _Varnish_
* Java application servers - _Tomcat 6/7/8/9_, _TomEE_, _GlassFish 3/4_, _Jetty 6_
* PHP application servers - _Apache PHP_, _NGINX PHP_
* Ruby application servers - _Apache Ruby_, _NGINX Ruby_

This list is constantly extended to subsequently provide all software stacks support.

The Let’s Encrypt add-on allows to configure SSL for:
* **_internal environment address_**, which is composed of environment name and platform domain, to be served with a dummy (i.e. not commonly trusted) SSL certificate; this option can be used for testing purposes
* **_external domain(s)_**, each of which should be preliminarily bound to external IP of the corresponding node - either master application server instance or load balancer - via [A Record](https://docs.jelastic.com/a-records-domain-names) or [CNAME](https://docs.jelastic.com/custom-domain-via-cname); provides trusted SSL certificates for production applications

To get deeper insights on how the Let’s Encrypt service works, refer to the [official documentation](https://letsencrypt.org/how-it-works/).

## How to Install Let’s Encrypt Add-On to Jelastic Environment

For the Let’s Encrypt SSL appliance, copy link to the **_manifest.jps_** file above and [import](https://docs.jelastic.com/environment-import) it to the required Jelastic Platform.

![Let’s Encrypt Installation](/images/install-letsencrypt-ssl.png)

Here, you need to:
* provide **_External Domains_** of target environment. Here, the possible options are:
  * leave the field blank to create a dummy SSl certificate, assigned to environment internal URL (_env_name.{[hoster_domain](https://docs.jelastic.com/jelastic-hoster-info)}_), for being used in testing
  * insert the preliminary linked external domain(s) to get a trusted certificate for each of them; if specifying multiple hostnames, separate them with either comma, space or semicolon
* select the corresponding **_Environment name_** within the expandable drop-down list 
* leave the automatically chosen _Nodes_ layer value unchanged - it defines a layer with your environment entry point

Finally, click on **Install** to initiate installation of the appropriate SSL certificate(s).

## How to Renew SSL Certificate

Your Let’s Encrypt SSL certificate(s) will remain valid for _90_ days. After this period expires, they need to be renewed for the encryption to remain active.

By default, the required updated SSL certificates are requested and applied automatically 30 days before expiration (you'll get the appropriate email notification). Such a check up is performed once per day based on the appropriate cron job. If needed, the exact time can be specified through adjusting the corresponding "cronTime": "_0 ${fn.random(1,6)} * * *_" setting within this package manifest file.

To renew certificate files manually, click the **Add-ons** button next to the appropriate environment layer and use the **Update Now** button within add-on’s panel.

![Let’s Encrypt Update](/images/update-ssl-certificate.png)

Also, your SSL certificates can be updated by add-on re-installation for the same domain name(s). Herewith, adding new or specifying different domain name(s) during this procedure will cause the complete replacement of used certificates.

## How to Reconfigure SSL Certificate

In case of necessity, the already existing **Let’s Encrypt** add-on can be adjusted to match a new requirements (i.e. to replace the currently used domain names with a list of new ones).

![Let’s Encrypt Configure](/images/configure-ssl-certificate.png)

> **Note:** To avoid security issues, a new certificate will be issued, even in case of removing domain name(s) from the existing one.

Just click the **Configure** button within Let’s Encrypt panel and type domain name in the appeared pop up window.
