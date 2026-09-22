/**
 * API_FLOW_TRACE.md — Complete API Call Flow for Every Operation
 * 
 * Traced 100% from source code:
 *   D:\Openclaude\10.8.50_0\assets\adapter-BEikWMOV.js
 * 
 * ═══════════════════════════════════════════════════════════
 * คำตอบ: เมื่อ user เลือก "NanoBanana 2 lite" แล้วกด Generate
 * ─────────────────────────────────────────────────────────
 * ทุก image model (NanoBanana, NanoBanana pro, NanoBanana 2 lite)
 * ยิงไปที่ RPC เดียวกัน = "image_generate"
 * สิ่งเดียวที่ต่างกันคือ model string ข้างในตัว payload เท่านั้น
 * ═══════════════════════════════════════════════════════════
 */

# API_FLOW_TRACE.md — Complete Call Flow for Every Model

> Traced 100% from `adapter-BEikWMOV.js` source code (49KB)

---

## §1. คำตอบหลัก: ทุก Image Model ยิงไป RPC เดียวกัน

เมื่อ user เลือก **NanoBanana 2 lite** กด Generate:

```
User clicks Generate
    ↓
settings.model = "NanoBanana2Lite"    ← displayKey
    ↓
buildSubmit()
    ↓
rc.image_models.models["NanoBanana2Lite"].api_model = "???"   ← ค่าจาก server
    ↓
rn(ctx, prompt, count, aspect, modelApiKey, projectId, opts)
    ↓
Sr(modelApiKey, captchaToken, aspectCode, parts, ...)   ← build payload
    ↓
e.call( e.cfg.rpcid("image_generate"), payload )   ← ALWAYS same RPC key
    ↓
rc.flow_google.rpcids["image_generate"] = "YhhmEf"   ← actual RPC ID from server
    ↓
POST https://flow.google.com/_/FlowUi/data/batchexecute
     ?rpcids=YhhmEf&source-path=...&bl=...&f.sid=...
     Body: f.req=[[[  "YhhmEf", JSON.stringify(payload), null, "generic"  ]]]
              ↑ rpcid is same regardless of which NanaBanana model
```

**ต่างกันแค่ `modelApiKey` ใน payload field[5]**

---

## §2. Flow แบบ Step-by-Step (จากโค้ดจริง)

### Step 1: User เลือก Model

```javascript
// window-FCzuzsyx.js — model dropdown:
modelOptions() {
  return (capabilities.models ?? [])
    .filter(m => m.mode === "image")   // filter image models
    .filter(m => !(isNonUltra && m.key === "lite_relaxed"))
    .map(m => ({ value: m.key, label: m.label }));
  // Output:
  // [
  //   { value: "NanoBanana",      label: "Gemini Image 3"      },
  //   { value: "NanoBanana2",     label: "NanoBanana pro"      },
  //   { value: "NanoBanana2Lite", label: "NanoBanana 2 lite"   },
  // ]
}

// User selects → stored as:
settings.model = "NanoBanana2Lite"   // displayKey stored in settings
```

### Step 2: prepare() — Upload References & Resolve ProjectId

```javascript
// adapter-BEikWMOV.js:38617 — prepare()
async prepare(e, t) {
  const rc = t.rc;

  // 1. Create/get project for compose mode (image doesn't auto-create)
  const projectId = await getOrCreateProject(t, e.mode);

  // 2. Upload any base64 reference images → get mediaIds
  for (const ref of e.references) {
    if (ref.startsWith("data:")) {
      // Upload to Flow, get mediaId back
      const mediaId = await mt(
        k(t),           // context with auth
        projectId,
        base64data,
        mimeType,
        filename,
        { tokenProvider: captchaProvider }
      );
      // mt() calls: e.cfg.rpcid("image_upload")  → "image_upload" RPC
    }
  }

  // 3. Resolve character entity references from prompt
  // e.g. "@Alice" → entityId lookup
  const entityIds = resolveCharacters(e.prompt, characters);
}
```

### Step 3: buildSubmit() — Determine RPC Config

