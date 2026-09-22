# PROTOCOL.md — Complete API Protocol Specification

> Full technical specification of the `flow.google.com` batchexecute RPC protocol.  
> AI agents: read this file to understand exactly how to construct and send every request.

---

## §1. HTTP Request Format

Every API call is a single HTTP POST to the batchexecute endpoint.

### Endpoint URL
```
POST https://flow.google.com/_/FlowUi/data/batchexecute
```
With query parameters:
```
?rpcids={RPC_ID}
&source-path={SOURCE_PATH}
&bl={WIZ_global_data.cfb2h}
&f.sid={WIZ_global_data.FdrFJe}
&hl=en
&_reqid={RANDOM_6_DIGITS}
&rt=c
```

Where:
- `{RPC_ID}` = the specific RPC identifier (e.g., `YhhmEf`, `UpteDb`) from `rc.rpcids`
- `{SOURCE_PATH}` = `rc.source_path` with `{auth_index}` replaced (e.g., `/flow/0`)
- `{RANDOM_6_DIGITS}` = `Math.floor(100000 + Math.random() * 900000)`

### Request Headers
```
Content-Type:  application/x-www-form-urlencoded;charset=UTF-8
X-Same-Domain: 1
Cookie:        {Google session cookies}
```

### Request Body (URL-encoded)
```
f.req=%5B%5B%5B...%5D%5D%5D&at=YOUR_AT_TOKEN
```

Decoded body:
```
f.req=[[["{RPC_ID}","{JSON.stringify(PAYLOAD)}",null,"generic"]]]
at={WIZ_global_data.SNlM0e}
```

**Note:** `f.req` is a 3-layer nested array: `[ [ [rpcId, jsonString, null, "generic"] ] ]`  
The payload inside is **JSON-stringified** (double-encoded), not embedded directly.

### Complete JavaScript Fetch Example
```javascript
function buildBatchRequest(cfg, auth, rpcId, payload) {
  // Build URL
  const sourcePath = cfg.source_path.replace('{auth_index}', auth.authIndex);
  const batchPath  = cfg.batchexecute_path.replace('{auth_index}', auth.authIndex);
  const reqid      = String(Math.floor(100000 + Math.random() * 900000));
  
  const qs = new URLSearchParams({
    rpcids:        rpcId,
    'source-path': sourcePath,
    bl:            auth.bl,
    'f.sid':       auth.sid,
    hl:            'en',
    _reqid:        reqid,
    rt:            'c',
  });
  
  const url = `${cfg.origin}${batchPath}?${qs}`;
  
  // Build body
  const body = new URLSearchParams({
    'f.req': JSON.stringify([[[rpcId, JSON.stringify(payload), null, 'generic']]]),
    at:      auth.at,
  }).toString();
  
  return { url, body };
}
```

---

## §2. Sparse Array System (CRITICAL — Must Understand)

Flow's API encodes data as **null-padded (sparse) arrays** instead of objects.  
Every payload is built using this pattern.

### The `y()` Function
```javascript
// y(indexMap) → sparse array
// Input: object with numeric keys
// Output: array where index = key, gaps filled with null

function y(obj) {
  if (!obj || Object.keys(obj).length === 0) return [];
  const keys = Object.keys(obj).map(Number);
  const max  = Math.max(...keys);
  const arr  = new Array(max + 1).fill(null);
  for (const k of keys) arr[k] = obj[k];
  return arr;
}

// Examples:
y({ 0: 'hello' })            → ['hello']
y({ 1: 22 })                 → [null, 22]
y({ 0: 'a', 3: 'b' })        → ['a', null, null, 'b']
y({ 1: 22, 5: 'token' })     → [null, 22, null, null, null, 'token']
```

