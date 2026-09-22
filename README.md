# 🎬 Flow Google API Kit

> **Complete reverse-engineered protocol documentation and SDK for `flow.google.com`**  
> Extracted from Chrome Extension v10.8.50 — Ready for AI agents to build Custom API integrations.

---

## 📚 What's in this repo?

| File | Description |
|------|-------------|
| [`PROTOCOL.md`](./PROTOCOL.md) | Full API protocol spec — every RPC, every payload format |
| [`AUTH.md`](./AUTH.md) | Session extraction, reCAPTCHA, OAuth — step by step |
| [`MODELS.md`](./MODELS.md) | All AI models, voices, aspect ratios, parameters |
| [`sdk/flow-sdk.js`](./sdk/flow-sdk.js) | Standalone Node.js SDK — drop-in, no dependencies |
| [`sdk/examples.js`](./sdk/examples.js) | Full working examples for every API operation |
| [`sdk/payload-builders.js`](./sdk/payload-builders.js) | Low-level payload construction utilities |

---

## 🚀 Quick Start (for AI agents)

### What you need
1. **Session tokens** from `window.WIZ_global_data` on `flow.google.com`:
   - `SNlM0e` → `at` (CSRF token — **most important**)
   - `cfb2h`  → `bl` (build label)
   - `FdrFJe` → `sid` (session ID)
   - URL path `/u/{N}/` → `authIndex`

2. **Google session cookies** (browser cookies for `flow.google.com`)

3. **Remote config** (RPC IDs, model keys, aspect codes) — comes from the license server OR sniff from network traffic

4. **reCAPTCHA token** — must be minted from a live browser session

### Minimal example
```javascript
const { FlowSDK } = require('./sdk/flow-sdk');

const sdk = new FlowSDK({
  at:        'YOUR_SNlM0e',   // from WIZ_global_data
  bl:        'YOUR_cfb2h',    // from WIZ_global_data  
  sid:       'YOUR_FdrFJe',   // from WIZ_global_data
  authIndex: '0',             // from URL /u/0/
  rc:        YOUR_RC_CONFIG,  // see PROTOCOL.md §11
  cookies:   'SID=xxx; ...',  // Google session cookies
});

// Generate a video
const job = await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite',
  prompt:       'A mountain lake at golden hour',
  aspect:       'landscape',
  projectId:    'YOUR_PROJECT_ID',
  captchaToken: 'RECAPTCHA_TOKEN',
});

// Wait and get URL
const { done } = await sdk.waitForVideo(job.mediaIds);
const media    = await sdk.getMedia(done[0]);
console.log(media.videoUrl);
```

---

## 🏗️ Architecture Overview

```
flow.google.com Page
       │
       ├── window.WIZ_global_data  ←── Session tokens (at, bl, sid)
       ├── grecaptcha.enterprise   ←── reCAPTCHA minting
       │
       ↓
POST https://flow.google.com/_/FlowUi/data/batchexecute
  Query: rpcids=&source-path=&bl=&f.sid=&hl=en&rt=c
  Body:  f.req=[[[rpcId, JSON.stringify(payload), null, "generic"]]]
         at=SNlM0e_VALUE
  ↓
Response: )]}'\n[[["wrb.fr","rpcId","JSON_DATA",null,null,flagArray]]]
```

---

## ⚡ Key Concepts for AI Agents

### 1. Sparse Arrays
Flow's API uses "sparse arrays" — arrays with null gaps:
```javascript
// y({0: "hello", 3: "world"}) → ["hello", null, null, "world"]
function y(obj) {
  const keys = Object.keys(obj).map(Number);
  const max  = Math.max(...keys);
  const arr  = new Array(max + 1).fill(null);
  for (const k of keys) arr[k] = obj[k];
  return arr;
}
```
**Every payload is built using this function.**

### 2. reCAPTCHA Context Array
Every payload includes a reCAPTCHA context array at a specific position:
```javascript
// z(captchaToken, modelKey) → [null, version=22, null, null, null, captchaToken, ...]
function z(captchaToken, modelKey = null, version = 22) {
  const n = { 1: version };
  if (captchaToken) n[5] = captchaToken;
  if (modelKey)     n[10] = [modelKey, 1]; // sparse array of model key
  return y(n);
}
```

### 3. Response Parsing
Strip the `)]}'` prefix, then find `wrb.fr` rows:
```javascript
text = text.slice(4);                        // remove )]}' 
// find all JSON arrays, look for rows where row[0] === "wrb.fr"
// row[2] contains the actual response JSON (double-encoded string)
data = JSON.parse(row[2]);
```

---

## 📋 All Available Operations

| Operation | Mode | RPC Config Key |
|-----------|------|----------------|
| Generate image | — | `image_generate` |
| Upload reference image | — | `image_upload` |
| Upscale image | 2K / 4K | `image_upscale` |
| Generate video (text) | `t2v` | `video_text` |
| Generate video (image start) | `i2v` | `video_start_image` |
| Generate video (first+last) | `first_last` | `video_start_end_image` |
| Generate video (references) | `ingredients` | `video_reference_images` |
| Edit / extend video | `edit` | `video_edit` |
| Poll video status | — | `video_poll` |
| Get media info + URL | — | `get_media` |
| Upscale video | 1080p / 4K | `video_upscale` |
| Generate audio (TTS) | — | `audio_generate` |
| Create character entity | — | `entity_create` |
| Create project | — | `project_create` |
| Get credits & tier | — | `get_credits` |

---

## 🔑 How to Get Your Tokens (Manual)

1. Open **Chrome DevTools** on `flow.google.com/project/xxx`
2. Console tab, type:
   ```javascript
   WIZ_global_data.SNlM0e  // → at token
   WIZ_global_data.cfb2h   // → bl
   WIZ_global_data.FdrFJe  // → sid
   ```
3. Network tab → filter `batchexecute` → copy cookies from request headers
4. For reCAPTCHA token:
   ```javascript
   grecaptcha.enterprise.execute(
     '___grecaptcha_cfg.clients[0]...sitekey',
     { action: 'GENERATE_VIDEO' }
   ).then(console.log)
   ```

---

## 📎 Notes

- RPC ID strings (`YhhmEf`, `jwpduf`, etc.) are **dynamic** — loaded from server config. Sniff from network or extract from license response.
- Tokens expire — `at` typically lasts ~1 hour, cookies ~days.
- Video polling: check every 5s, videos take 30s–3min depending on model.
- `0-credit` model: `veo_3_1_t2v_lite_low_priority`

---

## 📄 License

Educational / research purposes. All trademarks belong to their respective owners.
