import { useEffect, useState } from 'react';
import { Info, Sun, Moon, ChevronDown } from 'lucide-react';
import Map from './Map';
import TimeFilter, { type TimeFilterMode } from './TimeFilter';
import {
  fetchTrashCollectionPoints,
  getCurrentTimeInMinutes,
  getTimeStatus,
  isWithinTimeWindow,
  type City
} from './api';
import type { UnifiedTrashCollectionPoint } from './types';
import './App.css';
import AboutModal from './AboutModal';
import AdSense from './AdSense';

function App() {
  const [points, setPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPoints, setFilteredPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>('all');
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(getCurrentTimeInMinutes());
  const [selectedCity, setSelectedCity] = useState<City>(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('selectedCity');
    return (saved === 'new-taipei' ? 'new-taipei' : 'taipei') as City;
  });
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // Otherwise check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Derived loading state: both data and map must be loaded
  const loading = !dataLoaded || !mapLoaded;

  useEffect(() => {
    // Save dark mode preference and update document class
    localStorage.setItem('darkMode', darkMode.toString());
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    // Update current time every minute
    const interval = setInterval(() => {
      setCurrentTimeMinutes(getCurrentTimeInMinutes());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Save city preference
    localStorage.setItem('selectedCity', selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    async function loadData() {
      try {
        setDataLoaded(false);
        setMapLoaded(false);
        const data = await fetchTrashCollectionPoints(selectedCity);
        setPoints(data);
        setFilteredPoints(data);
        setError(null);
        setDataLoaded(true);
      } catch (err) {
        setError('無法載入垃圾車資料，請稍後再試');
        console.error(err);
      }
    }
    loadData();
  }, [selectedCity]);

  useEffect(() => {
    let filtered = points;

    // Apply text search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((point) =>
        point.district.toLowerCase().includes(search) ||
        point.village.toLowerCase().includes(search) ||
        point.location.toLowerCase().includes(search) ||
        point.route.toLowerCase().includes(search)
      );
    }

    // Apply time-based filter
    if (timeFilterMode !== 'all') {
      const windowMap: Record<TimeFilterMode, number> = {
        'all': Infinity,
        'now': 0,
        '30min': 30,
        '1hour': 60,
        '3hours': 180,
      };

      if (timeFilterMode === 'now') {
        // Show only active trucks
        filtered = filtered.filter((point) =>
          getTimeStatus(point.arrivalTime, point.departureTime, currentTimeMinutes) === 'active'
        );
      } else {
        // Show trucks within time window
        const windowMinutes = windowMap[timeFilterMode];
        filtered = filtered.filter((point) =>
          isWithinTimeWindow(point.arrivalTime, point.departureTime, currentTimeMinutes, windowMinutes)
        );
      }
    }

    setFilteredPoints(filtered);
  }, [searchTerm, points, timeFilterMode, currentTimeMinutes]);

  // Calculate active and upcoming counts for TimeFilter
  const activeCount = points.filter((point) =>
    getTimeStatus(point.arrivalTime, point.departureTime, currentTimeMinutes) === 'active'
  ).length;

  const upcomingCount = points.filter((point) =>
    getTimeStatus(point.arrivalTime, point.departureTime, currentTimeMinutes) === 'upcoming'
  ).length;

  const handleMapLoaded = () => {
    setMapLoaded(true);
  };

  const renderSearchField = (wrapperClass: string) => (
    <div className={`relative w-full ${wrapperClass}`}>
      <input
        type="text"
        placeholder="搜尋行政區、里別、地點或路線..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-sm text-black placeholder-neutral-500 transition-colors focus:border-black focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder-neutral-500 dark:focus:border-white"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-black dark:hover:text-white"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen w-full bg-white dark:bg-black">
      <a href="#main-content" className="skip-link">
        跳至主要內容
      </a>
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur-sm dark:border-neutral-800 dark:bg-black/90 md:px-6 md:py-3 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="truncate text-base font-bold text-black dark:text-white sm:text-lg md:text-xl lg:text-3xl">
              垃圾車地圖
            </h1>
            <p className="hidden whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400 md:inline">
              {selectedCity === 'taipei' ? '台北市' : '新北市'} 收集點
            </p>
          </div>
          {renderSearchField('hidden md:flex md:min-w-[220px] md:flex-1 md:max-w-md lg:max-w-lg')}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value as City)}
                className="h-8 shrink-0 appearance-none rounded-md border border-neutral-300 bg-white pl-2 pr-6 text-xs text-black transition-colors hover:border-black focus:border-black focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-white dark:focus:border-white sm:h-9 sm:pl-3 sm:pr-8 sm:text-sm"
              >
                <option value="taipei">台北市</option>
                <option value="new-taipei">新北市</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500 dark:text-neutral-300 sm:right-3" />
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-black transition-all hover:border-black hover:bg-neutral-50 dark:border-neutral-700 dark:text-white dark:hover:border-white dark:hover:bg-neutral-900 sm:h-9 sm:w-9"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 px-2 text-xs font-medium text-neutral-700 transition-colors hover:border-black hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-white dark:hover:text-white sm:h-9 sm:px-3 sm:text-sm"
              type="button"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">關於</span>
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between md:hidden">
          <span className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            總共 {points.length} 個收集點
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileFilterOpen((prev) => !prev)}
              aria-expanded={isMobileFilterOpen}
              aria-controls="mobile-filters"
              className="text-xs font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
            >
              {isMobileFilterOpen ? '收合篩選' : '搜尋 / 篩選'}
            </button>
          </div>
        </div>
        <div
          id="mobile-filters"
          className={`${
            isMobileFilterOpen ? 'grid' : 'hidden'
          } mt-3 gap-3 md:mt-4 md:grid md:grid-cols-1`}
        >
          {renderSearchField('max-w-2xl md:hidden')}
          <div className="max-w-4xl">
            <TimeFilter
              selectedMode={timeFilterMode}
              onModeChange={setTimeFilterMode}
              activeCount={activeCount}
              upcomingCount={upcomingCount}
            />
          </div>
        </div>
        <div className="mt-2 hidden flex-wrap gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 md:mt-3 md:flex md:text-xs">
          <span className="rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            總共 {points.length} 個收集點
          </span>
          {searchTerm && (
            <span className="rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
              顯示 {filteredPoints.length} 個結果
            </span>
          )}
          <span className="hidden rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900 md:inline">
            運行中 {activeCount} 班、即將到站 {upcomingCount} 班
          </span>
        </div>
      </header>

      <main id="main-content" className="flex-1 flex flex-col min-h-0">
        <section className="relative flex-1 min-h-[320px] overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50 h-full w-full">
              <div className="w-12 h-12 border-4 border-neutral-200 dark:border-neutral-800 border-t-black dark:border-t-white rounded-full spinner" />
              <p className="mt-4 text-neutral-600 dark:text-neutral-400">載入中...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {dataLoaded && !error && <Map points={filteredPoints} darkMode={darkMode} onMapLoaded={handleMapLoaded} />}
        </section>

      </main>

      {/* Ad Section - Mobile and Desktop */}
      {import.meta.env.VITE_ADSENSE_CLIENT_ID && import.meta.env.VITE_ADSENSE_SLOT_ID && (
        <aside className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mx-auto max-w-5xl">
            <div className="mb-2 text-center text-[10px] text-neutral-500 dark:text-neutral-500">
              廣告
            </div>
            <AdSense
              client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
              slot={import.meta.env.VITE_ADSENSE_SLOT_ID}
              format="auto"
              responsive={true}
              className="mx-auto max-w-3xl"
            />
          </div>
        </aside>
      )}

      <footer className="hidden border-t border-neutral-200 bg-neutral-100 px-4 py-3 text-[11px] text-neutral-600 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-400 md:px-6 md:py-4 md:text-xs lg:px-8 md:block">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span>資料來源：台北市與新北市政府資料開放平台。</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
              type="button"
            >
              關於此服務
            </button>
            <a
              href="https://github.com/yukaii/garbage/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
            >
              回報問題
            </a>
          </div>
        </div>
      </footer>

      <AboutModal
        open={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        totalPoints={points.length}
        activeCount={activeCount}
        upcomingCount={upcomingCount}
      />
    </div>
  );
}

export default App;
