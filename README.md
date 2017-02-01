# Free SSL Let’s Encrypt Add-On


Let’s Encrypt Add-on for Automatic SSL Configuration of Your Jelastic Environment


![Let’s Encrypt Add-on](/images/letsencrypt-jelastic-ssl.png)



**[Let’s Encrypt](https://letsencrypt.org/)** is a free and open Certificate Authority, that simplifies and automates processes of browser-trusted SSL certificates issuing and appliance. This is achieved through obtaining a browser-trusted SSL certificate from Let's Encrypt and attaching it to environment entry point (i.e. either compute node or load balancer). Upon integrating such certificate into your application, it will start supporting secure connection via the _HTTPS_ protocol.


## SSL Configuration with Jelastic Let’s Encrypt Add-On


This solution can be installed to any environment with the following Jelastic certified containers as an entry point:
- Load Balancers - _NGINX, Apache LB, HAProxy_
- Java application servers - _Tomcat 6/7/8/9, TomEE, GlassFish 3/4, Jetty 6_
- PHP application servers - _Apache PHP, NGINX PHP_
- Ruby application servers - _Apache Ruby, NGINX Ruby_

Herewith, pay attention that Tomcat 8/9, GlassFish 4 and HAProxy servers are supported only starting with 4.9.5 Jelastic Platform version. Other stacks support is going to be implemented further.

The Let’s Encrypt add-on allows to configure SSL for:
- **_Internal environment address_** (i.e. the one that contains platform domain name); can be used for testing purposes
- **_Custom domains_**, including multiple ones (each of them should be preliminarily bound to external IP of the corresponding node - either master application server instance or load balancer - via [A Record](https://docs.jelastic.com/a-records-domain-names)); provides trusted SSL certificates for production applications


To get deeper insights on how the Let’s Encrypt service works, refer to the [official documentation](https://letsencrypt.org/how-it-works/).


## How to Install Let’s Encrypt Add-On to Jelastic Environment


For the Let’s Encrypt SSL appliance, copy link to the **_manifest.jps_** file above and [import](https://docs.jelastic.com/environment-import) it to the required Jelastic Platform.

![Let’s Encrypt Installation](/images/install-letsencrypt-ssl.png)

Here, choose one of the following options:
- **Internal Domain** - creates a dummy (invalid) SSL certificate for your environment internal URL (_env_name.{[hoster_domain](https://docs.jelastic.com/jelastic-hoster-info)}_) to be used in testing 
- **Custom Domain** - allows to list the previously attached to the environment external domain(s) (if specifying multiple ones, separate them with either comma, space or semicolon)


Then define target environment with the corresponding _Environment name_ drop-down list (leaving the automatically chosen _Nodes_ layer value unchanged) and click on **Install** to initiate installation of the appropriate SSL certificates.


## How to Renew SSL Certificate


Your Let’s Encrypt SSL certificate(s) will remain valid for _90_ days. After this period expires, they need to be renewed (you'll get the appropriate email notification 30 days before expiration).

Depending on the Platform version your application is running at, this operation is performed in one of the following ways:
- _for Jelastic of 4.9.5 version and higher_ - the required updated SSL certificates are requested and applied automatically. By default, their validity is checked once per day at 3 AM with a special cron job (to change this period, adjust the corresponding _"0 3 * * *"_ setting within this package manifest file)
- _for preceding Jelastic versions_ - you need to handle this operation by your own upon receiving the appropriate notification.

To renew certificate files manually, use the **Update** button within add-on’s panel.

![Let’s Encrypt Update](/images/update-sll-certificate.png)

Also, your SSL certificates can be updated by add-on re-installation for the same domain name(s). Herewith, adding new or specifying different domain name(s) during this procedure will cause the complete replacement of used certificates.