```javascript
// adapter-BEikWMOV.js:42776 — buildSubmit() for image mode:
function buildSubmit(e, rc) {
  // e.modelKey = "NanoBanana2Lite"  (displayKey)
  
  // ① Resolve api_model from RC:
  const modelCfg    = rc.image_models?.models?.["NanoBanana2Lite"];
  const modelApiKey = modelCfg?.api_model ?? "NanoBanana2Lite";
  //                              ↑ e.g. "gemini_v4_img_lite_flow"
  //                              (exact value depends on server rc)

  // ② Resolve aspect code:
  const aspectEnum = rc.image_models?.aspect_ratios?.[e.aspectRatio];
  //    "16:9" → "IMAGE_ASPECT_RATIO_LANDSCAPE"

  // ③ Pack into __imageParams:
  return {
    url: "flow:image",
    method: "POST",
    __flowImage: true,
    __imageParams: {
      prompt:       e.prompt,
      aspectForCfg: aspectEnum ?? e.aspectRatio,  // "IMAGE_ASPECT_RATIO_LANDSCAPE"
      model:        modelApiKey,    // ← api_model: e.g. "gemini_v4_img_lite_flow"
      projectId,
      refIds:       e.references.filter(r => !r.startsWith("data:")),
      entityIds:    e.extra?.referenceEntityIds ?? [],
      structuredParts: e.extra?.structuredParts,
      seed:         e.extra?.seed,
      captchaToken: captchaToken,
    },
  };
}
```

### Step 4: submit() — Call the RPC

```javascript
// adapter-BEikWMOV.js:43556 — submit()
async submit(e, t) {
  if (e.__flowImage && e.__imageParams) {
    const o = e.__imageParams;

    // Call rn() = image generation caller
    const results = await rn(
      k(t),          // FlowContext (has auth tokens + cfg)
      o.prompt,      // text prompt
      1,             // count (numImages)
      o.aspectForCfg,// "IMAGE_ASPECT_RATIO_LANDSCAPE"
      o.model,       // modelApiKey: "gemini_v4_img_lite_flow"  ← HERE
      o.projectId,
      {
        recaptchaToken:     o.captchaToken,
        structuredParts:    o.structuredParts,
        refImgIds:          o.refIds,
        referenceEntityIds: o.entityIds,
        seed:               o.seed ?? null,
      }
    );
    // ...
  }
}
```

### Step 5: rn() — Build & Fire HTTP Request

```javascript
// adapter-BEikWMOV.js:22278 — rn()
async function rn(e, t, r, n, o, a, i = {}) {
  //              ctx  prompt cnt aspect  modelApiKey  projectId  opts
  
  // ① Resolve aspect to numeric code:
  const aspectCode = e.cfg.imageAspect(n);
  // e.cfg.imageAspect("IMAGE_ASPECT_RATIO_LANDSCAPE")
  // → looks up rc.flow_google.image_aspects["IMAGE_ASPECT_RATIO_LANDSCAPE"]
  // → returns numeric: 2

  // ② Build parts array:
  const parts = i.structuredParts?.length
    ? i.structuredParts
    : [{ text: t }];  // wrap plain text

  const batchId = crypto.randomUUID().toUpperCase();
  const results = [];

  for (let idx = 0; idx < Math.max(1, r); idx++) {
    // ③ Mint reCAPTCHA token:
    const captchaToken = await mintCaptcha(
      i.tokenProvider,
      i.recaptchaToken || "",
      e.cfg.action("image")  // → rc.flow_google.captcha_actions.image = "GENERATE_IMAGE"
    );

    // ④ Build payload with Sr():
    const payload = Sr(
      o,            // modelApiKey = "gemini_v4_img_lite_flow"
      captchaToken, // fresh token
      aspectCode,   // numeric: 2
      parts,        // structured parts
      {
        seed:                 i.seed ?? null,
        imageInputIds:        i.refImgIds ?? null,
        referenceEntityIds:   i.referenceEntityIds ?? null,
        batchId,
      }
    );

    // ⑤ Resolve RPC ID from rc:
    const rpcId = e.cfg.rpcid("image_generate");
    // → looks up rc.flow_google.rpcids["image_generate"]
    // → e.g. "YhhmEf"  (dynamic from server — same for ALL image models)

    // ⑥ Fire HTTP request via e.call():
    const raw = await e.call(rpcId, payload);
    // e.call() = batchexecute POST

    // ⑦ Parse response with Br():
    const parsed = Br(raw);
    if (parsed.url) results.push({ url: parsed.url, mediaId: parsed.mediaId });
  }

  return { results, batchId };
}
```

### Step 6: Sr() — Build the Actual Payload Array

