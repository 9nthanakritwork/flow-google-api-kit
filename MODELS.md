# MODELS.md — AI Models, Voices & Parameters

> Complete catalog of all AI models, voice IDs, aspect ratios, and generation parameters
> supported by `flow.google.com`.

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
| `displayKey` | UI model group name | `"veo3"`, `"veo3lite"`, `"veofast"`, `"quality"` |
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
    if (base.includes('_ultra')) return base; // already has it
    return base.endsWith('_fl')
      ? `${base.slice(0, -3)}_ultra_fl`
      : `${base}_ultra`;
  }

  return base;
}
```

---

## §2. Video Generation Modes — `mode` + `ce` Internal Mapping

When the user triggers video generation, the mode is determined from the references provided:

| User Action | `mode` (API) | `ce` (internal lookup key) |
|------------|-------------|--------------------------|
| Text only, no images | `t2v` | `"t2v"` |
| 1 reference image → start frame | `i2v` | `"i2v"` |
| 2 reference images → start + end | `first_last` | `"i2v_end"` |
| Multiple refs (ingredients) or characters | `ingredients` | `"r2v"` |
| Edit existing video | `edit` | `"edit"` |

```javascript
// From buildSubmit() in adapter-BEikWMOV.js:
if (hasEditVideoMediaId)       { mode = 'edit',         lookupKey = 'edit'     }
else if (!refs.length)         { mode = 't2v',          lookupKey = 't2v'      }
else if (isCompose || chars)   { mode = 'ingredients',  lookupKey = 'r2v'      }
else if (refs.length >= 2)     { mode = 'first_last',   lookupKey = 'i2v_end'  }
else                           { mode = 'i2v',          lookupKey = 'i2v'      }

// Then: modelApiKey = selectModelApiKey(rc, displayKey, lookupKey, orientation, tier, duration)
```

---

## §3. Complete modelApiKey Reference

> ⚠️ The actual string values (e.g., `veo_3_1_t2v_lite`) come from `rc.model_mappings`  
> which is delivered by the server. The table below shows the **known patterns** extracted from the extension code.

### 3.1 Video Model API Key Patterns

| Pattern | Description | Notes |
|---------|-------------|-------|
| `veo_3_t2v` | Veo 3.0 — Text-to-Video | Standard |
| `veo_3_i2v` | Veo 3.0 — Image-to-Video | Needs `startMediaId` |
| `veo_3_i2v_end` | Veo 3.0 — First+Last frame | Needs start + end |
| `veo_3_r2v` | Veo 3.0 — Reference-to-Video | Multiple refs |
| `veo_3_1_t2v_lite` | **Veo 3.1 Lite** — T2V | Faster, fewer credits |
| `veo_3_1_t2v_lite_low_priority` | **Veo 3.1 Lite 0-credit** | Free, slowest queue |
| `veo_3_1_t2v` | Veo 3.1 Full — T2V | Higher quality |
| `veo_3_1_i2v` | Veo 3.1 — Image-to-Video | |
| `veo_3_1_i2v_end` | Veo 3.1 — First+Last frame | |
| `veo_3_1_r2v` | Veo 3.1 — Reference-to-Video | |
| `veo_fast_t2v` | Veo Fast — T2V | Quick generation |
| `veo_fast_t2v_ultra` | Veo Fast + Ultra tier | Auto-appended for ULTRA |
| `veo_fast_t2v_ultra_fl` | Veo Fast + Ultra + First/Last | Auto-appended |
| `*_360p` | 360p output variant | Triggers special payload field |

### 3.2 Per-Mode modelApiKey Lookup Table

Use this table to select `modelApiKey` for each scenario:

```javascript
// rc.model_mappings structure:
const MODEL_MAPPINGS = {
  // displayKey → { videoMode → { orientation → { tier → modelApiKey } } }

  'veo3lite': {
    t2v: {
      landscape: {
        FREE:    'veo_3_1_t2v_lite',
        PRO:     'veo_3_1_t2v_lite',
        ULTRA:   'veo_3_1_t2v_lite',
        ULTRA1P5:'veo_3_1_t2v_lite',
        GEMNOVA: 'veo_3_1_t2v_lite',
      },
      portrait: {
        FREE:    'veo_3_1_t2v_lite',
        // ...same across tiers for lite
      },
    },
    i2v: {
      landscape: { FREE: 'veo_3_1_i2v', ULTRA: 'veo_3_1_i2v', ... },
      portrait:  { ... },
    },
    i2v_end: {
      landscape: { FREE: 'veo_3_1_i2v_end', ... },
      portrait:  { ... },
    },
    r2v: {
      landscape: { FREE: 'veo_3_1_r2v', ... },
      portrait:  { ... },
    },
  },

  'veo3': {
    t2v:     { landscape: { FREE: 'veo_3_t2v', ULTRA: 'veo_3_t2v', ... }, portrait: {...} },
    i2v:     { landscape: { FREE: 'veo_3_i2v', ... }, portrait: {...} },
    i2v_end: { landscape: { FREE: 'veo_3_i2v_end', ... }, portrait: {...} },
    r2v:     { landscape: { FREE: 'veo_3_r2v', ... }, portrait: {...} },
  },

  'fast': {
    // For ULTRA/ULTRA1P5 tier, '_ultra' suffix is auto-appended by selectModelApiKey()
    t2v: {
      landscape: {
        FREE:    'veo_fast_t2v',
        PRO:     'veo_fast_t2v',
        ULTRA:   'veo_fast_t2v',          // → becomes 'veo_fast_t2v_ultra'
        ULTRA1P5:'veo_fast_t2v',          // → becomes 'veo_fast_t2v_ultra'
      },
      portrait: { ... },
    },
    i2v: { ... },
  },

  'quality': {
    // High-quality / Veo Quality — does NOT support compose/r2v tab
    t2v: {
      landscape: { PRO: 'veo_quality_t2v', ULTRA: 'veo_quality_t2v_ultra', ... },
      portrait:  { ... },
    },
    i2v:     { ... },
    i2v_end: { ... },
    // Note: r2v NOT supported for quality model
  },
};
```

### 3.3 0-Credit Model (Special Case)

```javascript
// The 0-credit "low priority" model:
const FREE_MODEL = 'veo_3_1_t2v_lite_low_priority';

