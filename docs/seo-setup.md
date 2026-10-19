# 搜尋引擎收錄設定（SEO）

本文說明如何把 **https://garbage.yukai.dev**（網頁 App，GitHub Pages）與 **https://mcp.garbage.yukai.dev**（MCP 伺服器，Vercel）註冊到搜尋引擎，並確認收錄狀況。

站上已備妥的項目：

| 項目 | 位置 | 說明 |
| --- | --- | --- |
| `robots.txt` | https://garbage.yukai.dev/robots.txt | 允許所有爬蟲，並明確允許 AI 爬蟲 |
| `sitemap.xml` | https://garbage.yukai.dev/sitemap.xml | 由 `public/sitemap.xml` 部署；目前只有首頁一個 URL |
| `llms.txt` | https://garbage.yukai.dev/llms.txt | 給 AI 代理的站點說明與資料格式 |
| AI Catalog | https://garbage.yukai.dev/.well-known/ai-catalog.json | 網域層級的 AI 服務探索資訊 |

> 以下操作都需要網站擁有者本人完成，因為會用到 DNS 管理介面、Google/Bing 帳號與 GitHub Secrets。

---

## 0. 部署後先做的基本檢查

先確認部署內容真的上線，再送交搜尋引擎（搜尋引擎會即時抓取這些檔案）：

```bash
curl -sI https://garbage.yukai.dev/ | head -1
curl -s https://garbage.yukai.dev/robots.txt
curl -s https://garbage.yukai.dev/sitemap.xml
curl -sI https://garbage.yukai.dev/llms.txt | head -1
```

預期：

- 首頁回 `HTTP/2 200`。
- `robots.txt` 內含 `Sitemap: https://garbage.yukai.dev/sitemap.xml`，且**沒有**任何 `Disallow: /`。
- `sitemap.xml` 是合法 XML，`<loc>` 使用完整網址（`https://...`）。

若 `sitemap.xml` 回 404，先確認 `public/sitemap.xml` 有被 commit，且部署流程成功，再繼續下一節。

---

## 1. Google Search Console（GSC）

GSC 是 Google 收錄狀況的唯一可靠來源；`site:` 查詢只是粗略估計。

### 1.1 新增資源

1. 開啟 <https://search.google.com/search-console>，用擁有者帳號登入。
2. 左上角資源選單 → **新增資源**。
3. 選擇 **網域**（Domain）資源，輸入 `garbage.yukai.dev`，按 **繼續**。
   - 選「網域」而非「網址前置字元」，是因為網域資源可用 DNS 驗證，不需要改動 `index.html`，也能一次涵蓋 `http`/`https`、有無 `www` 的所有變化。
4. Google 會顯示一筆 TXT 記錄，形如：

   ```text
   google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   先不要關閉頁面，下一步會用到。

### 1.2 用 DNS TXT 驗證（建議）

到 `yukai.dev` 的 DNS 代管商（Cloudflare、Route 53、Gandi、Namecheap…）新增 TXT 記錄：

| 欄位 | 值 |
| --- | --- |
| 類型 | `TXT` |
| 名稱／主機 | `garbage.yukai.dev`（若介面會自動附加網域，只填 `garbage`） |
| 內容／值 | 整串 `google-site-verification=...`（含等號後全部字元） |
| TTL | 預設值或 `3600` |

存檔後等待 DNS 生效（通常幾分鐘，最慢 24–48 小時），用終端機確認：

```bash
dig +short TXT garbage.yukai.dev
dig @8.8.8.8 +short TXT garbage.yukai.dev
```

看到該字串後，回到 GSC 按 **驗證**。驗證成功後**不要刪除**這筆 TXT 記錄，否則日後會失去擁有權。

接著對 MCP 網域重複同樣流程：

1. GSC → **新增資源** → **網域** → 輸入 `mcp.garbage.yukai.dev`。
2. 新增另一筆 TXT：名稱 `mcp.garbage.yukai.dev`，值為 Google 這次提供的新字串。
3. `dig +short TXT mcp.garbage.yukai.dev` 確認後按 **驗證**。

> **注意：CNAME 與 TXT 衝突**
> `mcp.garbage.yukai.dev` 通常以 CNAME 指向 Vercel。依 DNS 標準，同一個名稱不能同時存在 CNAME 與 TXT；部分代管商會直接拒絕新增。
> 若遇到這個狀況，改用**上層網域**：在 GSC 新增 `yukai.dev` 網域資源，並在 apex（`@`）加一筆 TXT。Google 的網域資源會自動涵蓋所有子網域，`garbage.yukai.dev` 與 `mcp.garbage.yukai.dev` 都會一併驗證，是最省事的做法。
> 若 DNS 代管商支援 CNAME flattening／允許 CNAME 與 TXT 並存（例如 Cloudflare 的某些設定），才直接用子網域驗證。

### 1.3 提交 sitemap

1. 在 GSC 左側選 **索引** → **Sitemap**。
2. 於「新增 Sitemap」輸入 `sitemap.xml`（只需相對路徑），按 **提交**。
3. 清單應出現 `https://garbage.yukai.dev/sitemap.xml`，狀態一開始可能是「已提交」，之後轉為 **成功**。
   - 「無法讀取」→ 回到第 0 節檢查網址是否 200、是否為合法 XML。
   - 「成功」但「已找到的網址數」為 0 → 等 Google 抓取，通常數小時到數天。

