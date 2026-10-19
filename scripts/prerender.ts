import { cityRegistry, type City } from '../src/cities/cityRegistry';
import type { CollectionSchedule, UnifiedTrashCollectionPoint } from '../src/types';
import { districtSlugs } from './district-slugs';

const origin = 'https://garbage.yukai.dev';
const buildDate = new Date().toISOString().slice(0, 10);
const collator = new Intl.Collator('zh-TW');
const types = { garbage: '垃圾', recycling: '資源回收', foodscraps: '廚餘' } as const;
const weekdays = ['', '一', '二', '三', '四', '五', '六', '日'];

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Keep distinct visits, but merge duplicate weekday/type records without relying
// on adapter IDs (some IDs discard Chinese location names). No raw JSON is shipped.
export function aggregateStops(points: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
  const stops = new Map<string, UnifiedTrashCollectionPoint>();
  for (const point of points) {
    const key = JSON.stringify([point.district, point.village, point.location, point.route,
      point.carSeq, point.team, point.arrivalTime, point.departureTime, point.longitude, point.latitude]);
    const existing = stops.get(key);
    if (!existing) {
      stops.set(key, { ...point, schedule: point.schedule ? structuredClone(point.schedule) : undefined });
      continue;
    }
    for (const [type, days] of Object.entries(point.schedule ?? {}) as [keyof CollectionSchedule, number[]][]) {
      existing.schedule ??= {};
      existing.schedule[type] = [...new Set([...(existing.schedule[type] ?? []), ...days])].sort((a, b) => a - b);
    }
  }
  return [...stops.values()].sort((a, b) => collator.compare(a.route, b.route)
    || a.arrivalTime.localeCompare(b.arrivalTime) || collator.compare(a.location, b.location));
}

function time(value: string): string {
  return /^\d{3,4}$/.test(value) ? value.padStart(4, '0').replace(/^(\d{2})(\d{2})$/, '$1:$2') : value || '未提供';
}

function schedule(point: UnifiedTrashCollectionPoint): string {
  if (!point.schedule || !Object.keys(point.schedule).length) return '來源未提供';
  return (Object.keys(types) as (keyof CollectionSchedule)[]).flatMap(type => {
    const days = point.schedule?.[type];
    if (!days) return [];
    return [`${types[type]}：${days.length ? days.map(day => `週${weekdays[day]}`).join('、') : '無排程'}`];
  }).join('；');
}

function table(points: UnifiedTrashCollectionPoint[], caption: string): string {
  return `<div class="table-scroll" role="region" aria-label="停靠點時間表" tabindex="0"><table><caption>${escapeHtml(caption)}</caption><thead><tr><th scope="col">路線／車次</th><th scope="col">里別</th><th scope="col">停靠地點</th><th scope="col">抵達時間</th><th scope="col">清運星期</th></tr></thead><tbody>${points.map(point => `<tr><td>${escapeHtml([point.team, point.route, point.carSeq === point.route ? '' : point.carSeq].filter(Boolean).join(' / '))}</td><td>${escapeHtml(point.village || '未提供')}</td><td>${escapeHtml(point.location)}</td><td>${escapeHtml(time(point.arrivalTime))}</td><td>${escapeHtml(schedule(point))}</td></tr>`).join('')}</tbody></table></div>`;
}

function page(cityId: City, district: string | undefined, body: string): string {
  const city = cityRegistry.getAdapter(cityId).displayName;
  const place = district ? `${city}${district}` : city;
  const path = `/${cityId}/${district ? `${districtSlugs[cityId][district]}/` : ''}`;
  const title = `${district || city}垃圾車時間表｜${city}垃圾車與資源回收車停靠點`;
  const description = `查詢${place}垃圾車與資源回收車停靠點、路線、里別、抵達時間及來源提供的清運星期。免 JavaScript 瀏覽時間表，也可開啟互動地圖搜尋附近站點。`;
  const crumbs = [{ name: '垃圾車地圖', path: '/' }, { name: city, path: `/${cityId}/` },
    ...(district ? [{ name: district, path }] : [])];
  const jsonLd = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem', position: index + 1, name: crumb.name, item: origin + crumb.path,
      })) },
      { '@type': 'Dataset', name: `${place}垃圾車停靠點與清運時間表`, description,
        url: origin + path, inLanguage: 'zh-TW', spatialCoverage: place,
        isBasedOn: origin + cityRegistry.getAdapter(cityId).dataUrl,
        variableMeasured: ['路線', '里別', '停靠地點', '抵達時間', '清運星期'],
      },
    ],
  };
  return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${origin}${path}"><link rel="alternate" type="text/plain" href="/llms.txt" title="AI 網站指南"><style>body{font:1rem/1.7 system-ui,sans-serif;color:#17212b;background:#fff;max-width:76rem;margin:auto;padding:1.25rem}a{color:#0756a0}h1{line-height:1.3}nav ul{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;padding-left:1.25rem}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}caption{text-align:left;font-weight:bold;padding:.75rem 0}th,td{border:1px solid #cbd5e1;padding:.4rem .6rem;text-align:left;vertical-align:top}th{background:#edf2f7}td:nth-child(4){white-space:nowrap}footer{margin-top:2rem}</style><script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script></head><body><header><nav aria-label="麵包屑">${crumbs.map(crumb => `<a href="${crumb.path}">${escapeHtml(crumb.name)}</a>`).join(' › ')}</nav></header><main><h1>${escapeHtml(place)}垃圾車時間表</h1><p>${escapeHtml(description)}</p><p><a href="${origin}/?q=${encodeURIComponent(district || city)}">開啟互動地圖搜尋${escapeHtml(district || city)}</a></p><p>頁面建置日期：<time datetime="${buildDate}">${buildDate}</time>（非資料更新日期）。時間為台灣時間，依政府開放資料整理；實際清運請以當地清潔隊公告為準。來源未提供星期不代表每日清運。</p>${body}</main><footer><a href="/">互動垃圾車地圖</a> · <a href="/llms.txt">AI 網站指南（llms.txt）</a> · <a href="https://mcp.garbage.yukai.dev/mcp">唯讀 MCP 伺服器</a></footer></body></html>`;
}