### Other Helper Functions
```javascript
// Generate UUID (uppercase)
function G() { return crypto.randomUUID().toUpperCase(); }

// Generate random seed integer
function randomSeed() { return Math.floor(1e5 + Math.random() * (2**31 - 1e5)); }

// reCAPTCHA context array — included in EVERY payload
function z(captchaToken = null, modelKey = null, version = 22) {
  const n = { 1: version };
  if (captchaToken) n[5] = captchaToken;   // index 5 = recaptcha token
  if (modelKey)     n[10] = y({ 0: modelKey, 1: 1 }); // index 10 = model ref
  return y(n);
  // → [null, 22, null, null, null, "TOKEN", null, null, null, null, [modelKey, 1]]
}

// Text content part
function fe(text) { return y({ 0: text }); }
// → ['text string']

// Media reference part (by mediaId)
function Pr(mediaId, handle = '') {
  return y({ 1: y({ 0: y({ 0: mediaId, 1: handle }) }) });
}

// Entity reference part (by entityId / character)
function Ur(entityId, handle = '') {
  return y({ 1: y({ 2: y({ 0: entityId, 1: handle }) }) });
}

// Batch ID container
function Ae() { return y({ 4: G(), 5: G() }); }

// Media frame wrapper (for start/end frames in i2v)
function Le(mediaId) { return y({ 1: mediaId, 5: y({ 2: 1, 3: 1 }) }); }

// Video payload wrapper — me(items, projectId, captchaToken, batchId, audioPref)
function me(items, projectId, captchaToken, batchId = null, audioPref = 1) {
  return [
    [...items],                              // index 0: payload items
    z(projectId, captchaToken),             // index 1: recaptcha context (projectId as modelKey)
    [batchId ?? G(), audioPref],            // index 2: [batchId, audioPref]
  ];
}
```

---

## §3. Content Parts (Structured Prompts)

Each API call includes a "parts" array representing the prompt content.  
Parts can be text, media references, or entity references — mixed together.

```javascript
// Simple text prompt:
const parts = [fe('A mountain lake at sunset')];
// → [['A mountain lake at sunset']]

// Text + media reference (for image-to-video):
const parts = [
  fe('A person walking through'),
  Pr('mediaId123', 'filename.jpg'),
];

// Text + character entity:
const parts = [
  fe('Say hello @Alice'),
  Ur('entityId456', 'Alice'),
];
```

---

## §4. Response Parsing

### Raw Response Format
```
)]}'
[["wrb.fr","RPC_ID","JSON_DATA_STRING",null,null,null,FLAG_ARRAY]]
[["di",45]]
[["e",4,["rc",0,"",4]]]
```

### Parsing Steps
```javascript
function parseResponse(rawText) {
  // Step 1: Remove security prefix
  if (rawText.startsWith(")]}'")) rawText = rawText.slice(4);
  
  // Step 2: Extract all top-level JSON arrays
  const chunks = extractAllJsonArrays(rawText); // parse [ ... ] blocks
  
  // Step 3: Find result rows and error rows
  const results = [], errors = [];
  
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;
    for (const row of chunk) {
      if (!Array.isArray(row)) continue;
      
      if (row[0] === 'wrb.fr') {
        // Result row:
        // row[1] = rpcId
        // row[2] = JSON-encoded response (or null if error)
        // row[5] = error flag array (if null payload)
        results.push({
          rpcid:       row[1],
          data:        row[2] != null ? JSON.parse(row[2]) : null,
          nullPayload: row[2] == null,
          flag:        row[5] ?? null,
        });
      } else if (row[0] === 'er') {
        // Error row:
        // row[5] = HTTP status code
        // row[9] = gRPC error code
        errors.push({ http: row[5], code: row[9] });
      }
    }
  }
  
  return { results, errors };
}
```

### Accessing Response Data
```javascript
const { results, errors } = parseResponse(responseText);

// Check for errors
if (results[0].nullPayload) {
  throw new Error(`Generation failed. Flag: ${JSON.stringify(results[0].flag)}`);
}

const data = results[0].data; // The actual response object
```

---

## §5. All RPC Payload Specifications

### 5.1 — Image Generate

**Config key:** `image_generate`

