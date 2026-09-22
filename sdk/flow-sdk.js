/**
 * flow-sdk.js — Standalone Flow.google.com API SDK
 *
 * No external dependencies required.
 * Works in Node.js 18+ (uses built-in fetch and crypto).
 *
 * USAGE:
 *   const { FlowSDK } = require('./flow-sdk');
 *
 *   const sdk = new FlowSDK({
 *     at:        'YOUR_SNlM0e',    // from WIZ_global_data
 *     bl:        'YOUR_cfb2h',     // from WIZ_global_data
 *     sid:       'YOUR_FdrFJe',    // from WIZ_global_data
 *     authIndex: '0',              // from URL /u/0/
 *     rc:        yourRcConfig,     // from license server or network sniff
 *     cookies:   'SID=xxx; ...',   // Google session cookies
 *   });
 *
 * See examples.js for complete working examples.
 * See PROTOCOL.md for detailed payload documentation.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// PART 1: SPARSE ARRAY UTILITIES
// These functions are essential — every API payload uses them.
// ═══════════════════════════════════════════════════════════════

/**
 * y(indexMap) — Converts an object with numeric keys into a sparse array.
 *
 * Why? Flow's API encodes structured data as arrays with specific indexes,
 * using null to fill gaps. Example:
 *   y({ 0: 'hello', 3: 'world' }) → ['hello', null, null, 'world']
 *
 * This function is used to build EVERY payload in the API.
 */
function y(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const keys = Object.keys(obj).map(Number).filter(n => !isNaN(n));
  if (!keys.length) return [];
  const max = Math.max(...keys);
  const arr = new Array(max + 1).fill(null);
  for (const k of keys) arr[k] = obj[k];
  return arr;
}

/**
 * G() — Generate a fresh UUID in UPPERCASE format.
 * Used for batch IDs, item IDs, and unique identifiers in payloads.
 */
function G() {
  // Use crypto.randomUUID if available (Node 14.17+, browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().toUpperCase();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  }).toUpperCase();
}

/**
 * randomSeed() — Generate a random integer for use as a generation seed.
 * Same seed + same prompt = reproducible outputs.
 */
function randomSeed() {
  return Math.floor(1e5 + Math.random() * (2 ** 31 - 1e5));
}

/**
 * z(captchaToken, modelKey, version) — Build reCAPTCHA context array.
 *
 * This array is included in EVERY API payload and tells the server:
 * - The reCAPTCHA proof (captchaToken)
 * - Which model to use (modelKey)
 * - The API version (22)
 *
 * Structure: [null, 22, null, null, null, captchaToken, ...(10 items)..., [modelKey, 1]]
 */
function z(captchaToken = null, modelKey = null, version = 22) {
  const n = { 1: version };
  if (captchaToken) n[5] = captchaToken;
  if (modelKey) n[10] = y({ 0: modelKey, 1: 1 });
  return y(n);
}

/**
 * fe(text) — Create a plain text content part.
 * Used as the most basic element of a "prompt".
 */
function fe(text) {
  return y({ 0: text }); // → [text]
}

/**
 * Pr(mediaId, handle) — Create a media reference content part.
 * Used to reference a previously uploaded image/video in a prompt.
 */
function Pr(mediaId, handle = '') {
  return y({ 1: y({ 0: y({ 0: mediaId, 1: handle }) }) });
}

/**
 * Ur(entityId, handle) — Create a character entity reference part.
 * Used to reference a character created via entity_create.
 */
function Ur(entityId, handle = '') {
  return y({ 1: y({ 2: y({ 0: entityId, 1: handle }) }) });
}

/**
 * Ae() — Create a batch UUID pair container.
 * Used to track batches of video generation requests.
 */
function Ae() {
  return y({ 4: G(), 5: G() });
}

/**
 * Le(mediaId) — Wrap a mediaId for use as a video start/end frame.
 * Used in i2v (image-to-video) and first_last (first+last frame) modes.
 */
function Le(mediaId) {
  return y({ 1: mediaId, 5: y({ 2: 1, 3: 1 }) });
}

/**
 * me(items, projectId, captchaToken, batchId, audioPref) — Video payload wrapper.
 * All video generation payloads use this as their outer structure.
 *
 * @param items       Array of payload items (already y()-wrapped)
 * @param projectId   The Flow project ID
 * @param captchaToken reCAPTCHA token
 * @param batchId     Optional batch UUID (generated if null)
 * @param audioPref   1 = with audio (default), 0 = no audio
 */
function me(items, projectId, captchaToken, batchId = null, audioPref = 1) {
  return [
    [...items],                              // index 0: the payload items
    z(projectId, captchaToken),             // index 1: reCAPTCHA context
    [batchId ?? G(), audioPref],            // index 2: [batchId, audioPref]
  ];
}

