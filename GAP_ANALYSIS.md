# GAP_ANALYSIS.md — สิ่งที่ยังค้นพบ / ยังไม่ได้ Document

> Audit วันที่ 2026-09-22 — สแกนจาก `adapter-BEikWMOV.js` ทุกบรรทัด

---

## สรุปสั้น: ที่ยังขาด

| หมวด | ขาด | ความสำคัญ |
|------|-----|----------|
| **Video Upload (Resumable)** | `pn()` — อัปโหลดวิดีโอสำหรับ video edit | 🔴 Critical |
| **`rc.video` config** | `tool_name`, `model_upscale_key`, `model_upscale_4k_key` | 🔴 Critical |
| **`rc.video_edit` full** | `api_url_video_upload`, `api_url_edit`, `model_key`, `max_seconds`, `max_ref_images` | 🔴 Critical |
| **`rc.t2v_models`** | video model display label map (`displayKey → label`) | 🟠 Important |
| **Error Taxonomy** | `ge()` — all error codes with retry logic | 🟠 Important |
| **Watermark Removal** | `or()` — canvas pixel manipulation to strip Gemini watermark | 🟡 Notable |
| **PINHOLE** | Image tool name (hardcoded) vs video `rc.video.tool_name` | 🟡 Notable |
| **Response Parsers** | `Br`, `Me`, `Qr`, `Yr`, `Jr`, `$r`, `en`, `zr` — all complete | 🟠 Important |
| **Video Aspect Builder** | `Ct()` — how `videoAspectRatios` are built from rc | 🟡 Notable |
| **Character Entity System** | `En()` create/cache entity, `In()` fetch entity | 🟠 Important |
| **Voice Label Lookup** | `wn()` — voice ID → display label | 🟡 Minor |
| **Image Upscale Retry** | `bn()` — 5-retry wrapper for upscale | 🟡 Notable |
| **`rc.video_r2v_max_refs`** | per-model r2v ref limit | 🟡 Notable |
| **`rc.tier_limits`** | full structure (max_prompts, max_threads, allow_ref_modes) | 🟠 Important |
| **`rc.thread_limits`** | image/video threads per account | 🟡 Minor |
| **`rc.video_credit_guard`** | `min_credits` field | 🟡 Minor |
| **Project Auto-create** | `et()` vs `Re()` — compose vs normal project flow | 🟡 Notable |

---

## §1. 🔴 Video Upload — Resumable Upload Protocol

**พบในโค้ด:** `pn()` function — ใช้สำหรับ **video edit** (อัปโหลด source video)

```javascript
// adapter-BEikWMOV.js — pn()
async function pn(fetchFn, cfg, projectId, videoBytes, filename, mimeType = "video/mp4") {
  
  // ① GET upload URL — 2-step resumable upload (Google's X-Goog-Upload protocol)
  const uploadInitUrl = cfg.uploadVideoUrl(projectId);
  // → rc.flow_google.upload_video_path → "https://flow.google.com/upload/video?project_id={projectId}"

  // ② Step 1: Start resumable upload
  const initResponse = await fetchFn(uploadInitUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Slug":                              encodeURIComponent(filename),
      "X-Goog-Upload-Protocol":            "resumable",
      "X-Goog-Upload-Command":             "start",
      "X-Goog-Upload-Header-Content-Length": String(videoBytes.byteLength),
      "Content-Type":                      mimeType,
    },
    body: new Uint8Array(0),  // empty body on init
  });

  // ③ Get resumable upload URL from response header
  const resumeUrl = initResponse.headers.get("X-Goog-Upload-URL")
                 || initResponse.headers.get("x-goog-upload-url");
  if (!resumeUrl) throw new Error("no X-Goog-Upload-URL received");

  // ④ Step 2: Upload + finalize
  const uploadResponse = await fetchFn(resumeUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset":  "0",
    },
    body: videoBytes,  // actual video bytes
  });

  if (!uploadResponse.ok) throw new Error(`upload finalize error http ${uploadResponse.status}`);
  
  const result = await uploadResponse.json();
  // result contains mediaId of the uploaded video
  return { mediaId: result?.mediaId || "" };
}

// Supported video MIME types (vn map):
const SUPPORTED_VIDEO_TYPES = {
  mp4:  "video/mp4",
  mov:  "video/quicktime",
  webm: "video/webm",
  m4v:  "video/x-m4v",
  avi:  "video/x-msvideo",
  mkv:  "video/x-matroska",
};
```

