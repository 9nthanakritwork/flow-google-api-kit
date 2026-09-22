# QUICKSTART_FOR_AI.md
# คู่มือสำหรับ AI — อ่านก่อนประยุกต์ใช้ทุกครั้ง

> **เป้าหมาย:** ส่ง request ไปที่ `flow.google.com` แบบ programmatic  
> โดย **เปิด Tab Google Flow ค้างไว้เฉยๆ** เพื่อดึง Token — ไม่ต้องทำ OAuth ซับซ้อน

---

## 🎯 ภาพรวมในหนึ่งประโยค

```
เปิด Tab flow.google.com → ดึง Token จาก Tab → ยิง batchexecute API ตรงๆ → ได้ผลลัพธ์
```

ไม่มี OAuth. ไม่มี Google API Key. ใช้แค่ Cookie + Session Token ของ Browser.

---

## 📁 อ่านไฟล์ตามลำดับนี้

```
1. QUICKSTART_FOR_AI.md  ← ไฟล์นี้ (อ่านก่อน)
2. AUTH.md               ← วิธีดึง Token จาก Browser Tab
3. PROTOCOL.md           ← วิธียิง API (batchexecute)
4. API_FLOW_TRACE.md     ← trace ทุก function จากโค้ดจริง
5. MODELS.md             ← modelApiKey ทุก model ทุก mode
6. IMAGE_MODELS.md       ← Image models โดยเฉพาะ
7. GAP_ANALYSIS.md       ← สิ่งที่ยังไม่รู้ + วิธีหาค่าจริง
8. sdk/flow-sdk.js       ← SDK พร้อมใช้ (Node.js)
9. sdk/examples.js       ← ตัวอย่าง 15 operation
```

---

## ⚡ วิธีทำงานจริง — ขั้นตอนที่ AI ต้องเข้าใจ

### Step 1: เปิด Tab Google Flow ค้างไว้

```
User เปิด https://flow.google.com → login ด้วย Google Account
Tab นี้ค้างไว้ตลอด — ไม่ต้องทำอะไรเพิ่ม
```

### Step 2: ดึง Token 3 ตัวจาก Tab

Token ทั้ง 3 ตัวนี้อยู่ใน **HTML source ของหน้า flow.google.com**:

```javascript
// วิธีที่ 1: ใช้ Chrome Extension (G-Labs Flow) ดึงให้ — แล้วรับผ่าน Webhook
// วิธีที่ 2: ดึงเองจากหน้าเว็บ

// เปิด DevTools Console ที่ Tab flow.google.com แล้วรัน:
const at  = document.querySelector('input[name="at"]')?.value
         ?? (document.body.innerHTML.match(/"SNlM0e":"([^"]+)"/) || [])[1];
const bl  = (document.body.innerHTML.match(/"cfb2h":"([^"]+)"/) || [])[1];
const sid = (document.body.innerHTML.match(/"FdrFJe":"([^"]+)"/) || [])[1];
const authIndex = location.pathname.match(/\/u\/(\d+)/)?.[1] ?? "0";

console.log({ at, bl, sid, authIndex });
// ได้: { at: "AFSAue...", bl: "boq_...", sid: "-...", authIndex: "0" }
```

**Token ใช้งานได้ประมาณ 1 ชั่วโมง** — ถ้าหมดอายุ refresh Tab แล้วดึงใหม่

### Step 3: ดึง RC Config (รู้ modelApiKey จริงๆ)

```javascript
// วิธีที่ถูก: ดึง rc จาก Extension storage หรือ intercept network
// วิธีเร็ว: hardcode modelApiKey ที่รู้แน่ๆ แล้วแก้ถ้า error

// modelApiKey ที่ใช้ได้แน่ๆ:
const KNOWN_MODELS = {
  image: "gemini_v4_img_flow",           // NanoBanana (Gemini Image 3)
  video_t2v_lite: "veo_3_1_t2v_lite",    // Veo 3.1 Lite (standard)
  video_t2v_free: "veo_3_1_t2v_lite_low_priority",  // Free (0 credits)
  tts: "gemini_v4s_tts_flow",            // Text-to-Speech
};
```

### Step 4: ยิง API

```javascript
// ทุก request ไปที่ URL เดียว:
const ENDPOINT = `https://flow.google.com/_/FlowUi/data/batchexecute`;

// ตัวอย่าง generate image:
const payload = buildImagePayload(modelApiKey, captchaToken, aspectCode, parts, opts);
const body = new URLSearchParams({
  "f.req": JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]),
  "at":    at,  // Token ที่ดึงมา
});

