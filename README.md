# iPad 影像 4x 放大工具

純 web PWA，從 iPad / iPhone / Android / 桌面瀏覽器都能用。透過 Cloudflare Pages 部署、Replicate 跑 super-resolution 模型。

## 功能

- 從相簿選圖（或拍照）
- 可選：先降噪（適合髒照片 / 舊掃描）
- 可選：人臉強化（GFPGAN，僅標準模式）
- 標準模式 ／ 動漫模式 切換
- 4x 超解析度放大
- 下載 PNG 或長按存到相簿

## 架構

```
iPad / 任何瀏覽器
    ↓ HTTPS (Cloudflare Pages serves /index.html, manifest, icons)
Cloudflare Pages Function /api/predict (proxy + auth)
    ↓ HTTPS (token 藏在 Worker env)
Replicate (SCUNet / Real-ESRGAN / Real-ESRGAN-anime)
```

Pipeline 完全由前端編排，Worker 是無狀態 proxy。

---

## 一次性設定

### 1. 開 Replicate 帳號拿 token

1. 到 https://replicate.com/ 註冊
2. 加信用卡（免費額度需要）
3. 到 https://replicate.com/account/api-tokens 建一個 token，會像 `r8_xxxxxxxxxxxxxxxx`

### 2. 開 Cloudflare 帳號 + 裝 wrangler

```bash
# Mac 上
npm install -g wrangler
wrangler login   # 會開 browser，登入後回 terminal
wrangler whoami  # 確認登入成功
```

### 3. 產生 PWA icons

打開 `tools/make-icons.html`：
- Mac Safari/Chrome 雙擊就能開
- 點「下載全部」會自動下載 3 個 PNG
- 把這 3 個檔案搬到 `public/` 資料夾

```
public/
  apple-touch-icon.png   ← 180×180
  icon-192.png           ← 192×192
  icon-512.png           ← 512×512
```

（不想用內建樣式可以改 `tools/make-icons.html` 裡的 `BG / FG / TEXT` 常數，或自己準備這 3 張 PNG 丟進去。）

### 4. 設定本機環境變數

```bash
cp .dev.vars.example .dev.vars
# 編輯 .dev.vars，填入 REPLICATE_TOKEN 和 ACCESS_PASSWORD
```

---

## 本機開發測試

```bash
npm run dev
# 預設跑在 http://localhost:8788
```

Mac Safari / Chrome 打開 `http://localhost:8788`：
1. 輸入 `.dev.vars` 設的 `ACCESS_PASSWORD`
2. 點選圖、選一張小圖（500KB 內測試最快）
3. 試「標準 / 動漫」、「降噪」、「人臉強化」各種組合
4. 看狀態列、結果出來、下載按鈕

---

## 部署到 Cloudflare Pages

```bash
npm run deploy
# 第一次會問 project name，輸入 ipad-upscale
# 完成後拿到部署 URL：https://ipad-upscale.pages.dev
```

部署完還要去 Cloudflare Dashboard 設環境變數：
1. https://dash.cloudflare.com → Pages → ipad-upscale
2. Settings → Environment variables → Production
3. 加兩個變數：
   - `REPLICATE_TOKEN`（值同 `.dev.vars`）
   - `ACCESS_PASSWORD`（值同 `.dev.vars`，或設不同的）
4. 點「Save」後在 Deployments 點最新一次的 `⋯` → Retry deployment（讓新環境變數生效）

---

## iPad 上使用

1. iPad Safari 打開 `https://ipad-upscale.pages.dev`
2. 輸入 `ACCESS_PASSWORD`（會記在 localStorage，下次不用再輸）
3. **加到主畫面**：分享按鈕 → 「加入主畫面」→ 變類原生 app
4. 從主畫面開啟，會是全螢幕、無 Safari UI

存放大結果到相簿的兩種方式：
- 長按結果圖 → 「加入照片」
- 點下載 PNG 按鈕 → 存到 Files → Files 裡再「分享 → 儲存影像」

---

## ⚠️ 重要：Replicate 模型 schema 可能要驗證

`functions/api/predict.js` 裡寫死了 3 個 model 與假設的 input 參數：

```js
standard: { owner: 'nightmareai', name: 'real-esrgan' }   // image, scale, face_enhance
anime:    { owner: 'cjwbw', name: 'real-esrgan' }         // image, scale, model_name
denoise:  { owner: 'cjwbw', name: 'scunet' }              // image, task
```

**如果某個模型呼叫失敗**（status 顯示 `failed`，錯誤訊息提到參數不對 / 模型不存在）：

1. 去 Replicate 找替代模型（例如 https://replicate.com/collections/super-resolution、https://replicate.com/collections/image-restoration）
2. 在模型頁面的「API」tab 看實際 input schema
3. 修改 `functions/api/predict.js` 裡的 `MODELS` 常數
4. `npm run deploy` 重新部署

備援候選：
- 動漫 SR：`mayhemantt/realesrgan-x4-anime`、`xinntao/realesrgan`
- 降噪：`megvii-research/nafnet`、`zsxkib/scunet`

---

## 成本估算（個人用）

Replicate 是按 GPU 秒計費：
- Real-ESRGAN：約 $0.001-0.003 / 張
- SCUNet：約 $0.0005-0.002 / 張

個人用一個月幾十~幾百張 → **不到 $1 / 月**。

Cloudflare Pages 完全免費（個人用打不到免費 tier 上限）。

---

## 安全注意

- `.dev.vars` 與真正的 token 都 **不要 commit**（已在 `.gitignore`）
- `ACCESS_PASSWORD` 至少 16 字元隨機，因為網址公開時這是唯一防線
- 如果懷疑密碼外洩：去 Cloudflare Dashboard 改 `ACCESS_PASSWORD` → 重新 deploy；也順手到 Replicate 把 token rotate 掉

---

## 檔案結構

```
ipad_app/
├── public/                  # 前端靜態檔（也是 Cloudflare Pages 部署目錄）
│   ├── index.html
│   ├── manifest.json
│   ├── apple-touch-icon.png  # 自己用 tools/make-icons.html 產生
│   ├── icon-192.png
│   └── icon-512.png
├── functions/
│   └── api/
│       └── predict.js        # Cloudflare Pages Function
├── tools/
│   └── make-icons.html       # 純 Canvas icon 生成器（一次性用）
├── wrangler.toml
├── package.json
├── .gitignore
├── .dev.vars.example
├── plan.md
├── status.md
└── README.md
```