**เมื่อไหร่ถึงเรียก `pn()`:**
```javascript
// An() — video file upload wrapper (for Omni Flash ref video)
async function An(e, t, filename, projectId) {
  const ext    = filename.split(".").pop().toLowerCase();
  const mime   = SUPPORTED_VIDEO_TYPES[ext] || "video/mp4";
  const cfg    = ve(e.rc);  // wrap rc in _r class
  return (await pn(e.fetch, cfg, projectId, videoBytes, filename, mime)).mediaId || "";
}
// Called when: user uploads a reference VIDEO for Omni Flash Compose
```

---

## §2. 🔴 rc.video + rc.video_edit — Complete Config

```javascript
// rc.video (for video upscale model keys):
rc.video = {
  tool_name:            "SOME_TOOL_NAME",  // sent in video payloads (Rt() function)
  model_upscale_key:    "veo_upscale_1080p",    // for 1080p video upscale
  model_upscale_4k_key: "veo_upscale_4k",       // for 4K video upscale (Ultra only)
};

// Usage in Rt() function:
function Rt(rc, mode) {
  if (mode === "video") {
    return rc.video?.tool_name ?? "";  // → goes into video payload
  }
  return "PINHOLE";  // ← HARDCODED for image! Always "PINHOLE"
}
// "PINHOLE" appears in image generate payload — it's a fixed string

// rc.video_edit (for edit/extend video feature):
rc.video_edit = {
  api_url_video_upload: "https://...",   // video upload endpoint (triggers pn())
  api_url_edit:         "...",           // edit RPC URL
  model_key:            "...",           // model for edit operations
  max_seconds:          30,             // max video duration for edit source
  max_ref_images:       4,              // max ref images during edit
};

// videoEditAvailable check (from capabilities()):
const videoEditAvailable = !!(
  rc.video_edit?.api_url_video_upload &&
  rc.video_edit?.api_url_edit &&
  rc.video_edit?.model_key
);
// Only true when ALL THREE are present in server rc
```

---

## §3. 🟠 rc.t2v_models — Video Model Label Map

```javascript
// t2v_models maps: modelApiKey → display label
// Used to show human-readable label in UI for video models
rc.t2v_models = {
  "veo_3_1_t2v_lite":             "Veo 3.1 Lite",
  "veo_3_1_t2v_lite_low_priority":"Veo 3.1 Lite (Free)",
  "veo_3_1_t2v":                  "Veo 3.1",
  "veo_3_t2v":                    "Veo 3",
  "veo_fast_t2v":                 "Veo Fast",
  "omni_flash_t2v":               "Omni Flash",
  // ...
};

rc.extra_t2v_models = {
  // Additional model labels injected later
  // Same format as t2v_models
};

// How capabilities() uses it (from source):
const mergedLabels = { ...rc.t2v_models, ...rc.extra_t2v_models };
const labelByApiKey = {};
for (const [label, apiKey] of Object.entries(mergedLabels)) {
  labelByApiKey[apiKey] = label;  // invert: apiKey → label
}

// Then for each model_mappings displayKey:
for (const displayKey of Object.keys(merged)) {
  capabilities.models.push({
    key:   displayKey,
    label: labelByApiKey[displayKey] || displayKey,  // fallback to displayKey
    mode:  "video",
  });
}
// → This is how video model labels appear in the UI dropdown
```

---

## §4. 🟠 Error Taxonomy — ge() Complete

