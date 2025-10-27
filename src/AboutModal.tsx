import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Info, X, Bug } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
  totalPoints: number;
  activeCount: number;
  upcomingCount: number;
  debugTime?: string;
  onDebugTimeChange?: (time: string) => void;
  scrollToSupport?: boolean;
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
}: AboutModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showDebugSettings, setShowDebugSettings] = useState(false);
  const supportSectionRef = useRef<HTMLDivElement>(null);

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
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              <Info className="h-4 w-4" aria-hidden="true" />
              關於此服務
            </div>
            <h2 id="about-modal-title" className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
              台北市垃圾車地圖
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              查詢台北市、新北市與台中市垃圾車、資源回收車路線與停靠時間，協助居民掌握最佳倒垃圾時機。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-md border border-transparent p-1.5 text-neutral-500 transition-colors hover:border-neutral-200 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:hover:border-neutral-700 dark:hover:text-white"
            aria-label="關閉關於視窗"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 md:text-base">
          <div className="flex flex-wrap gap-3 text-xs text-neutral-600 dark:text-neutral-400 md:text-sm">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 dark:border-neutral-700 dark:bg-neutral-900/60">
              收錄 {totalPoints.toLocaleString()} 個收集點
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 dark:border-neutral-700 dark:bg-neutral-900/60">
              運行中 {activeCount.toLocaleString()} 班
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 dark:border-neutral-700 dark:bg-neutral-900/60">
              即將到站 {upcomingCount.toLocaleString()} 班
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 dark:border-neutral-700 dark:bg-neutral-900/60">
              支援深色模式與行動裝置
            </span>
          </div>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">產品亮點</h3>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">三都資料同步更新</h4>
                <p className="mt-2 text-sm">
                  每月自動抓取台北市、新北市與台中市公開資料，涵蓋超過 20 萬筆收集點，並在部署前精簡欄位以提升載入速度。
                </p>
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">多元時間篩選</h4>
                <p className="mt-2 text-sm">
                  支援立即、30 分鐘、1 小時與 3 小時內的抵達範圍，快速掌握即將到站或正在運行的垃圾車。
                </p>
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">地點與路線搜尋</h4>
                <p className="mt-2 text-sm">
                  透過行政區、里別或地點關鍵字搜尋所有符合條件的收集點，新搬的住戶也能快速上手。
                </p>
              </li>
              <li className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">行動裝置友善</h4>
                <p className="mt-2 text-sm">
                  響應式介面搭配 PWA 支援、深淺色模式，在手機、平板與桌機皆能流暢操作。
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">如何使用</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm md:text-base">
              <li>選擇查看的縣市（台北市、新北市或台中市）。</li>
              <li>搜尋行政區、里別或收集點名稱，快速鎖定常用地點。</li>
              <li>套用時間篩選，顯示即將抵達或正在運行的班次。</li>
              <li>點擊地圖標記，查看詳細停靠描述與抵達/離開時間。</li>
              <li>啟用定位功能，找出距離最近的收集點與行車時間。</li>
            </ol>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">資料來源與更新</h3>
            <p className="mt-2 text-sm md:text-base">
              平台整合三都政府開放資料，透過 GitHub Actions 每月自動抓取、整理並部署最新版本。台中市資料經內政地理資訊圖資雲整合服務平台批次地理編碼處理，確保座標精準度。
            </p>
            <ul className="mt-3 space-y-2 text-sm md:text-base">
              <li>
                <a
                  href="https://data.taipei/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  台北市政府資料開放平台：垃圾車收集點資料集
                </a>
              </li>
              <li>
                <a
                  href="https://data.ntpc.gov.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  新北市政府資料開放平台：垃圾車與資源回收車路線
                </a>
              </li>
              <li>
                <a
                  href="https://datacenter.taichung.gov.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  台中市政府資料開放平台：定時定點垃圾收運地點
                </a>
              </li>
              <li>
                <a
                  href="https://www.tgos.tw/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  內政地理資訊圖資雲整合服務平台：地理編碼服務
                </a>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  (台中市地址座標轉換)
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">常見問題</h3>
            <div className="mt-3 space-y-3">
              <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-white">
                  資料多久更新一次？
                </summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  系統會在每月政府資料更新後自動重新抓取、處理並部署。若有特殊情況，可在 GitHub 觸發手動更新以掌握最新資訊。
                </p>
              </details>
              <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-white">
                  是否支援離線或通知功能？
                </summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  目前為線上查詢工具，可透過 PWA 加入主畫面以獲得近似 App 的體驗。後續會評估整合通知或提醒功能。
                </p>
              </details>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">作者與貢獻者</h3>
            <div className="mt-3 space-y-2 text-sm md:text-base">
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">作者：</span>
                <a
                  href="https://github.com/Yukaii"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  Yukaii
                </a>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">貢獻者：</span>
                <a
                  href="https://github.com/pastleo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
                >
                  PastLeo
                </a>
              </div>
              <div>
                <span className="font-semibold text-neutral-900 dark:text-white">AI 協作：</span>
                <span className="ml-2 text-neutral-700 dark:text-neutral-300">
                  Claude Sonnet 4.5, GPT-5-Codex
                </span>
              </div>
            </div>
          </section>

          {/* Support Section */}
          <section ref={supportSectionRef} className="scroll-mt-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white md:text-lg">支持這個專案</h3>
            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                如果這個工具對您有幫助，歡迎請作者喝杯咖啡！您的支持是我們持續改進的動力。
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
          <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <button
              onClick={() => setShowDebugSettings(!showDebugSettings)}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <Bug className="h-4 w-4" />
              開發者除錯模式
              <span className="ml-auto text-xs opacity-60">
                {showDebugSettings ? '▼' : '▶'}
              </span>
            </button>

            {showDebugSettings && onDebugTimeChange && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                  🚛 即時追蹤測試模式
                </h4>
                <p className="mt-2 text-xs text-yellow-800 dark:text-yellow-300">
                  設定自訂時間來測試垃圾車即時位置追蹤功能。此設定僅用於開發測試，不會影響實際資料。
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="debug-time" className="block text-xs font-medium text-yellow-900 dark:text-yellow-200">
                      測試時間 (HH:MM 格式)
                    </label>
                    <input
                      id="debug-time"
                      type="time"
                      value={debugTime || ''}
                      onChange={(e) => onDebugTimeChange(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-yellow-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:border-yellow-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const hours = now.getHours().toString().padStart(2, '0');
                        const minutes = now.getMinutes().toString().padStart(2, '0');
                        onDebugTimeChange(`${hours}:${minutes}`);
                      }}
                      className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 hover:bg-yellow-50 dark:border-yellow-800 dark:bg-neutral-900 dark:text-yellow-200 dark:hover:bg-neutral-800"
                    >
                      使用目前時間
                    </button>
                    <button
                      onClick={() => onDebugTimeChange('')}
                      className="rounded-md border border-yellow-300 bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 hover:bg-yellow-50 dark:border-yellow-800 dark:bg-neutral-900 dark:text-yellow-200 dark:hover:bg-neutral-800"
                    >
                      清除測試時間
                    </button>
                  </div>

                  {debugTime && (
                    <div className="rounded-md bg-yellow-100 px-3 py-2 text-xs text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
                      <strong>目前測試時間：</strong> {debugTime}
                      <br />
                      <span className="opacity-75">垃圾車位置將基於此時間計算</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          <span>若發現資料異常或有功能建議，歡迎於 GitHub 提交 Issue。</span>
          <a
            href="https://github.com/yukaii/garbage/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1 font-medium text-sky-600 hover:border-sky-200 hover:bg-sky-50 dark:border-neutral-700 dark:text-sky-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
          >
            前往 GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
