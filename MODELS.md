# MODELS.md — AI Models, Voices & Parameters

> Complete catalog of all AI models, voice IDs, aspect ratios, and generation parameters
> supported by `flow.google.com`.

---

## §0. Critical Concept: displayKey vs modelApiKey

> ⚠️ **This is the most important thing to understand.**

| Term | What it is | Example |
|------|-----------|---------|
| `displayKey` | **UI label key** — stored in extension settings, used to *look up* the real key | `"omni_flash"`, `"veo3lite"`, `"fast"` |
| `modelApiKey` | **Actual API string** — sent inside the batchexecute payload | `"veo_3_1_t2v_lite"`, `"omni_flash_t2v"` |

The lookup chain:
```
rc.model_mappings[displayKey][videoMode][orientation][tier]  →  modelApiKey
```

**`displayKey` is NEVER sent to the API directly.** It is only used to look up the real `modelApiKey`.

---

## §1. How `modelApiKey` Works

`modelApiKey` is the **actual API string sent in the payload** — NOT the display name shown in UI.

It is resolved from the server config (`rc`) through this lookup chain:

```
rc.model_mappings[displayKey][videoMode][orientation][tier]  →  modelApiKey string
```

**Parameters:**
| Param | Description | Examples |
|-------|-------------|---------|
| `displayKey` | UI model group name | `"omni_flash"`, `"veo3"`, `"veo3lite"`, `"fast"`, `"quality"` |
| `videoMode` | API call mode | `"t2v"`, `"i2v"`, `"i2v_end"`, `"r2v"` |
| `orientation` | Video orientation | `"landscape"`, `"portrait"` |
| `tier` | User subscription tier | `"FREE"`, `"PRO"`, `"ULTRA"`, `"ULTRA1P5"`, `"GEMNOVA"` |

### Model Resolution Function (from `voices-DvmVY6zd.js`)
```javascript
// F(rc, displayKey, videoMode, orientation, tier, duration)
function selectModelApiKey(rc, displayKey, videoMode, orientation, tier, duration) {
  const merged = { ...rc.model_mappings, ...rc.extra_model_mappings };
  const defaultDuration = rc.video_duration?.default_seconds ?? 0;

  // Priority 1: duration-specific model key override
  if (duration && duration !== defaultDuration) {
    const byDur = rc.video_duration?.model_keys?.[String(duration)];
    const specific = byDur?.[displayKey]?.[videoMode];
    if (specific) return specific;
  }

  // Priority 2: standard mapping
  const base = merged?.[displayKey]?.[videoMode]?.[orientation]?.[tier] ?? '';
  if (!base) return '';

  // Priority 3: Ultra Fast model gets '_ultra' suffix appended automatically
  if (displayKey === 'fast' && (tier === 'ULTRA' || tier === 'ULTRA1P5')) {
    if (base.includes('_ultra')) return base;
    return base.endsWith('_fl')
      ? `${base.slice(0, -3)}_ultra_fl`
      : `${base}_ultra`;
  }

  return base;
}
```

---

## §2. Video Model Display Keys (settings.model)

These are the keys stored in the extension's settings. They appear in `capabilities.models[].key`.

| `displayKey` | UI Label | Description |
|-------------|---------|-------------|
| `"omni_flash"` | **Omni Flash** | Google's Gemini Flash-based video model — supports **3 chars + 4 ref images** in Compose |
| `"veo3lite"` or `"lite_relaxed"` | **Veo 3.1 Lite** | Standard Veo 3.1 (fast, fewer credits) — `lite_relaxed` hidden from PRO users |
| `"veo3"` | **Veo 3** | Veo 3.0 standard |
| `"fast"` | **Veo Fast** | Fast generation; Ultra tier auto-gets `_ultra` suffix |
| `"quality"` | **Veo Quality** | High-quality model — does NOT support Compose tab |
| (more from rc) | varies | Additional keys in `extra_model_mappings` from server |

---

## §3. Omni Flash — Complete Guide

### What is Omni Flash?
`displayKey = "omni_flash"` is the **Gemini Flash-based video model** on flow.google.com — distinct from the Veo family. It supports significantly more characters and reference images than Veo in Compose mode.

### Compose Mode Capacity (from source code)
```
Model                      Characters    Ref Images    Total
─────────────────────────────────────────────────────────────
Veo (all veo* models)         1             2             3
Omni Flash                    3             4             7
Omni Flash + ref video        3 chars       1 video       6
                              + 2 images
Veo Quality                   ✗  (does not support Compose tab)
```

