# RPC_IDS.md — สูตรและรายการ RPC IDs ทั้งหมดของ Google Flow

> **แกะสูตรจากโค้ดจริง 100%:** `adapter-BEikWMOV.js` และ `my-autoflow/src/core/contracts/api.js`

---

## §1. รายการ RPC IDs ทั้งหมด (ครบ 18 รายการในระบบ)

ในโค้ด `adapter-BEikWMOV.js` ระบบ `FlowUi` ของ Google Flow เรียกใช้งานผ่าน `e.cfg.rpcid(...)` ทั้งหมด **18 Keys** ดังนี้:

| RPC Key ใน config (`rpcids`) | ฟังก์ชันที่เรียก | ความหมาย / หน้าที่ | ตัวอย่าง RPC Hash |
|---|---|---|---|
| **`video_text`** | `on()` via `ht["t2v"]` | **Text-to-Video (T2V)**: เจนวิดีโอจากข้อความ (Veo / Omni Flash) | `YhhmEf` |
| **`video_start_image`** | `on()` via `ht["i2v"]` | **Image-to-Video (I2V)**: เจนวิดีโอจากภาพเริ่มต้น (Start Frame) | `eb1hJf` |
| **`video_start_end_image`**| `on()` via `ht["first_last"]`| **First + Last Frame**: เจนวิดีโอเชื่อมระหว่าง 2 ภาพ | ดึงจาก Network |
| **`video_reference_images`**| `on()` via `ht["ingredients"]`| **Compose / Ingredients (R2V)**: ผสมภาพ/ตัวละคร (Omni Flash 3 chars + 4 refs) | ดึงจาก Network |
| **`video_edit`** | `sn()` | **Video Edit / Extend**: ขยายหรือตัดต่อวิดีโอเดิม | ดึงจาก Network |
| **`video_poll`** | `pt()` | **Video Status Polling**: เช็คสถานะการเจนวิดีโอว่าเสร็จหรือยัง | ดึงจาก Network |
| **`video_upscale`** | `cn()` | **Video Upscale**: ขยายความละเอียดวิดีโอเป็น 1080p หรือ 4K | ดึงจาก Network |
| **`image_generate`** | `rn()` | **Image Generate**: เจนภาพ (NanoBanana, Gemini Image 3, etc.) | ดึงจาก Network |
| **`image_upload`** | `mt()` | **Image Upload**: อัปโหลดรูปภาพตั้งต้น / รูปอ้างอิง | ดึงจาก Network |
| **`image_upscale`** | `nn()` | **Image Upscale**: ขยายความละเอียดรูปเป็น 2K หรือ 4K | ดึงจาก Network |
| **`get_media`** | `Fe()` | **Get Media Info**: ขอ URL ของวิดีโอ (.mp4), ภาพ (.jpg) และ thumbnail | ดึงจาก Network |
| **`get_credits`** | `gt()` | **Check Credits**: เช็คยอดเครดิตคงเหลือและระดับสมาชิก (Tier) | ดึงจาก Network |
| **`project_create`** | `wt()` | **Create Project**: สร้าง Project ใหม่ใน Google Flow | ดึงจาก Network |
| **`entity_create`** | `ln()` | **Create Character**: สร้างตัวละครใหม่ใน Character Library | ดึงจาก Network |
| **`entity_update`** | `dn()` | **Update Character**: ผูกเสียงพากย์ (Voice Audio) เข้ากับตัวละคร | ดึงจาก Network |
| **`audio_generate`** | `hn()` | **TTS Audio**: สังเคราะห์เสียงพูด (Text-to-Speech) | ดึงจาก Network |
| **`media_set_visibility`** | `un()` | **Set Visibility**: ตั้งค่าสื่อให้เป็น Public หรือ Private | ดึงจาก Network |
| **`workflow_set_name`** | `fn()` | **Rename Workflow**: เปลี่ยนชื่อโปรเจกต์ / Workflow | ดึงจาก Network |

---

## §2. สูตรการส่ง Payload ของ batchexecute

เมื่อ Google Flow ส่งคำขอ จะยิงแบบ `POST` ไปที่:
```http
POST https://flow.google.com/_/FlowUi/data/batchexecute?rpcids={RPC_ID}&source-path=/flow/{authIndex}&bl={bl}&f.sid={sid}&hl=en&_reqid={reqid}&rt=c
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
X-Same-Domain: 1
```