// ═══════════════════════════════════════════════════════════════
// PART 2: HTTP REQUEST BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * buildBatchRequest(cfg, auth, rpcId, payload)
 * Constructs the complete HTTP request for a batchexecute call.
 *
 * @param {object} cfg    flow_google config from rc
 * @param {object} auth   {at, bl, sid, authIndex}
 * @param {string} rpcId  The RPC identifier (e.g., 'YhhmEf')
 * @param {any}    payload The request payload (will be JSON.stringify'd)
 * @returns {{ url, method, headers, body }}
 */
function buildBatchRequest(cfg, auth, rpcId, payload) {
  // Replace template placeholders in URL paths
  const batchPath  = (cfg.batchexecute_path ?? '/_/FlowUi/data/batchexecute')
    .replace('{auth_index}', auth.authIndex)
    .replace('{app_name}',   cfg.app_name ?? 'FlowUi');

  const sourcePath = (cfg.source_path ?? '/flow/{auth_index}')
    .replace('{auth_index}', auth.authIndex);

  const origin = cfg.origin ?? 'https://flow.google.com';
  const reqid  = String(Math.floor(100000 + Math.random() * 900000));

  // Query string parameters
  const qs = new URLSearchParams({
    rpcids:        rpcId,
    'source-path': sourcePath,
    bl:            auth.bl   ?? '',
    'f.sid':       auth.sid  ?? '',
    hl:            'en',
    _reqid:        reqid,
    rt:            'c',
  });

  const url = `${origin}${batchPath}?${qs}`;

  // Request body: f.req is triple-nested: [[[rpcId, jsonPayload, null, "generic"]]]
  const body = new URLSearchParams({
    'f.req': JSON.stringify([[[rpcId, JSON.stringify(payload), null, 'generic']]]),
    at:      auth.at ?? '',  // CSRF token
  }).toString();

  return {
    url,
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded;charset=UTF-8',
      'X-Same-Domain': '1',
    },
    body,
  };
}

// ═══════════════════════════════════════════════════════════════
// PART 3: RESPONSE PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * parseResponse(rawText)
 * Parses the raw batchexecute response text.
 *
 * The response format is:
 *   )]}'\n
 *   [["wrb.fr","RPC_ID","JSON_DATA",null,null,null,FLAG]]
 *   [["di",45]]
 *   ...
 *
 * @returns {{ results: Array, errors: Array }}
 *   results[i] = { rpcid, data, nullPayload, flag }
 *   errors[i]  = { http, code }
 */
function parseResponse(rawText) {
  // Remove the security prefix
  if (rawText.startsWith(")]}'")) rawText = rawText.slice(4);

  // Extract all top-level JSON array blocks
  const chunks = [];
  let i = 0;
  while (i < rawText.length) {
    const start = rawText.indexOf('[', i);
    if (start < 0) break;

    let depth = 0, inString = false, escaped = false, end = -1;
    for (let j = start; j < rawText.length; j++) {
      const ch = rawText[j];
      if (inString) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"')  { inString = false; continue; }
        continue;
      }
      if (ch === '"')      inString = true;
      else if (ch === '[') depth++;
      else if (ch === ']') { if (--depth === 0) { end = j; break; } }
    }
    if (end < 0) break;
    try { chunks.push(JSON.parse(rawText.slice(start, end + 1))); } catch {}
    i = end + 1;
  }

  // Classify rows
  const results = [], errors = [];
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;
    for (const row of chunk) {
      if (!Array.isArray(row) || !row.length) continue;
      if (row[0] === 'wrb.fr') {
        const raw = row[2]; // May be null on error
        results.push({
          rpcid:       row[1] ?? null,
          data:        raw != null ? JSON.parse(raw) : null,
          nullPayload: raw == null,
          flag:        row[5] ?? null,
        });
      } else if (row[0] === 'er') {
        errors.push({ http: row[5] ?? null, code: row[9] ?? null });
      }
    }
  }
  return { results, errors };
}

// ═══════════════════════════════════════════════════════════════
// PART 4: RESPONSE DATA ACCESSORS
// Helper to safely access nested array values
// ═══════════════════════════════════════════════════════════════

function I(obj, ...path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    if (Array.isArray(cur) && typeof k === 'number') {
      cur = cur[k < 0 ? cur.length + k : k];
    } else if (typeof cur === 'object' && k in cur) {
      cur = cur[k];
    } else {
      return undefined;
    }
  }
  return cur;
}

const xStr = v => (typeof v === 'string' ? v : v == null ? null : String(v));
const xNum = v => (typeof v === 'number' ? v : null);

// ─── Individual Response Parsers ───

/** Parse image generate response → { mediaId, workflowId, width, height, url, seed } */
function parseImageResult(data) {
  return {
    mediaId:    xStr(I(data, 0, 0, 0)),
    workflowId: xStr(I(data, 0, 0, 2)),
    width:      xNum(I(data, 0, 0, 6, 2, 0)),
    height:     xNum(I(data, 0, 0, 6, 2, 1)),
    url:        xStr(I(data, 0, 0, 6, 0, 13)), // CDN URL
    seed:       xNum(I(data, 0, 0, 6, 0, 1)),
  };
}