```javascript
// adapter-BEikWMOV.js — ge() error classifier
function ge(httpCode, rawError, type = "image") {
  if (httpCode === 400) {
    const violation = classifyViolation(rawError);
    const isHardBlock = /INVALID_ARGUMENT|PROMINENT_PEOPLE|PUBLIC_ERROR_MINOR_UPLOAD|PUBLIC_ERROR_UNSAFE_GENERATION/.test(message);
    
    if (type === "image" && !violation && !isHardBlock) {
      return { retry: true,  code: "400", message: "Bad request",     afterMs: undefined };
    } else {
      return { retry: false, code: "400", message: "Blocked content", hint: violation || "err_prompt_violation" };
    }
  }
  if (httpCode === 401) return { retry: true,  code: "401", message: "Auth token rejected",  afterMs: 0,   hint: "err_token_not_found" };
  if (httpCode === 403) return { retry: true,  code: "403", message: "Forbidden",            afterMs: 30000, hint: "err_flow_403_hint" };
  if (httpCode === 429) return handle429(rawError, type);  // quota exhausted
  return                       { retry: true,  code: String(httpCode), message: `HTTP ${httpCode}` };
}

// 429 logic (ur()):
const THROTTLE_REASONS = ["THROTTLED", "TOO_MUCH_TRAFFIC"];    // → retry=true, afterMs=30s, hint: service_overloaded
const QUOTA_REASONS    = ["RESOURCE_EXHAUSTED", "PUBLIC_ERROR_PER_MODEL_LIMIT"];  // → retry=false, err_quota_exhausted
// Retry-After header also respected

// Violation types (dr() — maps error strings to i18n keys):
const VIOLATION_MAP = [
  { tokens: ["PROMINENT_PEOPLE"],             key: "err_prompt_violation"       },
  { tokens: ["UNSAFE_GENERATION"],            key: "err_prompt_violation"       },
  { tokens: ["MINOR", "CHILD"],               key: "err_prompt_violation_minor" },
  { tokens: ["SEXUAL"],                       key: "err_prompt_violation_sexual" },
];

// Video status codes:
const STATUS_DONE  = 3;   // → done=true,  error=false
const STATUS_ERROR = 4;   // → done=false, error=true, errorMessage from field

// fr() — generation failure (from video poll):
function fr(_, message) {
  return { retry: true, code: "unknown", message: message, afterMs: 5000 };
}

// Retry-able error codes (ar = auto-retry):
const AUTO_RETRY_REASONS = ["THROTTLED", "TOO_MUCH_TRAFFIC"];
```

---

## §5. 🟡 PINHOLE — Image Tool Name

```javascript
// Rt() function — determines tool_name for payloads
function Rt(rc, mode) {
  if (mode === "video") {
    return rc.video?.tool_name ?? "";  // from server
  }
  return "PINHOLE";  // ← HARDCODED for image!
}

// "PINHOLE" goes into... which video payload field?
// It appears as the internal tool identifier for image generation
// "PINHOLE" is the internal Google name for the Flow Image tool
```

---

## §6. 🟡 Gemini Watermark Removal — or() Algorithm

```javascript
// adapter-BEikWMOV.js — or() — detect & remove Gemini watermark from image
async function or(imageUrl) {
  try {
    const [imgElement, detector] = await Promise.all([
      loadImage(imageUrl),   // ot()
      loadDetector(),        // nr() — lazy-load watermark detector model
    ]);

    const { width, height } = imgElement;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // rr() — pixel-level watermark detection + removal
    const result = rr(imageData.data, width, height, detector);
    
    if (result.removed) {
      ctx.putImageData(imageData, 0, 0);    // put modified pixels back
      return canvas.toDataURL("image/jpeg", 0.98);  // return cleaned image
    }
    
    return imageUrl;  // no watermark found, return original
  } catch {
    return imageUrl;  // on error, return original
  }
}

// rr() uses Qt() and zt() — image processing functions:
// Qt() — grayscale conversion (luminance formula: 0.299R + 0.587G + 0.114B)
// zt() — edge/gradient detection (Sobel-like operator)
// We() — pixel painting/filling
// Yt() — confidence scoring for watermark region detection
```

---

## §7. 🟠 All Response Parsers — Complete Reference