```javascript
// adapter-BEikWMOV.js:17580 — Sr()
function Sr(e, t, r, n, o, a = {}) {
  // e = modelApiKey = "gemini_v4_img_lite_flow"
  // t = captchaToken
  // r = aspectCode = 2
  // n = structuredParts = [{ text: "prompt..." }]
  // o = (unused here, parts already passed as n)

  // Build recaptcha context (z function):
  const i = z(e, t);
  //           ↑ modelApiKey goes INTO captcha context too:
  // z(modelApiKey, captchaToken) → sparse array:
  //   [null, version=22, null, null, null, captchaToken, null,null,null,null, [modelApiKey, 1]]
  //                                                                            ↑ index 10

  const inner = {
    3: a.seed ?? randomSeed(),       // seed
    4: r,                            // aspectCode = 2
    5: e,                            // ← modelApiKey = "gemini_v4_img_lite_flow"
    7: i,                            // recaptcha context
    8: [[...n]],                     // structured parts
    12: G(),                         // UUID (batchItemId)
    13: G(),                         // UUID
  };

  // Add reference image IDs if present:
  if (a.imageInputIds?.length) {
    inner[2] = a.imageInputIds.map(id => y({ 0: id, 4: 1 }));
  }

  // Add entity IDs (character references) if present:
  if (a.referenceEntityIds?.length) {
    inner[10] = a.referenceEntityIds.map(id => y({ 0: id }));
  }

  // Return full payload:
  return [
    null,
    [y(inner)],      // [sparseArray(inner)]
    1,
    i,               // recaptcha context (also at top level)
    y({ 0: a.batchId || G() }),
  ];
}
```

### Step 7: e.call() — The HTTP batchexecute POST

```javascript
// adapter-BEikWMOV.js — call() / Mr() / Rr()
async function call(rpcId, payload) {
  // rpcId = "YhhmEf"  (resolved from rc.flow_google.rpcids["image_generate"])

  const url = cfg.batchexecuteUrl(authIndex);
  // → "https://flow.google.com/_/FlowUi/data/batchexecute?authuser=0"

  const fReq = JSON.stringify([[[
    rpcId,                    // "YhhmEf"
    JSON.stringify(payload),  // double-encoded payload string
    null,
    "generic"
  ]]]);

  const body = new URLSearchParams({
    "f.req": fReq,
    "at":    sessionTokens.at,   // SNlM0e — CSRF token
  });

  const response = await fetch(
    `${url}&rpcids=${rpcId}&source-path=${encodeURIComponent(cfg.sourcePath(authIndex))}&bl=${sessionTokens.bl}&f.sid=${sessionTokens.sid}&hl=en&_reqid=${reqId}&rt=c`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Same-Domain": "1",
      },
      body,
    }
  );

  return parseResponse(await response.text());
}
```

---

## §3. RPC Map — ทุก Operation ยิงไปที่ไหน

| Operation | RC Config Key | `rpcid()` result | โค้ดที่เรียก |
|-----------|--------------|-----------------|------------|
| **Image Generate (ทุก model)** | `image_generate` | e.g. `"YhhmEf"` | `rn()` → `Sr()` |
| **Image Upload (ref images)** | `image_upload` | e.g. `"Abcd12"` | `mt()` → `Tr()` |
| **Image Upscale 2K/4K** | `image_upscale` | e.g. `"Xyz789"` | `nn()` → `Cr()` |
| Video T2V | `video_text` | `ht["t2v"]` → rpc | `on()` |
| Video I2V | `video_start_image` | `ht["i2v"]` → rpc | `on()` |
| Video First+Last | `video_start_end_image` | `ht["first_last"]` → rpc | `on()` |
| Video Ingredients | `video_reference_images` | `ht["ingredients"]` → rpc | `on()` |
| Video Edit | `video_edit` | e.g. `"Edit11"` | `sn()` |
| Video Poll Status | `video_poll` | e.g. `"PollXX"` | `pt()` |
| Video Upscale | `video_upscale` | e.g. `"VUpsc1"` | `cn()` |
| Get Media URL | `get_media` | e.g. `"GtMed1"` | `Fe()` |
| Create Entity | `entity_create` | e.g. `"EntCr1"` | `ln()` |
| Get Credits | `get_credits` | e.g. `"Credit"` | — |
| Create Project | `project_create` | e.g. `"ProjCr"` | — |

> RPC ID values (e.g. `"YhhmEf"`) come 100% from `rc.flow_google.rpcids` — never hardcoded

---

## §4. Payload Diff: NanoBanana vs NanoBanana 2 lite

ทุกอย่างเหมือนกัน **ยกเว้น field[5]** และ context array `[10][0]`:

```javascript
// NanoBanana:
Sr("gemini_v4_img_flow", captcha, 2, parts, opts)
//    ↑ inner[5] = "gemini_v4_img_flow"
//    ↑ context[10][0] = "gemini_v4_img_flow"

// NanoBanana 2 lite:
Sr("gemini_v4_img_lite_flow", captcha, 2, parts, opts)
//    ↑ inner[5] = "gemini_v4_img_lite_flow"
//    ↑ context[10][0] = "gemini_v4_img_lite_flow"

// EVERYTHING ELSE IS IDENTICAL:
// - Same RPC endpoint (image_generate)
// - Same batchexecute URL
// - Same payload structure
// - Same response parser (Br)
// - Same auth headers
```

### Concrete Payload Example

```
// NanoBanana 2 lite payload (f.req body):
[[["YhhmEf", "[null,[[null,null,null,42,2,\"gemini_v4_img_lite_flow\",null,[ctx],[[\"your prompt\"]],null,null,\"UUID1\",\"UUID2\"]],1,[null,22,null,null,null,\"captchaToken\",null,null,null,null,[\"gemini_v4_img_lite_flow\",1]],[\"batchId\"]]", null, "generic"]]]

// field breakdown in inner sparse array:
// [3] = seed (42)
// [4] = aspectCode (2 = landscape)
// [5] = "gemini_v4_img_lite_flow"   ← MODEL API KEY
// [7] = recaptcha context (also contains model at [10][0])
// [8] = [[structured parts]]
// [12] = UUID (item id)
// [13] = UUID
```

---

## §5. rc.flow_google Complete Structure

This is the full config namespace that `_r` class reads from:

```javascript
// All fields accessed by _r class (adapter-BEikWMOV.js:12058-13606):
rc.flow_google = {
  // URLs
  origin:              "https://flow.google.com",
  app_name:            "FlowUi",
  bootstrap_path:      "/flow/{auth_index}",
  source_path:         "/flow/{auth_index}",
  batchexecute_path:   "/_/FlowUi/data/batchexecute?authuser={auth_index}",
  upload_video_path:   "/upload/video?project_id={project_id}",
  captcha_page_url:    "https://flow.google.com/flow/...",
  captcha_script_url:  "https://recaptcha.net/recaptcha/enterprise.js?render={site_key}",
  captcha_site_key:    "6Le...",   // reCAPTCHA Enterprise site key

  // reCAPTCHA action names (sent in recaptcha.execute() call)
  captcha_actions: {
    image:        "GENERATE_IMAGE",
    video:        "GENERATE_VIDEO",
    audio:        "GENERATE_AUDIO",
    upload_image: "UPLOAD_IMAGE",
  },

  // RPC IDs (dynamic short strings from server)
  rpcids: {
    image_generate:        "YhhmEf",  // ALL image models use this
    image_upload:          "...",     // upload reference image
    image_upscale:         "...",     // 2K/4K upscale
    video_text:            "...",     // t2v
    video_start_image:     "...",     // i2v
    video_start_end_image: "...",     // first+last
    video_reference_images:"...",     // ingredients/r2v
    video_poll:            "...",     // poll status
    video_edit:            "...",     // extend/edit video
    video_upscale:         "...",     // 1080p/4K upscale
    get_media:             "...",     // get video/image URL
    get_credits:           "...",     // check credit balance
    project_create:        "...",     // create project
    entity_create:         "...",     // create character
    entity_update:         "...",     // update character
    audio_generate:        "...",     // TTS
    media_set_visibility:  "...",     // set public/private
    workflow_set_name:     "...",     // rename workflow
  },

  // Numeric code maps (string enum → number for payload)
  image_aspects: {
    "IMAGE_ASPECT_RATIO_SQUARE":        1,
    "IMAGE_ASPECT_RATIO_LANDSCAPE":     2,
    "IMAGE_ASPECT_RATIO_PORTRAIT":      3,
    "IMAGE_ASPECT_RATIO_LANDSCAPE_4_3": 4,
    "IMAGE_ASPECT_RATIO_PORTRAIT_3_4":  5,
  },
  video_aspects: {
    "VIDEO_ASPECT_RATIO_LANDSCAPE": 1,
    "VIDEO_ASPECT_RATIO_PORTRAIT":  2,
  },
  image_upscale_levels: {
    "2K": 1,
    "4K": 2,
  },
  video_upscale_res: {
    "1080p": 1,
    "4K":    2,
  },
};
```

---

## §6. Complete End-to-End Code (Copy-Paste Ready)

