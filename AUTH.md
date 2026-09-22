# AUTH.md — Session & Authentication Guide

> How Flow.google.com authenticates requests, and how to extract every required token.

---

## Overview

Flow.google.com uses **three layers** of authentication:
1. **WIZ Session Tokens** — page-level CSRF and session identifiers
2. **Google Cookies** — browser session (SSO)
3. **reCAPTCHA Enterprise Token** — per-request bot protection

All three must be present in every API call.

---

## Layer 1: WIZ Session Tokens

These are embedded in `window.WIZ_global_data` on every Flow page.  
They are only readable from the **main world** (page context), not from Chrome extension isolated world.

### Token Map

| Token Name | JavaScript Key | Where Used | Example |
|------------|---------------|------------|---------|
| `at` | `WIZ_global_data.SNlM0e` | POST body: `at=...` | `AMf-vBy...` |
| `bl` | `WIZ_global_data.cfb2h` | Query param: `bl=...` | `boq_flowuiserver_...` |
| `sid` | `WIZ_global_data.FdrFJe` | Query param: `f.sid=...` | `1234567890` |
| `authIndex` | URL path `/u/{N}/` | URL and source-path | `0`, `1`, `2` |

### How to Extract

**In a browser console** (on any `flow.google.com` page):
```javascript
const auth = {
  at:        WIZ_global_data.SNlM0e,
  bl:        WIZ_global_data.cfb2h,
  sid:       String(WIZ_global_data.FdrFJe),
  authIndex: location.pathname.match(/\/u\/(\d+)/)?.[1] ?? '0',
};
console.log(JSON.stringify(auth, null, 2));
```

**Via Puppeteer / Playwright:**
```javascript
const auth = await page.evaluate(() => ({
  at:        window.WIZ_global_data?.SNlM0e ?? '',
  bl:        window.WIZ_global_data?.cfb2h  ?? '',
  sid:       String(window.WIZ_global_data?.FdrFJe ?? ''),
  authIndex: location.pathname.match(/\/u\/(\d+)/)?.[1] ?? '0',
}));
```

### Email Extraction (Optional)
Used for per-account caching. Scraped from page HTML via regex:
```javascript
// Pattern 1: OGB account tuple
html.match(/"([\w.+-]+@[\w-]+\.[\w.]+)"\s*,\s*(?:true|1)\s*\]/)?.[1]
// Pattern 2: escaped JSON
html.match(/\\\"email\\\":\\\"([\w.+-]+@[\w-]+\.[\w.]+)\\\"/)?.[1]
// Pattern 3: plain JSON  
html.match(/"email":"([\w.+-]+@[\w-]+\.[\w.]+)"/)?.[1]
```

---

## Layer 2: Google Session Cookies

Required as `Cookie` header (or browser `credentials: 'include'`).

### Essential Cookies for `flow.google.com`
```
SID=...
HSID=...
SSID=...
APISID=...
SAPISID=...
__Secure-1PSID=...
__Secure-3PSID=...
__Secure-1PAPISID=...
__Secure-3PAPISID=...
```

### Extracting via Puppeteer
```javascript
await page.goto('https://flow.google.com');
const cookies = await page.cookies('https://flow.google.com');
const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
```

### Using in Node.js Fetch
```javascript
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Cookie':        cookieStr,
    'Content-Type':  'application/x-www-form-urlencoded;charset=UTF-8',
    'X-Same-Domain': '1',
  },
  body: requestBody,
});
```

---

## Layer 3: reCAPTCHA Enterprise Token

### Important Rules
- `grecaptcha.enterprise` is **only present on `/project/*` pages** — not on the root page
- The token expires in ~2 minutes — mint just before each API call
- Tokens are minted **serially** (one at a time) — parallel minting causes failures
- Each operation type uses a different **action string**

### Action Strings (from server config `captcha_actions`)
```javascript
const CAPTCHA_ACTIONS = {
  image:        'GENERATE_IMAGE',   // image generate + upscale
  video:        'GENERATE_VIDEO',   // video generate + upscale + edit
  audio:        'GENERATE_AUDIO',   // TTS/audio generation
  upload_image: 'UPLOAD_IMAGE',     // uploading reference images
};
// Note: exact action strings come from rc.captcha_actions in server config
```

### Site Key Detection
```javascript
// Auto-detected from ___grecaptcha_cfg:
function detectSiteKey() {
  const clients = window.___grecaptcha_cfg?.clients;
  if (!clients) return '';
  for (const ck of Object.keys(clients)) {
    const client = clients[ck];
    for (const p of Object.keys(client)) {
      const v = client[p];
      if (v && typeof v === 'object') {
        for (const p2 of Object.keys(v)) {
          if (v[p2]?.sitekey) return v[p2].sitekey;
        }
      }
    }
  }
  return '';
}
```

### Minting the Token (In-Browser)
```javascript
async function mintCaptcha(siteKey, action) {
  // Wait for grecaptcha to load (polls every 300ms, up to 8 seconds)
  await new Promise((resolve) => {
    const deadline = Date.now() + 8000;
    const check = () => {
      if (window.grecaptcha?.enterprise?.execute) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(check, 300);
    };
    check();
  });

  await new Promise(resolve => grecaptcha.enterprise.ready(resolve));
  
  // Timeout after 15 seconds
  const token = await Promise.race([
    grecaptcha.enterprise.execute(siteKey, { action }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
  ]);
  
  return token; // string — include in API payload
}
```

### Minting via Puppeteer
```javascript
const token = await page.evaluate(async (siteKey, action) => {
  await new Promise(r => grecaptcha.enterprise.ready(r));
  return await grecaptcha.enterprise.execute(siteKey, { action });
}, SITE_KEY, 'GENERATE_VIDEO');
```

---

## Complete Auth Object

Everything combined into one object used by the SDK:

```javascript
const auth = {
  // WIZ tokens
  at:        'AMf-vBxxxxxxx',   // SNlM0e — CRITICAL
  bl:        'boq_flowuiserver_20260922',  // cfb2h
  sid:       '-1234567890123',  // FdrFJe
  authIndex: '0',               // from URL
  
  // Not stored in auth object — passed separately:
  // cookies: 'SID=xxx; HSID=yyy; ...'
  // captchaToken: 'mint fresh per call'
};
```

---

## Token Lifetime & Refresh

| Token | Lifetime | How to Refresh |
|-------|---------|---------------|
| `at` (SNlM0e) | ~1 hour | Re-read `WIZ_global_data` after page reload |
| `bl` (cfb2h) | Days (build label) | Re-read after page reload |
| `sid` (FdrFJe) | Session | Re-read on session change |
| Google Cookies | Days–weeks | Re-login when 401 returned |
| reCAPTCHA token | ~2 minutes | Mint fresh before each call |

### Error Signals
```
HTTP 401 → at token invalid or cookies expired → re-auth
HTTP 400 → at token wrong → re-read WIZ_global_data
HTTP 403 → rate limited or account issue → wait 30s and retry
HTTP 429 + THROTTLED → service overloaded → wait 30s and retry
HTTP 429 + RESOURCE_EXHAUSTED → quota used up → no retry
```