`mcp.garbage.yukai.dev` 是 API 端點（`/mcp`），沒有可索引的 HTML 頁面，**不需要**提交 sitemap；驗證擁有權即可。

### 1.4 要求建立索引

1. GSC 上方網址列貼上 `https://garbage.yukai.dev/`，按 Enter。
2. 點 **測試實際網址**，確認「網址已提交至 Google」且沒有阻擋。
3. 若尚未收錄，點 **要求建立索引**（每天有額度限制，重複按沒有幫助）。

Google 從未收錄到出現在搜尋結果，常見需要數天到數週；這段時間不需要反覆提交。

---

## 2. Bing Webmaster Tools

Bing 的索引也被 ChatGPT 搜尋等功能使用，建議一併設定。

### 2.1 從 GSC 匯入（最快）

1. 開啟 <https://www.bing.com/webmasters>，用 Microsoft 帳號登入。
2. 選擇 **Import from Google Search Console**。
3. 授權 Bing 讀取 GSC，勾選 `garbage.yukai.dev`（以及需要的子網域），完成匯入。
4. 匯入會一併帶入已驗證的擁有權與 sitemap；到 **Sitemaps** 確認 `https://garbage.yukai.dev/sitemap.xml` 狀態為 Success。

### 2.2 手動新增（匯入失敗時）

1. **Add site** → 輸入 `https://garbage.yukai.dev`。
2. 驗證方式選 **DNS**（新增 Bing 提供的 TXT，例如 `msvalidate.01=...`）或下載 HTML 驗證檔放到 `public/` 後部署。
3. 驗證後到 **Sitemaps** → **Submit sitemap** → 輸入 `https://garbage.yukai.dev/sitemap.xml`。

Bing 也支援 IndexNow（見第 5 節），設定後新內容不必等 Bing 排程抓取。

---

## 3. Naver（選擇性）

只有在想觸及韓國使用者時才需要；對台灣受眾的效益很低。

1. 開啟 <https://searchadvisor.naver.com>，登入 Naver 帳號。
2. **사이트 등록**（網站登錄）→ 輸入 `https://garbage.yukai.dev`。
3. 依畫面提供的方式驗證：
   - **HTML 檔案上傳**：把下載的驗證檔放進 `public/`，部署後確認 `https://garbage.yukai.dev/<驗證檔名>` 可開啟，再按驗證。
   - **DNS TXT**：若介面提供，於 DNS 新增對應 TXT 記錄。
   - 避免使用需要修改 `<head>` 的 HTML meta 驗證，以減少與其他變更的衝突。
