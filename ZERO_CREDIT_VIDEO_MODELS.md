# ZERO_CREDIT_VIDEO_MODELS.md — ความลับของระบบเจนวิดีโอ 0-Credit (Free Queue)

> **แกะจากโค้ดจริง 100%:** `adapter-BEikWMOV.js`, `contracts/api.js`, และ `real_rc.json` (v10.8.50)

---

## 🎯 1. ระบบ 0-Credit ใน Google Flow คืออะไร?

Google Flow มีระบบคิว **2 ระดับ**:
1. **Priority Queue (เสียเครดิต):** เจนเร็ว, คิวสั้น, เสียเครดิตต่อครั้ง (เช่น 10-20 เครดิต)
2. **Relaxed / Low-Priority Queue (0 เครดิต / ไม่เสียเครดิต):** ใช้โมเดลตระกูล **`low_priority`** และ **`relaxed`** 
   - **เครดิต 0 ก็เจนได้ไม่จำกัดครั้ง**
   - ข้อแลกเปลี่ยน: คิวประมวลผลนานกว่าเล็กน้อยเมื่อเซิร์ฟเวอร์โหลดสูง

ใน Extension 10.8.50 จะซ่อนเมนูนี้ไว้ภายใต้ชื่อ UI Display Key: **`"lite_relaxed"`**

---

## 📋 2. รายการโมเดล 0-Credit (Low Priority / Relaxed) ครบทุกโหมดและทุกความยาว

### 1. Text-to-Video (T2V) — 0 เครดิต
| ความยาว | แนวนอน (Landscape) | แนวตั้ง (Portrait) |
|---|---|---|
| **มาตรฐาน (8s)** | `veo_3_1_t2v_lite_low_priority` | `veo_3_1_t2v_lite_low_priority` |
| **4 วินาที** | `veo_3_1_t2v_lite_4s_low_priority` | `veo_3_1_t2v_lite_4s_low_priority` |
| **6 วินาที** | `veo_3_1_t2v_lite_6s_low_priority` | `veo_3_1_t2v_lite_6s_low_priority` |
| **Fast Relaxed (Ultra)** | `veo_3_1_t2v_fast_ultra_relaxed` | `veo_3_1_t2v_fast_portrait_ultra_relaxed` |

### 2. Image-to-Video (I2V) — ภาพเริ่มต้น (Start Image) — 0 เครดิต
| ความยาว | แนวนอน (Landscape) | แนวตั้ง (Portrait) |
|---|---|---|
| **มาตรฐาน (8s)** | `veo_3_1_i2v_lite_low_priority` | `veo_3_1_i2v_lite_low_priority` |
| **4 วินาที** | `veo_3_1_i2v_s_lite_4s_low_priority` | `veo_3_1_i2v_s_lite_4s_low_priority` |
| **6 วินาที** | `veo_3_1_i2v_s_lite_6s_low_priority` | `veo_3_1_i2v_s_lite_6s_low_priority` |
| **Fast Relaxed (Ultra)** | `veo_3_1_i2v_s_fast_ultra_relaxed` | `veo_3_1_i2v_s_fast_portrait_ultra_relaxed` |

### 3. First + Last Frame (I2V End / Interpolation) — 0 เครดิต
| ความยาว | แนวนอน (Landscape) | แนวตั้ง (Portrait) |
|---|---|---|
| **มาตรฐาน (8s)** | `veo_3_1_interpolation_lite_low_priority` | `veo_3_1_interpolation_lite_low_priority` |
| **4 วินาที** | `veo_3_1_i2v_s_lite_4s_fl_low_priority` | `veo_3_1_i2v_s_lite_4s_fl_low_priority` |
| **6 วินาที** | `veo_3_1_i2v_s_lite_6s_fl_low_priority` | `veo_3_1_i2v_s_lite_6s_fl_low_priority` |
| **Fast Relaxed (Ultra)** | `veo_3_1_i2v_s_fast_fl_ultra_relaxed` | `veo_3_1_i2v_s_fast_portrait_fl_ultra_relaxed` |

### 4. Compose / Ingredients (R2V) — 0 เครดิต
| แนวนอน (Landscape) | แนวตั้ง (Portrait) |
|---|---|
| `veo_3_1_r2v_fast_landscape_ultra_relaxed` | `veo_3_1_r2v_fast_portrait_ultra_relaxed` |

---

## ⚡ 3. ตัวอย่าง Payload ยิงเจน 0-Credit ทันที (Node.js / fetch)

### ยิง T2V (Text-to-Video 0-Credit):
```javascript
const rpcId = "YhhmEf"; // RPC ID ของ video_text
const modelApiKey = "veo_3_1_t2v_lite_low_priority"; // โมเดล 0 credit

const payload = [
  null,
  [
    [
      null,
      null,
      null,
      Math.floor(Math.random() * 2147483647), // Seed
      1,                                     // Aspect ratio (1: landscape, 2: portrait)
      modelApiKey,                           // "veo_3_1_t2v_lite_low_priority"
      null,
      recaptchaContext,
      [[{ text: "Cinematic drone shot of misty bamboo forest at dawn" }]],
      null,
      null,
      crypto.randomUUID().toUpperCase(),
      crypto.randomUUID().toUpperCase()
    ]
  ],
  1,
  recaptchaContext,
  [crypto.randomUUID().toUpperCase()]
];

// ยิงไปยัง batchexecute
await fetch(`https://flow.google.com/_/FlowUi/data/batchexecute?rpcids=${rpcId}&...`, {
  method: "POST",
  body: new URLSearchParams({
    "f.req": JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]),
    "at": sessionAt
  })
});
```

---

## 🛡️ 4. เงื่อนไขและข้อควรระวัง (Credit Guard)

ในโค้ด `real_rc.json` มีตัวแปรตัวหนึ่งชื่อ:
```json
"video_credit_guard": {
  "min_credits": 5
}
```
- **สำหรับผู้ใช้ทั่วไปในเว็บปกติ:** Google อาจตรวจว่าบัญชีต้องมีเครดิตขั้นต่ำเหลืออยู่อย่างน้อย 5 เครดิต (เพื่อเปิดระบบ UI) แต่เมื่อส่งคำขอเป็นโมเดล `_low_priority` หรือ `_relaxed` ยอดเครดิต **จะไม่ถูกหักแม้แต่แต้มเดียว (0-Credit)**!
- **สำหรับบัญชี Pro / Ultra:** ทาง Extension มี Logic ซ่อน `lite_relaxed` ไว้เพื่อบังคับให้ผู้ใช้ Pro ใช้คิวเร็ว (Fast) แต่หากเรายิงเป็น Custom API เราสามารถบังคับใส่โมเดล `_low_priority` ได้โดยตรงตลอดเวลา!