// Usage: same as regular t2v, just use this modelApiKey
const job = await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite_low_priority',  // ← 0 credits!
  prompt:       'Your prompt here',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});
// Credits used: 0 — but goes into a slower queue
```

### 3.4 Video Edit Model

```javascript
// For edit mode, modelApiKey comes from:
const editModelKey = rc.video_edit?.model_key ?? '';    // standard edit
const edit4kKey    = rc.video_edit?.model_upscale_4k_key ?? '';  // 4K upscale edit

// In editVideo() call:
await sdk.editVideo({
  sourceMediaId: 'EXISTING_VIDEO_MEDIA_ID',
  modelApiKey:   editModelKey,   // ← from rc.video_edit.model_key
  prompt:        'Extend the video with more waves',
  aspect:        'landscape',
  projectId:     PROJECT_ID,
  captchaToken:  CAPTCHA_TOKEN,
});
```

### 3.5 Upscale Model Keys

```javascript
// Video upscale models come from server config:
const upscale1080pKey = rc.video?.model_upscale_key    ?? '';  // 1080p
const upscale4kKey    = rc.video?.model_upscale_4k_key ?? '';  // 4K (Ultra only)

// In upscaleVideo() call:
await sdk.upscaleVideo({
  mediaId:      'VIDEO_MEDIA_ID',
  workflowId:   'WORKFLOW_ID',
  aspect:       'landscape',
  resolution:   '1080p',
  modelKey:     upscale1080pKey,   // ← from rc
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});
```

---

## §4. Complete generateVideo Examples — Every mode × model

### T2V — Text to Video

```javascript
// ─── Veo 3.1 Lite (standard, most common) ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite',
  prompt:       'A serene lake at sunrise, cinematic',
  aspect:       'landscape',        // 'landscape' | 'portrait'
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,      // action: 'GENERATE_VIDEO'
});

// ─── Veo 3.1 Lite — 0 credits (low priority queue) ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite_low_priority',
  prompt:       'A simple animation of waves',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── Veo 3.1 Full ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v',
  prompt:       'Epic drone shot over mountain peaks, golden hour',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  seed:         42,                 // optional: fix seed for reproducibility
});

// ─── Veo 3.0 ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_t2v',
  prompt:       'Timelapse of a blooming flower, macro',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── Veo Fast ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_fast_t2v',     // or 'veo_fast_t2v_ultra' for Ultra tier
  prompt:       'Quick shot of a city street',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── Portrait orientation ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite',
  prompt:       'A person walking through a forest',
  aspect:       'portrait',         // ← portrait for phone/vertical
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});

// ─── With audio preference ───
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v_lite',
  prompt:       'Ocean waves crashing on rocks',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  audioPref:    1,   // 1 = generate WITH audio (default), 0 = no audio
});

// ─── With specific duration (8s or 10s) ───
// Duration is handled by model key selection — pass duration to selectModelApiKey
// or look up the right key from rc.video_duration.model_keys[duration][displayKey][mode]
await sdk.generateVideo({
  mode:         't2v',
  modelApiKey:  'veo_3_1_t2v',     // 10s model key (from rc for 10s duration)
  prompt:       'Long cinematic sequence',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
});
```

### I2V — Image to Video (start frame)

```javascript
// ─── Basic I2V ───
await sdk.generateVideo({
  mode:         'i2v',
  modelApiKey:  'veo_3_1_i2v',     // i2v-specific key
  prompt:       'The person turns around slowly',
  aspect:       'portrait',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: 'UPLOADED_IMAGE_MEDIA_ID',  // REQUIRED: first frame image
});