/** Parse video submit response → { credits, mediaIds[], workflowIds[] } */
function parseVideoSubmit(data) {
  return {
    credits:     xNum(I(data, 1)),
    mediaIds:    (I(data, 3) ?? []).map(n => xStr(I(n, 0))).filter(Boolean),
    workflowIds: (I(data, 2) ?? []).map(n => xStr(I(n, 0))).filter(Boolean),
  };
}

/** Parse video poll response → Array of { mediaId, status, done, error, errorMessage } */
function parsePollResult(data) {
  return (I(data, 2) ?? []).map(r => ({
    mediaId:      xStr(I(r, 0)),
    status:       xNum(I(r, 5, 8, 0)),   // 3=done, 4=error
    done:         I(r, 5, 8, 0) === 3,
    error:        I(r, 5, 8, 0) === 4,
    errorMessage: xStr(I(r, 5, 8, 2, 0)),
    bytes:        xNum(I(r, 5, 13)),
  }));
}

/** Parse get_media response → { workflowId, videoUrl, thumbUrl, status, bytes } */
function parseGetMedia(data) {
  return {
    workflowId: xStr(I(data, 2)),
    videoUrl:   xStr(I(data, 7, 0, 8)),  // direct mp4 URL
    thumbUrl:   xStr(I(data, 5, 10)),
    status:     xNum(I(data, 5, 8, 0)),
    bytes:      xNum(I(data, 5, 13)),
  };
}

/** Parse image upload response → { mediaId, workflowId, width, height, bytes } */
function parseImageUpload(data) {
  return {
    mediaId:    xStr(I(data, 0, 0)),
    workflowId: xStr(I(data, 0, 2)),
    width:      xNum(I(data, 0, 6, 2, 0)),
    height:     xNum(I(data, 0, 6, 2, 1)),
    bytes:      xNum(I(data, 0, 5, 13)),
  };
}

/** Parse entity create response → { projectId, entityId } */
function parseEntityCreate(data) {
  return {
    projectId: xStr(I(data, 0, 0)),
    entityId:  xStr(I(data, 0, 1)),
  };
}

/** Tier name lookup */
const TIER_NAMES = {
  0:'UNSPECIFIED', 1:'PRO', 2:'ULTRA', 3:'FREE',
  4:'UNSUBSCRIBED_WITH_CREDITS', 5:'ZERO', 6:'EXEMPT',
  7:'GEMNOVA', 8:'ULTRA1P5',
};

/** Parse get_credits response → { credits, tierCode, tier } */
function parseCredits(data) {
  const tierCode = xNum(I(data, 1));
  return {
    credits:  xNum(I(data, 0)),
    tierCode: tierCode,
    tier:     tierCode != null ? (TIER_NAMES[tierCode] ?? 'Unknown') : 'Unknown',
  };
}

/** Find base64 image string buried in upscale response */
function findBase64(data) {
  let best = '';
  function search(node) {
    if (typeof node === 'string' && node.length > 2000) {
      const s   = node.slice(0, 200);
      const ok  = [...s].filter(c => /[A-Za-z0-9+/=\-_]/.test(c)).length;
      if (ok >= s.length - 2 && node.length > best.length) best = node;
    } else if (Array.isArray(node)) {
      for (const c of node) search(c);
    } else if (node && typeof node === 'object') {
      for (const c of Object.values(node)) search(c);
    }
  }
  search(data);
  return best || null;
}

// ═══════════════════════════════════════════════════════════════
// PART 5: PAYLOAD BUILDERS
// One function per API operation.
// ═══════════════════════════════════════════════════════════════

function buildImageGeneratePayload(modelApiKey, captchaToken, aspectCode, parts, opts = {}) {
  const captchaCtx = z(captchaToken, modelApiKey);
  const inner = {
    3:  opts.seed ?? randomSeed(),
    4:  aspectCode,
    5:  modelApiKey,
    7:  captchaCtx,
    8:  [parts],
    12: G(),
    13: G(),
  };
  if (opts.imageInputIds?.length)
    inner[2] = opts.imageInputIds.map(id => y({ 0: id, 4: 1 }));
  if (opts.referenceEntityIds?.length)
    inner[10] = opts.referenceEntityIds.map(id => y({ 0: id }));
  const batchId = opts.batchId ?? G();
  return [null, [y(inner)], 1, captchaCtx, y({ 0: batchId })];
}