### Character Cap Code
```javascript
// From window-FCzuzsyx.js:
veoCharCap() {
  return this.settings.model === "omni_flash" ? 3 : 1;
  //         ↑ displayKey in settings              ↑
  // Omni Flash = 3 chars per prompt, all Veo = 1 char
}
```

### Ref Video Support
```javascript
// Omni Flash is the ONLY model that supports a video as reference input:
veoRefVideoEnabled() {
  return (
    mode === "video" &&
    veoMode === "compose" &&
    settings.model === "omni_flash" &&   // ← must be omni_flash
    capabilities.videoEditAvailable       // ← server must enable it
  );
}
```

### modelApiKey for Omni Flash
The actual API key strings are **server-defined** in `rc.model_mappings["omni_flash"]`.

```javascript
// Structure (values come from server rc config):
rc.model_mappings["omni_flash"] = {
  t2v:     {
    landscape: { FREE: "omni_flash_t2v",      ULTRA: "omni_flash_t2v_ultra"     },
    portrait:  { FREE: "omni_flash_t2v",      ULTRA: "omni_flash_t2v_ultra"     },
  },
  i2v:     {
    landscape: { FREE: "omni_flash_i2v",      ULTRA: "omni_flash_i2v_ultra"     },
    portrait:  { FREE: "omni_flash_i2v",      ULTRA: "omni_flash_i2v_ultra"     },
  },
  i2v_end: {
    landscape: { FREE: "omni_flash_i2v_end",  ULTRA: "omni_flash_i2v_end_ultra" },
    portrait:  { FREE: "omni_flash_i2v_end",  ULTRA: "omni_flash_i2v_end_ultra" },
  },
  r2v:     {
    landscape: { FREE: "omni_flash_r2v",      ULTRA: "omni_flash_r2v_ultra"     },
    portrait:  { FREE: "omni_flash_r2v",      ULTRA: "omni_flash_r2v_ultra"     },
  },
};
// ↑ Exact string values vary — read from network traffic or decrypted rc config
```

> **To get the real values:** intercept the `POST /check_license` response from `glab.duckmartians.info`.  
> The decrypted `rc_enc` field (AES-GCM, key = session token) contains `model_mappings`.

### Helper — Resolve Omni Flash modelApiKey
```javascript
function getOmniFlashKey(rc, videoMode, orientation, tier) {
  const merged = { ...rc.model_mappings, ...rc.extra_model_mappings };
  return merged?.["omni_flash"]?.[videoMode]?.[orientation]?.[tier] ?? "";
}

// Example:
const modelApiKey = getOmniFlashKey(rc, "t2v", "landscape", "FREE");
// → e.g. "omni_flash_t2v"
```

### generateVideo — Omni Flash Examples

```javascript
// ─── T2V ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  getOmniFlashKey(rc, "t2v", "landscape", userTier),
  prompt:       "Three friends walking in a sunny park",
  aspect:       "landscape",
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── I2V ───
await sdk.generateVideo({
  mode:         "i2v",
  modelApiKey:  getOmniFlashKey(rc, "i2v", "portrait", userTier),
  prompt:       "The character turns and waves at the camera",
  aspect:       "portrait",
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: START_FRAME_MEDIA_ID,
});

// ─── First + Last ───
await sdk.generateVideo({
  mode:         "first_last",
  modelApiKey:  getOmniFlashKey(rc, "i2v_end", "landscape", userTier),
  prompt:       "Smooth transition between the two scenes",
  aspect:       "landscape",
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: FIRST_FRAME_ID,
  endMediaId:   LAST_FRAME_ID,
});

// ─── Ingredients (3 chars + 4 ref images — OMNI FLASH SPECIALTY) ───
await sdk.generateVideo({
  mode:        "ingredients",
  modelApiKey: getOmniFlashKey(rc, "r2v", "landscape", userTier),
  prompt:      "@Alice @Bob and @Charlie having a picnic with scenic background",
  aspect:      "landscape",
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  entityIds:   [ALICE_ID, BOB_ID, CHARLIE_ID],          // up to 3 characters
  refMediaIds: [BG1_ID, BG2_ID, FOOD_ID, TABLE_ID],     // up to 4 ref images
});
```

---

## §4. All Video Models — Quick Reference

### T2V — Text to Video

