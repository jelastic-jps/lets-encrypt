# Let’s Encrypt Add-On for Automated SSL Certificates Configuration

**[Let’s Encrypt](https://letsencrypt.org/)** is a free and open Certificate Authority, that simplifies and automates processes of browser-trusted SSL certificates issuing and appliance. Using this package you can automatically install Let’s Encrypt as an add-on to your environment.

<p align="center"> 
<img src="https://github.com/jelastic-jps/lets-encrypt/blob/master/images/letsencrypt-jelastic-ssl.png" width="400">
</p>

The installation can be performed on one of the following Jelastic containers as an entry point:
* Load Balancers - _NGINX_, _Apache LB_, _HAProxy_, _Varnish_
* Java application servers - _Tomcat_, _TomEE_, _GlassFish_, _Payara_, _Jetty_
* PHP application servers - _Apache PHP_, _NGINX PHP_
* Ruby application servers - _Apache Ruby_, _NGINX Ruby_

If you require Let’s Encrypt SSL for any other stack, just add a load balancer in front of your application servers and install the add-on. SSL termination at load balancing level is used by default in clustered topologies.

The Let’s Encrypt add-on allows to configure SSL for:
* **_internal environment address_**, which is composed of environment name and platform domain, to be served with a dummy (i.e. not commonly trusted) SSL certificate; this option can be used for testing purposes
* **_external domain(s)_**, each of which should be preliminarily bound to external IP of the corresponding node - either master application server instance or load balancer - via [A Record](https://docs.jelastic.com/a-records-domain-names) or [CNAME](https://docs.jelastic.com/custom-domain-via-cname); provides trusted SSL certificates for production applications

To get deeper insights on how the Let’s Encrypt service works, refer to the [official documentation](https://letsencrypt.org/how-it-works/).

## Installation Process

Import the [raw link of the add-on manifest](https://raw.githubusercontent.com/jelastic-jps/lets-encrypt/master/manifest.jps) within Jelastic PaaS dashboard or initiate the installation within **Marketplace > Add-Ons**.

Note: to access the dashboard you need to be registered at one of the [Jelastic Public Cloud providers](https://jelastic.com/install-application/?manifest=https://raw.githubusercontent.com/jelastic-jps/magento-cluster/master/manifest.jps&keys=app.jelastic.eapps.com;app.cloud.hostnet.nl;app.jelastichosting.nl;app.appengine.flow.ch;app.jelasticlw.com.br;app.mircloud.host;app.jcs.opusinteractive.io;app.paas.quarinet.eu) or have a Private Cloud installation.

<p align="center"> 
<img src="https://github.com/jelastic-jps/lets-encrypt/blob/master/images/install-letsencrypt-ssl.png" width="400">
</p>

In the opened confirmation window:
* provide **External Domain(s)** of target environment, the possible options are:
  * leave the field blank to create a dummy SSL certificate, assigned to environment internal URL (env_name.{[hoster_domain](https://docs.jelastic.com/jelastic-hoster-info)}), for being used in testing
  * insert the preliminary linked external domain(s) to get trusted certificates; if specifying multiple hostnames, separate them with either comma or semicolon
<p align="center">
<img src="https://github.com/jelastic-jps/lets-encrypt/blob/master/images/separate-domains.png" width="400">
</p>

* select the corresponding **Environment name** within the expandable drop-down list 
* choose a Nodes layer with your environment entry point (usually, it’s automatically detected but can be redefined manually)

Finally, click **Install** and wait a few minutes for the process to be completed.

For additional information on how to renew or reconfigure SSL certificates using this add-on, follow the detailed [Let’s Encrypt SSL Certificates](https://jelastic.com/blog/free-ssl-certificates-with-lets-encrypt/) article.
Take into account, the free and custom SSL certificates are provided for billing accounts only.

Try out the **Let’s Encrypt SSL** add-on with [Jelastic Multi-Cloud PaaS](https://jelastic.com/) for Java, PHP, Node.js, Ruby, Python, .NET, Go, Docker Swarm and Kubernetes clusters.
