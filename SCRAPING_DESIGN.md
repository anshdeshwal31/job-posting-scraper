# Ingestion Evasion & Anti-Bot Evasion Design Document

This document outlines the engineering architecture, detection surfaces, evasion strategies, and ethical boundaries required to extract data repeatedly from high-security job platforms (e.g. LinkedIn, Indeed, Naukri, Wellfound) without triggering automated IP blocks or account bans.

---

## 1. The Detection Surface

Automated scrapers are detected by modern Web Application Firewalls (WAFs) like Cloudflare, Akamai, and PerimeterX through several distinct fingerprinting layers:

### A. HTTP/2 and TLS (JA3) Fingerprinting
- **The Surface**: When standard HTTP clients (such as Axios or Fetch in Node.js) initiate a TLS handshake, the cipher suites, extensions, and elliptic curves they advertise are different from those of standard consumer browsers (Chrome, Safari, Firefox). WAFs generate a JA3 hash of the handshake. If a client claiming to be "Chrome" sends a JA3 hash matching Node.js, the request is flagged instantly.
- **Mitigation**: Bypass this using a custom TLS connector (like `tls-client` or specialized scraping libraries) that mimics standard Chrome HTTP/2 frame settings, window sizes, and JA3 cipher order.

### B. Client-Side Browser Fingerprinting
- **The Surface**: Headless browsers (like Puppeteer or Playwright) leave execution traces in the browser environment:
  - `navigator.webdriver` is set to `true`.
  - Permissions APIs behave differently.
  - Absence of standard plugins or audio/video codecs.
  - Mismatches in Canvas or WebGL rendering dimensions.
- **Mitigation**: Inject stealth scripts (e.g., `puppeteer-extra-plugin-stealth`) to redefine `navigator.webdriver` to `undefined`, mock standard plugin arrays, and spoof canvas noise to prevent browser fingerprint tracking.

### C. Network & IP Reputation
- **The Surface**: Requests originating from hosting datacenters (AWS, DigitalOcean, GCP) are instantly blocked or CAPTCHA-walled by high-security job boards.
- **Mitigation**: Route all traffic through rotating **residential proxy networks**. These proxies route requests through real consumer devices with standard residential ISPs.

### D. Behavioral Patterns
- **The Surface**: Scripted behavior includes instantaneous page actions, linear mouse trajectories, static request timings (e.g. exactly every 10 seconds), and high page-request frequencies.
- **Mitigation**: Implement human-like mouse movements, randomized scroll patterns, and non-linear pacing delays.

---

## 2. Ingestion & Evasion Strategy

To run a reliable, continuous job pipeline, the ingestion architecture implements a layered stealth strategy:

```
Ingestion Orchestrator
        │
        ├── Session Manager (Isolates login/cookie states)
        │
        ├── Proxy Rotator (Swaps residential consumer IPs)
        │
        └── Request Pacer (Gaussian random delays)
                │
                └── Target Platform (LinkedIn/Indeed)
```

### A. IP and Session Rotation
- Maintain a pool of distinct user identities (cookies, session tokens, user-agent configurations).
- Ensure a 1:1 binding between a proxy IP and a specific session context. Swapping IPs mid-session under the same cookie set flags security alerts.

### B. Request Pacing
- Instead of static timeouts, delays between page requests follow a **Gaussian (Normal) Distribution** (e.g. $\mu = 5.0\text{s}$, $\sigma = 1.5\text{s}$). This guarantees natural variance mimicking a human reviewer reading job listings.

### C. Fallback Strategy (Plan B)
- **Primary Method**: Headless browser automation (Playwright stealth contexts).
- **Secondary (Plan B)**: If browser fingerprints are flagged or CAPTCHAs triggered:
  - Pivot to specialized third-party scraping APIs (e.g., ZenRows, ScraperAPI) which handle proxy rotation, CAPTCHA bypass, and TLS spoofing at the API level.
  - Swap to public RSS/API mirrors that act as cached caches of the original listings.

---

## 3. DOM Selector & Data Resilience

Target platforms frequently update their DOM tree layouts to break scrapers. The ingestion pipeline handles this through defensive programming:

### A. Semantic DOM Selectors
- Avoid brittle absolute selectors (e.g. `.container > div > span:nth-child(3)`).
- Use substring selector matches (e.g., `[class*="job-card"]`) or standard accessibility attributes (e.g. `[role="article"]`, `[aria-label="Job details"]`) which remain stable for screen readers and SEO purposes.

### B. Schema Boundary Enforcement (Zod)
- Every raw job object is passed through a strict schema validation gate (`RawJobSchema`).
- If markup changes break the parser, the schema rejects individual malformed elements, records a `WARNING` audit log, and lets valid elements pass. The script never crashes.

### C. Empty Payload Guards
- Ingesting an empty array `[]` when historic data exists triggers a `SuspiciousEmptyResponseError`. This halts database changes and issues an alert, preserving historic jobs.

---

## 4. Ethical Boundaries & Scrape Limits

Scraping operates within strict legal and ethical limits:

1. **Public vs. Private Boundaries**: The pipeline scrapes only publicly accessible, unauthenticated index pages. We do **not** scrape pages behind user logins or authenticated walls, respecting the boundaries of personal user data.
2. **Rate Limits & Server Load**: Respect target server capacities. Limit request speeds to prevent resource exhaustion on host servers.
3. **Intellectual Property & Personal Data (PII)**: We extract only basic, publicly listed job postings (titles, descriptions, URLs). We do **not** collect candidate profiles, resumes, or personal contact details.