// ─── I2V with Veo 3.0 ───
await sdk.generateVideo({
  mode:         'i2v',
  modelApiKey:  'veo_3_i2v',
  prompt:       'Camera slowly pans right',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: 'MEDIA_ID_FROM_UPLOAD_OR_GENERATE',
  seed:         99,
});

// ─── I2V — how to get a startMediaId ───
// Option 1: Upload your own image
const uploaded = await sdk.uploadImage({
  modelApiKey:  'gemini_v4_img_flow',
  captchaToken: CAPTCHA_TOKEN_UPLOAD,   // use 'upload_image' action
  base64Data:   yourBase64String,
  mimeType:     'image/jpeg',
  aspect:       '16:9',
});
const startMediaId = uploaded.mediaId;

// Option 2: Use mediaId from generateImage()
const generated = await sdk.generateImage({ ... });
const startMediaId2 = generated.mediaId;
```

### First + Last — Both start and end frames

```javascript
// ─── First+Last frame (i2v_end mode internally) ───
await sdk.generateVideo({
  mode:         'first_last',
  modelApiKey:  'veo_3_1_i2v_end',  // i2v_end-specific key
  prompt:       'Smooth cinematic transition between scenes',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: 'FIRST_FRAME_MEDIA_ID',   // REQUIRED
  endMediaId:   'LAST_FRAME_MEDIA_ID',    // REQUIRED
});

// ─── First+Last with Veo 3.0 ───
await sdk.generateVideo({
  mode:         'first_last',
  modelApiKey:  'veo_3_i2v_end',
  prompt:       'The flower opens fully',
  aspect:       'portrait',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  startMediaId: 'CLOSED_FLOWER_MEDIA_ID',
  endMediaId:   'OPEN_FLOWER_MEDIA_ID',
  seed:         777,
});
```

### Ingredients (Reference-to-Video)

```javascript
// ─── R2V with reference images (r2v mode internally) ───
await sdk.generateVideo({
  mode:         'ingredients',
  modelApiKey:  'veo_3_1_r2v',     // r2v-specific key
  prompt:       'Two characters having a friendly conversation outdoors',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  refMediaIds:  [             // array of uploaded image media IDs
    'PERSON_A_MEDIA_ID',
    'PERSON_B_MEDIA_ID',
    'BACKGROUND_MEDIA_ID',   // up to N refs based on model's max_refs
  ],
});

// ─── R2V with character entities (for named characters) ───
await sdk.generateVideo({
  mode:         'ingredients',
  modelApiKey:  'veo_3_1_r2v',
  prompt:       '@Alice walks into the scene waving at @Bob',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  entityIds:    ['ALICE_ENTITY_ID', 'BOB_ENTITY_ID'],  // character entity IDs
  // refMediaIds not needed when using entityIds
});

// ─── R2V mixing refs + characters ───
await sdk.generateVideo({
  mode:         'ingredients',
  modelApiKey:  'veo_3_1_r2v',
  prompt:       '@Alice in the magical forest background',
  aspect:       'landscape',
  projectId:    PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,
  refMediaIds:  ['FOREST_BACKGROUND_MEDIA_ID'],
  entityIds:    ['ALICE_ENTITY_ID'],
});
```

### Edit — Extend or modify existing video

```javascript
// ─── Edit/Extend existing video ───
await sdk.editVideo({
  sourceMediaId: 'EXISTING_VIDEO_MEDIA_ID',    // REQUIRED
  modelApiKey:   rc.video_edit?.model_key,     // from server config
  prompt:        'Continue: the character keeps walking into the forest',
  aspect:        'landscape',
  projectId:     PROJECT_ID,
  captchaToken:  CAPTCHA_TOKEN,
  endFrame:      0,    // frame to start editing from (0 = end of video)
  startFrame:    0,
});

// ─── Edit with reference images ───
await sdk.editVideo({
  sourceMediaId: 'VIDEO_MEDIA_ID',
  modelApiKey:   rc.video_edit?.model_key,
  prompt:        'Add a sunset glow to the background',
  aspect:        'landscape',
  projectId:     PROJECT_ID,
  captchaToken:  CAPTCHA_TOKEN,
  refMediaIds:   ['SUNSET_REFERENCE_MEDIA_ID'],
});
```

---

## §5. Image Model `modelApiKey`

For image generation, `modelApiKey` comes from:
```javascript
rc.image_models.models[modelKey].api_model
```

| UI Model Key | `api_model` | Description |
|-------------|-------------|-------------|
| `NanoBanana` | `gemini_v4_img_flow` | Gemini Image 3 (primary) |
| (others) | varies | From server config |

```javascript
// Get the api_model for a given model key:
const modelApiKey = rc.image_models?.models?.[displayModelKey]?.api_model ?? displayModelKey;