```javascript
// Br() — Image Generate response parser
function Br(rawRpcResponse) {
  const item = rawRpcResponse[0][0];
  return {
    mediaId:    item[0],         // string — media ID
    workflowId: item[2],         // string — workflow ID
    width:      item[6][2][0],   // number — image width in pixels
    height:     item[6][2][1],   // number — image height in pixels
    url:        item[6][0][13],  // string — CDN URL of generated image
    seed:       item[6][0][1],   // number — seed used
  };
}

// Me() — Video Submit response parser (all video modes)
function Me(rawRpcResponse) {
  return {
    credits:     rawRpcResponse[1],              // number — credits consumed
    mediaIds:    rawRpcResponse[3].map(x => x[0]).filter(Boolean),   // string[]
    workflowIds: rawRpcResponse[2].map(x => x[0]).filter(Boolean),   // string[]
  };
}

// Qr() — Video Poll response parser
function Qr(rawRpcResponse) {
  return rawRpcResponse[2].map(item => ({
    mediaId:      item[0],          // string
    status:       item[5][8][0],    // number: 3=done, 4=error
    done:         item[5][8][0] === 3,
    error:        item[5][8][0] === 4,
    errorMessage: item[5][8][2]?.[0],  // string or null
    bytes:        item[5][13],      // number — file size in bytes
  }));
}

// Yr() — Get Media response parser (get video/image URL)
function Yr(rawRpcResponse) {
  return {
    workflowId: rawRpcResponse[2],          // string
    videoUrl:   rawRpcResponse[7][0][8],    // string — CDN video URL
    thumbUrl:   rawRpcResponse[5][10],      // string — thumbnail URL
    status:     rawRpcResponse[5][8][0],    // number — status code
    bytes:      rawRpcResponse[5][13],      // number — file size
  };
}

// Jr() — TTS Audio Generate response parser
function Jr(rawRpcResponse) {
  const item = rawRpcResponse[0][0];
  return {
    mediaId:    item[0],   // string — audio media ID
    workflowId: item[2],   // string — workflow ID
  };
}

// $r() — Image Upscale response parser
function $r(rawRpcResponse) {
  // Recursively searches response for base64 string (long base64 = image data)
  let base64 = "";
  function search(node) {
    if (typeof node === "string" && isLikelyBase64(node) && node.length > base64.length) {
      base64 = node;
    } else if (Array.isArray(node)) {
      for (const child of node) search(child);
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) search(v);
    }
  }
  search(rawRpcResponse);
  return base64 || null;  // base64 JPEG string, or null if not found
}
// isLikelyBase64() = string > 2000 chars AND first 200 chars are all base64 chars

// Wr() — Image Upload response parser
function Wr(rawRpcResponse) {
  return {
    mediaId:  rawRpcResponse[0][0],   // string
    entityId: rawRpcResponse[0][1],   // string (if uploaded as entity)
  };
}

// Xr() — Entity Create response parser
function Xr(rawRpcResponse) {
  return {
    entityId: rawRpcResponse[0][0],   // string
  };
}

// en() — Get Credits response parser
function en(rawRpcResponse) {
  const tierCode = rawRpcResponse[1];
  return {
    credits:  rawRpcResponse[0],   // number — remaining credits
    tierCode,                       // number: 0=UNSPECIFIED, 1=PRO, 2=ULTRA, 3=FREE,
                                   //         4=UNSUBSCRIBED_WITH_CREDITS, 5=ZERO,
                                   //         6=EXEMPT, 7=GEMNOVA, 8=ULTRA1P5
    tier:    TIER_MAP[tierCode] ?? "Unknown",  // string tier name
  };
}

// zr() — Project Create response parser
function zr(rawRpcResponse) {
  return rawRpcResponse[0];  // string — project ID
}
```

---

## §8. 🟠 rc.tier_limits — Access Control Structure

```javascript
// Controls what features are available per tier
rc.tier_limits = {
  max_prompts:     10,      // max prompts per run
  max_threads:     4,       // max concurrent threads
  allow_ref_modes: ["keyword", "exact"],  // reference matching modes allowed

  // Per-feature tier gates:
  image_upscale_tiers:   ["PRO", "ULTRA", "ULTRA1P5"],
  video_upscale_tiers:   ["PRO", "ULTRA", "ULTRA1P5"],
  video_4k_tiers:        ["ULTRA", "ULTRA1P5"],
  video_compose_tiers:   ["PRO", "ULTRA", "ULTRA1P5"],  // Compose tab
};

// Usage in UI (window-FCzuzsyx.js):
// .filter(model => tier_limits allows this model/feature)
```

