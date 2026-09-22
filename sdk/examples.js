/**
 * examples.js — Complete working examples for every Flow API operation
 *
 * Run with: node examples.js
 * (You must fill in YOUR real tokens first)
 */

'use strict';

const { FlowSDK, VOICES, parts } = require('./flow-sdk');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — Fill these in with your real values
// ═══════════════════════════════════════════════════════════════

// Get these from browser console on flow.google.com:
//   WIZ_global_data.SNlM0e  → at
//   WIZ_global_data.cfb2h   → bl
//   WIZ_global_data.FdrFJe  → sid
const AUTH = {
  at:        'YOUR_SNlM0e_TOKEN',
  bl:        'YOUR_cfb2h_VALUE',
  sid:       'YOUR_FdrFJe_VALUE',
  authIndex: '0',
};

// Get cookies from DevTools → Network → any batchexecute request → Request Headers → Cookie
const COOKIES = 'SID=xxx; HSID=yyy; SSID=zzz; ...';

// Get from network traffic or license server response
// The rpcids values are the actual short strings like 'YhhmEf'
const RC = {
  origin:            'https://flow.google.com',
  app_name:          'FlowUi',
  source_path:       '/flow/{auth_index}',
  batchexecute_path: '/_/FlowUi/data/batchexecute?authuser={auth_index}',
  captcha_actions: {
    image:        'GENERATE_IMAGE',
    video:        'GENERATE_VIDEO',
    audio:        'GENERATE_AUDIO',
    upload_image: 'UPLOAD_IMAGE',
  },
  rpcids: {
    image_generate:         'REPLACE_WITH_REAL_RPC_ID',
    image_upload:           'REPLACE_WITH_REAL_RPC_ID',
    image_upscale:          'REPLACE_WITH_REAL_RPC_ID',
    video_text:             'REPLACE_WITH_REAL_RPC_ID',
    video_start_image:      'REPLACE_WITH_REAL_RPC_ID',
    video_start_end_image:  'REPLACE_WITH_REAL_RPC_ID',
    video_reference_images: 'REPLACE_WITH_REAL_RPC_ID',
    video_poll:             'REPLACE_WITH_REAL_RPC_ID',
    get_media:              'REPLACE_WITH_REAL_RPC_ID',
    video_upscale:          'REPLACE_WITH_REAL_RPC_ID',
    video_edit:             'REPLACE_WITH_REAL_RPC_ID',
    entity_create:          'REPLACE_WITH_REAL_RPC_ID',
    audio_generate:         'REPLACE_WITH_REAL_RPC_ID',
    get_credits:            'REPLACE_WITH_REAL_RPC_ID',
    project_create:         'REPLACE_WITH_REAL_RPC_ID',
  },
  video_aspects: {
    landscape: 1,
    portrait:  2,
  },
  image_aspects: {
    '1:1':  1,
    '16:9': 2,
    '9:16': 3,
    '4:3':  4,
    '3:4':  5,
  },
  image_upscale_levels: { '2K': 1, '4K': 2 },
  video_upscale_res:    { '1080p': 1, '4K': 2 },
};

// Your project ID (create one with createProject() or find from URL)
const PROJECT_ID = 'YOUR_PROJECT_ID';

// reCAPTCHA token — must be minted fresh from browser
// In browser console: await grecaptcha.enterprise.execute(SITE_KEY, { action: 'GENERATE_VIDEO' })
const CAPTCHA_TOKEN = 'YOUR_RECAPTCHA_TOKEN';

// ═══════════════════════════════════════════════════════════════
// INITIALIZE SDK
// ═══════════════════════════════════════════════════════════════

const sdk = new FlowSDK({
  ...AUTH,
  rc:      RC,
  cookies: COOKIES,
});

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 1: Check Credits & Tier
// ═══════════════════════════════════════════════════════════════

