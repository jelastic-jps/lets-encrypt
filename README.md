[![Let's Encrypt](images/letsencrypt-logo-horizontal.png)](../../../lets-encrypt)
## Jelastic Let's Encrypt Add-on

This repository provides [Let's Encrypt](https://letsencrypt.org/about/) add-on for Jelastic Platform.

**Let's Encrypt** is a free, automated, and open certificate authority (CA), run for the public’s benefit. Let’s Encrypt is a service provided by the [Internet Security Research Group (ISRG)](https://letsencrypt.org/isrg/).

**Type of nodes this add-on can be applied to**: 
- Application server (cp).

### What it can be used for?
With a help of our bookmarklet, Let's Encrypt is installed on selected app server available in the environment. The key principles behind Let’s Encrypt are:<br />
    **Free**: Anyone who owns a domain name can use Let’s Encrypt to obtain a trusted certificate at zero cost.
    **Automatic**: Software running on a web server can interact with Let’s Encrypt to painlessly obtain a certificate, securely configure it for use, and automatically take care of renewal.
    **Secure**: Let’s Encrypt will serve as a platform for advancing TLS security best practices, both on the CA side and by helping site operators properly secure their servers.
    **Transparent**: All certificates issued or revoked will be publicly recorded and available for anyone to inspect.
    **Open**: The automatic issuance and renewal protocol will be published as an open standard that others can adopt.
    **Cooperative**: Much like the underlying Internet protocols themselves, Let’s Encrypt is a joint effort to benefit the community, beyond the control of any one organization.

	
For more information on what Let's Encrypt can be used for, follow the [Let's Encrypt](https://letsencrypt.org) reference.

### Deployment

In order to get this solution instantly deployed, click the "Get It Hosted Now" button, specify your email address within the widget, choose one of the [Jelastic Public Cloud providers](https://jelastic.cloud) and press Install.

[![GET IT HOSTED](https://raw.githubusercontent.com/jelastic-jps/jpswiki/master/images/getithosted.png)](https://jelastic.com/install-application/?manifest=https%3A%2F%2Fgithub.com%2Fjelastic-jps%2Flets-encrypt%2Fraw%2Fmaster%2Fmanifest.jps)

To deploy this package to Jelastic Private Cloud, import [this JPS manifest](../../raw/master/manifest.jps) within your dashboard ([detailed instruction](https://docs.jelastic.com/environment-export-import#import)).

For more information on what Jelastic add-on is and how to apply it, follow the [Jelastic Add-ons](https://github.com/jelastic-jps/jpswiki/wiki/Jelastic-Addons) reference.