const response = await fetch(
  `${ENDPOINT}?authuser=${authIndex}&rpcids=${rpcId}&source-path=/flow/${authIndex}&bl=${bl}&f.sid=${sid}&hl=en&rt=c`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "X-Same-Domain": "1" },
    credentials: "include",  // ส่ง Cookie ไปด้วย
    body,
  }
);
```

---

## 🏗️ Architecture ที่ AI ควรสร้าง

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Chrome)                         │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │  Tab: flow.google.com│    │  Tab: Your App (optional) │   │
│  │  - Login ค้างไว้     │    │  - หรือ Extension popup   │   │
│  │  - Cookie อยู่ที่นี่  │    └──────────────────────────┘   │
│  └──────────┬──────────┘                                   │
└─────────────│───────────────────────────────────────────────┘
              │ ดึง at, bl, sid, Cookie
              ↓
┌─────────────────────────────────────────────────────────────┐
│              Your Automation Script (Node.js)               │
│                                                             │
│  const sdk = new FlowSDK({ at, bl, sid, authIndex,          │
│                            rc, cookies });                  │
│                                                             │
│  // Generate!                                               │
│  const img = await sdk.generateImage({ prompt, ... });      │
│  const vid = await sdk.generateVideo({ mode:"t2v", ... });  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 สิ่งที่ต้องรู้เกี่ยวกับ Token

| Token | ชื่อใน HTML | อายุ | ใช้ทำอะไร |
|-------|------------|------|----------|
| `at` | `SNlM0e` | ~1 ชม. | CSRF token ใน POST body (`&at=...`) |
| `bl` | `cfb2h` | ~1 ชม. | Build label ใน URL query (`&bl=...`) |
| `sid` | `FdrFJe` | ~1 ชม. | Session ID ใน URL query (`&f.sid=...`) |
| Cookie | Browser Cookie | ~1 วัน | ส่งใน header อัตโนมัติ (credentials: include) |

**กฎสำคัญ:** Cookie ต้องมาจาก Browser เดียวกัน ถ้ารัน Node.js ต้องก็อป Cookie มาใส่ด้วย

---

## 🍪 วิธีดึง Cookie สำหรับ Node.js

```javascript
// เปิด DevTools → Application → Cookies → flow.google.com
// Copy ค่าออกมา หรือรันใน Console:

const cookies = document.cookie;
// หรือดึงเฉพาะที่ต้องการ:
const needed = ["__Secure-3PSID", "__Secure-3PAPISID", "HSID", "SSID", "APISID", "SID", "NID"];
const cookieObj = {};
document.cookie.split(";").forEach(c => {
  const [k, v] = c.trim().split("=");
  if (needed.includes(k)) cookieObj[k] = v;
});

// ใช้ใน Node.js:
headers["Cookie"] = Object.entries(cookieObj).map(([k,v]) => `${k}=${v}`).join("; ");
```

---

## 🎬 reCAPTCHA — ปัญหาหลักสำหรับ Node.js

**ปัญหา:** reCAPTCHA ต้องรันใน Browser (มี JavaScript + DOM)

**วิธีแก้ 3 แบบ:**

### วิธีที่ 1: ขอ Token จาก Tab (แนะนำที่สุด)
```javascript
// รันใน Browser Tab (Content Script หรือ Console):
async function mintCaptcha(action) {
  const token = await grecaptcha.enterprise.execute(SITE_KEY, { action });
  return token;
}

// ส่ง token ผ่าน WebSocket หรือ Local HTTP Server ไปให้ Node.js:
const token = await fetch("http://localhost:3001/captcha?action=GENERATE_IMAGE")
  .then(r => r.text());
```

### วิธีที่ 2: 2captcha / CapSolver Service
```javascript
// ใช้ service ภายนอก solve reCAPTCHA
const token = await capsolver.recaptchaV3({
  websiteKey: SITE_KEY,
  websiteURL: "https://flow.google.com",
  pageAction: "GENERATE_IMAGE",
});
```

### วิธีที่ 3: Puppeteer/Playwright (รัน Browser อัตโนมัติ)
```javascript
// เปิด Browser แบบ headless, navigate ไป flow.google.com
// ดึง token จาก page context
const token = await page.evaluate(async (key, action) => {
  return await grecaptcha.enterprise.execute(key, { action });
}, SITE_KEY, "GENERATE_IMAGE");
```

---

## 📦 การใช้ SDK ที่มีอยู่แล้ว (sdk/flow-sdk.js)

```javascript
const { FlowSDK } = require("./sdk/flow-sdk");