```javascript
// ─── Omni Flash T2V ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  getOmniFlashKey(rc, "t2v", "landscape", "FREE"), // "omni_flash_t2v"
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
});

// ─── Veo 3.1 Lite (standard) ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  rc.model_mappings?.["veo3lite"]?.t2v?.landscape?.FREE, // "veo_3_1_t2v_lite"
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
});

// ─── Veo 3.1 Lite — 0 credits ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  "veo_3_1_t2v_lite_low_priority",   // hardcoded — always free
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
});

// ─── Veo 3.1 Full ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  rc.model_mappings?.["veo3"]?.t2v?.landscape?.FREE,   // "veo_3_1_t2v"
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
  seed:         42,
});

// ─── Veo Fast ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  rc.model_mappings?.["fast"]?.t2v?.landscape?.FREE,   // "veo_fast_t2v"
  // Ultra tier → auto becomes "veo_fast_t2v_ultra" by server logic
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
});

// ─── Portrait ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  rc.model_mappings?.["veo3lite"]?.t2v?.portrait?.FREE,
  prompt:       "...",
  aspect:       "portrait", projectId, captchaToken,
});

// ─── With no audio ───
await sdk.generateVideo({
  mode:         "t2v",
  modelApiKey:  rc.model_mappings?.["veo3lite"]?.t2v?.landscape?.FREE,
  prompt:       "...",
  aspect:       "landscape", projectId, captchaToken,
  audioPref:    0,   // 1 = with audio (default), 0 = silent
});
```

### I2V — Image to Video

```javascript
// ─── Omni Flash I2V ───
await sdk.generateVideo({
  mode:         "i2v",
  modelApiKey:  getOmniFlashKey(rc, "i2v", "landscape", "FREE"), // "omni_flash_i2v"
  prompt:       "The character slowly walks forward",
  aspect:       "landscape", projectId, captchaToken,
  startMediaId: IMAGE_MEDIA_ID,   // REQUIRED
});

// ─── Veo 3.1 I2V ───
await sdk.generateVideo({
  mode:         "i2v",
  modelApiKey:  rc.model_mappings?.["veo3lite"]?.i2v?.landscape?.FREE, // "veo_3_1_i2v"
  prompt:       "Camera pans right revealing the cityscape",
  aspect:       "landscape", projectId, captchaToken,
  startMediaId: IMAGE_MEDIA_ID,
});
```

### First + Last Frame

```javascript
// ─── Omni Flash First+Last ───
await sdk.generateVideo({
  mode:         "first_last",
  modelApiKey:  getOmniFlashKey(rc, "i2v_end", "landscape", "FREE"), // "omni_flash_i2v_end"
  prompt:       "Natural transition between the two scenes",
  aspect:       "landscape", projectId, captchaToken,
  startMediaId: FIRST_FRAME_ID,  // REQUIRED
  endMediaId:   LAST_FRAME_ID,   // REQUIRED
});

// ─── Veo 3.1 First+Last ───
await sdk.generateVideo({
  mode:         "first_last",
  modelApiKey:  rc.model_mappings?.["veo3lite"]?.i2v_end?.landscape?.FREE, // "veo_3_1_i2v_end"
  prompt:       "The flower blooms",
  aspect:       "portrait", projectId, captchaToken,
  startMediaId: CLOSED_FLOWER_ID,
  endMediaId:   OPEN_FLOWER_ID,
});
```

### Ingredients — Reference to Video

```javascript
// ─── Omni Flash R2V (3 chars + 4 refs) ───
await sdk.generateVideo({
  mode:        "ingredients",
  modelApiKey: getOmniFlashKey(rc, "r2v", "landscape", "FREE"), // "omni_flash_r2v"
  prompt:      "@Alice @Bob @Charlie at a cafe",
  aspect:      "landscape", projectId, captchaToken,
  entityIds:   [ALICE_ID, BOB_ID, CHARLIE_ID],    // up to 3 chars
  refMediaIds: [CAFE_BG_ID, TABLE_ID],             // up to 4 images total
});

// ─── Veo 3.1 R2V (1 char + 2 refs) ───
await sdk.generateVideo({
  mode:        "ingredients",
  modelApiKey: rc.model_mappings?.["veo3lite"]?.r2v?.landscape?.FREE, // "veo_3_1_r2v"
  prompt:      "@Alice in the magical forest",
  aspect:      "landscape", projectId, captchaToken,
  entityIds:   [ALICE_ID],               // 1 character max for Veo
  refMediaIds: [FOREST_BG_ID],           // 2 images max for Veo
});
```

### Edit / Extend Video

```javascript
// Edit model key comes from rc.video_edit.model_key:
const editKey = rc.video_edit?.model_key ?? "";

await sdk.editVideo({
  sourceMediaId: EXISTING_VIDEO_MEDIA_ID,
  modelApiKey:   editKey,
  prompt:        "Continue the action — character keeps walking",
  aspect:        "landscape", projectId, captchaToken,
});
```

---