```javascript
function buildImageGeneratePayload(modelApiKey, captchaToken, aspectCode, parts, opts = {}) {
  const captchaCtx = z(captchaToken, modelApiKey);
  
  const inner = {
    3:  opts.seed ?? randomSeed(),   // random seed
    4:  aspectCode,                  // numeric aspect ratio (from rc.image_aspects)
    5:  modelApiKey,                 // model API string
    7:  captchaCtx,                  // recaptcha context
    8:  [parts],                     // [[...parts]]
    12: G(),                         // UUID for this item
    13: G(),                         // UUID for this item (second)
  };
  
  // Optional: reference image IDs
  if (opts.imageInputIds?.length)
    inner[2] = opts.imageInputIds.map(id => y({ 0: id, 4: 1 }));
  
  // Optional: character entity IDs
  if (opts.referenceEntityIds?.length)
    inner[10] = opts.referenceEntityIds.map(id => y({ 0: id }));
  
  const batchId = opts.batchId ?? G();
  
  return [
    null,           // index 0: null
    [y(inner)],     // index 1: array containing the inner payload
    1,              // index 2: always 1
    captchaCtx,     // index 3: recaptcha context (repeated)
    y({ 0: batchId }), // index 4: batch ID wrapper
  ];
}
```

**Response Parser:**
```javascript
function parseImageResult(data) {
  // Path helper: I(data, 0, 0, 6, 0, 13) → data[0][0][6][0][13]
  return {
    mediaId:    data?.[0]?.[0]?.[0],           // string
    workflowId: data?.[0]?.[0]?.[2],           // string
    width:      data?.[0]?.[0]?.[6]?.[2]?.[0], // number
    height:     data?.[0]?.[0]?.[6]?.[2]?.[1], // number
    url:        data?.[0]?.[0]?.[6]?.[0]?.[13],// CDN URL string
    seed:       data?.[0]?.[0]?.[6]?.[0]?.[1], // number
  };
}
```

---

### 5.2 — Image Upload (Reference)

**Config key:** `image_upload`

```javascript
function buildImageUploadPayload(modelApiKey, captchaToken, base64Data, mimeType, aspectCode, opts = {}) {
  const inner = {
    0:  z(modelApiKey, captchaToken), // recaptcha context
    1:  base64Data,                   // base64 image string (no data: prefix)
    2:  mimeType,                     // e.g. 'image/jpeg'
    3:  aspectCode,                   // numeric aspect
    8:  1,                            // always 1
    10: G(),                          // UUID
    11: G(),                          // UUID
  };
  
  // Optional: link to character entity
  if (opts.entityId) {
    inner[9] = y({
      2: y({ 0: opts.entityId, 1: y({ 0: opts.imageReferenceIndex ?? 0 }) })
    });
  }
  
  return y(inner);
}
```

**Response Parser:**
```javascript
function parseImageUpload(data) {
  return {
    mediaId:    data?.[0]?.[0],           // string
    workflowId: data?.[0]?.[2],           // string
    width:      data?.[0]?.[6]?.[2]?.[0], // number
    height:     data?.[0]?.[6]?.[2]?.[1], // number
    bytes:      data?.[0]?.[5]?.[13],     // number
  };
}
```

---

### 5.3 — Image Upscale

**Config key:** `image_upscale`

```javascript
function buildImageUpscalePayload(mediaId, upscaleLevelCode, captchaToken) {
  // upscaleLevelCode: from rc.image_upscale_levels ('2K' → code, '4K' → code)
  return [
    mediaId,           // index 0: source media ID
    upscaleLevelCode,  // index 1: numeric level code
    z(null, captchaToken), // index 2: recaptcha context (no modelKey)
  ];
}
```

**Response:** Returns base64 JPEG string buried in nested arrays.
```javascript
function findBase64InResponse(data) {
  let best = '';
  function search(node) {
    if (typeof node === 'string' && node.length > 2000) {
      // Check it looks like base64
      const sample = node.slice(0, 200);
      const valid  = [...sample].filter(c => /[A-Za-z0-9+/=\-_]/.test(c)).length;
      if (valid >= sample.length - 2 && node.length > best.length) best = node;
    } else if (Array.isArray(node)) {
      for (const c of node) search(c);
    } else if (node && typeof node === 'object') {
      for (const c of Object.values(node)) search(c);
    }
  }
  search(data);
  return best || null; // base64 JPEG string, or null
}
```