// Generate image with model key:
await sdk.generateImage({
  prompt:      'A detailed portrait of a cat',
  modelApiKey: 'gemini_v4_img_flow',   // ← api_model string
  aspect:      '1:1',
  projectId:   PROJECT_ID,
  captchaToken: CAPTCHA_TOKEN,         // action: 'GENERATE_IMAGE'
});
```

---

## §6. Helper: Auto-Resolve modelApiKey

Add this helper to your code so you don't need to hardcode model keys:

```javascript
/**
 * resolveVideoModelKey(rc, displayKey, mode, isPortrait, tier, duration)
 * Auto-resolves the correct modelApiKey from server config.
 *
 * @param {object} rc            Remote config from license server
 * @param {string} displayKey    Model display key: 'veo3lite', 'veo3', 'fast', 'quality'
 * @param {string} mode          API mode: 't2v', 'i2v', 'i2v_end', 'r2v'
 * @param {boolean} isPortrait   true for portrait, false for landscape
 * @param {string} tier          User tier: 'FREE', 'PRO', 'ULTRA', 'ULTRA1P5', 'GEMNOVA'
 * @param {number} [duration]    Desired duration in seconds (optional)
 */
function resolveVideoModelKey(rc, displayKey, mode, isPortrait, tier, duration) {
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const merged      = { ...rc.model_mappings, ...rc.extra_model_mappings };
  const defaultDur  = rc.video_duration?.default_seconds ?? 0;

  // Check duration-specific keys first
  if (duration && duration !== defaultDur) {
    const byDur   = rc.video_duration?.model_keys?.[String(duration)];
    const specific = byDur?.[displayKey]?.[mode];
    if (specific) return specific;
  }

  // Standard lookup
  const base = merged?.[displayKey]?.[mode]?.[orientation]?.[tier] ?? '';
  if (!base) return '';

  // Ultra fast gets suffix
  if (displayKey === 'fast' && (tier === 'ULTRA' || tier === 'ULTRA1P5')) {
    if (base.includes('_ultra')) return base;
    return base.endsWith('_fl') ? `${base.slice(0, -3)}_ultra_fl` : `${base}_ultra`;
  }

  return base;
}

// Usage example:
const modelApiKey = resolveVideoModelKey(
  rc,           // your rc config
  'veo3lite',   // display key
  't2v',        // video mode
  false,        // landscape
  'FREE',       // user tier
  8,            // 8 seconds
);
// → 'veo_3_1_t2v_lite'  (or whatever server maps it to)
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

Auto-mapping from image to video aspect:
```javascript
// If image aspect string contains 'PORTRAIT' → VIDEO_ASPECT_RATIO_PORTRAIT
// Otherwise → VIDEO_ASPECT_RATIO_LANDSCAPE
function imageAspectToVideoAspect(rc, imageAspectKey) {
  const enum_ = rc.image_models?.aspect_ratios?.[imageAspectKey] ?? '';
  return enum_.toUpperCase().includes('PORTRAIT')
    ? 'VIDEO_ASPECT_RATIO_PORTRAIT'
    : 'VIDEO_ASPECT_RATIO_LANDSCAPE';
}
```

---

## §9. Duration Options

```javascript
rc.video_duration = {
  options_seconds:      [5, 8, 10],  // all available choices
  default_seconds:      8,           // default if not specified
  ultra_only_seconds:   [10],        // only for Ultra tier
  ultra_exempt_models:  [],          // models exempt from ultra-only restriction
  model_keys: {                      // duration → displayKey → mode → modelApiKey
    '10': {
      'veo3': { 't2v': 'veo_3_t2v_10s', 'i2v': '...' },
      // ...
    },
  },
};

// Check if duration is allowed for user's tier:
const isUltra = (tier) => tier === 'ULTRA' || tier === 'ULTRA1P5';

function isDurationAllowed(rc, duration, tier, modelApiKey) {
  const ultraOnly  = rc.video_duration?.ultra_only_seconds ?? [];
  const exemptions = rc.video_duration?.ultra_exempt_models ?? [];
  if (!ultraOnly.includes(duration)) return true;
  if (exemptions.includes(modelApiKey)) return true;
  return isUltra(tier);
}
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

```javascript
// Check tier from server:
const { tier } = await sdk.getCredits();
// tier → 'FREE', 'PRO', 'ULTRA', etc.
```