## §5. Image Models — Complete Guide

### How Image Model Selection Works

```javascript
// From adapter-BEikWMOV.js — buildSubmit() for image mode:
const modelCfg    = rc.image_models?.models?.[displayKey];
const modelApiKey = modelCfg?.api_model ?? displayKey;
//                              ↑ THIS is what gets sent in payload field[5]
```

### rc.image_models Structure
```javascript
rc.image_models = {
  models: {
    "NanoBanana": {
      label:            "Gemini Image 3",   // shown in UI
      api_model:        "gemini_v4_img_flow", // ← actual modelApiKey
      enabled:          true,
      order:            1,                  // sort position in dropdown
      max_refs:         4,                  // max reference images
      supports_upscale: true,               // 2K/4K upscale available
    },
    // ... other models from server
  },
  flow_models:          ["NanoBanana"],     // keys of isFlow models
  aspect_ratios:        { "1:1": "IMAGE_ASPECT_RATIO_SQUARE", ... },
  model_aspect_ratios:  { "NanoBanana": ["1:1","16:9","9:16","4:3","3:4"] },
  aspect_ratio_labels:  { "1:1": "Square", ... },
};
```

### Known Image Models

| `displayKey` | `api_model` (→ sent in payload) | UI Label | Max Refs | Upscale | isFlow |
|-------------|--------------------------------|----------|---------|---------|--------|
| `NanoBanana` | `gemini_v4_img_flow` | **Gemini Image 3** | 4 | ✓ | ✓ |
| (from server) | (from `api_model` field) | varies | varies | varies | varies |

> The **total number of image models** is dynamic — it depends on what `rc.image_models.models` contains for your account. As of v10.8.50, `NanoBanana` (`Gemini Image 3`) is the primary known Flow image model.

### Get All Available Image Models
```javascript
function getAvailableImageModels(rc) {
  const models    = rc.image_models?.models ?? {};
  const flowSet   = new Set(rc.image_models?.flow_models ?? []);
  const aspectMap = rc.image_models?.model_aspect_ratios ?? {};

  return Object.entries(models)
    .filter(([, cfg]) => cfg.enabled !== false)
    .sort(([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999))
    .map(([key, cfg]) => ({
      displayKey:      key,
      label:           cfg.label || cfg.name || key,
      modelApiKey:     cfg.api_model,          // ← send this to API
      maxRefs:         cfg.max_refs ?? 0,
      supportsUpscale: cfg.supports_upscale ?? false,
      isFlow:          flowSet.has(key),
      aspectRatios:    aspectMap[key] ?? [],
    }));
}

// Example output:
// [{ displayKey: "NanoBanana", label: "Gemini Image 3",
//    modelApiKey: "gemini_v4_img_flow", maxRefs: 4,
//    supportsUpscale: true, isFlow: true, aspectRatios: ["1:1","16:9",...] }]
```

### Image Model Usage Examples

```javascript
// ─── Generate with Gemini Image 3 (NanoBanana) ───
await sdk.generateImage({
  prompt:      "A detailed portrait of a cat, studio lighting",
  modelApiKey: "gemini_v4_img_flow",   // api_model from NanoBanana
  aspect:      "1:1",
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,         // action: 'GENERATE_IMAGE'
});

// ─── Generate with auto-resolved modelApiKey ───
const models   = getAvailableImageModels(rc);
const primary  = models[0];            // first model by order
await sdk.generateImage({
  prompt:      "A mountain landscape at sunset",
  modelApiKey: primary.modelApiKey,   // auto-resolved
  aspect:      "16:9",
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── With reference images ───
await sdk.generateImage({
  prompt:      "In the same art style as the reference",
  modelApiKey: "gemini_v4_img_flow",
  aspect:      "9:16",
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  refMediaIds: [REF_MEDIA_ID_1, REF_MEDIA_ID_2],  // up to max_refs (4)
});

// ─── With character entity ───
await sdk.generateImage({
  prompt:      "@Alice standing in a garden, professional portrait",
  modelApiKey: "gemini_v4_img_flow",
  aspect:      "3:4",
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  entityIds:   [ALICE_ENTITY_ID],
});

// ─── Image Upscale (only for isFlow models like NanoBanana) ───
const base64Jpg = await sdk.upscaleImage({
  mediaId:      GENERATED_IMAGE_MEDIA_ID,   // must be Flow-generated
  resolution:   "2K",                       // "2K" or "4K"
  captchaToken: CAPTCHA_TOKEN,
});
// → base64 JPEG string
```

---

## §6. Video Model Resolution Function (Full)