---

### 5.4 — Video: Text-to-Video (T2V)

**Config key:** `video_text`

```javascript
function buildT2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, opts = {}) {
  const inner = {
    0: y({ 2: [parts] }),  // content parts nested as: {2: [[...parts]]}
    1: modelApiKey,         // model API key string
    2: aspectCode,          // numeric aspect code
    4: Ae(),                // batch UUID pair: {4: UUID, 5: UUID}
  };
  
  if (opts.seed != null) inner[3] = opts.seed;
  
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
  // me() wraps as: [ [payload], z(projectId, captchaToken), [batchId, audioPref] ]
}
```

---

### 5.5 — Video: Image-to-Video (I2V)

**Config key:** `video_start_image`

```javascript
function buildI2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, startMediaId, opts = {}) {
  const inner = {
    0: y({ 2: [parts] }),
    1: modelApiKey,
    2: aspectCode,
    4: Le(startMediaId),   // start frame: y({1: mediaId, 5: y({2:1, 3:1})})
    5: Ae(),               // batch UUID pair
  };
  
  if (opts.seed != null) inner[3] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}
```

---

### 5.6 — Video: First + Last Frame

**Config key:** `video_start_end_image`

```javascript
function buildFirstLastPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, startMediaId, endMediaId, opts = {}) {
  const inner = {
    0: y({ 2: [parts] }),
    1: modelApiKey,
    2: aspectCode,
    4: Le(startMediaId),  // start frame media
    5: Le(endMediaId),    // end frame media
    6: Ae(),              // batch UUID pair
  };
  
  if (opts.seed != null) inner[3] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}
```

---

### 5.7 — Video: Reference-to-Video (Ingredients)

**Config key:** `video_reference_images`

```javascript
function buildR2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, refMediaIds = [], opts = {}) {
  const inner = {
    0: y({ 2: [parts] }),
    2: modelApiKey,          // NOTE: index 2, not 1 (different from t2v!)
    3: aspectCode,           // NOTE: index 3, not 2!
    5: Ae(),
  };
  
  // Reference media IDs (uploaded images)
  if (refMediaIds.length)
    inner[1] = refMediaIds.map(id => y({ 1: id }));  // index 1 = ref media
  
  // Character entity IDs
  if (opts.referenceEntityIds?.length)
    inner[9] = opts.referenceEntityIds.map(id => y({ 0: id }));
  
  if (opts.seed != null) inner[4] = opts.seed;
  
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}
```

---

### 5.8 — Video Edit / Extend

**Config key:** `video_edit`

```javascript
function buildVideoEditPayload(projectId, captchaToken, modelApiKey, sourceMediaId, parts, endFrame, aspectCode, opts = {}) {
  const inner = {
    0: [null, sourceMediaId, opts.startFrame ?? 0, endFrame], // [null, mediaId, startFrame, endFrame]
    1: [null, null, [parts]],                                  // [null, null, [[...parts]]]
    2: modelApiKey,
    3: aspectCode,
    4: [null, null, null, null, G(), G()],                    // 4 nulls + 2 UUIDs
  };
  
  // Reference media for editing
  if (opts.refMediaIds?.length)
    inner[8] = opts.refMediaIds.map(id => [null, id]);
  
  // Special: 360p models need index 12
  if (String(modelApiKey).endsWith('_360p'))
    inner[12] = [4];
  
  return [
    [y(inner)],                     // index 0: payload array
    z(projectId, captchaToken),     // index 1: recaptcha context
    [G(), 1],                       // index 2: [UUID, 1]
  ];
}
```

---

### 5.9 — Video Poll (Check Status)

**Config key:** `video_poll`