4. 驗證後到 **요청 → 사이트맵 제출**，提交 `https://garbage.yukai.dev/sitemap.xml`。
5. Naver 是 IndexNow 的參與者；完成第 5 節後，也可透過 IndexNow 通知。

---

## 4. Yandex（選擇性）

同樣只在有俄語市場需求時設定。

1. 開啟 <https://yandex.com/webmaster>，登入 Yandex 帳號。
2. **Add site** → 輸入 `https://garbage.yukai.dev`。
3. 驗證方式：
   - **DNS TXT**：新增值為 `yandex-verification: <token>` 的 TXT 記錄。
   - **HTML 檔案**：把驗證檔放進 `public/` 後部署。
4. 到 **Indexing → Sitemaps** 提交 `https://garbage.yukai.dev/sitemap.xml`。
5. Yandex 同樣支援 IndexNow，可與 Bing 共用同一組 key。

---

## 5. IndexNow（Bing／Yandex／Naver／Seznam）

IndexNow 讓網站在部署後主動通知搜尋引擎「這些 URL 更新了」，不必等排程爬取。**Google 不支援 IndexNow**，Google 請用 GSC。

本專案已提供 `scripts/indexnow.ts`，會讀取 `public/sitemap.xml`（或 `dist/sitemap.xml`）的 `<loc>`，POST 到 `https://api.indexnow.org/indexnow`。

### 5.1 產生 key

IndexNow key 必須是 8–128 個字元，只能使用 `a-z`、`A-Z`、`0-9`、`-`。建議用：

```bash
openssl rand -hex 16
```

把輸出（32 個十六進位字元）記下來，以下用 `<KEY>` 代表。

### 5.2 把 key 檔放進 `public/`

IndexNow 會抓取 `https://garbage.yukai.dev/<KEY>.txt` 來確認送出者擁有網站，因此**檔名與檔案內容都必須是 `<KEY>`**：

```bash
KEY=$(openssl rand -hex 16)
printf '%s' "$KEY" > "public/$KEY.txt"
```

- 這個檔案是**公開資訊，不是機密**；commit 進 repo 是正常做法（搜尋引擎必須讀得到）。
- 檔名只能是 `<KEY>.txt`，不能放在子目錄。
- 部署後確認：

  ```bash
  curl -s https://garbage.yukai.dev/$KEY.txt
  ```

  輸出必須與 `<KEY>` 完全相同（結尾換行可有可無，本專案腳本產生的檔案不含換行）。

> 請先完成一次部署，讓 key 檔上線，再送出 IndexNow；否則搜尋引擎抓不到 key 檔會回 `403`。

### 5.3 設定 GitHub Secret

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

- Name：`INDEXNOW_KEY`
- Secret：`<KEY>`

部署流程 `.github/workflows/deploy.yml` 在 GitHub Pages 部署成功後，會檢查 `INDEXNOW_KEY`：

- 沒有設定 → 三個 IndexNow 步驟自動跳過，部署不受影響。
- 有設定 → checkout、安裝 Bun、執行 `bun scripts/indexnow.ts`；此步驟 `continue-on-error: true`，送出失敗不會讓部署變紅。

### 5.4 手動執行

```bash
# 先預覽會送出哪些 URL，不會真的 POST
INDEXNOW_KEY=<KEY> bun scripts/indexnow.ts --dry-run

# 正式送出
INDEXNOW_KEY=<KEY> bun scripts/indexnow.ts

# 也可以指定其他 sitemap
INDEXNOW_KEY=<KEY> bun scripts/indexnow.ts dist/sitemap.xml
```

成功時 HTTP 狀態為 `200`（已接受）或 `202`（key 驗證中）；若為 `403`，代表 key 檔未上線或內容不符，修正後重跑即可。

### 5.5 注意事項

- 每次部署（push 到 `main`、每月排程、手動觸發）都會重送 sitemap 內全部 URL；目前只有首頁，量很小。若未來 sitemap 超過 10,000 筆，腳本會自動分批。
- IndexNow 只是「通知」，不保證立即或一定收錄。
- 不要把 key 檔刪掉；刪掉後所有提交都會被拒。
- 換 key 時：新增新的 `public/<NEW_KEY>.txt`、更新 GitHub Secret、刪除舊檔，再部署。

