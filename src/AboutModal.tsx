import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Info, X, Bug } from 'lucide-react';
import { getPlatformInfo } from './utils/platform';
import { formatDataDate, type DataMeta } from './hooks/useDataMeta';
import type { City } from './cities/cityRegistry';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  totalPoints: number;
  activeCount: number;
  upcomingCount: number;
  debugTime?: string;
  onDebugTimeChange?: (time: string) => void;
  scrollToSupport?: boolean;
  dataMeta?: DataMeta | null;
}

function UpdatedAt({ meta, city }: { meta?: DataMeta | null; city: City }) {
  const date = formatDataDate(meta?.[city]?.updatedAt);
  if (!date) return null;
  return <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">（資料更新於 {date}）</span>;
}

export default function AboutModal({
  open,
  onClose,
  totalPoints,
  activeCount,
  upcomingCount,
  debugTime,
  onDebugTimeChange,
  scrollToSupport = false,
  dataMeta,
}: AboutModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showDebugSettings, setShowDebugSettings] = useState(false);
  const supportSectionRef = useRef<HTMLDivElement>(null);
  const [platformInfo] = useState(() => getPlatformInfo());

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    // Scroll to support section if requested
    if (scrollToSupport && supportSectionRef.current) {
      const scrollTimeout = window.setTimeout(() => {
        supportSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = previousOverflow;
        window.clearTimeout(timeout);
        window.clearTimeout(scrollTimeout);
      };
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timeout);
    };
  }, [open, onClose, scrollToSupport]);

  if (!open) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl outline-none dark:border-neutral-800 dark:bg-neutral-950"
        ref={dialogRef}
        onClick={handleDialogClick}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              <Info className="h-4 w-4" aria-hidden="true" />
              關於本站
            </div>
            <h2 id="about-modal-title" className="mt-1.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100 md:text-xl">
              垃圾車地圖
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              收錄台北市、新北市、台中市與高雄市的垃圾車及資源回收車停靠點、清運路線與抵達時間，幫你輕鬆掌握出門倒垃圾的時間。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:hover:border-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="關閉關於視窗"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 md:text-base">
          <div className="flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 tabular-nums dark:border-neutral-800 dark:bg-neutral-900/60">
              已載入 {totalPoints.toLocaleString()} 個停靠點
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 tabular-nums dark:border-neutral-800 dark:bg-neutral-900/60">
              收運中 {activeCount.toLocaleString()} 站
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 tabular-nums dark:border-neutral-800 dark:bg-neutral-900/60">
              即將抵達 {upcomingCount.toLocaleString()} 站
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 dark:border-neutral-800 dark:bg-neutral-900/60">
              支援離線瀏覽與深色模式
            </span>
          </div>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">功能特色</h3>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              <li className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">四都資料定期同步</h4>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  每週自動同步台北、新北、台中與高雄市政府開放資料，涵蓋全台超過 20 萬筆清運停靠點。
                </p>
              </li>
              <li className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">到站時間快速篩選</h4>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  可依「現在」、「30 分鐘內」、「1 小時內」或「3 小時內」篩選，一眼看清正在收運或即將抵達的班次。
                </p>
              </li>
              <li className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">搜尋、收藏與分享</h4>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  輸入行政區、里別、路名或路線即可找站；常去的停靠點可加入收藏，也能複製連結分享給家人與鄰居。
                </p>
              </li>
              <li className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">安裝成 App・離線可用</h4>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  支援深淺色模式與衛星地圖；加到手機主畫面後即可像 App 一樣使用，沒網路也能查時刻表。
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">使用方式</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm md:text-base">
              <li>選擇所在縣市（台北市、新北市、台中市或高雄市），或點選地圖左側定位按鈕移至目前位置。</li>
              <li>在上方搜尋欄輸入行政區、里別、路名或路線名稱，快速找到住家附近的停靠點。</li>
              <li>點選時間篩選按鈕，過濾出正在收運或即將抵達的班次。</li>
              <li>點擊地圖上的站點查看詳細抵達與離開時間，並可開啟 Google 地圖導航、加入收藏或分享連結。</li>
              <li>展開「路線列表」可查看整條清運路線的沿途停靠點與預估行駛進度。</li>
            </ol>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">資料來源與更新</h3>
            <p className="mt-2 text-sm md:text-base">
              本站整合六縣市政府及環境部公開資料，每週透過 GitHub Actions 自動檢查，有更新時重新整理並部署。台中市、高雄市、彰化縣與雲林縣的部分站點經內政部 TGOS 地理編碼服務轉換座標，以提升地圖定位準確度。
            </p>
            <ul className="mt-3 space-y-2 text-sm md:text-base">
              <li>
                <a
                  href="https://data.taipei/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  台北市政府資料開放平台：垃圾車收集點資料集
                </a>
                <UpdatedAt meta={dataMeta} city="taipei" />
              </li>
              <li>
                <a
                  href="https://data.ntpc.gov.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  新北市政府資料開放平台：垃圾車與資源回收車路線
                </a>
                <UpdatedAt meta={dataMeta} city="new-taipei" />
              </li>
              <li>
                <a
                  href="https://data.gov.tw/dataset/84004"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  台中市政府資料開放平台：定時定點垃圾收運地點
                </a>
                <UpdatedAt meta={dataMeta} city="taichung" />
              </li>
              <li>
                <a
                  href="https://data.kcg.gov.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  高雄市政府資料開放平台：垃圾車清運路線與點位
                </a>
                <UpdatedAt meta={dataMeta} city="kaohsiung" />
              </li>
              <li>
                <a
                  href="https://hwms.moenv.gov.tw/dispPageBox/route/routeCP.aspx?ddsPageID=ROUTE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  環境部全國垃圾車清運路線查詢網：彰化縣清運路線與停靠點
                </a>
                <UpdatedAt meta={dataMeta} city="changhua" />
              </li>
              <li>
                <a
                  href="https://hwms.moenv.gov.tw/dispPageBox/route/routeCP.aspx?ddsPageID=ROUTE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  環境部全國垃圾車清運路線查詢網：雲林縣清運路線與停靠點
                </a>
                <UpdatedAt meta={dataMeta} city="yunlin" />
              </li>
              <li>
                <a
                  href="https://www.tgos.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  內政部地理資訊圖資雲服務平台（TGOS）：地理編碼服務
                </a>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  （台中市、高雄市、彰化縣、雲林縣地址座標轉換）
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">常見問題</h3>
            <div className="mt-3 space-y-2.5">
              <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  資料多久更新一次？時間準確嗎？
                </summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  系統每月會自動同步各縣市政府公開資料並更新網站。由於垃圾車實際抵達時間可能因當日路況、天候或清運量而有幾分鐘的落差，建議提早到站等候。
                </p>
              </details>
              <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  支援離線查看或到站通知嗎？
                </summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  將網站「加到手機主畫面」後，系統會在背景自動快取縣市資料，即使沒有網路也能查看停靠點與時刻表。你也可以把常用站點加入「收藏」方便快速查閱；到站提醒通知則會在後續版本評估加入。
                </p>
              </details>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">作者與貢獻者</h3>
            <div className="mt-3 space-y-2 text-sm md:text-base">
              <div>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">作者：</span>
                <a
                  href="https://github.com/Yukaii"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  Yukaii
                </a>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">貢獻者：</span>
                <a
                  href="https://github.com/pastleo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  PastLeo
                </a>
              </div>
            </div>
          </section>

          {/* Support Section */}
          <section ref={supportSectionRef} className="scroll-mt-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 md:text-lg">支持這個專案</h3>
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                如果這個小工具幫你省下了追垃圾車的時間，歡迎請作者喝杯咖啡！你的支持是持續維護與擴充新縣市的最大動力。
              </p>
              <div className="mt-4 flex justify-center">
                <a
                  href="https://www.buymeacoffee.com/yukaii"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block transition-transform hover:scale-105"
                >
                  <img
                    src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                    alt="Buy Me A Coffee"
                    className="h-[60px] w-[217px]"
                  />
                </a>
              </div>
            </div>
          </section>

          {/* Debug Settings Section */}
          <section className="border-t border-neutral-200/80 pt-6 dark:border-neutral-800/80">
            <button
              type="button"
              onClick={() => setShowDebugSettings(!showDebugSettings)}
              className="flex w-full items-center gap-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <Bug className="h-4 w-4" />
              開發者除錯模式
              <span className="ml-auto text-xs opacity-60">
                {showDebugSettings ? '▼' : '▶'}
              </span>
            </button>

            {showDebugSettings && (
              <div className="mt-4 space-y-4">
                {/* Platform Information */}
                <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/80 dark:bg-sky-950/30">
                  <h4 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                    📱 平台資訊
                  </h4>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-sky-700 dark:text-sky-300">裝置類型：</span>
                      <span className="font-medium text-sky-900 dark:text-sky-100">
                        {platformInfo.isAndroid ? 'Android' : platformInfo.isIOS ? 'iOS' : 'Desktop'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-700 dark:text-sky-300">瀏覽器：</span>
                      <span className="font-medium text-sky-900 capitalize dark:text-sky-100">
                        {platformInfo.browser}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-700 dark:text-sky-300">獨立模式：</span>
                      <span className="font-medium text-sky-900 dark:text-sky-100">
                        {platformInfo.isStandalone ? '✓ 已安裝' : '✗ 未安裝'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-700 dark:text-sky-300">PWA 安裝支援：</span>
                      <span className="font-medium text-sky-900 dark:text-sky-100">
                        {platformInfo.canInstall ? '✓ 支援' : '✗ 不支援'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-700 dark:text-sky-300">User Agent：</span>
                      <span className="truncate font-mono text-[10px] text-sky-900 dark:text-sky-100">
                        {navigator.userAgent.slice(0, 40)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time Testing */}
                {onDebugTimeChange && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/80 dark:bg-amber-950/30">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      🚛 即時追蹤測試模式
                    </h4>
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                      設定自訂時間來測試垃圾車即時位置與篩選狀態。此設定僅影響目前畫面顯示，不會改動實際資料。
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label htmlFor="debug-time" className="block text-xs font-medium text-amber-900 dark:text-amber-200">
                          測試時間（HH:MM 格式）
                        </label>
                        <input
                          id="debug-time"
                          type="time"
                          value={debugTime || ''}
                          onChange={(e) => onDebugTimeChange(e.target.value)}
                          className="mt-1 block h-9 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm text-neutral-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 focus:outline-none dark:border-amber-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const hours = now.getHours().toString().padStart(2, '0');
                            const minutes = now.getMinutes().toString().padStart(2, '0');
                            onDebugTimeChange(`${hours}:${minutes}`);
                          }}
                          className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:bg-neutral-900 dark:text-amber-200 dark:hover:bg-neutral-800"
                        >
                          套用目前時間
                        </button>
                        <button
                          type="button"
                          onClick={() => onDebugTimeChange('')}
                          className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:bg-neutral-900 dark:text-amber-200 dark:hover:bg-neutral-800"
                        >
                          恢復正常時間
                        </button>
                      </div>

                      {debugTime && (
                        <div className="rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                          <strong>目前測試時間：</strong> {debugTime}
                          <br />
                          <span className="opacity-75">站點狀態與垃圾車預估位置將依此時間計算</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 bg-neutral-50 px-5 py-3.5 text-xs text-neutral-500 dark:border-neutral-800/80 dark:bg-neutral-950 dark:text-neutral-400">
          <span>發現站點資料有誤，或希望支援其他縣市？歡迎至 GitHub 回報。</span>
          <a
            href="https://github.com/yukaii/garbage/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 font-medium text-sky-600 transition-colors hover:border-sky-300 hover:bg-sky-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-sky-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
          >
            前往 GitHub 回報
          </a>
        </div>
      </div>
    </div>
  );
}
