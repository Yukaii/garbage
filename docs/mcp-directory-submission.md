# MCP 目錄收錄作業指南

本文件說明如何把本專案的 MCP 伺服器（`dev.yukai/taipei-trash`）上架到各個公開的 MCP 目錄 / 索引。

> **本文件只涵蓋「準備」工作。** 所有需要登入第三方帳號、付款、設定 DNS 紀錄、按下「送出」的動作，都必須由維護者本人親自完成；請依第 8 節的檢查表逐項處理。

---

## 0. 共同資訊（先備好，之後貼到各目錄）

### 0.1 基本資料

| 欄位 | 值 |
|---|---|
| 識別代號（ID） | `dev.yukai/taipei-trash` |
| 顯示名稱（中文） | 台灣垃圾車地圖 |
| 顯示名稱（英文） | Taiwan Garbage Truck Map |
| MCP 端點 | `https://mcp.garbage.yukai.dev/mcp`（Streamable HTTP、stateless） |
| 傳輸協定 | `streamable-http`（`2025-11-25` / 2025 年各版本皆可交談） |
| 驗證 | 無需驗證（免金鑰、唯讀） |
| 網站 | https://garbage.yukai.dev |
| 伺服器卡片 | https://mcp.garbage.yukai.dev/mcp/server-card |
| AI Catalog | https://mcp.garbage.yukai.dev/.well-known/ai-catalog.json |
| LLM 導覽 | https://mcp.garbage.yukai.dev/llms.txt |
| 原始碼 | https://github.com/Yukaii/garbage （MCP 原始碼在 `mcp/`） |
| 授權 | MIT |
| 伺服器版本 | `0.1.0` |
| 支援縣市 | `taipei`（台北市）、`new-taipei`（新北市）、`taichung`（台中市）、`kaohsiung`（高雄市） |
| 時區 | `Asia/Taipei`（所有時間皆為台北時間） |

### 0.2 簡短描述（一句話）

- **繁體中文**：查詢台北市、新北市、台中市、高雄市垃圾車與資源回收車的停靠點、路線與預計抵達時間。
- **English**：Find garbage and recycling truck stops, routes, and arrival times in Taipei, New Taipei, Taichung, and Kaohsiung.

### 0.3 完整描述

- **繁體中文**：
  台灣垃圾車地圖的官方 MCP 伺服器（唯讀、免金鑰）。以台北市、新北市、台中市、高雄市各縣市政府開放資料為基礎，提供垃圾車與資源回收車的停靠點、清運路線與預計抵達／離開時間查詢，資料每月自動同步。內建四個工具：`list_cities`（支援的縣市與範圍）、`find_nearby_points`（依經緯度找 50–2,000 公尺內的停靠點，由近而遠）、`search_points`（以行政區、里別、路名、路線關鍵字搜尋，繁體中文）、`get_schedule`（取得單一停靠點與同一路線上所有站點的抵達順序，新北市與台中市另含每週收運日）。所有時間皆為 Asia/Taipei 台北時間。
