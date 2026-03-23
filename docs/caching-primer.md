# Caching Primer

Personal notes for building a serious mental model of caching on the web.

This is biased toward HTTP, browsers, CDNs, and API/product engineering work rather than database or in-process caches.

## Why caching matters

Caching is really about four things:

- latency: serve responses closer to the user
- origin protection: reduce repeated work on the app and database
- bandwidth: avoid retransmitting the same bytes
- resilience: sometimes serve stale-but-acceptable content while the origin is slow or unhealthy

The trap is that caching also introduces inconsistency. Every cache is a partial copy of reality with rules for when it can be trusted.

That means good caching is not "store more." It is:

- deciding what can be stale
- for how long
- for whom
- under which key
- with what revalidation or invalidation path

## The core mental model

Think in layers:

1. browser cache
2. shared intermediaries and enterprise proxies
3. CDN edge cache
4. reverse proxy / gateway cache near origin
5. application and data-layer caches

Each layer may have different rules, different lifetimes, and different visibility into headers.

For web apps, the most important starting point is usually:

- static assets: cache hard
- HTML shell: revalidate
- public media: cache with care
- authenticated or personalized data: usually private or uncached
- write paths: do not cache casually

## The science and technology underneath

### 1. Freshness

A response is fresh if it can be reused without asking origin again.

Typical controls:

- `Cache-Control: max-age=...`
- `s-maxage=...` for shared caches
- `Expires`

Freshness is the main latency lever.

### 2. Validation

When content may be reused only after checking origin, caches use validators.

Typical validators:

- `ETag`
- `Last-Modified`

Requests then use:

- `If-None-Match`
- `If-Modified-Since`

Validation gives you "cheap correctness": the client still asks, but the server can reply `304 Not Modified` instead of resending the body.

### 3. Cache keys

Caching is only safe if the key matches the representation.

A cache key is not just URL in the abstract. It may also vary by:

- method
- query string
- host
- `Accept-Encoding`
- `Accept-Language`
- auth state
- cookies
- selected request headers via `Vary`

Bad caching bugs are often key bugs, not TTL bugs.

### 4. Revalidation and stale serving

Modern caches are not just hit/miss stores. They can serve stale content while checking the origin.

Important directives:

- `stale-while-revalidate`
- `stale-if-error`
- `must-revalidate`
- `proxy-revalidate`

This is where modern CDN behavior gets interesting: performance is often about controlling stale windows, not just picking a TTL.

### 5. Targeted cache policy

Modern stacks often need different rules for:

- browsers
- generic shared caches
- a specific CDN like Cloudflare

That is why targeted headers matter:

- `CDN-Cache-Control`
- `Cloudflare-CDN-Cache-Control`

This is one of the more important "state of the art" developments in practical HTTP caching because it lets you separate browser policy from CDN policy without hacks.

### 6. Observability

If you cannot see how caches handled a response, you are guessing.

Useful signals:

- `Age`
- `Cache-Status`
- vendor headers like `CF-Cache-Status`

The modern standards direction here is toward structured, standardized cache reporting instead of vendor-only debugging headers.

## What to know in practice

### Cache classes

#### Browser cache

Good for:

- JS/CSS bundles
- images
- fonts
- short-lived HTML revalidation

Be careful with:

- auth-sensitive responses
- user-specific dashboards

#### CDN cache

Good for:

- static assets
- public media
- public API responses with stable keys
- shield/origin protection

Be careful with:

- cookies in the cache key
- auth headers
- personalized HTML
- cache poisoning and key explosion

#### App cache

Good for:

- repeated expensive computations
- derived report fragments
- reference data

Usually not the first cache you should add to a CRUD-heavy product.

### The practical patterns that age well

#### Pattern 1: versioned static assets

Use content-hashed filenames and cache them hard:

`Cache-Control: public, max-age=31536000, immutable`

This is one of the cleanest, safest optimizations in web engineering.

#### Pattern 2: HTML as revalidating shell

For SPA shells or server-rendered entry documents:

`Cache-Control: public, max-age=0, must-revalidate`

That gives you freshness without turning every page load into a full uncached fetch of all assets.

#### Pattern 3: public media with bounded freshness

For user-uploaded public files that may be replaced at stable URLs:

- use moderate TTLs
- consider `stale-while-revalidate`
- or move to versioned object paths if you want more aggressive caching

