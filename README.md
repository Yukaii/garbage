# Taipei & New Taipei Trash Collection Data

This orphan branch contains static JSON data for trash collection points in Taipei City and New Taipei City.

## Files

- `trash-collection-points.json` - Complete dataset of 4000+ Taipei City trash collection points
- `new-taipei-trash-collection-points.json` - Complete dataset of 26,822 New Taipei City trash collection points (29 districts)
- `fetch-new-taipei-data.ts` - Script to fetch and update New Taipei City data from the API

## Data Sources

### Taipei City
- URL: https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202
- Format: Wrapped in `result.results` object
- Updates: Monthly via GitHub Actions

### New Taipei City
- URL: https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/json
- Format: Direct array, paginated (3 pages: 10k + 10k + 6,822 entries)
- Coverage: All 29 districts (三峽區, 三芝區, 三重區, 中和區, 五股區, 八里區, 土城區, 坪林區, 平溪區, 新店區, 新莊區, 板橋區, 林口區, 樹林區, 永和區, 汐止區, 泰山區, 淡水區, 深坑區, 烏來區, 瑞芳區, 石碇區, 石門區, 萬里區, 蘆洲區, 貢寮區, 金山區, 雙溪區, 鶯歌區)
- Updates: Run `bun fetch-new-taipei-data.ts` to update

## Update Schedule

This data is automatically updated monthly via GitHub Actions.

## Last Updated

Check the commit timestamp for the last data update.