// Setup
const sdk = new FlowSDK({
  at:        "AFSAue...",   // จาก Browser Tab
  bl:        "boq_...",
  sid:       "-1234...",
  authIndex: "0",
  rc:        rcConfig,      // จาก Extension storage หรือ hardcode บางค่า
  cookies:   cookieString,  // จาก Browser
});

// ───────────────── Image ─────────────────
// Generate
const img = await sdk.generateImage({
  prompt:      "A beautiful mountain at sunset",
  modelApiKey: "gemini_v4_img_flow",   // NanaBanana
  aspect:      "16:9",
  projectId:   PROJECT_ID,
  captchaToken: await getCaptchaToken("GENERATE_IMAGE"),
});
console.log(img.url, img.mediaId);

// Upscale
const hd = await sdk.upscaleImage({
  mediaId:     img.mediaId,
  resolution:  "4K",
  captchaToken: await getCaptchaToken("GENERATE_IMAGE"),
});

// ───────────────── Video ─────────────────
// Text to Video
const job = await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  "veo_3_1_t2v_lite",
  prompt:       "A cat playing in slow motion",
  aspect:       "landscape",
  projectId:    PROJECT_ID,
  captchaToken: await getCaptchaToken("GENERATE_VIDEO"),
});

// Poll until done
let result;
while (!result?.done) {
  await sleep(5000);
  result = await sdk.pollVideo({ mediaId: job.mediaId });
}
console.log("Video URL:", result.videoUrl);

// ───────────────── Audio (TTS) ─────────────────
const audio = await sdk.generateAudio({
  text:        "Hello, this is a test.",
  voice:       "aoede",
  projectId:   PROJECT_ID,
  captchaToken: await getCaptchaToken("GENERATE_AUDIO"),
});
```

---

## 🤖 สูตรสำเร็จ — Automation ที่ง่ายที่สุด

```
Architecture แนะนำสำหรับเริ่มต้น:

Browser (Chrome)
  └── Tab: flow.google.com (login ค้างไว้)
  └── Tab: Local App (http://localhost:3000)
        └── JavaScript ใน Tab นี้:
              - ดึง at/bl/sid จาก flow tab ด้วย window.open หรือ BroadcastChannel
              - mint reCAPTCHA token โดยตรง (grecaptcha available ถ้าอยู่ domain เดียว)
              - ยิง fetch() ไป flow.google.com (same browser = same cookies)
              - รับ result → แสดงหรือส่งต่อ

ข้อดี: ไม่ต้องก็อป Cookie, ไม่ต้อง solve reCAPTCHA ภายนอก, ไม่ต้อง Node.js
```

---

## ❓ คำถามที่ AI มักถามผิด

**Q: ต้องมี Google API Key ไหม?**  
A: ไม่ต้อง — ใช้ Session Token จาก Browser แทน

**Q: ต้อง OAuth ไหม?**  
A: ไม่ต้อง — login ผ่าน Browser ปกติ แล้วก็อป Token มาใช้

**Q: rpcid ("YhhmEf") ดึงมาจากไหน?**  
A: มาจาก `rc.flow_google.rpcids` ที่ server ส่งมา — ดึงได้จาก Extension storage  
หรือดัก Network ดู request ที่ Extension ยิงแล้วก็อป rpcid ออกมา

**Q: modelApiKey ดึงมาจากไหน?**  
A: มาจาก `rc.image_models.models[key].api_model` — ดูรายละเอียดใน IMAGE_MODELS.md  
ค่าที่รู้แน่แล้ว: `"gemini_v4_img_flow"` (NanaBanana), `"veo_3_1_t2v_lite"` (Veo Lite), `"gemini_v4s_tts_flow"` (TTS)

**Q: ทำไม fetch ส่งแล้ว 403?**  
A: ขาด Cookie หรือ `X-Same-Domain: 1` header หรือ CORS block — ต้องรันใน Browser หรือใช้ proxy

---

## 🗺️ Decision Tree — เลือก Architecture ตามงาน

```
ต้องการ Automation แบบไหน?
│
├── รัน Script ใน Browser Tab (ง่ายสุด)
│   → ใช้ fetch() ตรงจาก Tab, Cookie อัตโนมัติ, captcha จาก grecaptcha
│   → เหมาะกับ: batch generate จำนวนไม่มาก
│
├── รัน Node.js บน Server
│   → ต้อง: ก็อป Cookie + ใช้ 2captcha สำหรับ reCAPTCHA
│   → เหมาะกับ: automated pipeline, webhook server
│   → ดูตัวอย่าง: sdk/examples.js
│
├── Browser Extension (เหมือน G-Labs)
│   → ContentScript ดึง Token → Background SW รัน API
│   → ดู: AUTH.md สำหรับ architecture
│
└── Puppeteer / Playwright
    → Headless Chrome = Browser จริง = ไม่มี CORS ไม่มีปัญหา cookie
    → เหมาะกับ: production automation
    → ง่ายสุดถ้าไม่อยากจัดการ Token เอง
```

---

## ⚙️ ค่า Config ที่ต้อง Hardcode ไว้ก่อน (ใช้ได้เลย)

```javascript
// ค่าที่รู้แน่แล้วจากการ reverse engineer extension v10.8.50:
const FLOW_CONFIG = {
  baseUrl:    "https://flow.google.com",
  appName:    "FlowUi",
  
  // reCAPTCHA Actions (hardcoded ใน extension):
  captchaActions: {
    image:        "GENERATE_IMAGE",
    video:        "GENERATE_VIDEO",
    audio:        "GENERATE_AUDIO",
    upload_image: "UPLOAD_IMAGE",
  },
  
  // Aspect Ratios (hardcoded ใน extension):
  imageAspects: {
    "1:1":  1,  // Square
    "16:9": 2,  // Landscape
    "9:16": 3,  // Portrait
    "4:3":  4,
    "3:4":  5,
  },
  videoAspects: {
    "landscape": 1,
    "portrait":  2,
  },
  imageUpscaleLevels: { "2K": 1, "4K": 2 },
  videoUpscaleRes:    { "1080p": 1, "4K": 2 },
  
  // Known modelApiKeys (stable across versions):
  knownModels: {
    image: {
      "NanaBanana":     "gemini_v4_img_flow",      // Gemini Image 3
    },
    video: {
      "lite_free":      "veo_3_1_t2v_lite_low_priority",  // 0 credits
      "lite_standard":  "veo_3_1_t2v_lite",               // standard
    },
    audio: {
      "tts":            "gemini_v4s_tts_flow",     // TTS
    },
  },
  
  // Tier codes:
  tiers: { 0:"UNSPECIFIED", 1:"PRO", 2:"ULTRA", 3:"FREE", 4:"UNSUBSCRIBED_WITH_CREDITS", 5:"ZERO", 6:"EXEMPT", 7:"GEMNOVA", 8:"ULTRA1P5" },
  
  // Video status codes:
  videoStatus: { 3: "done", 4: "error" },
  
  // Tool name for image (hardcoded in extension):
  imageToolName: "PINHOLE",
};
```

---

## 🚀 Minimal Working Example (เริ่มจากนี้)

```javascript
// minimal.js — ทดสอบว่า Token ถูกต้องไหม
// รันใน Browser Console ที่ Tab flow.google.com

async function testConnection() {
  // 1. ดึง tokens
  const html   = document.body.innerHTML;
  const at     = html.match(/"SNlM0e":"([^"]+)"/)?.[1] || "";
  const bl     = html.match(/"cfb2h":"([^"]+)"/)?.[1] || "";
  const sid    = html.match(/"FdrFJe":"([^"]+)"/)?.[1] || "";
  const authI  = location.pathname.match(/\/u\/(\d+)/)?.[1] ?? "0";
  
  console.log("Tokens:", { at: at.slice(0,10)+"...", bl, sid: sid.slice(0,5)+"..." });
  
  // 2. ดึง rpcId สำหรับ get_credits (ไม่ต้อง captcha — ง่ายสุด)
  // rpcId หาจาก Extension storage หรือ ดัก Network
  // ตัวอย่างใช้ค่าที่เห็นจาก Network:
  const rpcId = prompt("Enter get_credits rpcId (from DevTools Network tab):");
  
  // 3. เรียก API
  const url  = `https://flow.google.com/_/FlowUi/data/batchexecute?authuser=${authI}&rpcids=${rpcId}&source-path=/flow/${authI}&bl=${bl}&f.sid=${sid}&hl=en&rt=c`;
  const body = new URLSearchParams({ "f.req": JSON.stringify([[[rpcId, "[]", null, "generic"]]]), "at": at });
  
  const res  = await fetch(url, { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","X-Same-Domain":"1"}, body });
  const text = await res.text();
  console.log("Response:", text.slice(0, 500));
}

testConnection();
```

---

## 📌 สิ่งที่ยังไม่รู้ — ต้อง intercept Network หามาเอง

ดูรายละเอียดใน `GAP_ANALYSIS.md §13`

**สรุปสั้น:** เปิด DevTools → Network → filter `batchexecute` → ดู request ที่ Extension ยิง  
จะเห็น rpcId จริงๆ และ payload structure — ก็อปออกมาใช้ได้เลย

---

*Repository นี้ reverse-engineered จาก G-Labs Flow Extension v10.8.50 เพื่อการศึกษา*