#### Pattern 4: authenticated documents as private

For inline PDFs or exports behind auth:

`Cache-Control: private, max-age=300, must-revalidate`

Usually better than `no-store` if the user may reopen the same document, but still keeps shared caches out.

#### Pattern 5: explicit invalidation only where necessary

If you can version URLs, do that.

If you cannot, then invalidation or purge tooling becomes important.

In general:

- static bundles: version, do not purge
- mutable public objects: either version or use short TTL + revalidation
- personalized responses: usually avoid shared caching

## Common mistakes

### 1. Using `no-store` everywhere

This is operationally simple and performance-hostile.

Use it for truly sensitive responses, not as a default.

### 2. Long TTLs on stable URLs that mutate

If the URL stays the same but the bytes change, long caching creates stale-content pain unless you also purge or revalidate aggressively.

### 3. Ignoring `Vary`

If the representation depends on language, compression, or auth shape and your cache key does not, you will leak or corrupt responses.

### 4. Caching personalized content in shared caches

This is one of the easiest ways to create a security incident.

### 5. Adding Redis before fixing HTTP caching

For most web apps, browser/CDN caching is a better first move than app-layer caches.

### 6. Treating CDN behavior as universal

Every CDN has slightly different semantics, overrides, defaults, and interactions with cookies, auth, and cache rules.

The standards matter, but vendor docs still matter too.

## What feels state of the art today

As of March 2026, the most important modern pieces are:

- standardized HTTP caching semantics in RFC 9111
- targeted cache headers like `CDN-Cache-Control` from RFC 9213
- better debugging and observability with `Cache-Status` from RFC 9211
- stale serving controls such as `stale-while-revalidate` and `stale-if-error`
- separating browser TTL from CDN TTL cleanly
- aggressive immutable caching for hashed assets

What is not state of the art:

- cargo-culting `no-cache` / `no-store`
- relying on query-string versioning alone when asset hashing is available
- assuming CDN cache behavior without measuring headers and actual hits

## How I would study caching

### Phase 1: build the mental model

Read these first:

- MDN HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
- MDN ETag: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
- Mark Nottingham's tutorial: https://www.mnot.net/cache_docs/

Goal:

- understand freshness
- understand validation
- understand shared vs private caches

### Phase 2: learn the standard

Read:

- RFC 9111 HTTP Caching: https://www.rfc-editor.org/rfc/rfc9111
- RFC 9213 Targeted HTTP Cache Control: https://www.rfc-editor.org/rfc/rfc9213.html
- RFC 9211 Cache-Status: https://www.rfc-editor.org/rfc/rfc9211.html

Goal:

- stop thinking of cache behavior as CDN folklore
- understand what the protocol actually says

### Phase 3: learn your CDN

For Cloudflare:

- Origin Cache Control: https://developers.cloudflare.com/cache/concepts/cache-control/
- CDN-Cache-Control: https://developers.cloudflare.com/cache/concepts/cdn-cache-control/

Goal:

- understand where Cloudflare follows origin headers
- understand when Cloudflare-specific controls are useful

### Phase 4: internalize performance tradeoffs

Read:

- web.dev on `stale-while-revalidate`: https://web.dev/articles/stale-while-revalidate
- Ilya Grigorik, *High Performance Browser Networking*: https://books.google.com/books/about/High_Performance_Browser_Networking.html?id=KfW-AAAAQBAJ
- Steve Souders, *High Performance Web Sites*:
  https://www.oreilly.com/library/view/high-performance-web/9780596529307/ch05s05.html

Goal:

- connect protocol mechanics to product latency and release strategy

## The short version

If you remember only a few rules, remember these:

1. Cache static assets aggressively, and version them.
2. Revalidate HTML instead of caching it forever.
3. Use `private` for authenticated documents and responses.
4. Do not put personalized responses in shared caches unless you are certain about the key.
5. Prefer origin-defined policy over CDN dashboard folklore.
6. Use `ETag` / validation and `stale-while-revalidate` intentionally.
7. Measure cache behavior with headers, not assumptions.

## How this maps to our app

For this codebase, the right order is:

- long-lived immutable caching for built frontend assets
- revalidating cache for the app shell HTML
- moderate caching for public R2 uploads
- short-lived private caching for authenticated inline PDFs
- no speculative shared caching for mutable authenticated API JSON yet

That is the correct starting point for an operational CRUD app like this one.