async function example_getCredits() {
  console.log('\n=== Example 1: Get Credits ===');

  const result = await sdk.getCredits();
  console.log('Credits:', result.credits);
  console.log('Tier:',    result.tier);      // e.g., 'ULTRA', 'FREE', 'PRO'
  console.log('Code:',    result.tierCode);  // numeric code

  return result;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 2: Create a Project
// ═══════════════════════════════════════════════════════════════

async function example_createProject() {
  console.log('\n=== Example 2: Create Project ===');

  const projectId = await sdk.createProject('My API Project');
  console.log('Project ID:', projectId);

  return projectId;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 3: Generate Image
// ═══════════════════════════════════════════════════════════════

async function example_generateImage() {
  console.log('\n=== Example 3: Generate Image ===');

  const result = await sdk.generateImage({
    prompt:       'A serene Japanese garden with cherry blossoms',
    modelApiKey:  'gemini_v4_img_flow',  // from rc.image_models.models[key].api_model
    aspect:       '16:9',               // or 1 if you know the numeric code
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,        // use 'image' action when minting
    seed:         42,                   // optional — for reproducibility
  });

  console.log('Media ID:',    result.mediaId);
  console.log('Workflow ID:', result.workflowId);
  console.log('Image URL:',   result.url);        // Direct CDN URL
  console.log('Dimensions:',  result.width, 'x', result.height);
  console.log('Seed used:',   result.seed);

  return result;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 4: Generate Video (Text-to-Video)
// ═══════════════════════════════════════════════════════════════

async function example_t2v() {
  console.log('\n=== Example 4: Text-to-Video ===');

  // Step 1: Submit generation job
  const job = await sdk.generateVideo({
    mode:         't2v',
    modelApiKey:  'veo_3_1_t2v_lite',  // from rc model_mappings
    prompt:       'A drone shot flying over a tropical beach at sunset, cinematic',
    aspect:       'landscape',
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,  // use 'video' action when minting
    seed:         123,
  });

  console.log('Job submitted!');
  console.log('Media IDs:', job.mediaIds);
  console.log('Credits used:', job.credits);

  // Step 2: Poll until done
  console.log('Polling for completion...');
  const { done, errored, timeout } = await sdk.waitForVideo(job.mediaIds, {
    intervalMs:  5000,    // check every 5 seconds
    timeoutMs:   300000,  // give up after 5 minutes
    onProgress:  (statuses) => {
      for (const s of statuses) {
        console.log(`  ${s.mediaId.slice(0, 12)}... status=${s.status} done=${s.done}`);
      }
    },
  });

  if (timeout) {
    console.error('Timed out!');
    return null;
  }

  // Step 3: Get video URLs
  const videoUrls = [];
  for (const mediaId of done) {
    const media = await sdk.getMedia(mediaId);
    console.log('Video URL:', media.videoUrl);
    videoUrls.push(media.videoUrl);
  }

  if (errored.length) {
    console.warn(`${errored.length} video(s) failed to generate`);
  }

  return { mediaIds: done, videoUrls };
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 5: Generate Video (Image-to-Video)
// ═══════════════════════════════════════════════════════════════

async function example_i2v(startImageMediaId) {
  console.log('\n=== Example 5: Image-to-Video ===');

  // startImageMediaId comes from uploadImage() or a previous generateImage()
  const job = await sdk.generateVideo({
    mode:          'i2v',
    modelApiKey:   'veo_3_1_i2v',  // i2v model key
    prompt:        'The person turns around slowly',
    aspect:        'portrait',
    projectId:     PROJECT_ID,
    captchaToken:  CAPTCHA_TOKEN,
    startMediaId:  startImageMediaId,  // REQUIRED for i2v
  });

  console.log('Media IDs:', job.mediaIds);

  // Wait and get URL (same as t2v)
  const { done } = await sdk.waitForVideo(job.mediaIds);
  const media    = await sdk.getMedia(done[0]);
  console.log('Video URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 6: Generate Video (First + Last Frame)
// ═══════════════════════════════════════════════════════════════

async function example_firstLast(startMediaId, endMediaId) {
  console.log('\n=== Example 6: First + Last Frame ===');

  const job = await sdk.generateVideo({
    mode:          'first_last',
    modelApiKey:   'veo_3_1_i2v_end',  // first_last model key
    prompt:        'Smooth transition between the two images',
    aspect:        'landscape',
    projectId:     PROJECT_ID,
    captchaToken:  CAPTCHA_TOKEN,
    startMediaId,  // REQUIRED: first frame
    endMediaId,    // REQUIRED: last frame
  });

  const { done } = await sdk.waitForVideo(job.mediaIds);
  const media    = await sdk.getMedia(done[0]);
  console.log('Video URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 7: Upload Reference Image → Use in Generation
// ═══════════════════════════════════════════════════════════════

async function example_uploadAndUse() {
  console.log('\n=== Example 7: Upload Reference Image ===');

  // Load image as base64 (replace with your image loading code)
  const fs       = require('fs');
  const imgBytes = fs.readFileSync('my-reference-image.jpg');
  const base64   = imgBytes.toString('base64');

  // Step 1: Upload the image
  const uploaded = await sdk.uploadImage({
    modelApiKey:  'gemini_v4_img_flow',
    captchaToken: CAPTCHA_TOKEN,  // use 'upload_image' action
    base64Data:   base64,
    mimeType:     'image/jpeg',
    aspect:       '16:9',
  });

  console.log('Uploaded Media ID:', uploaded.mediaId);

  // Step 2: Use mediaId as a reference in image generation
  const generated = await sdk.generateImage({
    prompt:       'In the same style as the reference image',
    modelApiKey:  'gemini_v4_img_flow',
    aspect:       '16:9',
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
    refMediaIds:  [uploaded.mediaId],  // use the uploaded image as reference
  });

  console.log('Generated Image URL:', generated.url);
  return generated;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 8: Reference-to-Video (Ingredients)
// ═══════════════════════════════════════════════════════════════

async function example_r2v(refMediaIds) {
  console.log('\n=== Example 8: Reference-to-Video ===');

  const job = await sdk.generateVideo({
    mode:        'ingredients',
    modelApiKey: 'veo_3_1_r2v',  // r2v model key
    prompt:      'The characters are having a friendly conversation',
    aspect:      'landscape',
    projectId:   PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
    refMediaIds,  // array of uploaded image media IDs
  });

  const { done } = await sdk.waitForVideo(job.mediaIds);
  const media    = await sdk.getMedia(done[0]);
  console.log('Video URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 9: Image Upscale
// ═══════════════════════════════════════════════════════════════

async function example_upscaleImage(mediaId) {
  console.log('\n=== Example 9: Upscale Image ===');

  // IMPORTANT: Only works on Flow-generated images (not uploaded ones!)
  const base64Jpg = await sdk.upscaleImage({
    mediaId,
    resolution:   '2K',   // '2K' or '4K'
    captchaToken: CAPTCHA_TOKEN,
  });

  console.log('Got base64 image, length:', base64Jpg.length);

  // Save to file:
  const fs = require('fs');
  fs.writeFileSync('upscaled.jpg', Buffer.from(base64Jpg, 'base64'));
  console.log('Saved to upscaled.jpg');

  return base64Jpg;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 10: Video Upscale
// ═══════════════════════════════════════════════════════════════

async function example_upscaleVideo(mediaId, workflowId) {
  console.log('\n=== Example 10: Upscale Video ===');

  // Submit upscale job
  const upscaleJob = await sdk.upscaleVideo({
    mediaId,
    workflowId,
    aspect:      'landscape',
    resolution:  '1080p',  // '1080p' or '4K'
    modelKey:    'YOUR_UPSCALE_MODEL_KEY',  // from rc.video.model_upscale_key
    projectId:   PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
  });

  console.log('Upscale submitted, mediaId:', upscaleJob.mediaIds[0]);

  // Poll the new mediaId
  const { done } = await sdk.waitForVideo(upscaleJob.mediaIds, { timeoutMs: 900000 });
  const media    = await sdk.getMedia(done[0]);
  console.log('Upscaled Video URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 11: TTS Audio Generation
// ═══════════════════════════════════════════════════════════════

async function example_generateAudio() {
  console.log('\n=== Example 11: TTS Audio ===');
  console.log('Available voices:', VOICES);

  const result = await sdk.generateAudio({
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,  // use 'audio' action
    text:         'Hello! This is a test of the Flow TTS system.',
    voiceName:    'aoede',        // from VOICES list — female voice
    label:        'aoede test',
    model:        'gemini_v4s_tts_flow',
    performance:  '',             // or 'EXPRESSIVE', etc.
  });

  console.log('Audio Media ID:',    result.mediaId);
  console.log('Audio Workflow ID:', result.workflowId);

  // Poll to get the audio URL
  const { done } = await sdk.waitForVideo([result.mediaId]);
  const media    = await sdk.getMedia(done[0]);
  console.log('Audio URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 12: Structured Prompt with Character Reference
// ═══════════════════════════════════════════════════════════════

async function example_structuredPrompt(entityId, refMediaId) {
  console.log('\n=== Example 12: Structured Prompt ===');

  // Build a structured prompt mixing text, entity refs, and media refs
  const structuredParts = [
    parts.text('A portrait photo of '),
    parts.entity(entityId, 'Alice'),     // @Alice character reference
    parts.text(' standing in a garden, smiling at camera, professional lighting'),
  ];

  const result = await sdk.generateImage({
    prompt:           '',  // ignored when structuredParts is provided
    modelApiKey:      'gemini_v4_img_flow',
    aspect:           '9:16',
    projectId:        PROJECT_ID,
    captchaToken:     CAPTCHA_TOKEN,
    structuredParts,
    entityIds:        [entityId],  // also pass entity IDs for reference
  });

  console.log('Generated with character reference:', result.url);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 13: One-Line Video Generation (Convenience Method)
// ═══════════════════════════════════════════════════════════════

async function example_generateAndWait() {
  console.log('\n=== Example 13: Generate and Wait (One Line) ===');

  const { mediaIds, videoUrls } = await sdk.generateAndWait({
    mode:         't2v',
    modelApiKey:  'veo_3_1_t2v_lite',
    prompt:       'Time-lapse of a blooming flower, macro photography',
    aspect:       'landscape',
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
  });

  for (const url of videoUrls) {
    console.log('Video:', url);
  }

  return videoUrls;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 14: 0-Credit Video (Veo 3.1 Lite Low Priority)
// ═══════════════════════════════════════════════════════════════

async function example_freeVideo() {
  console.log('\n=== Example 14: 0-Credit Video ===');

  const job = await sdk.generateVideo({
    mode:         't2v',
    modelApiKey:  'veo_3_1_t2v_lite_low_priority',  // 0-credit model
    prompt:       'A simple animation of waves on a beach',
    aspect:       'landscape',
    projectId:    PROJECT_ID,
    captchaToken: CAPTCHA_TOKEN,
    // No seed = random each time
  });

  console.log('Free job submitted, mediaIds:', job.mediaIds);
  console.log('Credits used:', job.credits);  // Should be 0

  const { done } = await sdk.waitForVideo(job.mediaIds, {
    timeoutMs: 600000,  // Low priority = slower, give 10 minutes
  });

  const media = await sdk.getMedia(done[0]);
  console.log('Video URL:', media.videoUrl);

  return media.videoUrl;
}

// ═══════════════════════════════════════════════════════════════
// EXAMPLE 15: Poll and Inspect Status
// ═══════════════════════════════════════════════════════════════

async function example_poll(mediaIds) {
  console.log('\n=== Example 15: Manual Poll ===');

  // Poll once
  const statuses = await sdk.pollVideo(mediaIds);

  for (const s of statuses) {
    console.log({
      mediaId:      s.mediaId,
      status:       s.status,  // number: 3=done, 4=error, others=pending
      done:         s.done,
      error:        s.error,
      errorMessage: s.errorMessage,
      bytes:        s.bytes,
    });
  }

  // Get URL for completed ones
  for (const s of statuses.filter(s => s.done)) {
    const media = await sdk.getMedia(s.mediaId);
    console.log('URL:', media.videoUrl);
  }
}

// ═══════════════════════════════════════════════════════════════
// RUN EXAMPLES
// ═══════════════════════════════════════════════════════════════

async function main() {
  try {
    // Run whichever example you want:
    await example_getCredits();
    // await example_createProject();
    // await example_generateImage();
    // await example_t2v();
    // await example_freeVideo();
    // await example_generateAndWait();
    // ... etc
  } catch (err) {
    console.error('Error:', err.message);
    if (err.httpStatus) console.error('HTTP Status:', err.httpStatus);
    if (err.grpcCode)   console.error('gRPC Code:', err.grpcCode);
  }
}

main();
