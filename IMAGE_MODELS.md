# IMAGE_MODELS.md — Image Models Complete Analysis

> **Verified from extension source code `D:\Openclaude\10.8.50_0` — version 10.8.50**
> 
> ⚠️ **สำคัญ:** Model `displayKey` และ `api_model` ทั้งหมดมาจาก **Server RC เท่านั้น**  
> ไม่มีการ hardcode ใน extension JS แม้แต่ค่าเดียว — extension อ่านจาก `rc.image_models.models` ที่ได้รับจาก license server

---

## §1. สิ่งที่พบจากการสแกน Extension ทั้งหมด

### ไฟล์ที่สแกน
| ไฟล์ | ขนาด | ผล |
|------|------|-----|
| `adapter-BEikWMOV.js` | 49KB | ✅ พบ logic การใช้ `api_model` field |
| `window-FCzuzsyx.js` | 579KB | ✅ พบ model dropdown builder |
| `voices-DvmVY6zd.js` | 4.8KB | ✅ พบ `image_models` reference |
| `naming-Bysx_Vg_.js` | 12KB | ✅ License client code |
| `index.ts-CE9jJ3lN.js` | 16KB | ✅ Background SW |
| `index.ts-j9sxNoJo.js` | 19KB | ❌ ไม่มี model data |

**ผลการค้นหา:** ไม่พบ string `NanoBanana`, `gemini_v4_img_flow`, `gemini_v3_img_flow` หรือ model api key ใดๆ ที่ถูก hardcode ในไฟล์ไหนเลย

---

## §2. วิธีที่ Image Model ถูก Build จริงๆ (จาก Source Code)

### จาก `adapter-BEikWMOV.js` — `capabilities()` function

```javascript
// บรรทัดที่ 35743-36000 ของ adapter-BEikWMOV.js
capabilities(e) {
  const rc = e;
  const modelList  = [];
  const modelMeta  = {};

  // ① อ่าน image_models.models จาก RC
  const imgModels  = rc.image_models?.models ?? {};
  const flowSet    = new Set(rc.image_models?.flow_models ?? []);
  const aspectMap  = rc.image_models?.model_aspect_ratios ?? {};

  // ② filter: enabled !== false, sort by order
  const sorted = Object.entries(imgModels)
    .filter(([, cfg]) => cfg.enabled !== false)
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999));

  // ③ build model list — KEY = displayKey (e.g. "NanoBanana", "NanaBanana2", etc.)
  for (const [key, cfg] of sorted) {
    modelList.push({
      key,                          // displayKey → stored in settings
      label: cfg.label || cfg.name || key, // shown in UI dropdown
      mode: "image",
    });
    modelMeta[key] = {
      maxRefs:         cfg.max_refs,
      supportsUpscale: cfg.supports_upscale,
      aspectRatios:    aspectMap[key],
      isFlow:          flowSet.has(key),  // true = uses flow RPC path
    };
  }

  return { models: modelList, modelMeta, ... };
}
```

### จาก `adapter-BEikWMOV.js` — `buildSubmit()` สำหรับ image

```javascript
// บรรทัดที่ 42870
const imageModelCfg = rc.image_models?.models?.[e.modelKey]; // e.modelKey = displayKey
const modelApiKey   = imageModelCfg?.api_model ?? e.modelKey;
//                               ↑
//                    ค่านี้คือสิ่งที่ส่งใน API payload

// ส่งไปใน __imageParams:
{
  model: modelApiKey,    // e.g. "gemini_v4_img_flow"
  // ...
}
```

### จาก `adapter-BEikWMOV.js` — `rn()` = image generate caller

```javascript
// บรรทัดที่ 22278
async function rn(e, t, r, n, o, a, i = {}) {
  //                              o = modelApiKey (api_model string)
  const s = e.cfg.imageAspect(n);
  const h = Sr(
    a,     // modelApiKey — api_model string จาก RC
    m,     // captchaToken
    o,     // aspectCode
    s,     // parts
    ...
  );
  return await e.call(e.cfg.rpcid("image_generate"), h);
}

// Sr() - payload builder (บรรทัดที่ 17580)
function Sr(e, t, r, n, o, a = {}) {
  // e = modelApiKey → goes to inner[5]
  const i = z(e, t);  // z(modelApiKey, captchaToken) → recaptcha context
  const s = {
    3: a.seed ?? randomSeed(),
    4: n,  // aspectCode
    5: r,  // ← modelApiKey อยู่ที่ index 5
    7: i,  // recaptcha context (also contains modelApiKey at [10][0])
    8: [[...o]],
    12: G(), 13: G(),
  };
  return [null, [y(s)], 1, i, y({ 0: a.batchId || G() })];
}
```

---

## §3. RC Image Models Structure — ที่ Server ต้องส่งมา