---

## 6. 確認收錄狀況

### 6.1 `site:` 查詢

在 Google 搜尋：

```text
site:garbage.yukai.dev
site:garbage.yukai.dev 垃圾車
site:mcp.garbage.yukai.dev
```

在 Bing 搜尋：

```text
site:garbage.yukai.dev
```

判讀方式：

- 有結果 → 至少首頁已被收錄。
- 完全沒有結果 → 可能還沒被爬取，或該頁有 `noindex`／被 robots 阻擋。新網域前幾週沒有結果是正常的。
- `site:` 的數字是估計值，不能用來計算實際頁面數或流量。
- 若要確認**單一網址**是否收錄，以 GSC 的 **網址審查（URL Inspection）** 為準；Bing 則看 **URL Inspection** 工具。

### 6.2 常見訊號

| 現象 | 意義 | 處理 |
| --- | --- | --- |
| GSC 顯示「已找到網址，但尚未建立索引」 | Google 知道該頁但還沒排入索引 | 等待；可對首頁按「要求建立索引」 |
| GSC Sitemap 狀態「無法讀取」 | sitemap 404、格式錯誤或需要登入 | 用 `curl` 檢查、驗證 XML |
| GSC 驗證失敗 | DNS TXT 尚未生效或名稱填錯 | `dig` 確認，等待 TTL，重試 |
| IndexNow 回 `403` | `/<KEY>.txt` 不存在或內容不符 | 確認檔案已部署且內容等於 key |
| IndexNow 回 `422` | URL 不屬於該 host 或 key 不符 | 確認 sitemap 使用 `https://garbage.yukai.dev` |
| Bing 匯入 GSC 失敗 | GSC 尚未完成驗證，或授權過期 | 先完成第 1 節，再重新匯入 |

---

## 7. AI 爬蟲與代理

`public/robots.txt` 目前明確允許下列使用者代理，且沒有任何 `Disallow`：

- `GPTBot`（OpenAI 訓練／爬取）
- `ClaudeBot`（Anthropic）
- `PerplexityBot`（Perplexity）
- `Google-Extended`（Gemini 訓練／grounding；不影響 Google 搜尋）

`User-agent: *` 的 `Allow: /` 已涵蓋其他爬蟲；上述具名群組只是把意圖寫清楚，避免日後改動 wildcard 時意外封鎖。

維護時**不要**加入：

- `Disallow: /` 或封鎖 `/assets/`、`/icons/`（會讓搜尋結果缺圖）。
- 封鎖 `sitemap.xml`、`llms.txt`、`/.well-known/`。
- `Crawl-delay`（Google 不支援，Bing 可能消極解讀）。

若之後要調整 AI 政策，請同步更新 `public/llms.txt`、`public/.well-known/ai-catalog.json` 與 `mcp/public/llms.txt`。

---

## 8. 待辦清單（擁有者手動）

- [ ] 在 DNS 新增 `google-site-verification` TXT（`garbage.yukai.dev`，或直接驗證 `yukai.dev` 一次涵蓋兩個子網域）。
- [ ] GSC 新增網域資源並完成驗證，保留 TXT 記錄。
- [ ] GSC 提交 `https://garbage.yukai.dev/sitemap.xml`。
- [ ] （選用）GSC 對 `mcp.garbage.yukai.dev` 建立網域資源。
- [ ] Bing Webmaster Tools 從 GSC 匯入，確認 sitemap 狀態。
- [ ] （選用）Naver Search Advisor、Yandex Webmaster 驗證與提交 sitemap。
- [ ] 產生 IndexNow key，新增 `public/<KEY>.txt` 並部署。
- [ ] 在 GitHub repo 設定 `INDEXNOW_KEY` secret。
- [ ] 部署後用 `curl https://garbage.yukai.dev/<KEY>.txt` 確認 key 可讀。
- [ ] 以 `site:garbage.yukai.dev` 與 GSC 網址審查確認收錄。