---

## §9. 🟠 Character Entity System — Complete

```javascript
// Entity creation (ln() in adapter):
async function ln(ctx, projectId, displayName = "Untitled character") {
  const payload = Nr(projectId, displayName);
  // Nr() builds: [sparseArray({ 0: projectId, 3: sparseArray({ 0: 1, 1: displayName, 2: [] }) })]
  
  const response = await ctx.call(ctx.cfg.rpcid("entity_create"), payload);
  return Xr(response).entityId || "";
}

// Entity update — add voice audio (dn() in adapter):
async function dn(ctx, entityId, workflowId, audioData) {
  // Or() builds voice update payload:
  // [sparseArray({ 0: entityId, 1: workflowId, 3: sparseArray({ 0: 1, 2: sparseArray({ 1: [[null, audioData]] }) }) }),
  //  [["entity_info.character_info.audio_references"]]]
  await ctx.call(ctx.cfg.rpcid("entity_update"), Or(entityId, workflowId, audioData));
  return true;
}

// Entity caching (In(), En(), yn()):
async function In(ctx, projectId, charSpec) {
  const cacheKey = charSpec.id ? `id:${charSpec.id}` : `name:${charSpec.name.toLowerCase()}`;
  const cached = entityCache.get(cacheKey);
  if (cached) return cached;
  return dedupeAsync(entityDedupeMap, cacheKey, () => En(ctx, projectId, charSpec, cacheKey));
}

async function En(ctx, projectId, charSpec, cacheKey) {
  // 1. Check chrome.storage for saved entity
  const saved = await getStoredEntity(charSpec);
  if (saved?.entityId) {
    entityCache.set(cacheKey, saved.entityId);
    return saved.entityId;
  }

  // 2. Upload character image
  if (!charSpec.imageUrl?.startsWith("http")) return "";
  const imageB64 = await fetchImageAsBase64(charSpec.imageUrl);
  const { mediaId } = await mt(ctx, projectId, imageB64, "image/jpeg", "char.jpg");

  // 3. Create entity
  const entityId = await ln(ctx, projectId, charSpec.name);

  // 4. Cache and return
  entityCache.set(cacheKey, entityId);
  return entityId;
}
```

---

## §10. 🟡 Other Undocumented Operations

### media_set_visibility — Set Public/Private (un())
```javascript
// Lr() payload: [sparseArray({ 0: mediaId, 5: sparseArray({ 9: visibility }) }), [["media.media_metadata.visibility"]]]
// visibility: 1 = public, 0 = private (default)
async function un(ctx, mediaId, visibility = 1) {
  await ctx.call(ctx.cfg.rpcid("media_set_visibility"), Lr(mediaId, visibility));
  return true;
}
```

### workflow_set_name — Rename Workflow (fn())
```javascript
// Dr() payload: [sparseArray({ 0: workflowId, 3: sparseArray({ 0: newName }), 4: projectId }), [["metadata.display_name"]]]
async function fn(ctx, projectId, workflowId, newName) {
  await ctx.call(ctx.cfg.rpcid("workflow_set_name"), Dr(projectId, workflowId, newName));
  return true;
}
```

### Image Upscale Retry — bn()
```javascript
// bn() = 5-attempt retry wrapper around nn() (image upscale)
async function bn(ctx, mediaId, resolution) {
  const MAX_RETRIES = 5;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const result = await nn(k(ctx), mediaId, resolution);
      if (result) return result;   // base64 JPEG string
    } catch (err) {
      if (J(err) === 429) return "";  // quota — give up
      if (J(err) === 401) { /* re-auth */ }
    }
  }
  return "";
}
```

### Voice Label (wn())
```javascript
// Ot = voice list from voices-DvmVY6zd.js (the G array of 30 voices)
function wn(voiceId) {
  return Ot.find(v => v.id === voiceId)?.label;
  // "aoede" → "Aoede"
}
```

