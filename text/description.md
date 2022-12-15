**Let's Encrypt** is a free solution for automated SSL certificates issuing. 
Just select a required *Environment* from the list below and specify the attached *External Domain(s)*.  

**Note:** 
* Public IP address will be automatically attached to all nodes within the entry point layer (application server or load balancer).
* Let’s Encrypt has a set of [limitations while issuing certificates](https://letsencrypt.org/docs/rate-limits/). If they don’t meet the requirements of your project, please consider using alternative SSL certificate authority.
* On the Node.js server, issued certificates are just stored at the /var/lib/jelastic/keys directory. Check the guide on how to read [SSL certificates on Node.js](https://www.virtuozzo.com/application-platform-docs/nodejs-le-ssl/).