```javascript
// Complete helper — resolves modelApiKey from rc for any video scenario:
function resolveVideoModelKey(rc, displayKey, mode, isPortrait, tier, duration) {
  const orientation = isPortrait ? "portrait" : "landscape";
  const merged      = { ...rc.model_mappings, ...rc.extra_model_mappings };
  const defaultDur  = rc.video_duration?.default_seconds ?? 0;

  // Duration-specific key override
  if (duration && duration !== defaultDur) {
    const specific = rc.video_duration?.model_keys?.[String(duration)]?.[displayKey]?.[mode];
    if (specific) return specific;
  }

  // Standard lookup
  const base = merged?.[displayKey]?.[mode]?.[orientation]?.[tier] ?? "";
  if (!base) return "";

  // Ultra fast auto-suffix
  if (displayKey === "fast" && (tier === "ULTRA" || tier === "ULTRA1P5")) {
    if (base.includes("_ultra")) return base;
    return base.endsWith("_fl") ? `${base.slice(0, -3)}_ultra_fl` : `${base}_ultra`;
  }

  return base;
}

// Usage:
const key = resolveVideoModelKey(rc, "omni_flash", "r2v", false, "FREE", 8);
// → e.g. "omni_flash_r2v"
```

---

## §7. Voices (TTS)

**TTS Model:** `gemini_v4s_tts_flow`

All 30 voice IDs:

| ID | Name | Gender |
|----|------|--------|
| `achernar` | Achernar | female |
| `achird` | Achird | male |
| `algenib` | Algenib | male |
| `algieba` | Algieba | male |
| `alnilam` | Alnilam | male |
| `aoede` | Aoede | female |
| `autonoe` | Autonoe | female |
| `callirrhoe` | Callirrhoe | female |
| `charon` | Charon | male |
| `despina` | Despina | female |
| `enceladus` | Enceladus | male |
| `erinome` | Erinome | female |
| `fenrir` | Fenrir | male |
| `gacrux` | Gacrux | female |
| `iapetus` | Iapetus | male |
| `kore` | Kore | female |
| `laomedeia` | Laomedeia | female |
| `leda` | Leda | female |
| `orus` | Orus | male |
| `puck` | Puck | male |
| `pulcherrima` | Pulcherrima | ungendered |
| `rasalgethi` | Rasalgethi | male |
| `sadachbia` | Sadachbia | male |
| `sadaltager` | Sadaltager | male |
| `schedar` | Schedar | male |
| `sulafat` | Sulafat | female |
| `umbriel` | Umbriel | male |
| `vindemiatrix` | Vindemiatrix | female |
| `zephyr` | Zephyr | female |
| `zubenelgenubi` | Zubenelgenubi | male |

---

## §8. Aspect Ratios

### Image
| String | Internal Enum | Numeric Code |
|--------|--------------|-------------|
| `'1:1'` | `IMAGE_ASPECT_RATIO_SQUARE` | `1` |
| `'16:9'` | `IMAGE_ASPECT_RATIO_LANDSCAPE` | `2` |
| `'9:16'` | `IMAGE_ASPECT_RATIO_PORTRAIT` | `3` |
| `'4:3'` | `IMAGE_ASPECT_RATIO_LANDSCAPE_4_3` | `4` |
| `'3:4'` | `IMAGE_ASPECT_RATIO_PORTRAIT_3_4` | `5` |

### Video
| String | Internal Enum | Numeric Code |
|--------|--------------|-------------|
| `'landscape'` | `VIDEO_ASPECT_RATIO_LANDSCAPE` | `1` |
| `'portrait'` | `VIDEO_ASPECT_RATIO_PORTRAIT` | `2` |

---

## §9. Duration Options

```javascript
rc.video_duration = {
  options_seconds:      [5, 8, 10],
  default_seconds:      8,
  ultra_only_seconds:   [10],        // 10s = Ultra tier only
  model_keys: {                      // duration-specific overrides
    "10": { "veo3": { "t2v": "veo_3_t2v_10s" }, ... },
  },
};
```

---

## §10. Tier System

| Tier String | Code | Capabilities |
|------------|------|-------------|
| `FREE` | 3 | Basic video, no upscale, 8s max |
| `PRO` | 1 | Video + 1080p upscale |
| `ULTRA` | 2 | All features, 4K, 10s |
| `ULTRA1P5` | 8 | Same as ULTRA (newer plan) |
| `GEMNOVA` | 7 | Special plan |
| `UNSUBSCRIBED_WITH_CREDITS` | 4 | Has credits but no sub |
| `ZERO` | 5 | No credits |
| `EXEMPT` | 6 | Exempt account |