function buildImageUploadPayload(modelApiKey, captchaToken, base64Data, mimeType, aspectCode, opts = {}) {
  const inner = {
    0:  z(modelApiKey, captchaToken),
    1:  base64Data,
    2:  mimeType,
    3:  aspectCode,
    8:  1,
    10: G(),
    11: G(),
  };
  if (opts.entityId)
    inner[9] = y({ 2: y({ 0: opts.entityId, 1: y({ 0: opts.imageReferenceIndex ?? 0 }) }) });
  return y(inner);
}

function buildImageUpscalePayload(mediaId, upscaleLevelCode, captchaToken) {
  return [mediaId, upscaleLevelCode, z(null, captchaToken)];
}

function buildT2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, opts = {}) {
  const inner = { 0: y({ 2: [parts] }), 1: modelApiKey, 2: aspectCode, 4: Ae() };
  if (opts.seed != null) inner[3] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}

function buildI2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, startMediaId, opts = {}) {
  const inner = { 0: y({ 2: [parts] }), 1: modelApiKey, 2: aspectCode, 4: Le(startMediaId), 5: Ae() };
  if (opts.seed != null) inner[3] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}

function buildFirstLastPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, startMediaId, endMediaId, opts = {}) {
  const inner = { 0: y({ 2: [parts] }), 1: modelApiKey, 2: aspectCode, 4: Le(startMediaId), 5: Le(endMediaId), 6: Ae() };
  if (opts.seed != null) inner[3] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}

function buildR2VPayload(projectId, captchaToken, modelApiKey, parts, aspectCode, refMediaIds = [], opts = {}) {
  const inner = { 0: y({ 2: [parts] }), 2: modelApiKey, 3: aspectCode, 5: Ae() };
  if (refMediaIds.length) inner[1] = refMediaIds.map(id => y({ 1: id }));
  if (opts.referenceEntityIds?.length) inner[9] = opts.referenceEntityIds.map(id => y({ 0: id }));
  if (opts.seed != null) inner[4] = opts.seed;
  return me([y(inner)], projectId, captchaToken, opts.batchId, opts.audioPref ?? 1);
}

function buildVideoEditPayload(projectId, captchaToken, modelApiKey, sourceMediaId, parts, endFrame, aspectCode, opts = {}) {
  const inner = {
    0: [null, sourceMediaId, opts.startFrame ?? 0, endFrame],
    1: [null, null, [parts]],
    2: modelApiKey,
    3: aspectCode,
    4: [null, null, null, null, G(), G()],
  };
  if (opts.refMediaIds?.length) inner[8] = opts.refMediaIds.map(id => [null, id]);
  if (String(modelApiKey).endsWith('_360p')) inner[12] = [4];
  return [[y(inner)], z(projectId, captchaToken), [G(), 1]];
}

function buildPollPayload(mediaIds) {
  return [null, null, mediaIds.map(id => [id])];
}

function buildVideoUpscalePayload(projectId, captchaToken, sourceMediaId, workflowId, aspectCode, upscaleResCode, modelKey, batchId = null) {
  return [
    [y({ 0: y({ 1: sourceMediaId }), 2: aspectCode, 4: y({ 1: workflowId, 4: G() }), 6: upscaleResCode, 31: modelKey })],
    z(projectId, captchaToken),
    y({ 0: batchId ?? G() }),
  ];
}

function buildAudioPayload(projectId, captchaToken, text, voiceName, label, opts = {}) {
  return [
    [y({ 0: y({ 1: text }), 2: opts.model ?? 'gemini_v4s_tts_flow', 3: opts.performance ?? '', 4: 2 })],
    z(projectId, captchaToken),
  ];
}

function buildProjectCreatePayload(displayName) {
  return ['projects/*', y({ 1: y({ 0: displayName }) }), y({ 1: 22 })];
}

function buildEntityCreatePayload(projectId, name = 'Untitled character') {
  return [y({ 0: projectId, 3: y({ 0: 1, 1: name, 2: [] }) })];
}

// ═══════════════════════════════════════════════════════════════
// PART 6: FlowSDK CLASS
// High-level API — use this in your code.
// ═══════════════════════════════════════════════════════════════

class FlowSDK {
  /**
   * Create a new FlowSDK instance.
   *
   * @param {object} opts
   * @param {string}   opts.at          WIZ_global_data.SNlM0e — CSRF token (REQUIRED)
   * @param {string}   opts.bl          WIZ_global_data.cfb2h  — build label
   * @param {string}   opts.sid         WIZ_global_data.FdrFJe — session ID
   * @param {string}   opts.authIndex   From URL /u/{N}/ — usually '0'
   * @param {object}   opts.rc          Remote config object (rc.flow_google or full rc)
   * @param {string}   opts.cookies     Cookie header string for Node.js requests
   * @param {Function} opts.fetchFn     Custom fetch function (default: global fetch)
   */
  constructor(opts = {}) {
    this.auth = {
      at:        opts.at        ?? '',
      bl:        opts.bl        ?? '',
      sid:       opts.sid       ?? '',
      authIndex: opts.authIndex ?? '0',
    };
    // Accept either full rc or rc.flow_google directly
    this.cfg     = opts.rc?.flow_google ?? opts.rc ?? {};
    this.cookies = opts.cookies ?? '';
    this.fetch   = opts.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : null);