### TTS Payload (xr()) — Audio Generate
```javascript
// xr(captchaCtx, captchaToken, projectId, text, voiceName, opts)
function xr(captchaCtx, captchaToken, projectId, text, voiceName, opts = {}) {
  const model       = opts.model       || "gemini_v4s_tts_flow";   // default TTS model
  const performance = opts.performance || "";                        // e.g. "EXPRESSIVE"
  
  return [
    [y({ 0: projectId, 1: y({ 0: y({ 0: text, 1: voiceName }) }), 2: model, 3: performance, 4: 2 })],
    z(captchaCtx, captchaToken),  // recaptcha context
  ];
}
// Note: TTS payload does NOT use inner[5] for model — model is at inner[2]
// This is different from image/video payloads!
```

---

## §11. Complete rc Structure — Everything Found

```javascript
// COMPLETE rc object structure (all fields referenced in extension code):
const rc = {

  // ─── Flow Google Core Config ───────────────────────────────
  flow_google: {
    origin:              "https://flow.google.com",
    app_name:            "FlowUi",
    bootstrap_path:      "/flow/{auth_index}",
    source_path:         "/flow/{auth_index}",
    batchexecute_path:   "/_/FlowUi/data/batchexecute?authuser={auth_index}",
    upload_video_path:   "/upload/video?project_id={project_id}",
    captcha_page_url:    "https://...",
    captcha_script_url:  "https://recaptcha.net/recaptcha/enterprise.js?render={site_key}",
    captcha_site_key:    "6Le...",
    captcha_actions: {
      image:        "GENERATE_IMAGE",
      video:        "GENERATE_VIDEO",
      audio:        "GENERATE_AUDIO",
      upload_image: "UPLOAD_IMAGE",
    },
    rpcids: {
      image_generate:         "...",
      image_upload:           "...",
      image_upscale:          "...",
      video_text:             "...",    // t2v
      video_start_image:      "...",    // i2v
      video_start_end_image:  "...",    // first+last
      video_reference_images: "...",    // ingredients/r2v
      video_poll:             "...",
      video_edit:             "...",
      video_upscale:          "...",
      get_media:              "...",
      get_credits:            "...",
      project_create:         "...",
      entity_create:          "...",
      entity_update:          "...",
      audio_generate:         "...",
      media_set_visibility:   "...",
      workflow_set_name:      "...",
    },
    image_aspects: {
      IMAGE_ASPECT_RATIO_SQUARE:        1,
      IMAGE_ASPECT_RATIO_LANDSCAPE:     2,
      IMAGE_ASPECT_RATIO_PORTRAIT:      3,
      IMAGE_ASPECT_RATIO_LANDSCAPE_4_3: 4,
      IMAGE_ASPECT_RATIO_PORTRAIT_3_4:  5,
    },
    video_aspects: {
      VIDEO_ASPECT_RATIO_LANDSCAPE: 1,
      VIDEO_ASPECT_RATIO_PORTRAIT:  2,
    },
    image_upscale_levels: { "2K": 1, "4K": 2 },
    video_upscale_res:    { "1080p": 1, "4K": 2 },
  },

  // ─── Image Models ──────────────────────────────────────────
  image_models: {
    models: {
      "NanoBanana": {
        label: "Gemini Image 3", api_model: "gemini_v4_img_flow",
        enabled: true, order: 1, max_refs: 4, supports_upscale: true,
      },
      "NanoBanana2": {
        label: "NanoBanana pro", api_model: "???",
        enabled: true, order: 2, max_refs: 10, supports_upscale: true,
      },
      "NanoBanana2Lite": {
        label: "NanoBanana 2 lite", api_model: "???",
        enabled: true, order: 3, max_refs: 2, supports_upscale: false,
      },
    },
    flow_models:          ["NanoBanana", "NanoBanana2", "NanoBanana2Lite"],
    aspect_ratios:        { "1:1": "IMAGE_ASPECT_RATIO_SQUARE", "16:9": "IMAGE_ASPECT_RATIO_LANDSCAPE", ... },
    model_aspect_ratios:  { "NanoBanana": ["1:1","16:9","9:16","4:3","3:4"], ... },
    aspect_ratio_labels:  { "1:1": "Square", ... },
  },

  // ─── Video Models (display label map) ──────────────────────
  t2v_models: {
    // modelApiKey → display label  (used for video model dropdown)
    "veo_3_1_t2v_lite":             "Veo 3.1 Lite",
    "veo_3_1_t2v_lite_low_priority":"Veo 3.1 Lite (Free)",
    // ...
  },
  extra_t2v_models: { /* same format, injected later */ },

  // ─── Video Model Mappings (key → apiKey lookup) ─────────────
  model_mappings: {
    "omni_flash": { t2v: { landscape: { FREE: "omni_flash_t2v", ... }, portrait: {...} }, i2v: {...}, i2v_end: {...}, r2v: {...} },
    "veo3lite":   { t2v: {...}, i2v: {...}, i2v_end: {...}, r2v: {...} },
    "veo3":       { t2v: {...}, i2v: {...}, i2v_end: {...}, r2v: {...} },
    "fast":       { t2v: {...}, i2v: {...} },
    "quality":    { t2v: {...}, i2v: {...}, i2v_end: {...} },
  },
  extra_model_mappings: { /* same format */ },

  // ─── Video Duration ─────────────────────────────────────────
  video_duration: {
    options_seconds:     [5, 8, 10],
    default_seconds:     8,
    ultra_only_seconds:  [10],
    ultra_exempt_models: [],
    model_keys: {        // duration → displayKey → mode → modelApiKey
      "10": { "veo3": { "t2v": "veo_3_t2v_10s" } },
    },
  },

  // ─── Video Upscale Models ────────────────────────────────────
  video: {
    tool_name:            "SOME_VIDEO_TOOL",  // sent in video payload wrapper
    model_upscale_key:    "veo_upscale_1080p",
    model_upscale_4k_key: "veo_upscale_4k",
  },

  // ─── Video Edit ─────────────────────────────────────────────
  video_edit: {
    api_url_video_upload: "https://flow.google.com/...",  // triggers resumable upload
    api_url_edit:         "...",
    model_key:            "...",    // model for video edit operation
    max_seconds:          30,      // max source video duration
    max_ref_images:       4,       // max ref images during edit
  },

  // ─── R2V Ref Limit ──────────────────────────────────────────
  video_r2v_max_refs: {
    default:  4,        // default max refs for r2v
    by_model: {
      "omni_flash_r2v": 7,   // Omni Flash allows more
      // ...
    },
  },

  // ─── Credit Guard ───────────────────────────────────────────
  video_credit_guard: {
    min_credits: 10,   // minimum credits needed to generate video
  },

  // ─── Tier & Thread Limits ───────────────────────────────────
  tier_limits: {
    max_prompts:         10,
    max_threads:         4,
    allow_ref_modes:     ["keyword", "exact"],
  },
  thread_limits: {
    image_threads_per_account: 4,
    video_threads_per_account: 2,
  },
};
```

