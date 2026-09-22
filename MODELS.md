# MODELS.md — AI Models, Voices & Parameters

> Complete catalog of all AI models, voice IDs, aspect ratios, and generation parameters
> supported by `flow.google.com`.

---

## §1. Video Models

### How Model Keys Work

Video models are selected through a 4-level lookup:
```
rc.model_mappings[displayKey][videoMode][orientation][tier]
→ modelApiKey string (sent in API payload)
```

**Parameters:**
- `displayKey` — the key shown in UI (e.g., `'veo3'`, `'veo3lite'`, `'veofast'`)
- `videoMode` — one of: `'t2v'` | `'i2v'` | `'i2v_end'` | `'r2v'`
- `orientation` — `'landscape'` | `'portrait'`
- `tier` — `'FREE'` | `'PRO'` | `'ULTRA'` | `'ULTRA1P5'` | `'GEMNOVA'`

### Known Model API Key Patterns

| API Key Pattern | Description |
|-----------------|-------------|
| `veo_3_1_t2v_lite` | Veo 3.1 Lite — text-to-video |
| `veo_3_1_t2v_lite_low_priority` | **0-credit** Veo 3.1 Lite (slower queue) |
| `veo_3_1_t2v` | Veo 3.1 Full |
| `veo_3_t2v` | Veo 3.0 |
| `veo_fast_*` | Veo Fast variants |
| `*_ultra` | Ultra tier suffix |
| `*_ultra_fl` | Ultra + First/Last frame suffix |
| `*_360p` | 360p output (triggers `inner[12] = [4]` in payload) |

### Fast Model on Ultra Tier
```javascript
// Special rule: if modelDisplayKey === 'fast' AND tier is ULTRA or ULTRA1P5:
if (modelKey === 'fast' && (tier === 'ULTRA' || tier === 'ULTRA1P5')) {
  return modelKey.endsWith('_fl')
    ? `${baseKey}_ultra_fl`
    : `${baseKey}_ultra`;
}
```

### Video Modes Explained

| Mode | Config Key | What it does |
|------|-----------|-------------|
| `t2v` | `video_text` | Text prompt → Video |
| `i2v` | `video_start_image` | Image + Text → Video (image is first frame) |
| `first_last` | `video_start_end_image` | Start image + End image + Text → Video |
| `ingredients` | `video_reference_images` | Multiple reference images + Text → Video |
| `edit` | `video_edit` | Existing video + Text → Extended/edited video |

---

## §2. Image Models

### Configuration Structure
```javascript
rc.image_models.models = {
  'ModelKey': {
    label:           'Display Name',       // shown in UI
    api_model:       'api_model_string',   // sent in API payload at field[5]
    enabled:         true,
    order:           1,                    // sort order in UI
    max_refs:        4,                    // max reference images supported
    supports_upscale: true,
    aspectRatios:    ['1:1', '16:9', '9:16', '4:3', '3:4'],
    isFlow:          true,                 // is this a Flow-native model?
  }
}
```

### Known Image Model Keys
| Model Key | Description |
|-----------|-------------|
| `NanoBanana` | Gemini Image 3 (primary Flow image model) |
| (others loaded from rc) | Additional models vary by account/config |

---

## §3. Audio / TTS

### TTS Model
```javascript
model: 'gemini_v4s_tts_flow'  // default
```

### Performance Styles
Performance style strings come from server config. Common examples:
```
'' (empty)  → default
'NEUTRAL'   → neutral tone
'EXPRESSIVE'→ expressive tone
```

### All 30 Voice IDs

| Voice ID | Display Name | Gender |
|----------|-------------|--------|
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

## §4. Aspect Ratios

### Image Aspect Ratios
Configured in `rc.image_models.aspect_ratios` (string → internal enum):
```javascript
{
  '1:1':  'IMAGE_ASPECT_RATIO_SQUARE',
  '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '4:3':  'IMAGE_ASPECT_RATIO_LANDSCAPE_4_3',
  '3:4':  'IMAGE_ASPECT_RATIO_PORTRAIT_3_4',
}
```

Numeric codes in `rc.image_aspects`:
```javascript
{
  '1:1':  1,   // or however the server maps it
  '16:9': 2,
  '9:16': 3,
  '4:3':  4,
  '3:4':  5,
}
```

