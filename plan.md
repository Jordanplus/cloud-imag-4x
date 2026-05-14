# iPad 影像 4x 放大工具 — 實作計畫

> 完整原始版本：`/Users/mcgrady/.claude/plans/ipad-glimmering-hummingbird.md`
> 本檔保留與專案同步、可被 git 追蹤的版本。

---

## Context

- **使用者需求**：在 iPad 上從相簿選圖 → 可選降噪 / 人臉強化 → 4x 放大 → 存回相簿。個人用，出門也要能用，跨平台（iPad/Android/桌面瀏覽器都能跑）。
- **走過的彎路**：
  - NVIDIA 免費 API（build.nvidia.com）沒有 image SR endpoint
  - Gemini / Claude / OpenAI（DALL·E/Imagen/GPT-image）都是 LLM 或 text-to-image，不是 super-resolution，丟照片進去會「重畫」而非「放大恢復細節」
  - 真正在做這件事的是 Real-ESRGAN / SCUNet 等專門模型 → 走 Replicate

---

## 最終架構

```
┌──────────────────┐  HTTPS  ┌─────────────────────────┐  HTTPS  ┌─────────────────┐
│  iPad / Android  │ ──────► │  Cloudflare Pages       │ ──────► │  Replicate API  │
│  / 桌面 Browser  │         │  + Pages Function       │         │  • SCUNet       │
│  (PWA-ready)     │ ◄────── │  /api/predict           │ ◄────── │  • Real-ESRGAN  │
│                  │         │  (無狀態 proxy)          │         │  • Anime SR     │
└──────────────────┘         └─────────────────────────┘         └─────────────────┘
       │ 前端編排 pipeline
       │ Step1: (optional) Denoise
       │ Step2: Upscale 4x (含 optional face_enhance)
       ▼
   下載 / 長按存照片
```

**關鍵決定**：
- **純靜態前端**：HTML + vanilla JS 單檔（不上 React/Vue），符合 Simplicity First
- **Pipeline 由前端編排**：Worker 無狀態 proxy，前端逐步呼叫；不用 KV/DO
- **PWA**：加 manifest + icons，iPad「加到主畫面」變類 native app
- **跨平台**：純 web，免費附贈所有瀏覽器支援
- **Replicate 用新版 endpoint**：`POST /v1/models/{owner}/{name}/predictions`（不用寫死 version hash）

---

## Pipeline 設計

| 步驟 | Replicate Model | 何時跑 |
|------|---------|------|
| 1. Denoise（可選） | `cjwbw/scunet`（或其他活躍模型） | 使用者勾選 |
| 2. Upscale 4x（必跑） | 標準模式：`nightmareai/real-esrgan`（含 `face_enhance` 參數）<br>動漫模式：`xinntao/realesrgan` 或同類 anime model | 必跑 |

**UI 邏輯**：
- 動漫模式 → 隱藏「強化人臉」（手繪人臉不適合 GFPGAN）
- 顯示當前步驟訊息（降噪中… / 放大中…）
- 多步時前一步的輸出 URL 直接餵下一步（不來回 iPad）

**呼叫次數**：最少 1 次（只 upscale）、最多 2 次（denoise → upscale）

---

## 檔案結構

```
ipad_app/
├── public/
│   ├── index.html              # 前端：UI + pipeline 編排
│   ├── manifest.json           # PWA manifest
│   ├── icon-192.png            # PWA Android icon
│   ├── icon-512.png            # PWA splash / install icon
│   └── apple-touch-icon.png    # 180×180 iOS
├── functions/
│   └── api/
│       └── predict.js          # 無狀態 proxy + auth
├── tools/
│   └── make-icons.html         # 純 Canvas 生 icon 工具
├── wrangler.toml
├── package.json                # 只是給 wrangler 認專案
├── .gitignore
├── .dev.vars.example           # 環境變數範本
├── README.md
├── plan.md
└── status.md
```

---

## 實作步驟（同步進度看 status.md）

1. ✅ 建立 plan.md / status.md
2. 寫前端 `public/index.html`
3. 寫後端 `functions/api/predict.js`
4. 寫 PWA manifest + `tools/make-icons.html`
5. 寫 Cloudflare 設定 + 環境檔（`wrangler.toml`、`package.json`、`.gitignore`、`.dev.vars.example`）
6. 寫 README（含 Replicate / Cloudflare setup、deploy 步驟）

---

## 帳號 / API key 需求（給使用者參考）

- **Cloudflare**：1 個帳號，免費，不需要 API key（用 `wrangler login` CLI）
- **Replicate**：1 個帳號 + 信用卡，1 個 API token (`r8_xxx`)；同 token 可呼叫所有用到的 model

---

## 驗證計畫（end-to-end）

1. 本機：`wrangler pages dev public` → Mac Safari 完整流程
2. 部署後：Mac Safari 開 `*.pages.dev` 跑一遍
3. iPad Wi-Fi：完整流程 + 長按存相簿
4. iPad 4G：關 Wi-Fi 重做，驗證出門可用
5. 三種 pipeline 組合各測一次：
   - 不勾任何 + 標準
   - 勾人臉 + 標準
   - 勾降噪 + 動漫
6. 錯誤路徑：錯密碼、傳 PDF、傳超大圖