export async function prerender(): Promise<void> {
  if (!await Bun.file('dist/index.html').exists()) throw new Error('Run vite build before prerendering.');
  const urls = ['/'];
  let totalBytes = 0;
  const writePage = async (path: string, html: string) => {
    totalBytes += await Bun.write(`dist${path}index.html`, html);
    urls.push(path);
  };
  for (const adapter of cityRegistry.getAllAdapters()) {
    const cityId = adapter.cityId as City;
    const slugs = districtSlugs[cityId];
    if (!slugs) throw new Error(`Missing district slug map for ${cityId}`);
    if (new Set(Object.values(slugs)).size !== Object.keys(slugs).length
      || Object.values(slugs).some(slug => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
      throw new Error(`Invalid or duplicate district slugs for ${cityId}`);
    }
    const source = Bun.file(`public${adapter.dataUrl}`);
    if (!await source.exists()) throw new Error(`Missing ${source.name}. Run bun run dump-data first.`);
    // Reuse the adapters' unwrapping and field mapping directly on local files.
    // Aggregate all weekdays here, bypassing the browser's today-only filtering.
    const stops = aggregateStops(adapter.preprocessData(await source.json()).map(point => adapter.mapToUnified(point)));
    if (!stops.length) throw new Error(`No stops for ${cityId}`);
    const districts = new Map<string, UnifiedTrashCollectionPoint[]>();
    for (const stop of stops) {
      if (!Object.hasOwn(slugs, stop.district)) throw new Error(`Missing ${cityId} slug for ${stop.district}`);
      if (!districts.has(stop.district)) districts.set(stop.district, []);
      districts.get(stop.district)!.push(stop);
    }
    const entries = [...districts.entries()].sort(([a], [b]) => collator.compare(a, b));
    for (const [district, points] of entries) {
      await writePage(`/${cityId}/${slugs[district]}/`, page(cityId, district,
        `<p>共 ${points.length} 筆停靠時段；同站不同路線或時間分列，重複星期與清運類型合併顯示。</p>${table(points, `${adapter.displayName}${district}停靠點時間表`)}`));
    }
    const links = entries.map(([district, points]) => `<li><a href="/${cityId}/${slugs[district]}/">${escapeHtml(district)}垃圾車時間表</a>（${points.length} 筆）</li>`).join('');
    // City indexes preview one actual stop per district; the complete tables live
    // on district pages, avoiding a second city-wide copy of every stop.
    const preview = entries.map(([district, points]) => ({ ...points[0], location: `${district}：${points[0].location}` }));
    await writePage(`/${cityId}/`, page(cityId, undefined,
      `<p>收錄 ${entries.length} 個行政區、${stops.length} 筆停靠時段。以下僅列出來源有資料的行政區。</p><nav aria-label="行政區時間表"><ul>${links}</ul></nav>${table(preview, '各行政區停靠點預覽（每區一筆，完整時間表請點選行政區）')}`));
    console.log(`${cityId}: ${entries.length} districts, ${stops.length} aggregated visits`);
  }
  await Bun.write('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `<url><loc>${origin}${path}</loc><lastmod>${buildDate}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  console.log(`Prerendered ${urls.length - 1} pages (${(totalBytes / 1024 / 1024).toFixed(2)} MiB HTML); sitemap contains ${urls.length} URLs.`);
}

if (import.meta.main) await prerender();