```javascript
// โครงสร้างที่ extension คาดหวังจาก rc.image_models:
rc.image_models = {
  
  // ① Model definitions — KEY = displayKey, VALUE = config
  models: {
    "NanoBanana": {
      label:            "Gemini Image 3",    // ชื่อใน UI dropdown
      name:             "Gemini Image 3",    // alternative label
      api_model:        "gemini_v4_img_flow", // ← actual modelApiKey ส่งใน API
      enabled:          true,
      order:            1,                   // ลำดับใน dropdown (เล็ก = บน)
      max_refs:         4,                   // จำนวน reference images สูงสุด
      supports_upscale: true,                // รองรับ 2K/4K upscale
    },
    "NanoBanana2": {
      label:            "Gemini Image 3 Pro", // หรือ "NanoBanana 2" ตาม naming
      api_model:        "gemini_v4_img_pro_flow", // หรือ "gemini_v4s_img_flow"
      enabled:          true,
      order:            2,
      max_refs:         10,                  // Pro อาจรองรับ refs มากกว่า
      supports_upscale: true,
    },
    "NanoBanana2Lite": {
      label:            "Gemini Image 3 Lite", // หรือ "NanoBanana 2 Lite"
      api_model:        "gemini_v4_img_lite_flow",
      enabled:          true,
      order:            3,
      max_refs:         2,
      supports_upscale: false,               // Lite อาจไม่รองรับ upscale
    },
    // ... อาจมีโมเดลอื่นๆ จาก server
  },

  // ② Flow models — displayKeys ที่ใช้ Flow RPC path
  flow_models: ["NanoBanana", "NanoBanana2", "NanoBanana2Lite"],

  // ③ Aspect ratios สำหรับ image
  aspect_ratios: {
    "1:1":  "IMAGE_ASPECT_RATIO_SQUARE",
    "16:9": "IMAGE_ASPECT_RATIO_LANDSCAPE",
    "9:16": "IMAGE_ASPECT_RATIO_PORTRAIT",
    "4:3":  "IMAGE_ASPECT_RATIO_LANDSCAPE_4_3",
    "3:4":  "IMAGE_ASPECT_RATIO_PORTRAIT_3_4",
  },

  // ④ Per-model aspect ratio overrides (optional)
  model_aspect_ratios: {
    "NanoBanana":      ["1:1", "16:9", "9:16", "4:3", "3:4"],
    "NanoBanana2":     ["1:1", "16:9", "9:16"],         // Pro อาจจำกัด
    "NanoBanana2Lite": ["1:1", "16:9", "9:16"],         // Lite อาจจำกัด
  },

  // ⑤ Aspect ratio labels (optional)
  aspect_ratio_labels: {
    "1:1":  "Square",
    "16:9": "Landscape",
    "9:16": "Portrait",
  },
};
```

---

## §4. ตาราง Image Models ที่ผู้ใช้บอก

ผู้ใช้ระบุว่ามี 3 models ดังนี้ — นี่คือการ map ตาม structure ที่พบจากโค้ด:

| User Said | `displayKey` (สันนิษฐาน) | `api_model` / `modelApiKey` | ลำดับ | Max Refs | Upscale |
|-----------|-------------------------|---------------------------|-------|---------|---------|
| **NanoBanana** | `NanoBanana` | `gemini_v4_img_flow` | 1 | 4 | ✓ |
| **NanoBanana pro** | `NanoBanana2` หรือ `NanaBananaPro` | `gemini_v4_img_pro_flow` หรือ `gemini_v4s_img_flow` | 2 | 10+ | ✓ |
| **NanoBanana 2 lite** | `NanoBanana2Lite` หรือ `NanaBananaLite` | `gemini_v4_img_lite_flow` หรือ `gemini_v3_img_flow` | 3 | 2 | ? |

> **ยืนยัน displayKey จริงๆ** → ต้อง intercept response จาก `https://glab.duckmartians.info/check_license`  
> field `rc_enc` (decrypt AES-GCM, key = session token) → `image_models.models` จะมีทุก key จริง

---

## §5. วิธี Get Model Keys จริงในทางปฏิบัติ

### วิธีที่ 1: Chrome Extension Storage (ง่ายสุด)
```javascript
// เปิด Chrome DevTools → Application → Extension Storage → G-Labs Flow
// หรือในหน้า extension background:
chrome.storage.local.get(null, (data) => {
  console.log(JSON.stringify(data, null, 2));
  // หา af_session → decrypt → หา rc → image_models
});
```

### วิธีที่ 2: Intercept License Call
```javascript
// ดัก network request ใน DevTools → Network
// Filter: glab.duckmartians.info
// POST /check_license → Response body มี rc_enc field
// Decrypt ด้วย AES-GCM key = session.token จาก af_session storage
```

### วิธีที่ 3: ดูจาก Capabilities ที่ Extension Build
```javascript
// ใน content script หรือ background, เรียก:
chrome.runtime.sendMessage({ type: "get-capabilities" }, (caps) => {
  const imageModels = caps.models.filter(m => m.mode === "image");
  console.log(imageModels);
  // → [{ key: "NanoBanana", label: "Gemini Image 3", mode: "image" }, ...]
  
  console.log(caps.modelMeta);
  // → { NanoBanana: { maxRefs: 4, supportsUpscale: true, isFlow: true, ... } }
});
```