### สูตรการประกอบ Body `f.req`:
```javascript
// รูปแบบโครงสร้าง 4 ชั้น (Triple-nested array)
const envelope = [
  [
    [
      rpcId,                   // เช่น "YhhmEf" หรือ "eb1hJf"
      JSON.stringify(payload), // Payload ตัวจริงถูกแปลงเป็น JSON string อีกชั้นหนึ่ง
      null,
      "generic"
    ]
  ]
];

const postBody = new URLSearchParams({
  "f.req": JSON.stringify(envelope),
  "at":    sessionTokenAt,     // CSRF Token (SNlM0e) ที่ดึงจากหน้าเว็บ
});
```

---

## §3. วิธี "แกะสูตรดึง RPC IDs จริง" ออกมาจากหน้าเว็บแบบ 100%

เนื่องจาก Google อัปเดตรหัส RPC ID hash (6 ตัวอักษร) ตามเวอร์ชันของ UI วิธีดึงค่าจริงที่แม่นยำที่สุดมี 2 ทาง:

### วิธีที่ 1: ดักจับจาก Console / Network (ง่ายที่สุด)
1. เปิดแท็บ `https://flow.google.com/` กด `F12` เปิด DevTools
2. ไปที่แท็บ **Network** พิมพ์ช่อง Filter ว่า: `batchexecute`
3. ลองกดปุ่มใดก็ได้ในเว็บ 1 ครั้ง เช่น:
   - กดปุ่มสร้างวิดีโอ T2V → ดูใน URL query จะเห็น `rpcids=YhhmEf`
   - กดปุ่มสร้างวิดีโอ I2V → ดูใน URL query จะเห็น `rpcids=eb1hJf`
4. หรือเปิดแท็บ **Console** แล้ววางโค้ด Snippet นี้ดักจับ RPC IDs อัตโนมัติ:

```javascript
// วางโค้ดนี้ใน Console ของ flow.google.com เพื่อดู mapping ของ RPC IDs ทั้งหมดแบบเรียลไทม์
(function() {
  const originalFetch = window.fetch;
  window.capturedRpcIds = window.capturedRpcIds || {};
  
  window.fetch = async function(...args) {
    const url = String(args[0] || "");
    if (url.includes("batchexecute")) {
      const match = url.match(/rpcids=([^&]+)/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        const body = args[1]?.body;
        console.log(`%c[Google Flow RPC Intercepted] ID: ${id}`, "color: #00ff00; font-weight: bold;");
        console.log("Request Body:", body);
      }
    }
    return originalFetch.apply(this, args);
  };
  console.log("Hooked into Google Flow! ทำการกดปุ่มใดๆ ในหน้าเว็บ ระบบจะพิมพ์ RPC ID ออกมาทันที");
})();
```

---

## §4. ความลับที่ค้นพบ: โปรโตคอล REST ทางเลือก (ไม่ต้องใช้ RPC ID Hash!)

จากการแกะไฟล์ `my-autoflow/src/core/contracts/api.js` พบว่า Google Flow มี **Direct REST API Endpoint** อีกทางหนึ่งบน `https://aisandbox-pa.googleapis.com` ซึ่ง **ไม่จำเป็นต้องใช้ batchexecute RPC ID Hash เลยแม้แต่ตัวเดียว**:

### 1. Direct REST Endpoints:
- **Generate Images:**  
  `POST https://aisandbox-pa.googleapis.com/v1/projects/{projectId}/flowMedia:batchGenerateImages`
- **Text-to-Video:**  
  `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText`
- **Image-to-Video (Start Image):**  
  `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage`
- **First + Last Frame:**  
  `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartAndEndImage`
- **Reference / Compose Video:**  
  `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages`
- **Poll Video Status:**  
  `POST https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus`
- **Upload Image:**  
  `POST https://aisandbox-pa.googleapis.com/v1/flow/uploadImage`

### 2. ชื่อ Model จริงระดับ Backend (Codename) จาก API Contract:
- **NanoBanana (Gemini Image 3):** `"GEM_PIX_2"`
- **NanoBanana 2 (Pro):** `"NARWHAL"`
- **NanoBanana 2 Lite:** `"HARBOR_SEAL"`
- **Imagen 3.5:** `"IMAGEN_3_5"` (หรือ `"R2I"` เมื่อใส่ภาพอ้างอิง)
- **Omni Flash Video:**  
  - T2V: `"abra_t2v_{duration}s"` (เช่น `abra_t2v_8s`)
  - I2V: `"abra_i2v_{duration}s"` (เช่น `abra_i2v_8s`)
  - R2V: `"abra_r2v_{duration}s"` (เช่น `abra_r2v_8s`)
- **Veo 3.1 Video:**  
  - Standard: `"veo_3_1_t2v"`, `"veo_3_1_i2v_s"`, `"veo_3_1_r2v_fast_landscape"`
  - Lite (0 credit): `"veo_3_1_t2v_lite_low_priority"`, `"veo_3_1_i2v_lite_low_priority"`