---

## §12. What We DON'T Know (Truly Unknown)

| Unknown | Why |
|---------|-----|
| Actual `api_model` strings for NanaBanana2 and NanaBanana2Lite | Not hardcoded — need to intercept `/check_license` response |
| Actual `rpcids` values (real short strings like `"YhhmEf"`) | Dynamic per session |
| Actual `captcha_site_key` | Not in extension code |
| `rc.video.tool_name` actual value | Dynamic from server |
| `rc.video_edit.model_key` actual value | Dynamic from server |
| `rc.t2v_models` complete mapping | Dynamic from server |
| Image upscale request payload (internal structure) | `Cr()` function — only summary documented |
| Watermark detection algorithm exact math | `rr()`, `Qt()`, `zt()`, `Yt()` — complex image processing |
| Bootstrap URL content | Not loaded in extension — goes to browser |
| `captcha_page_url` when used | Edge case — only when reCAPTCHA unavailable in CS |

---

## §13. เส้นทางหาค่าจริง

```
1. เปิด Chrome → flow.google.com → login
2. DevTools → Application → Extension → G-Labs Flow → Storage
3. ดู af_session key → decrypt XOR ด้วย installId (จาก storage)
   หรือ
4. DevTools → Network → filter: glab.duckmartians.info
5. POST /check_license → Response JSON
6. ดู rc_enc field → decrypt AES-GCM ด้วย session.token
7. ผลลัพธ์ = rc object ทั้งหมดพร้อมค่าจริงทุกอย่าง
```