### Video Aspect Ratios
```javascript
rc.video_aspects = {
  'landscape': 1,  // VIDEO_ASPECT_RATIO_LANDSCAPE
  'portrait':  2,  // VIDEO_ASPECT_RATIO_PORTRAIT
}

// Determined from image aspect:
function imageAspectToVideoAspect(imageAspect) {
  const enum_ = rc.image_models.aspect_ratios[imageAspect] ?? '';
  return enum_.toUpperCase().includes('PORTRAIT')
    ? 'VIDEO_ASPECT_RATIO_PORTRAIT'
    : 'VIDEO_ASPECT_RATIO_LANDSCAPE';
}
```

---

## §5. Video Duration

### Duration Options
```javascript
rc.video_duration = {
  options_seconds:      [5, 8, 10],  // available duration choices
  default_seconds:      8,           // default
  ultra_only_seconds:   [10],        // only available on Ultra tier
  ultra_exempt_models:  [],          // models exempt from ultra-only restriction
  model_keys:           {},          // per-model duration overrides
}
```

### Per-Model Duration Selection
```javascript
// F(rc, modelDisplayKey, videoMode, orientation, tier, duration)
// Priority:
// 1. model_keys[duration][modelDisplayKey][videoMode] → specific key
// 2. model_mappings[modelDisplayKey][videoMode][orientation][tier] → default key
function selectModelKey(rc, displayKey, mode, orientation, tier, duration) {
  const defaultDur = rc.video_duration?.default_seconds ?? 0;
  
  // Check duration-specific override first
  if (duration && duration !== defaultDur) {
    const modelKeys = rc.video_duration?.model_keys;
    const byDuration = modelKeys?.[String(duration)];
    const specific   = byDuration?.[displayKey]?.[mode];
    if (specific) return specific;
  }
  
  // Fall back to standard mapping
  return rc.model_mappings?.[displayKey]?.[mode]?.[orientation]?.[tier] ?? '';
}
```

---

## §6. Upscale Parameters

### Image Upscale
```javascript
rc.image_upscale_levels = {
  '2K': 1,  // numeric code sent in payload
  '4K': 2,
}
```
- Only works on **Flow-generated images** (not uploaded references)
- Returns base64 JPEG in response

### Video Upscale
```javascript
rc.video_upscale_res = {
  '1080p': 1,  // numeric code
  '4K':    2,
}
```
- Upscale models: `rc.video.model_upscale_key` (1080p) and `rc.video.model_upscale_4k_key` (4K)
- 4K only available on Ultra tier: `isUltra(tier)` = tier is `'ULTRA'` or `'ULTRA1P5'`
- After submitting upscale → poll same `video_poll` RPC → `get_media` for URL

---

## §7. Tier System

### Tier Codes
```javascript
const TIER_CODES = {
  0: 'UNSPECIFIED',
  1: 'PRO',
  2: 'ULTRA',
  3: 'FREE',
  4: 'UNSUBSCRIBED_WITH_CREDITS',
  5: 'ZERO',
  6: 'EXEMPT',
  7: 'GEMNOVA',
  8: 'ULTRA1P5',
};
```

### Tier Capabilities
| Feature | FREE | PRO | ULTRA | ULTRA1P5 | GEMNOVA |
|---------|------|-----|-------|---------|---------|
| Video generation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Video upscale 1080p | ✗ | ✓ | ✓ | ✓ | ✓ |
| Video upscale 4K | ✗ | ✗ | ✓ | ✓ | ✓ |
| 10s duration | ✗ | ✗ | ✓ | ✓ | ✓ |
| Compose mode | ✓ | ✓ | ✓ | ✓ | ✓ |
| Image upscale 4K | ✗ | ✗ | ✓ | ✓ | ✓ |

### Check if Ultra Tier
```javascript
function isUltra(tier) {
  return tier === 'ULTRA' || tier === 'ULTRA1P5';
}
```

---

## §8. audioPref Parameter

The `audioPref` field appears in all video payloads at index 2, position 1.

```javascript
const AUDIO_PREF = {
  1: 'WITH_AUDIO',    // generate with audio (default)
  0: 'NO_AUDIO',      // generate without audio
};

// In me() wrapper:
return [[...items], z(projectId, captchaToken), [batchId, audioPref]];
//                                                              ↑
//                                                    1 = with audio
```

---

## §9. Seed Values

Random seeds control the generation randomness. Same seed + same prompt = reproducible output.

```javascript
// Random seed generation:
const seed = Math.floor(1e5 + Math.random() * (2**31 - 1e5));
// Range: 100000 to 2147483647

// Usage in payloads:
inner[3] = seed; // for video payloads
inner[3] = seed; // for image payloads (also at index 3)
```