```javascript
function buildPollPayload(mediaIds) {
  return [
    null,                          // index 0: null
    null,                          // index 1: null
    mediaIds.map(id => [id]),      // index 2: [[mediaId1], [mediaId2], ...]
  ];
}
```

**Response Parser:**
```javascript
function parsePollResult(data) {
  // data[2] = array of status objects
  return (data?.[2] ?? []).map(r => ({
    mediaId:      r?.[0],         // string
    status:       r?.[5]?.[8]?.[0], // number: 3=done, 4=error
    done:         r?.[5]?.[8]?.[0] === 3,
    error:        r?.[5]?.[8]?.[0] === 4,
    errorMessage: r?.[5]?.[8]?.[2]?.[0], // string
    bytes:        r?.[5]?.[13],   // number (file size)
  }));
}

// Status codes:
// 3 → DONE (generation complete, fetch video URL)
// 4 → ERROR (generation failed)
// any other → still processing
```

---

### 5.10 — Get Media Info

**Config key:** `get_media`

```javascript
function buildGetMediaPayload(mediaId) {
  return [mediaId]; // just an array with the mediaId string
}
```

**Response Parser:**
```javascript
function parseGetMedia(data) {
  return {
    workflowId: data?.[2],          // string
    videoUrl:   data?.[7]?.[0]?.[8], // CDN video URL (mp4)
    thumbUrl:   data?.[5]?.[10],     // thumbnail URL
    status:     data?.[5]?.[8]?.[0], // number
    bytes:      data?.[5]?.[13],     // number
  };
}
```

---

### 5.11 — Video Upscale

**Config key:** `video_upscale`

```javascript
function buildVideoUpscalePayload(projectId, captchaToken, sourceMediaId, workflowId, aspectCode, upscaleResCode, modelKey, batchId = null) {
  return [
    [y({
      0:  y({ 1: sourceMediaId }),           // source media
      2:  aspectCode,                         // numeric aspect
      4:  y({ 1: workflowId, 4: G() }),       // workflow reference + UUID
      6:  upscaleResCode,                     // numeric resolution code
      31: modelKey,                           // upscale model key
    })],
    z(projectId, captchaToken),              // recaptcha context
    y({ 0: batchId ?? G() }),               // batch ID
  ];
}
```

**Response:** Same as video submit — `parseVideoSubmit(data)`.

---

### 5.12 — Video Submit Response (Shared)

Used by: `video_text`, `video_start_image`, `video_start_end_image`, `video_reference_images`, `video_upscale`

```javascript
function parseVideoSubmit(data) {
  return {
    credits:     data?.[1],                                     // number (credits used)
    mediaIds:    (data?.[3] ?? []).map(n => n?.[0]).filter(Boolean),  // string[] 
    workflowIds: (data?.[2] ?? []).map(n => n?.[0]).filter(Boolean),  // string[]
  };
}
```

---

### 5.13 — Audio Generate (TTS)

**Config key:** `audio_generate`

```javascript
function buildAudioPayload(projectId, captchaToken, text, voiceName, label, opts = {}) {
  return [
    [y({
      0: y({ 1: text }),                        // text content
      2: opts.model ?? 'gemini_v4s_tts_flow',  // TTS model
      3: opts.performance ?? '',                // performance style
      4: 2,                                     // always 2
    })],
    z(projectId, captchaToken),                 // recaptcha context
  ];
}
```

---

### 5.14 — Create Project

**Config key:** `project_create`

```javascript
function buildProjectCreatePayload(displayName) {
  return [
    'projects/*',                      // fixed string
    y({ 1: y({ 0: displayName }) }),   // display name
    y({ 1: 22 }),                      // fixed: {1: 22}
  ];
}
// Response: data[0] = projectId string
```

---

### 5.15 — Get Credits

**Config key:** `get_credits`

```javascript
const payload = []; // empty array
```