    if (!this.fetch) {
      throw new Error('No fetch available. Pass opts.fetchFn or use Node.js 18+.');
    }
  }

  /** Get RPC ID string from config */
  rpcid(name) {
    const id = this.cfg.rpcids?.[name];
    if (!id) throw new Error(`RPC ID '${name}' not found in rc.rpcids. Check your rc config.`);
    return id;
  }

  /** Resolve aspect ratio string to numeric code */
  imageAspect(aspect)      { return this._numMap('image_aspects', aspect); }
  videoAspect(aspect)      { return this._numMap('video_aspects', aspect); }
  imageUpscaleLevel(res)   { return this._numMap('image_upscale_levels', res); }
  videoUpscaleRes(res)     { return this._numMap('video_upscale_res', res); }

  _numMap(key, val) {
    if (typeof val === 'number') return val; // already numeric
    const map = this.cfg[key];
    if (!map) throw new Error(`Config map '${key}' missing from rc. Check your rc config.`);
    let v = map[val] ?? map[String(val).toLowerCase()];
    if (v === undefined) throw new Error(`'${val}' not found in rc.${key}`);
    return v;
  }

  /**
   * Execute a batchexecute RPC call.
   * This is the core HTTP function used by all other methods.
   *
   * @param {string} rpcId    RPC identifier string
   * @param {any}    payload  Request payload (built by builder functions)
   * @param {number} [timeoutMs=180000]  Timeout in milliseconds
   * @returns {any} Parsed response data
   */
  async call(rpcId, payload, timeoutMs = 180000) {
    const req = buildBatchRequest(this.cfg, this.auth, rpcId, payload);

    // Add cookies for Node.js (browsers handle cookies automatically)
    if (this.cookies) req.headers['Cookie'] = this.cookies;

    // Set up timeout
    let controller, timer;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer      = setTimeout(() => controller.abort(), timeoutMs);
    }

    let resp;
    try {
      resp = await this.fetch(req.url, {
        method:  req.method,
        headers: req.headers,
        body:    req.body,
        signal:  controller?.signal,
      });
    } finally {
      if (timer) clearTimeout(timer);
    }

    const text           = await resp.text();
    const { results, errors } = parseResponse(text);

    // Handle HTTP errors
    if (resp.status === 401) throw new Error('401 UNAUTHENTICATED — session expired, re-extract tokens');
    if (resp.status === 400) throw new Error('400 INVALID_ARGUMENT — at token invalid, refresh WIZ_global_data');
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status} — ${text.slice(0, 200)}`);
    if (!results.length)     throw new Error('No wrb.fr row in response — unexpected format');

    const row = results[0];
    if (row.nullPayload) {
      const errInfo = errors[0];
      const code    = errInfo?.code ?? 'unknown';
      const http    = errInfo?.http ?? resp.status;
      throw Object.assign(
        new Error(`Generation failed (${http}/${code}) — flag: ${JSON.stringify(row.flag)}`),
        { httpStatus: http, grpcCode: code, flag: row.flag }
      );
    }

    return row.data;
  }

  // ─────────────────────────────────────────────
  // IMAGE METHODS
  // ─────────────────────────────────────────────

  /**
   * Generate one or more images.
   *
   * @param {object} p
   * @param {string}   p.prompt          Text prompt
   * @param {string}   p.modelApiKey     Model API key (e.g., 'gemini_v4_img_flow')
   * @param {string|number} p.aspect     Aspect ratio ('1:1', '16:9', etc.) or numeric code
   * @param {string}   p.projectId       Flow project ID
   * @param {string}   p.captchaToken    reCAPTCHA token (from grecaptcha.enterprise.execute)
   * @param {number}   [p.seed]          Seed for reproducibility
   * @param {string[]} [p.refMediaIds]   Reference image media IDs
   * @param {string[]} [p.entityIds]     Character entity IDs
   * @param {Array}    [p.structuredParts] Custom parts array (overrides prompt)
   * @returns {{ mediaId, workflowId, url, width, height, seed }}
   */
  async generateImage(p) {
    const aspectCode = this.imageAspect(p.aspect);
    const parts      = p.structuredParts ?? [fe(p.prompt)];

    const payload = buildImageGeneratePayload(
      p.modelApiKey, p.captchaToken, aspectCode, parts,
      { seed: p.seed, imageInputIds: p.refMediaIds, referenceEntityIds: p.entityIds }
    );

    const data = await this.call(this.rpcid('image_generate'), payload);
    return parseImageResult(data);
  }

  /**
   * Upload a reference image (for use as refMediaId in subsequent calls).
   *
   * @param {object} p
   * @param {string}   p.modelApiKey     Model API key
   * @param {string}   p.captchaToken    reCAPTCHA token (use 'upload_image' action)
   * @param {string}   p.base64Data      Base64-encoded image (without 'data:...' prefix)
   * @param {string}   p.mimeType        MIME type (e.g., 'image/jpeg')
   * @param {string|number} p.aspect     Aspect ratio
   * @param {string}   [p.entityId]      Character entity ID to associate with
   * @returns {{ mediaId, workflowId, width, height, bytes }}
   */
  async uploadImage(p) {
    const aspectCode = this.imageAspect(p.aspect);
    const payload = buildImageUploadPayload(
      p.modelApiKey, p.captchaToken, p.base64Data, p.mimeType, aspectCode,
      { entityId: p.entityId, imageReferenceIndex: p.imageReferenceIndex ?? 0 }
    );
    const data = await this.call(this.rpcid('image_upload'), payload);
    return parseImageUpload(data);
  }

  /**
   * Upscale an image to 2K or 4K resolution.
   * IMPORTANT: Only works on Flow-generated images, not uploaded references.
   *
   * @param {object} p
   * @param {string} p.mediaId       Media ID of the image to upscale
   * @param {string} p.resolution    '2K' or '4K'
   * @param {string} p.captchaToken  reCAPTCHA token (use 'image' action)
   * @returns {string} Base64 JPEG string of the upscaled image
   */
  async upscaleImage(p) {
    const levelCode = this.imageUpscaleLevel(p.resolution);
    const payload   = buildImageUpscalePayload(p.mediaId, levelCode, p.captchaToken);
    const data      = await this.call(this.rpcid('image_upscale'), payload);
    const b64       = findBase64(data);
    if (!b64) throw new Error('Upscale returned no image — only Flow-generated images can be upscaled');
    return b64; // base64 JPEG
  }

  // ─────────────────────────────────────────────
  // VIDEO METHODS
  // ─────────────────────────────────────────────

  /**
   * Generate video (supports all modes).
   *
   * @param {object} p
   * @param {'t2v'|'i2v'|'first_last'|'ingredients'} p.mode  Video generation mode
   * @param {string}   p.modelApiKey     Model API key (from rc model_mappings)
   * @param {string}   p.prompt          Text prompt
   * @param {string|number} p.aspect     'landscape' or 'portrait' or numeric code
   * @param {string}   p.projectId       Flow project ID
   * @param {string}   p.captchaToken    reCAPTCHA token (use 'video' action)
   * @param {string}   [p.startMediaId]  Required for i2v and first_last modes
   * @param {string}   [p.endMediaId]    Required for first_last mode
   * @param {string[]} [p.refMediaIds]   Required for ingredients mode
   * @param {string[]} [p.entityIds]     Character entity IDs for ingredients mode
   * @param {number}   [p.seed]          Seed for reproducibility
   * @param {string}   [p.batchId]       Optional batch ID
   * @param {Array}    [p.structuredParts] Custom parts array (overrides prompt)
   * @returns {{ credits, mediaIds[], workflowIds[] }}
   */
  async generateVideo(p) {
    const aspectCode = this.videoAspect(p.aspect);
    const parts      = p.structuredParts ?? [fe(p.prompt)];
    const opts       = { seed: p.seed, batchId: p.batchId, audioPref: p.audioPref };

    const rpcMap = {
      t2v:         'video_text',
      i2v:         'video_start_image',
      first_last:  'video_start_end_image',
      ingredients: 'video_reference_images',
    };

    const rpcKey = rpcMap[p.mode];
    if (!rpcKey) throw new Error(`Invalid mode: '${p.mode}'. Use: t2v, i2v, first_last, ingredients`);

    let payload;
    if (p.mode === 't2v') {
      payload = buildT2VPayload(p.projectId, p.captchaToken, p.modelApiKey, parts, aspectCode, opts);

    } else if (p.mode === 'i2v') {
      if (!p.startMediaId) throw new Error('i2v mode requires startMediaId');
      payload = buildI2VPayload(p.projectId, p.captchaToken, p.modelApiKey, parts, aspectCode, p.startMediaId, opts);

    } else if (p.mode === 'first_last') {
      if (!p.startMediaId || !p.endMediaId) throw new Error('first_last mode requires startMediaId AND endMediaId');
      payload = buildFirstLastPayload(p.projectId, p.captchaToken, p.modelApiKey, parts, aspectCode, p.startMediaId, p.endMediaId, opts);

    } else if (p.mode === 'ingredients') {
      if (!p.refMediaIds?.length && !p.entityIds?.length) throw new Error('ingredients mode requires refMediaIds or entityIds');
      payload = buildR2VPayload(p.projectId, p.captchaToken, p.modelApiKey, parts, aspectCode, p.refMediaIds ?? [], { ...opts, referenceEntityIds: p.entityIds });
    }

    const data = await this.call(this.rpcid(rpcKey), payload);
    return parseVideoSubmit(data);
  }

  /**
   * Edit or extend an existing video.
   *
   * @param {object} p
   * @param {string}   p.sourceMediaId   Media ID of the video to edit
   * @param {string}   p.modelApiKey     Edit model key (from rc.video_edit.model_key)
   * @param {string}   p.prompt          Edit instructions
   * @param {string|number} p.aspect     Aspect ratio
   * @param {string}   p.projectId       Flow project ID
   * @param {string}   p.captchaToken    reCAPTCHA token (use 'video' action)
   * @param {number}   [p.endFrame]      Frame number to edit up to (default 0)
   * @param {number}   [p.startFrame]    Start frame (default 0)
   * @param {string[]} [p.refMediaIds]   Reference media for the edit
   * @returns {{ credits, mediaIds[], workflowIds[] }}
   */
  async editVideo(p) {
    const aspectCode = this.videoAspect(p.aspect);
    const parts      = [fe(p.prompt)];
    const payload    = buildVideoEditPayload(
      p.projectId, p.captchaToken, p.modelApiKey,
      p.sourceMediaId, parts, p.endFrame ?? 0, aspectCode,
      { startFrame: p.startFrame ?? 0, refMediaIds: p.refMediaIds }
    );
    const data = await this.call(this.rpcid('video_edit'), payload);
    return parseVideoSubmit(data);
  }

  /**
   * Poll the status of video generation jobs.
   * Call this repeatedly every ~5 seconds until items show done=true.
   *
   * @param {string[]} mediaIds   Array of media IDs to check
   * @returns {Array<{ mediaId, status, done, error, errorMessage, bytes }>}
   */
  async pollVideo(mediaIds) {
    if (!mediaIds.length) return [];
    const data = await this.call(this.rpcid('video_poll'), buildPollPayload(mediaIds));
    return parsePollResult(data);
  }

  /**
   * Get media info and download URL for a completed video/image.
   *
   * @param {string} mediaId
   * @returns {{ workflowId, videoUrl, thumbUrl, status, bytes }}
   */
  async getMedia(mediaId) {
    const data = await this.call(this.rpcid('get_media'), [mediaId]);
    return parseGetMedia(data);
  }

  /**
   * Upscale a video to 1080p or 4K.
   *
   * @param {object} p
   * @param {string}   p.mediaId       Source media ID
   * @param {string}   p.workflowId    Source workflow ID
   * @param {string|number} p.aspect   Aspect ratio
   * @param {string}   p.resolution    '1080p' or '4K'
   * @param {string}   p.modelKey      Upscale model key (from rc.video.model_upscale_key)
   * @param {string}   p.projectId     Flow project ID
   * @param {string}   p.captchaToken  reCAPTCHA token (use 'video' action)
   * @returns {{ credits, mediaIds[], workflowIds[] }} — new mediaId to poll
   */
  async upscaleVideo(p) {
    const aspectCode = this.videoAspect(p.aspect);
    const resCode    = this.videoUpscaleRes(p.resolution);
    const payload    = buildVideoUpscalePayload(
      p.projectId, p.captchaToken, p.mediaId, p.workflowId,
      aspectCode, resCode, p.modelKey, p.batchId ?? null
    );
    const data = await this.call(this.rpcid('video_upscale'), payload);
    return parseVideoSubmit(data);
  }

  // ─────────────────────────────────────────────
  // ACCOUNT METHODS
  // ─────────────────────────────────────────────

  /**
   * Get credit balance and tier information.
   * @returns {{ credits, tierCode, tier }}
   */
  async getCredits() {
    const data = await this.call(this.rpcid('get_credits'), []);
    return parseCredits(data);
  }

  /**
   * Create a new Flow project.
   * @param {string} displayName  Project display name
   * @returns {string} Project ID
   */
  async createProject(displayName) {
    const data = await this.call(this.rpcid('project_create'), buildProjectCreatePayload(displayName));
    return xStr(I(data, 0)) ?? '';
  }

  // ─────────────────────────────────────────────
  // CHARACTER / ENTITY METHODS
  // ─────────────────────────────────────────────

  /**
   * Create a character entity (for use in character-reference generation).
   * After creating, upload an image to associate with it using uploadImage({ entityId }).
   *
   * @param {string} projectId   Flow project ID
   * @param {string} name        Character display name
   * @returns {string} Entity ID
   */
  async createEntity(projectId, name = 'Untitled character') {
    const data = await this.call(this.rpcid('entity_create'), buildEntityCreatePayload(projectId, name));
    return parseEntityCreate(data).entityId ?? '';
  }

  // ─────────────────────────────────────────────
  // AUDIO / TTS METHODS
  // ─────────────────────────────────────────────

  /**
   * Generate audio (Text-to-Speech).
   *
   * @param {object} p
   * @param {string} p.projectId      Flow project ID
   * @param {string} p.captchaToken   reCAPTCHA token (use 'audio' action)
   * @param {string} p.text           Text to speak
   * @param {string} p.voiceName      Voice ID (see MODELS.md §3 for all 30 voice IDs)
   * @param {string} p.label          Label for the audio
   * @param {string} [p.model]        TTS model (default: 'gemini_v4s_tts_flow')
   * @param {string} [p.performance]  Performance style
   * @returns {{ mediaId, workflowId }}
   */
  async generateAudio(p) {
    const payload = buildAudioPayload(
      p.projectId, p.captchaToken, p.text, p.voiceName, p.label,
      { model: p.model, performance: p.performance }
    );
    const data = await this.call(this.rpcid('audio_generate'), payload);
    return { mediaId: xStr(I(data, 0)), workflowId: xStr(I(data, 2)) };
  }

  // ─────────────────────────────────────────────
  // CONVENIENCE / HIGH-LEVEL HELPERS
  // ─────────────────────────────────────────────

  /**
   * Poll until all videos are done or error.
   * This is the main "wait" function — call after generateVideo().
   *
   * @param {string[]} mediaIds         Media IDs from generateVideo().mediaIds
   * @param {object}   [opts]
   * @param {number}   [opts.intervalMs=5000]   How often to poll (ms)
   * @param {number}   [opts.timeoutMs=600000]  Max wait time (ms) — default 10 min
   * @param {Function} [opts.onProgress]        Callback: (statuses) => void
   * @returns {{ done: string[], errored: string[], timeout: boolean }}
   */
  async waitForVideo(mediaIds, opts = {}) {
    const intervalMs = opts.intervalMs ?? 5000;
    const deadline   = Date.now() + (opts.timeoutMs ?? 600000);
    const done       = new Set();
    const errored    = new Set();

    while (Date.now() < deadline) {
      const pending = mediaIds.filter(id => !done.has(id) && !errored.has(id));
      if (!pending.length) break;

      try {
        const statuses = await this.pollVideo(pending);
        if (opts.onProgress) opts.onProgress(statuses);
        for (const s of statuses) {
          if (s.done)  done.add(s.mediaId);
          if (s.error) errored.add(s.mediaId);
        }
      } catch (err) {
        // Transient errors during polling are expected — just retry
        if (err.httpStatus === 401) throw err; // auth failure = stop
      }

      if (done.size + errored.size >= mediaIds.length) break;
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return {
      done:    [...done],
      errored: [...errored],
      timeout: Date.now() >= deadline,
    };
  }

  /**
   * Generate video and wait for it — single convenience call.
   *
   * @param {object} videoParams   Same as generateVideo() params
   * @param {object} [waitOpts]    Same as waitForVideo() opts
   * @returns {{ mediaIds, videoUrls: string[] }}
   */
  async generateAndWait(videoParams, waitOpts = {}) {
    const job              = await this.generateVideo(videoParams);
    const { done, errored, timeout } = await this.waitForVideo(job.mediaIds, waitOpts);

    if (timeout && !done.length) throw new Error('Video generation timed out');
    if (!done.length && errored.length) throw new Error(`Video generation failed for all ${errored.length} item(s)`);

    const videoUrls = await Promise.all(done.map(async id => {
      const media = await this.getMedia(id);
      return media.videoUrl;
    }));

    return { mediaIds: done, videoUrls };
  }
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** All 30 TTS voice IDs */
const VOICES = [
  'achernar','achird','algenib','algieba','alnilam','aoede',
  'autonoe','callirrhoe','charon','despina','enceladus','erinome',
  'fenrir','gacrux','iapetus','kore','laomedeia','leda','orus',
  'puck','pulcherrima','rasalgethi','sadachbia','sadaltager',
  'schedar','sulafat','umbriel','vindemiatrix','zephyr','zubenelgenubi',
];

/** Content part constructors */
const parts = { text: fe, media: Pr, entity: Ur };

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Main class
  FlowSDK,

  // Constants
  VOICES,
  parts,
  TIER_NAMES,

  // Low-level utilities (for custom payload building)
  y, z, G, randomSeed, fe, Pr, Ur, Ae, Le, me,

  // HTTP layer
  buildBatchRequest,
  parseResponse,

  // Response parsers
  parseImageResult,
  parseVideoSubmit,
  parsePollResult,
  parseGetMedia,
  parseImageUpload,
  parseEntityCreate,
  parseCredits,
  findBase64,

  // Payload builders
  buildImageGeneratePayload,
  buildImageUploadPayload,
  buildImageUpscalePayload,
  buildT2VPayload,
  buildI2VPayload,
  buildFirstLastPayload,
  buildR2VPayload,
  buildVideoEditPayload,
  buildPollPayload,
  buildVideoUpscalePayload,
  buildAudioPayload,
  buildProjectCreatePayload,
  buildEntityCreatePayload,
};
