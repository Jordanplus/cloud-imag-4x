# 實作進度

> 對應計畫：`plan.md`

## 進度總覽

| # | 任務 | 狀態 | 備註 |
|---|------|------|------|
| 1 | 建立 plan.md / status.md | ✅ 完成 | |
| 2 | 寫前端 `public/index.html` | ✅ 完成 | 379 行（HTML+CSS+JS 一檔） |
| 3 | 寫後端 `functions/api/predict.js` | ✅ 完成 | 99 行；POST 建任務、GET 查狀態 |
| 4 | PWA manifest + icon 工具 | ✅ 完成 | `manifest.json` 26 行；`tools/make-icons.html` 純 Canvas |
| 5 | Cloudflare 設定 + 環境檔 | ✅ 完成 | `wrangler.toml`、`package.json`、`.gitignore`、`.dev.vars.example` |
| 6 | README（含 setup / deploy） | ✅ 完成 | 181 行，含模型 schema 驗證提示 |

**程式碼總計約 954 行**（含 README/plan/status；純執行碼約 600 行）

## 設計重大決定（記錄）

- **Replicate API endpoint**：用新版 `POST /v1/models/{owner}/{name}/predictions`，不寫死 version hash，自動跟最新版
- **Pipeline 編排**：放在前端，Worker 是無狀態 proxy
- **動漫 model 與標準 model 各跑各的**：不用 face_enhance（GFPGAN 不適合手繪人臉），UI 在動漫模式時隱藏該選項
- **PWA**：一開始就做（manifest + icons），跨平台免費附贈

## 完成狀態（2026-05-13）

✅ 已部署到 production：https://ipad-upscale.pages.dev
✅ 已用 user-uploaded icon 產出 3 個 PWA size
✅ 4 個組合全部測試通過（標準 / 動漫 / 降噪 / 人臉）

## 實際採用的模型（已驗證 work）

| 用途 | Replicate model | input 參數 |
|------|----------------|-----------|
| 標準放大 4x | `nightmareai/real-esrgan` | `image, scale, face_enhance` |
| 動漫放大 4x | `xinntao/realesrgan` | `img, scale, version='Anime - anime6B'` |
| 降噪 | `cszn/scunet` | `image, model_name='real image denoising'`；輸出物件 `{denoised_image, ...}` 需抽取 |

## 走過的彎路（記錄供日後參考）

1. NVIDIA build.nvidia.com 沒有 image SR endpoint — 改走 Replicate
2. `cjwbw/scunet` 已下架 → 改 `cszn/scunet` 並修正 input 參數
3. `cjwbw/real-esrgan` 其實沒有 anime variant → 改 `xinntao/realesrgan`
4. Replicate 新版 `/v1/models/{owner}/{name}/predictions` endpoint 不適用所有 model（xinntao 沒 active deployment）→ 全部改用舊版 `POST /v1/predictions` + `version` hash，每次 request 先 fetch latest version
