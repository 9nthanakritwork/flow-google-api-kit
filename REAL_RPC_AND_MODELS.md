# REAL_RPC_AND_MODELS.md — ข้อมูลจริงที่ถอดรหัสออกมาได้ 100% จาก Live Remote Config (v10.8.50)

> ถอดรหัสสดจาก Live License Server (`https://glab.duckmartians.info/login`)  
> ผ่าน AES-256-GCM ด้วย Hardware ID และ Session Token ของเวอร์ชัน **10.8.50**

---

## 🎯 1. รายการ RPC IDs จริงทั้งหมดของ Google Flow (`flow_google.rpcids`)

นี่คือ **Hash RPC IDs จริง 100%** ที่ Extension 10.8.50 ใช้งานอยู่:

```json
{
  "video_text": "YhhmEf",
  "video_start_image": "eb1hJf",
  "video_start_end_image": "nprQif",
  "video_reference_images": "MZZa6b",
  "video_edit": "jIps6",
  "video_poll": "jwpduf",
  "video_upscale": "p0UkFb",
  "image_generate": "ogiZ0b",
  "image_upload": "maseQ",
  "image_upscale": "SPrCad",
  "get_media": "as29s",
  "get_credits": "nzlxg",
  "get_models": "HTrJv",
  "project_create": "jHPbke",
  "entity_create": "C4BZMd",
  "entity_update": "rzMKMb",
  "audio_generate": "no0P6",
  "media_set_visibility": "lt8g5",
  "workflow_set_name": "mYWVGd",
  "set_watermark": "DA4VGb"
}
```

---

## 🍌 2. รายการ Image Models จริงทั้งหมด (`image_models`)

ที่ถามถึง **NanoBanana 2**, **NanoBanana 2 Lite**, **NanoBanana Pro** นี่คือค่า `api_model` และ `displayKey` จริง 100%:

| ชื่อในหน้า UI | `displayKey` (key) | `api_model` (ส่งไปใน API) | max_refs | supports_upscale | order |
|---|---|---|---|---|---|
| **Nano Banana 2 Lite** | `"HARBOR_SEAL"` | `"HARBOR_SEAL"` | 10 | `true` | 1 |
| **Nano Banana 2** | `"NARWHAL"` | `"NARWHAL"` | 10 | `true` | 2 |
| **Nano Banana Pro** | `"GEM_PIX_2"` | `"GEM_PIX_2"` | 10 | `true` | 3 |

### รายละเอียดการแมป Aspect Ratio ของรูปภาพ:
- **16:9 (`landscape_16_9`)** → `"IMAGE_ASPECT_RATIO_LANDSCAPE"` (Numeric Code: `3`)
- **9:16 (`portrait_9_16`)** → `"IMAGE_ASPECT_RATIO_PORTRAIT"` (Numeric Code: `2`)
- **1:1 (`square`)** → `"IMAGE_ASPECT_RATIO_SQUARE"` (Numeric Code: `1`)
- **4:3 (`landscape_4_3`)** → `"IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE"` (Numeric Code: `5`)
- **3:4 (`portrait_3_4`)** → `"IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR"` (Numeric Code: `4`)

---

## 🎬 3. รายการ Video Models จริงทั้งหมด (`model_mappings` + `video_duration.model_keys`)

### Veo 3.1 Standard Models:
| Mode | Display Key | Landscape Key | Portrait Key |
|---|---|---|---|
| **T2V** | `quality` | `veo_3_1_t2v` | `veo_3_1_t2v_portrait` |
| **I2V** | `quality` | `veo_3_1_i2v_s` | `veo_3_1_i2v_s_portrait` |
| **I2V End (First+Last)** | `quality` | `veo_3_1_i2v_s_fl` | `veo_3_1_i2v_s_portrait_fl` |
| **T2V Fast** | `fast` | `veo_3_1_t2v_fast` | `veo_3_1_t2v_fast_portrait` |
| **I2V Fast** | `fast` | `veo_3_1_i2v_s_fast` | `veo_3_1_i2v_s_fast_portrait` |
| **T2V Lite (Free)** | `lite_relaxed` | `veo_3_1_t2v_lite_low_priority` | `veo_3_1_t2v_lite_low_priority` |
| **I2V Lite (Free)** | `lite_relaxed` | `veo_3_1_i2v_lite_low_priority` | `veo_3_1_i2v_lite_low_priority` |
| **First+Last (Free)** | `lite_relaxed` | `veo_3_1_interpolation_lite_low_priority` | `veo_3_1_interpolation_lite_low_priority` |

### Omni Flash Video Models (รหัสจริงคือ `abra`):
- **4 วินาที:**
  - T2V: `"abra_t2v_4s"`
  - I2V: `"abra_i2v_4s"`
  - First+Last: `"omni_flash_i2v_4s_first_last"`
- **6 วินาที:**
  - T2V: `"abra_t2v_6s"`
  - I2V: `"abra_i2v_6s"`
  - First+Last: `"omni_flash_i2v_6s_first_last"`
- **8 วินาที:**
  - T2V: `"abra_t2v_8s"`
  - I2V: `"abra_i2v_8s"`
  - First+Last: `"omni_flash_i2v_8s_first_last"`
- **10 วินาที:**
  - T2V: `"abra_t2v_10s"`
  - I2V: `"abra_i2v_10s"`
  - First+Last: `"omni_flash_i2v_10s_first_last"`

---

## ⚙️ 4. การตั้งค่าระบบ Flow Google (`flow_google`)
- **Origin:** `https://flow.google.com`
- **AppName:** `AiSandboxAngularFrontend`
- **batchexecute path:** `/u/{auth_index}/_/{app_name}/data/batchexecute`
- **upload video path:** `/upload/v1/flow/upload/video/{project_id}`
- **reCAPTCHA actions:**
  - Image: `"IMAGE_GENERATION"`
  - Video: `"VIDEO_GENERATION"`
  - Audio: `"AUDIO_GENERATION"`
  - Upload Image: `"UPLOAD_IMAGE"`
