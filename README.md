# 垃圾車地圖 · Taiwan Garbage Truck Map

[![Live site](https://img.shields.io/badge/live-garbage.yukai.dev-111827)](https://garbage.yukai.dev)
[![MCP server](https://img.shields.io/badge/MCP-mcp.garbage.yukai.dev-111827)](https://mcp.garbage.yukai.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

即時查詢**台北市、新北市、台中市、高雄市**的垃圾車與資源回收車停靠點、清運路線與預計抵達時間。支援手機主畫面安裝（PWA）與離線瀏覽，讓你不用再盲目追著垃圾車跑。

**Find out when the garbage truck reaches your street.** An interactive map of garbage and recycling truck stops, routes, and arrival times for Taipei, New Taipei, Taichung, and Kaohsiung — built for mobile, installable as an app, and offline-ready.

**👉 [https://garbage.yukai.dev](https://garbage.yukai.dev)**

![Map of garbage truck stops in central Taipei](docs/screenshot.png)

## 功能特色 · Features

- **到站時間篩選 (Time filters)** — 依「現在」、「30 分鐘內」、「1 小時內」或「3 小時內」篩選，快速找出正在收運或即將抵達的班次。
- **關鍵字搜尋與深層連結 (Search & deep links)** — 輸入行政區、里別、路名或路線名稱（例如 `大安區`）即可找站，搜尋結果可直接透過網址分享（`?q=大安區`）。
- **常用站點收藏與分享 (Favorites & sharing)** — 將常去的停靠點加入收藏，或一鍵複製專屬連結（`?point=…`）分享給家人與鄰居。
- **清運路線與行駛進度 (Truck routes)** — 檢視整條清運路線的沿途停靠點，支援道路軌跡顯示與預估行駛位置。
- **深色模式與衛星地圖 (Dark mode & satellite view)** — 提供深淺色主題切換與高解析度衛星圖層。
- **安裝成 App・離線可用 (PWA & offline support)** — 加到手機主畫面即可全螢幕開啟，縣市站點資料會在背景自動快取與更新，沒網路也能查時刻表。

## 支援縣市 · Supported Cities

| 縣市 City | 資料來源 Source | 每週收運日 Weekly schedule |
|---|---|---|
| 台北市 Taipei | [台北市資料大平臺 (data.taipei)](https://data.taipei) | – |
| 新北市 New Taipei | [新北市政府資料開放平臺 (data.ntpc.gov.tw)](https://data.ntpc.gov.tw) | ✅ 一般垃圾 / 資源回收 / 廚餘 |
| 台中市 Taichung | [臺中市政府資料開放平臺](https://datacenter.taichung.gov.tw)（經 TGOS 地理編碼） | ✅ 一般垃圾 / 資源回收 |
| 高雄市 Kaohsiung | [高雄市政府資料開放平臺 (data.kcg.gov.tw)](https://data.kcg.gov.tw)（經 TGOS 地理編碼） | – |

系統每月會自動同步各縣市政府最新公開資料。若發現站點資訊有誤，或希望支援其他縣市，歡迎[建立 Issue 回報](https://github.com/Yukaii/garbage/issues)。

> 💡 **提醒**：表定抵達時間皆來自各縣市政府開放資料，實際到站時間可能因路況、天候或當日清運量而有幾分鐘誤差，建議提早前往等候。

## AI 助理整合 · MCP Server

本站同時提供免金鑰、唯讀的 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 伺服器，讓 AI 助理能直接查詢附近的垃圾車停靠點與時刻表：

```json
{
  "mcpServers": {
    "taipei-trash": {
      "url": "https://mcp.garbage.yukai.dev/mcp"
    }
  }
}
```

連接後即可直接詢問 AI（例如：「*25.033, 121.543 附近什麼時候有垃圾車？*」或「*幫我查大安區安和路的垃圾車時間*」）。

- **可用工具 (Tools)**：`list_cities`、`find_nearby_points`、`search_points`、`get_schedule`
- **詳細說明**：請參考 [`mcp/README.md`](mcp/README.md) 與網站的 [`/llms.txt`](https://garbage.yukai.dev/llms.txt)

## 開發指南 · Development

本專案採用 React 19、Vite、MapLibre GL、Tailwind CSS 與 Bun 建置。

```bash
bun install
bun run dev         # 啟動 Vite 開發伺服器
bun run typecheck   # 執行 TypeScript 型別檢查 (tsc --noEmit)
bun run build       # 建置正式版至 dist/
```

`public/*.json` 中的清運站點資料是由 `data` 分支匯出（執行 `bun run dump-data`，需先於本機 fetch `data` 分支）。

### 架構概覽 · Architecture

- **前端網頁 (Web app)**：部署於 GitHub Pages（`garbage.yukai.dev`）。
- **資料更新 (Data pipeline)**：由 GitHub Actions 每月自動抓取各縣市開放資料並寫入獨立的 `data` 分支，隨每次部署一同打包。
- **路線軌跡 (Routes)**：依據各路線停靠點順序，每週透過 Valhalla 預先計算實際道路軌跡。
- **MCP 伺服器 (MCP server)**：位於 [`mcp/`](mcp/) 目錄，獨立部署於 Vercel，並與前端共用同一套縣市資料轉換器（`src/cities`）。

若想新增其他縣市或了解專案開發規範，請參閱 [`AGENTS.md`](AGENTS.md) 與 [`docs/`](docs/) 目錄下的技術文件。

## 致謝 · Credits

- 由 [Yukaii](https://github.com/Yukaii) 開發維護，感謝 [PastLeo](https://github.com/pastleo) 貢獻。
- 地圖圖資 © [OpenStreetMap](https://www.openstreetmap.org/copyright) 貢獻者，圖磚由 [CARTO](https://carto.com/attributions) 提供，並使用 [MapLibre GL](https://maplibre.org) 繪製。
- 清運路線與停靠點資料版權歸屬各縣市政府，依政府開放資料授權條款使用。

## 授權 · License

程式碼採用 [MIT License](LICENSE) 授權；各縣市開放資料則依其原授權條款提供。