**Response Parser:**
```javascript
const TIER_NAMES = {
  0:'UNSPECIFIED', 1:'PRO', 2:'ULTRA', 3:'FREE',
  4:'UNSUBSCRIBED_WITH_CREDITS', 5:'ZERO', 6:'EXEMPT',
  7:'GEMNOVA', 8:'ULTRA1P5',
};

function parseCredits(data) {
  const tierCode = data?.[1];
  return {
    credits:  data?.[0],                               // number
    tierCode: tierCode,                                // number
    tier:     TIER_NAMES[tierCode] ?? 'Unknown',       // string
  };
}
```

---

## §6. Error Handling

### HTTP Error Mapping
```javascript
function handleHttpError(httpStatus, responseBody, mediaType) {
  const retryAfter30s = { retry: true,  afterMs: 30000 };
  const noRetry       = { retry: false };
  const retry5s       = { retry: true,  afterMs: 5000 };

  switch (httpStatus) {
    case 400:
      // Image: might be retriable. Video/violation: not retriable
      return { retry: mediaType === 'image', code: '400' };
    case 401:
      return { ...retryAfter30s, code: '401', hint: 'session expired' };
    case 403:
      return { ...retryAfter30s, code: '403' };
    case 429:
      const reason = responseBody?.status ?? '';
      if (reason.includes('THROTTLED') || reason.includes('TOO_MUCH_TRAFFIC'))
        return { ...retryAfter30s, code: '429', hint: 'service overloaded' };
      // RESOURCE_EXHAUSTED = quota gone
      return { ...noRetry, code: '429', hint: 'quota exhausted' };
    default:
      return { ...retry5s, code: String(httpStatus) };
  }
}
```

### Violation Error Codes
```javascript
// These error tokens in response indicate content policy violations:
const VIOLATIONS = [
  { tokens: ['IP_PROHIBITED'],                 key: 'ip_prohibited' },
  { tokens: ['PROMINENT_PERSON', 'PROMINENT_PEOPLE'], key: 'prominent_people' },
  { tokens: ['SEXUAL_UPLOAD', 'SEXUAL'],       key: 'sexual_content' },
  { tokens: ['MINOR_UPLOAD', 'MINOR'],         key: 'minor_content' },
];
// These are NOT retriable — stop and report.
```

---

## §7. Complete Request Example (Node.js)

```javascript
// Full example: generate a video and get the URL

const auth = { at: 'YOUR_AT', bl: 'YOUR_BL', sid: 'YOUR_SID', authIndex: '0' };
const rc   = { /* see PROTOCOL.md §8 for rc structure */ };

// 1. Build the payload
const parts      = [['A mountain lake at golden hour']];  // fe(text) = [text]
const aspectCode = rc.video_aspects['landscape'];          // e.g. 1
const modelKey   = 'veo_3_1_t2v_lite';                    // from rc model_mappings
const captcha    = 'YOUR_RECAPTCHA_TOKEN';
const projectId  = 'YOUR_PROJECT_ID';

const inner = {
  0: { 2: [parts] },  // but we use y() to build sparse arrays!
  1: modelKey,
  2: aspectCode,
  4: { 4: crypto.randomUUID().toUpperCase(), 5: crypto.randomUUID().toUpperCase() },
};
// ... (use y() to convert all objects to arrays — see payload-builders.js)

// 2. Send request
const { url, body } = buildBatchRequest(rc.flow_google, auth, rc.rpcids.video_text, payload);
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-Same-Domain': '1', 'Cookie': YOUR_COOKIES },
  body,
});

// 3. Parse response
const { results } = parseResponse(await response.text());
const { mediaIds } = parseVideoSubmit(results[0].data);

// 4. Poll until done
let videoUrl = '';
while (!videoUrl) {
  await new Promise(r => setTimeout(r, 5000)); // wait 5s
  const statuses = parsePollResult(await callRPC(rc.rpcids.video_poll, buildPollPayload(mediaIds)));
  if (statuses[0].done) {
    const media = parseGetMedia(await callRPC(rc.rpcids.get_media, [mediaIds[0]]));
    videoUrl = media.videoUrl;
  }
}

console.log('Video URL:', videoUrl);
```

---

## §8. Remote Config (rc) Structure