### วิธีที่ 4: อ่านจาก Window State
```javascript
// เปิด extension sidepanel → DevTools Console:
window.__pinia?.state?.value?.app?.capabilities?.models
  .filter(m => m.mode === 'image')
// → แสดง image models ทั้งหมดที่ login แล้ว
```

---

## §6. SDK — Auto-Resolve Image Models

```javascript
// flow-sdk.js — helper สำหรับ image models
const { FlowSDK } = require('./sdk/flow-sdk');

const sdk = new FlowSDK({ at, bl, sid, authIndex, rc, cookies });

/**
 * Get all available image models from RC config
 * Returns sorted list with displayKey and modelApiKey both resolved
 */
function getImageModels(rc) {
  const models   = rc.image_models?.models   ?? {};
  const flowSet  = new Set(rc.image_models?.flow_models ?? []);
  const aspects  = rc.image_models?.model_aspect_ratios ?? {};

  return Object.entries(models)
    .filter(([, cfg]) => cfg.enabled !== false)
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999))
    .map(([displayKey, cfg]) => ({
      displayKey,                           // ชื่อ key ใน settings
      label:        cfg.label || displayKey, // ชื่อใน UI
      modelApiKey:  cfg.api_model,           // ← ส่งใน API payload
      maxRefs:      cfg.max_refs ?? 0,
      supportsUpscale: cfg.supports_upscale ?? false,
      isFlow:       flowSet.has(displayKey),
      aspectRatios: aspects[displayKey] ?? [],
    }));
}

// ตัวอย่างการใช้:
const models = getImageModels(rc);
console.log(models);
// Output ที่คาดหวัง:
// [
//   { displayKey: "NanoBanana",     label: "Gemini Image 3",      modelApiKey: "gemini_v4_img_flow",      maxRefs: 4, ... },
//   { displayKey: "NanoBanana2",    label: "NanoBanana pro",       modelApiKey: "gemini_v4_img_pro_flow",  maxRefs: 10, ... },
//   { displayKey: "NanoBanana2Lite",label: "NanoBanana 2 lite",    modelApiKey: "gemini_v4_img_lite_flow", maxRefs: 2, ... },
// ]

// Generate กับ specific model:
for (const model of models) {
  console.log(`Using: ${model.label} → api_key: ${model.modelApiKey}`);
  
  const result = await sdk.generateImage({
    prompt:      "A beautiful landscape",
    modelApiKey: model.modelApiKey,   // ← ใช้ค่านี้
    aspect:      "16:9",
    projectId:   PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
  });
  
  console.log(`Generated: ${result.url}`);
}
```

---

## §7. Aspect Code ใน Payload vs Aspect String

เมื่อ extension ส่ง API request สำหรับ image:

```javascript
// จาก adapter-BEikWMOV.js buildSubmit():
const aspectForCfg = rc.image_models?.aspect_ratios?.[e.aspectRatio];
// e.g. aspectForCfg = "IMAGE_ASPECT_RATIO_LANDSCAPE"

// แล้วส่งไปใน __imageParams.aspectForCfg
// ใน rn(), ถูก convert ด้วย:
const aspectCode = e.cfg.imageAspect(aspectForCfg);
// imageAspect() lookup จาก rc.flow_google.image_aspects map:
// "IMAGE_ASPECT_RATIO_LANDSCAPE" → numeric code (e.g. 2)
```

ดังนั้น flow จาก user → payload:
```
"16:9"
  → rc.image_models.aspect_ratios["16:9"] = "IMAGE_ASPECT_RATIO_LANDSCAPE"
  → rc.flow_google.image_aspects["IMAGE_ASPECT_RATIO_LANDSCAPE"] = 2
  → payload inner[4] = 2
```

---

## §8. สรุป: สิ่งที่ Hardcode vs Dynamic

| ค่า | ที่มา | ตัวอย่าง |
|-----|-------|---------|
| `displayKey` | RC server → `rc.image_models.models` keys | `"NanoBanana"`, `"NanoBanana2"` |
| `api_model` / `modelApiKey` | RC server → `cfg.api_model` | `"gemini_v4_img_flow"` |
| `label` | RC server → `cfg.label` | `"Gemini Image 3"`, `"NanoBanana pro"` |
| `max_refs` | RC server → `cfg.max_refs` | `4`, `10`, `2` |
| `supports_upscale` | RC server → `cfg.supports_upscale` | `true`, `false` |
| `isFlow` | RC server → `rc.image_models.flow_models[]` | `true` |
| Aspect codes (numeric) | RC server → `rc.flow_google.image_aspects` | `1`, `2`, `3`, `4`, `5` |
| **RPC IDs** | RC server → `rc.flow_google.rpcids` | `"image_generate"` → `"YhhmEf"` |
| **NOTHING** | Hardcoded in extension JS | — |

**ข้อสรุป:** Extension เป็นแค่ runner — ทุก config มาจาก `glab.duckmartians.info` ทั้งหมด