```javascript
// Reproducing what extension does for ANY image model:
async function generateImage({ rc, auth, prompt, displayKey, aspectRatio, captchaToken, projectId, refMediaIds = [], seed = null }) {
  
  // ① Resolve api_model from rc (= "NanoBanana2Lite" → actual API string)
  const modelCfg    = rc.image_models?.models?.[displayKey];
  const modelApiKey = modelCfg?.api_model ?? displayKey;
  // e.g. "gemini_v4_img_lite_flow"

  // ② Resolve aspect string → enum → numeric code
  const aspectEnum = rc.image_models?.aspect_ratios?.[aspectRatio]
                  ?? `IMAGE_ASPECT_RATIO_${aspectRatio.toUpperCase()}`;
  const aspectCode = rc.flow_google.image_aspects[aspectEnum];
  // "16:9" → "IMAGE_ASPECT_RATIO_LANDSCAPE" → 2

  // ③ Build recaptcha context array z():
  const captchaCtx = buildCaptchaContext(captchaToken, modelApiKey);
  // sparse array: { 1: 22, 5: captchaToken, 10: [modelApiKey, 1] }

  // ④ Build inner item array Sr():
  const inner = sparseArray({
    3: seed ?? Math.floor(Math.random() * 2**32),
    4: aspectCode,           // 2
    5: modelApiKey,          // "gemini_v4_img_lite_flow"  ← KEY DIFF PER MODEL
    7: captchaCtx,
    8: [[{ text: prompt }]],
    12: crypto.randomUUID().toUpperCase(),
    13: crypto.randomUUID().toUpperCase(),
  });

  // Add ref image IDs if provided:
  if (refMediaIds.length) {
    inner[2] = refMediaIds.map(id => sparseArray({ 0: id, 4: 1 }));
  }

  const payload = [null, [inner], 1, captchaCtx, sparseArray({ 0: crypto.randomUUID().toUpperCase() })];

  // ⑤ Get RPC ID from rc (same for ALL image models):
  const rpcId = rc.flow_google.rpcids["image_generate"];
  // e.g. "YhhmEf"

  // ⑥ Build URL:
  const url = `https://flow.google.com/_/FlowUi/data/batchexecute?authuser=${auth.authIndex}`
            + `&rpcids=${rpcId}`
            + `&source-path=${encodeURIComponent(`/flow/${auth.authIndex}`)}`
            + `&bl=${auth.bl}`
            + `&f.sid=${auth.sid}`
            + `&hl=en`
            + `&_reqid=${String(Math.floor(Math.random() * 900000) + 100000)}`
            + `&rt=c`;

  // ⑦ Fire request:
  const body = new URLSearchParams({
    "f.req": JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]),
    "at":    auth.at,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Same-Domain": "1",
    },
    body: body.toString(),
  });

  // ⑧ Parse response:
  const text   = await response.text();
  const clean  = text.startsWith(")]}'") ? text.slice(4) : text;
  const rows   = parseWrbFr(clean); // find rows where row[0] === "wrb.fr"
  const data   = JSON.parse(rows[0][2]); // double-encoded response
  
  // Extract URL and mediaId from response:
  const imageUrl = data?.[0]?.[0];    // CDN image URL
  const mediaId  = data?.[0]?.[1];    // media ID for future use
  
  return { imageUrl, mediaId };
}

// Helper: build sparse array (y function from adapter)
function sparseArray(obj) {
  const keys = Object.keys(obj).map(Number);
  const max  = Math.max(...keys);
  const arr  = new Array(max + 1).fill(null);
  for (const k of keys) arr[k] = obj[k];
  return arr;
}

// Helper: build captcha context (z function from adapter)
function buildCaptchaContext(captchaToken, modelKey, version = 22) {
  const ctx = { 1: version };
  if (captchaToken) ctx[5] = captchaToken;
  if (modelKey)     ctx[10] = sparseArray({ 0: modelKey, 1: 1 });
  return sparseArray(ctx);
}
```

---

## §7. สรุปสั้น

```
User เลือก "NanoBanana 2 lite"
    ↓
Extension look up: rc.image_models.models["NanoBanana2Lite"].api_model
    ↓ (e.g. "gemini_v4_img_lite_flow")
Sr() ใส่ค่านั้นที่ payload[1][0][5] และ payload[3][10][0]
    ↓
rpcId = rc.flow_google.rpcids["image_generate"]  (same สำหรับทุก image model)
    ↓
POST flow.google.com/_/FlowUi/data/batchexecute?rpcids={rpcId}
    Body: f.req=[[["{rpcId}", "{serialized_payload}", null, "generic"]]]
    ↓
Response → Br() parser → CDN image URL + mediaId
```

**สรุปคำตอบชัด:** ทุก NanaBanana variant → **endpoint เดียวกัน, rpcid เดียวกัน** — ต่างกันแค่ `api_model` string ใน payload