The `rc` object is delivered from the license server (or can be sniffed from network).  
Here's the complete expected shape:

```javascript
const rc = {
  flow_google: {
    // URLs
    origin:             'https://flow.google.com',
    app_name:           'FlowUi',
    source_path:        '/flow/{auth_index}',
    batchexecute_path:  '/_/FlowUi/data/batchexecute?authuser={auth_index}',
    upload_video_path:  '/u/{auth_index}/video/upload?project_id={project_id}',
    
    // reCAPTCHA
    captcha_site_key:   '6Ld...',
    captcha_page_url:   'https://flow.google.com/project/...',
    captcha_script_url: 'https://www.google.com/recaptcha/enterprise.js?render={site_key}',
    captcha_actions: {
      image:        'GENERATE_IMAGE',
      video:        'GENERATE_VIDEO',
      audio:        'GENERATE_AUDIO',
      upload_image: 'UPLOAD_IMAGE',
    },
    
    // RPC IDs (the actual short strings sent to batchexecute)
    rpcids: {
      image_generate:         'YhhmEf',  // example — actual values from server
      image_upload:           'jwpduf',
      image_upscale:          'as29s',
      video_text:             'UpteDb',
      video_start_image:      'WuwhI',
      video_start_end_image:  'xxxYYY',
      video_reference_images: 'aaaBBB',
      video_poll:             'ccDDee',
      get_media:              'ffGGhh',
      video_upscale:          'iiJJkk',
      video_edit:             'llMMnn',
      entity_create:          'ooPPqq',
      entity_update:          'rrSStt',
      media_set_visibility:   'uuVVww',
      workflow_set_name:      'xxYYzz',
      audio_generate:         'aabb11',
      get_credits:            'ccdd22',
      project_create:         'eeff33',
    },
    
    // Aspect ratio maps (string → numeric code)
    image_aspects: {
      '1:1':  1,
      '16:9': 2,
      '9:16': 3,
      '4:3':  4,
      '3:4':  5,
    },
    video_aspects: {
      'landscape': 1,  // VIDEO_ASPECT_RATIO_LANDSCAPE
      'portrait':  2,  // VIDEO_ASPECT_RATIO_PORTRAIT
    },
    
    // Upscale level maps
    image_upscale_levels: { '2K': 1, '4K': 2 },
    video_upscale_res:    { '1080p': 1, '4K': 2 },
  },
  
  // Image models configuration
  image_models: {
    models: {
      'NanoBanana': {
        label: 'Gemini Image 3',
        api_model: 'gemini_v4_img_flow',
        enabled: true,
        order: 1,
        max_refs: 4,
        supports_upscale: true,
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        isFlow: true,
      },
      // ... other image models
    },
    aspect_ratios: {
      '1:1':  'IMAGE_ASPECT_RATIO_SQUARE',
      '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
      '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
    },
    flow_models: ['NanoBanana'],
  },
  
  // Video model mappings: displayKey → {mode → {orientation → {tier → modelApiKey}}}
  t2v_models: { 'Veo 3.1': 'veo_3_1_t2v_lite', ... },
  model_mappings: {
    'veo3': {
      t2v:      { landscape: { FREE: 'veo_3_t2v', ULTRA: 'veo_3_t2v_ultra' }, portrait: {...} },
      i2v:      { landscape: {...}, portrait: {...} },
      i2v_end:  { landscape: {...}, portrait: {...} },
      r2v:      { landscape: {...}, portrait: {...} },
    },
    // ...
  },
  
  // Video duration options
  video_duration: {
    options_seconds:  [5, 8, 10],
    default_seconds:  8,
    ultra_only_seconds: [10],
  },
  
  // Tier limits
  tier_limits: {
    max_threads:             4,
    max_prompts:             50,
    max_images_per_prompt:   4,
    max_queue_tasks:         100,
    allow_upscale_2k:        true,
    allow_upscale_4k:        true,
    allowed_video_tabs:      [0, 1],
    allow_ref_modes:         ['manual', 'chain', 'ingredients'],
  },
};
```