- **English**：
  The official MCP server for the Taiwan Garbage Truck Map — read-only and no API key required. Built on the open-data portals of Taipei, New Taipei, Taichung, and Kaohsiung, it answers "when does the garbage truck reach my street?" with garbage and recycling truck stops, collection routes, and scheduled arrival/departure times, refreshed monthly. Four tools are exposed: `list_cities` (supported cities and their bounding boxes), `find_nearby_points` (stops within 50–2,000 m of a coordinate, nearest first), `search_points` (search a city's stops by district, village, road, or route keyword in Traditional Chinese), and `get_schedule` (one stop plus every stop on the same route in arrival order, including weekly collection days for New Taipei and Taichung). All times are in `Asia/Taipei` local time.

### 0.4 工具清單

| 工具 | 用途 | 主要參數 |
|---|---|---|
| `list_cities` | 列出支援的縣市、ID 與經緯度範圍 | （無） |
| `find_nearby_points` | 依座標找附近停靠點，由近而遠排序，含抵達時間 | `lat`、`lng`、`radiusMeters`（50–2000，預設 500）、`limit`（1–20，預設 10）、`city`（選填） |
| `search_points` | 以行政區／里別／地點／路線關鍵字搜尋（繁體中文，空白分隔的詞必須全部符合） | `city`、`query`、`limit` |
| `get_schedule` | 取得單一停靠點，以及同一路線上所有站點（依抵達順序） | `pointId`（來自上面兩個工具） |

所有工具皆標註為唯讀（`readOnlyHint: true`），回傳 `structuredContent` 與純文字摘要。回傳欄位：`id`、`city`、`district`、`village`、`location`、`route`、`arrivalTime`、`departureTime`（`HH:MM`）、`latitude`、`longitude`；新北市與台中市另有 `schedule`（各收運類別對應的 ISO 星期幾）與 `servesToday`。

### 0.5 範例提示（example prompts）

繁體中文：

1. 我現在在台北市信義區，附近的垃圾車大概幾點會到？
2. 新北市板橋區安和路有資源回收車的停靠點嗎？
3. 這個停靠點屬於哪一條清運路線？整條路線還有哪些站？
4. 台中市西屯區的垃圾車禮拜三有收嗎？
5. 高雄市鼓山區最近的一般垃圾清運站點有哪些？

English：

1. When will the garbage truck reach 25.0330, 121.5654 in Taipei?
2. List the recycling stops on 安和路 in 新北市 (new-taipei).
3. Show me the full route and stop order for point `taipei-12345`.
4. Does Taichung collect general waste in 西屯區 on Wednesdays?
5. What Kaohsiung general-waste stops are near 22.6150, 120.3014?

### 0.6 提交前的技術檢查（每次改版後重跑）

```bash
# 1) initialize 應回傳 serverInfo.name = dev.yukai/taipei-trash
curl -s -X POST https://mcp.garbage.yukai.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"check","version":"1.0.0"}}}'

# 2) tools/list 應回傳 4 個工具
curl -s -X POST https://mcp.garbage.yukai.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3) 伺服器卡片
curl -s https://mcp.garbage.yukai.dev/mcp/server-card
```

注意事項：

- **瀏覽器來源限制**：伺服器會拒絕帶有 `Origin` 標頭、且該來源不在 `MCP_ALLOWED_ORIGINS` 白名單內的請求（回 `403`）。原生 / 伺服器端客戶端不會送 `Origin`，因此 Smithery、Glama 等掃描器不受影響；但若希望**在瀏覽器內**使用（例如 Glama Inspector、Claude 網頁版）能連線，需把該來源加入 Vercel 專案的 `MCP_ALLOWED_ORIGINS` 環境變數（見第 8 節）。
- **速率限制**：每 IP 每分鐘 60 次請求（Vercel Firewall 規則 `mcp-rate-limit`）。
- **冷啟動**：台中市資料約 50 MB，首次載入約需 1 秒、記憶體約 400 MB。
- **協定版本**：線上端點在 `initialize` 時會協商到 `2025-11-25`（2025 年各版本皆可）。`mcp/public/server-card.json` 目前宣告 `supportedProtocolVersions: ["2026-07-28"]`；若要對外宣稱支援該版本，請先確認線上 SDK 確實支援（見第 8 節待辦）。

---

## 1. 官方 MCP Registry（registry.modelcontextprotocol.io）

**提交網址**：https://registry.modelcontextprotocol.io/
**文件**：https://modelcontextprotocol.io/registry/about
**本次已準備好的檔案**：`mcp/server.json`（schema 驗證通過）

### 1.1 為什麼名稱是 `dev.yukai/taipei-trash`

Registry 會驗證「你確實擁有該名稱空間」。名稱格式由驗證方式決定：

| 驗證方式 | 可發布的名稱 | 本案是否適用 |
|---|---|---|
| GitHub OAuth | `io.github.<帳號>/*` | ✘ **無法**發布 `dev.yukai/*` |
| DNS 驗證（`yukai.dev`） | `dev.yukai/*`、`dev.yukai.*` | ✔ 適用 |
| HTTP 驗證（`yukai.dev`） | `dev.yukai/*` | ✔ 適用（本伺服器名稱即在此範圍內） |

`dev.yukai` 是網域 `yukai.dev` 的反向 DNS 形式，因此**必須**用 DNS 或 HTTP 驗證 `yukai.dev`，才能維持與 `mcp/public/server-card.json`、與伺服器 `serverInfo.name` 相同的名稱。

### 1.2 步驟（維護者手動執行）

```bash
# 0) 安裝官方 CLI
brew install mcp-publisher
# 或：https://github.com/modelcontextprotocol/registry/releases 下載 mcp-publisher

# 1) 先驗證 server.json（不需登入）
mcp-publisher validate mcp/server.json

# 2) 產生金鑰對（Ed25519；macOS 系統 openssl 為 LibreSSL，Ed25519 需 brew install openssl@3）
openssl genpkey -algorithm Ed25519 -out mcp-registry-key.pem
PUBLIC_KEY="$(openssl pkey -in mcp-registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "yukai.dev. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""

# 3) 把上面的 TXT 紀錄加到 DNS 供應商的「yukai.dev」頂點（apex）
#    ⚠️ 必須放在頂點，不能放在 _mcp-auth.yukai.dev 之類的子名稱下
#    （來源：https://modelcontextprotocol.io/docs/.../authentication#dns-authentication）

# 4) 登入並取得發布權限
PRIVATE_KEY="$(openssl pkey -in mcp-registry-key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain yukai.dev --private-key "$PRIVATE_KEY"

# 5) 發布
mcp-publisher publish mcp/server.json

# 6) 驗證
curl "https://registry.modelcontextprotocol.io/v0.1/servers/dev.yukai%2Ftaipei-trash/versions/latest"
```

也可以改用 **HTTP 驗證**（不動 DNS，把檔案放在網站上）：

```bash
PUBLIC_KEY="$(openssl pkey -in mcp-registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}" > mcp-registry-auth
# 部署到 https://yukai.dev/.well-known/mcp-registry-auth（純文字、UTF-8、無 BOM）
mcp-publisher login http --domain yukai.dev --private-key "$PRIVATE_KEY"
mcp-publisher publish mcp/server.json
```

### 1.3 需維護者手動完成

- [ ] 在 DNS 供應商為 `yukai.dev` **頂點**新增 TXT 紀錄（或改用 HTTP 驗證並部署 `/.well-known/mcp-registry-auth`）
- [ ] 妥善保管私鑰（`.pem`）**並加入 `.gitignore`**，不要 commit 進版本庫
- [ ] 執行 `mcp-publisher login dns|http` 與 `mcp-publisher publish mcp/server.json`
- [ ] 驗證 `https://registry.modelcontextprotocol.io/v0.1/servers/dev.yukai%2Ftaipei-trash/versions/latest` 有資料

### 1.4 注意事項

- **每個 remote URL 只能掛在一個 server name 上。** 若 `https://mcp.garbage.yukai.dev/mcp` 已被別的名稱使用，發布會失敗。2026-10-19 檢查時，`dev.yukai/taipei-trash` 與 `taipei-trash`、`yukai` 關鍵字在 Registry 都查不到既有資料。
- 純遠端（remote-only）伺服器**不需要** `packages`，也不需要 npm 上的 `mcpName` 驗證。
- `description` 上限 100 字元；`mcp/server.json` 目前為 85 字元，與 server card 完全一致。
- 發布新版本時，修改 `mcp/server.json` 的 `version`（並同步 `mcp/public/server-card.json` 與 `mcp/handler.ts` 的 `serverInfo.version`）後重新 publish。
- 若要自動發布，可用 GitHub Actions OIDC（`mcp-publisher login github-oidc`）或 DNS 驗證 + `MCP_PRIVATE_KEY` secret（https://modelcontextprotocol.io/docs/.../github-actions）。

---

## 2. Smithery

**提交網址**：https://smithery.ai/new
**文件**：https://smithery.ai/docs/build/publish

### 2.1 步驟

1. 登入 Smithery（Google / GitHub 帳號皆可），到 https://smithery.ai/new 。
2. 貼上端點 `https://mcp.garbage.yukai.dev/mcp`。
3. Smithery 會自動掃描（scanning）取得工具清單 metadata。本伺服器是公開、免驗證的 streamable HTTP，掃描會直接完成。
4. 填寫名稱與描述（用第 0.2 / 0.3 節的中英文文案）、挑選分類與標籤（建議：`garbage`、`trash`、`recycling`、`taiwan`、`taipei`、`map`、`open-data`、`public-transport`）。
5. 選 namespace（建議 `yukai`，namespace 名稱須為小寫字母與連字號），slug 建議 `taipei-trash` → 網址會是 `https://smithery.ai/servers/yukai/taipei-trash`。
6. 發布後到 **Settings → Verification** 完成官方驗證清單。

命令列版本（選用）：

```bash
smithery mcp publish "https://mcp.garbage.yukai.dev/mcp" -n @yukai/taipei-trash
```

### 2.2 不需要 `smithery.yaml`

`smithery.yaml` 是**本機 stdio 套件**（MCPB）上架時才需要的建置描述檔；本伺服器是「自架遠端 URL（Bring your own hosting）」模式，官方文件只要求貼上 URL 即可，因此**不新增** `smithery.yaml`。

### 2.3 若掃描失敗（備案）

Smithery 掃描會帶 `User-Agent: SmitheryBot/1.0 (+https://smithery.ai)`。若被擋下（403），可在本伺服器提供靜態伺服器卡片 `/.well-known/mcp/server-card.json` 讓 Smithery 略過掃描。本專案已有 `https://mcp.garbage.yukai.dev/mcp/server-card`，格式與該路徑不同，因此**先不用**；只有真的被擋時再考慮加一個別名路由。

### 2.4 需維護者手動完成

- [ ] 註冊 / 登入 Smithery 帳號
- [ ] 建立 namespace（例如 `yukai`）
- [ ] 於 smithery.ai/new 貼上端點 URL、填寫中英文描述與標籤、發布
- [ ] 完成 Settings → Verification 的驗證流程

---

## 3. Glama

**提交網址**：
- 原始碼（Servers）：https://glama.ai/mcp/servers → 「Add Server」
- 遠端端點（Connectors）：https://glama.ai/mcp/connectors → 「Add Server」

Glama 的目錄分成兩種型態，本案兩種都建議建立：

| 型態 | 內容 | 識別方式 |
|---|---|---|
| **Server**（原始碼） | 指向 GitHub 原始碼，可供使用者自行部署 | repo URL `https://github.com/Yukaii/garbage` |
| **Connector**（遠端端點） | 指向已架好的 streamable HTTP 端點 | URL `https://mcp.garbage.yukai.dev/mcp` |

### 3.1 本次已準備好的檔案

已在 repo 根目錄新增 `glama.json`（schema：https://glama.ai/mcp/schemas/server.json）：

```json
{
  "$schema": "https://glama.ai/mcp/schemas/server.json",
  "maintainers": ["Yukaii"]
}
```

有了它才能在 Glama 上「認領」（claim）這個 Server 項目，之後才能自行更新名稱、描述、icon 與查看使用報表。> 若 Glama 最後是以 `mcp/` 子資料夾建立項目，請把同一份檔案放到 `mcp/glama.json`。

### 3.2 步驟

1. 登入 Glama（GitHub 帳號），到 https://glama.ai/mcp/servers 點「Add Server」，貼上 repo URL `https://github.com/Yukaii/garbage`，送出。Glama 會掃描原始碼並建立 Server 項目。
2. 到 https://glama.ai/mcp/connectors 點「Add Server」，貼上 `https://mcp.garbage.yukai.dev/mcp`，送出建立 Connector 項目（只有通過審核、且可用 streamable HTTP 連線的端點才會上架）。
3. **認領 Connector**：在 Glama 的 claim 面板取得權杖（`glama_claim_` 開頭），再把下列檔案部署到 `https://mcp.garbage.yukai.dev/.well-known/glama.json`：

   ```json
   {
     "claim": "glama_claim_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```

   （此檔案內容取自 https://glama.ai/mcp/schemas/connector.json；權杖格式為 `^glama_claim_[A-Za-z0-9_-]{32}$`。也可用 GitHub、HTTP challenge 或 DNS 驗證來認領。）
4. 確認 Connector 頁面上的狀態為 Healthy，且工具清單有 4 個工具。

### 3.3 需維護者手動完成

- [ ] 登入 Glama、提交 Server 與 Connector 兩個項目
- [ ] 取得 claim 權杖並把 `/.well-known/glama.json` 部署到 MCP 端點的網域
- [ ] （選擇性）把 `https://glama.ai` 加入 Vercel 專案的 `MCP_ALLOWED_ORIGINS`，讓 Glama 網頁版 Inspector 能直接連線

---

## 4. PulseMCP

**提交網址**：https://www.pulsemcp.com/submit
**目前狀態**：**暫停收件中**。該頁面明載「submissions and changes are temporarily paused」，並建議先發布到官方 MCP Registry；PulseMCP 會自動收錄官方 Registry 的資料，恢復收件後也會自動補上。

### 4.1 步驟

1. 先完成第 1 節（官方 Registry 發布）——這是 PulseMCP 官方建議的第一步。
2. 之後定期回訪 https://www.pulsemcp.com/submit 查看是否恢復收件；若恢復，再依表單送出（名稱、簡短描述、完整描述、GitHub repo、網站、工具清單）。
3. 在 PulseMCP 上確認頁面已出現 `dev.yukai/taipei-trash`，並檢查「server.json file available」等欄位是否正確。

### 4.2 需維護者手動完成

- [ ] 監看 https://www.pulsemcp.com/submit 是否恢復收件
- [ ] 恢復後送出表單（需登入 PulseMCP 帳號）

---

## 5. mcp.so

**提交網址**：https://mcp.so/submit?type=remote-server
（另有 `?type=server` 給本機套件、`?type=client`、`?type=agent`；本案選 **Remote Server**。）

### 5.1 表單欄位

| 欄位 | 填入值 |
|---|---|
| Remote endpoint URL * | `https://mcp.garbage.yukai.dev/mcp` |
| Name * | `Taiwan Garbage Truck Map`（或 `台灣垃圾車地圖`） |
| 描述（選填） | 用第 0.3 節的完整描述（可中英並列） |

### 5.2 費用

mcp.so 為**付費提交**：一次性發布費 **US$39**。可選加購項目（頁面上以選項呈現）：略過審核直接上架、Verified badge、Featured 與優先版位、Dofollow 連結。加購與否由維護者自行決定。

### 5.3 需維護者手動完成

- [ ] 註冊 / 登入 mcp.so 帳號
- [ ] 付款（US$39）並送出表單
- [ ] 送出後確認項目出現在 https://mcp.so/remote-servers

---

## 6. awesome-mcp-servers（punkpeye）

**重要**：本伺服器是 **remote-only**（沒有 npm / PyPI 可安裝套件），依 `punkpeye/awesome-mcp-servers` 的範圍規範，明確寫著「If your server is remote-only (just a hosted URL, no installable package), it belongs in awesome-remote-mcp-servers instead」。因此正確的投稿目标是：

**https://github.com/punkpeye/awesome-remote-mcp-servers**

### 6.1 必要條件（缺一會被 CI 擋下）

1. **端點必須公開可用**，且能回應 MCP `initialize` 請求（CI 每次 PR 都會檢查）。
2. **必須先在 Glama 有 Connector 項目**（見第 3 節），因為每筆條目都要掛 Glama badge。
3. **標記驗證方式**：🔓（無驗證）。
4. **名稱連到產品首頁**（不是 GitHub repo），端點用反引號包住，描述一句話、不超過 120 字元 ending with a period。
5. **貢獻者必須先 star 該 repo**，PR 不會被合併。
6. PR 標題加上 `🤖🤖🤖` 可讓自動化 agent 的 PR 加速合併。

### 6.2 條目格式（三行）

```markdown
- [Taiwan Garbage Truck Map](https://garbage.yukai.dev) `https://mcp.garbage.yukai.dev/mcp`
  [![Taiwan Garbage Truck Map MCP connector](https://glama.ai/mcp/connectors/dev.yukai/taipei-trash/badges/score.svg)](https://glama.ai/mcp/connectors/dev.yukai/taipei-trash)
  🔓 - Garbage and recycling truck stops, routes and arrival times for Taipei, New Taipei, Taichung and Kaohsiung.
```

> badge 的 `NAMESPACE/NAME` 要與 Glama Connector 網址一致；本案的識別代號為 `dev.yukai/taipei-trash`（也就是 `serverInfo.name`）。請在 Glama 建立 Connector 後，**複製它實際顯示的網址**再貼進 README，CI 會驗證 badge 指向的 Connector 存在。

### 6.3 步驟

1. 先完成第 3 節（Glama Connector 與 badge）。
2. Star → Fork `punkpeye/awesome-remote-mcp-servers`。
3. 在 `README.md` 依分類（字母序）插入上方的條目，同步更新檔案頂端的索引。
4. Commit → Push → 對上游開 PR（標題加 `🤖🤖🤖`）。

### 6.4 需維護者手動完成

- [ ] 建立 Glama Connector 並取得正確的 badge 網址
- [ ] Star 與 Fork `punkpeye/awesome-remote-mcp-servers`
- [ ] 開 PR（標題加 `🤖🤖🤖`）

> 若之後真的把 MCP 伺服器包成 npm / PyPI 套件（可在本機執行），才另外投稿到 https://github.com/punkpeye/awesome-mcp-servers 。

---

## 7. 可選：其他常見目錄

| 目錄 | 網址 | 備註 |
|---|---|---|
| MCP.Directory | https://mcp.directory/submit | 填 GitHub repo URL，會自動抓取 metadata，24 小時內上架；已透過官方 Registry 自動收錄的項目可用 email 認領 |
| Claude / ChatGPT 的自訂 connector | https://support.claude.com/en/articles/11175166 | 使用者端自行新增，無需維護者處理 |

---

## 8. 維護者手動待辦總表

| # | 項目 | 說明 |
|---|---|---|
| 1 | DNS TXT 紀錄（`yukai.dev` 頂點） | 官方 Registry 的網域驗證；或改用 `/.well-known/mcp-registry-auth` |
| 2 | 保管 Ed25519 私鑰 | 請確認 `mcp-registry-key.pem` 已被 `.gitignore` 排除 |
| 3 | `mcp-publisher login` + `publish mcp/server.json` | 發布到官方 Registry |
| 4 | Smithery 帳號 + namespace + smithery.ai/new 發布 | 貼上端點 URL、填中英文描述 |
| 5 | Glama：Server 項目（repo） | `glama.json` 已加入 repo 根目錄 |
| 6 | Glama：Connector 項目（端點）+ `/.well-known/glama.json` claim 檔 | 需要 claim 權杖 |
| 7 | Vercel 環境變數 `MCP_ALLOWED_ORIGINS` | 若要支援瀏覽器內呼叫（Glama Inspector、Claude 網頁版），加入例如 `https://glama.ai` |
| 8 | PulseMCP：等待恢復收件 | 恢復後補交表單 |
| 9 | mcp.so：付款 US$39 並送出 | Remote Server 表單 |
| 10 | awesome-remote-mcp-servers：star / fork / 開 PR | 標題加 `🤖🤖🤖` |
| 11 | 確認 server card 的協定版本宣告 | 線上端點目前協商到 `2025-11-25`；`mcp/public/server-card.json` 宣告 `2026-07-28`，若要保留請先確認 SDK 支援 |
| 12 | 版本同步 | 改版時同步 `mcp/server.json`、`mcp/public/server-card.json`、`mcp/handler.ts` 的 `serverInfo.version` |

---

## 9. 參考來源

官方 MCP Registry

- 官方 Registry 首頁：https://registry.modelcontextprotocol.io/
- 說明文件：https://modelcontextprotocol.io/registry/about
- 發布快速入門（遠端伺服器）：https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- 遠端伺服器說明（remote、transport、URL 唯一性）：https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx
- 驗證方式（DNS / HTTP / GitHub）：https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx
- 官方 Registry 額外要求（package 驗證、`_meta` 限制）：https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md
- server.json 格式規格：https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md
- server.json schema（2025-12-11）：https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
- `mcp-publisher` CLI 指令參考：https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/cli/commands.md
- GitHub Actions 自動發布：https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/github-actions.mdx

Smithery

- 發布說明：https://smithery.ai/docs/build/publish
- Namespaces：https://smithery.ai/docs/concepts/namespaces
- 掃描失敗排查（403 / User-Agent）：https://smithery.ai/docs/build/publish#troubleshooting

Glama

- 目錄 API 說明：https://glama.ai/mcp/reference
- `glama.json` schema：https://glama.ai/mcp/schemas/server.json
- Connector claim schema：https://glama.ai/mcp/schemas/connector.json
- `glama.json` 說明文章：https://glama.ai/blog/2025-07-08-what-is-glamajson
- 常見問題：https://glama.ai/mcp/faq

PulseMCP

- 提交頁（目前暫停）：https://www.pulsemcp.com/submit
- 目錄 API：https://www.pulsemcp.com/api

mcp.so

- 遠端伺服器提交表單：https://mcp.so/submit?type=remote-server
- 遠端伺服器說明：https://mcp.so/remote-servers

awesome-mcp-servers

- 本機套件清單（本案不適用）：https://github.com/punkpeye/awesome-mcp-servers
- 遠端伺服器清單（本案適用）：https://github.com/punkpeye/awesome-remote-mcp-servers
- 貢獻規範：https://github.com/punkpeye/awesome-remote-mcp-servers/blob/main/CONTRIBUTING.md

---

## 附錄：本專案已準備好的檔案

| 檔案 | 用途 |
|---|---|
| `mcp/server.json` | 官方 MCP Registry 的伺服器描述（schema 驗證通過；與 `mcp/public/server-card.json` 欄位一致） |
| `glama.json` | Glama Server 項目的認領檔（maintainers） |
| `docs/mcp-directory-submission.md` | 本文件 |
| `mcp/public/server-card.json` | MCP Server Card（既有檔案，內容未更動） |
