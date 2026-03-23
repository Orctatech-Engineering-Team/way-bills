# Cloudflare CDN Setup For This App

This note answers the practical question:

> Do I just put Cloudflare in front of the domain?

Short answer:

- yes, that is the first step
- no, that is not the whole setup

For this app, the correct setup is:

1. move DNS for the domains to Cloudflare
2. proxy the web-facing records through Cloudflare
3. use `Full (strict)` SSL from Cloudflare to your origin
4. keep host Caddy as the origin server
5. let Cloudflare respect the origin cache headers we already set
6. avoid broad "cache everything" rules on authenticated API traffic

## What "put Cloudflare in front" actually means

When a DNS record is proxied through Cloudflare, requests do not go directly to your VPS first.

The path becomes:

`Browser -> Cloudflare edge -> your VPS Caddy -> frontend/backend containers`

That gives you:

- CDN delivery for cacheable content
- TLS termination and edge security
- DDoS/WAF/rate-limiting options
- origin IP shielding for proxied records

Cloudflare documents this through proxied DNS records, also called the orange cloud. Only A, AAAA, and CNAME records used for web traffic should generally be proxied.  
Source: https://developers.cloudflare.com/dns/proxy-status/  
Source: https://developers.cloudflare.com/dns/manage-dns-records/reference/proxied-dns-records/

## Your app-specific topology

For this project:

- `waybills.orctatech.com` -> frontend
- `api.waybills.orctatech.com` -> backend
- host Caddy stays on the VPS
- Docker services stay bound to loopback
- Cloudflare sits in front of the public hostnames

That means Cloudflare talks to:

- your VPS Caddy on `443`

and Caddy still proxies internally to:

- frontend container on `127.0.0.1:<frontend port>`
- backend container on `127.0.0.1:<backend port>`

This is a good setup. You do not need to remove Caddy.

## What you actually need to do

### 1. Put both public hostnames on proxied DNS records

In Cloudflare DNS:

- `waybills.orctatech.com` -> proxied
- `api.waybills.orctatech.com` -> proxied

That is the minimum step for Cloudflare to act as CDN and reverse proxy.

If a record stays DNS-only, traffic goes directly to your VPS and Cloudflare caching/protection does not apply.

Source: https://developers.cloudflare.com/dns/proxy-status/

### 2. Set SSL/TLS mode to `Full (strict)`

This is the correct setting for your stack if Caddy already serves valid HTTPS on the origin.

Why:

- browser to Cloudflare stays encrypted
- Cloudflare to your VPS stays encrypted
- Cloudflare verifies the origin certificate

Do not use `Flexible`.

Cloudflare recommends `Full (strict)` whenever possible.  
Source: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/

### 3. Keep Caddy as the origin

Cloudflare is not replacing Caddy here.

Caddy still does:

- origin TLS
- routing frontend/backend
- local loopback reverse proxy

Cloudflare adds:

- edge caching
- edge TLS
- DNS proxying
- security controls

That is a normal and clean setup.

### 4. Let Cloudflare respect origin cache headers

This is the important part.

You do not want to guess caching behavior with ad-hoc dashboard settings if the app already sends the right headers.

On this branch, we already prepared origin-side cache policy:

- frontend hashed assets: long-lived immutable
- frontend HTML shell: revalidate
- public R2 media: moderate shared cache
- public document objects: shorter shared cache
- authenticated inline PDFs: `private`, short-lived

For Free, Pro, and Business plans, Cloudflare says Origin Cache Control is enabled by default.  
Source: https://developers.cloudflare.com/cache/concepts/cache-control/

That means the right default strategy is:

- do not override origin cache headers unless you have a very specific reason

## What not to do

### Do not add a blanket "Cache Everything" rule to the API domain

Cloudflare explicitly warns that broad `Cache Everything` rules can cache HTML or dynamic content in ways that are unsafe if pages contain personalized or changing data.  
Source: https://developers.cloudflare.com/cache/how-to/cache-rules/examples/cache-everything/

For this app, that warning matters a lot because:

- the API is authenticated
- the dashboard is personalized
- operational data changes often

So:

- do not cache authenticated JSON broadly
- do not cache by cookie-blind rules
- do not add a general "ignore query string" rule to the API

### Do not treat CDN cache as a substitute for application correctness

Cloudflare is great for:

- static assets
- public files
- origin offload

It is not where you should first solve:

- stale operational state in rider dashboards
- personalized response correctness
- permission-sensitive API data

## What will cache well in this app

### Good Cloudflare cache candidates

- frontend `/assets/*`
- public R2 profile images
- public receipt images
- public signature images if exposed publicly
- public generated document objects from R2

### Not good public-cache candidates

- authenticated `/auth/*`
- rider/admin JSON endpoints
- mutable personalized API responses
- anything returning `private` or `no-store`

### Middle ground

- inline authenticated PDF responses from the API

Those should stay browser-cacheable only, not public CDN-cacheable. That is why we set them to `private`.

## Recommended Cloudflare dashboard posture for this app

Start simple:

### DNS

- proxy `waybills.orctatech.com`
- proxy `api.waybills.orctatech.com`

### SSL/TLS

- mode: `Full (strict)`

### Cache

- respect origin cache headers
- do not start with `Cache Everything`
- do not override Browser TTL or Edge TTL globally

### Optional later

- WAF managed rules
- rate limiting on auth endpoints
- custom cache rules only for very specific public paths

## If you want more control later

The more advanced path is to separate browser and CDN policy using:

- `CDN-Cache-Control`
- `Cloudflare-CDN-Cache-Control`

Cloudflare documents both. These headers let you tell Cloudflare to cache something differently from browsers.  
Source: https://developers.cloudflare.com/cache/concepts/cdn-cache-control/

That is useful later if, for example, you want:

- browsers to revalidate quickly
- Cloudflare edge to hold content longer

We do not need that immediately for launch.

## The practical answer

So for you personally, the answer is:

- yes, put Cloudflare in front of `waybills.orctatech.com` and `api.waybills.orctatech.com`
- make both records proxied
- set SSL/TLS to `Full (strict)`
- keep Caddy as the origin
- let Cloudflare respect the origin cache headers we already configured
- do not add broad "cache everything" rules to the API

That is enough to start correctly.

## Reading list

If you want to understand the technology more deeply:

- Cloudflare Proxy Status:
  https://developers.cloudflare.com/dns/proxy-status/
- Cloudflare Origin Cache Control:
  https://developers.cloudflare.com/cache/concepts/cache-control/
- Cloudflare CDN-Cache-Control:
  https://developers.cloudflare.com/cache/concepts/cdn-cache-control/
- Cloudflare Cache Rules:
  https://developers.cloudflare.com/cache/how-to/cache-rules/
- Cloudflare `Cache Everything` warning/example:
  https://developers.cloudflare.com/cache/how-to/cache-rules/examples/cache-everything/
- Cloudflare Full (strict):
  https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/
- MDN HTTP caching:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- RFC 9111 HTTP Caching:
  https://www.rfc-editor.org/rfc/rfc9111
