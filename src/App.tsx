import { useEffect, useState, useMemo } from 'react';
import { Info, Sun, Moon, ChevronDown, MessageSquarePlus, Star, X, MapPin, Navigation } from 'lucide-react';
import Map from './Map';
import TimeFilter, { type TimeFilterMode } from './TimeFilter';
import {
  fetchTrashCollectionPoints,
  fetchMultipleCities,
  getCitiesInViewport,
  MIN_DATA_LOAD_ZOOM,
  getCurrentTimeInMinutes,
  getTimeStatus,
  isWithinTimeWindow,
  groupPointsIntoRoutes,
  type City
} from './api';
import { cityRegistry } from './cities/cityRegistry';
import type { UnifiedTrashCollectionPoint } from './types';
import './App.css';
import AboutModal from './AboutModal';
import AdSense from './AdSense';
import { Logo } from './Logo';
import { updateThemeColor, initializeThemeColor } from './utils/themeColor';
import { useFavorites } from './hooks/useFavorites';
import { getPointIdFromUrl, getCityFromPointId } from './utils/share';

function App() {
  const [points, setPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPoints, setFilteredPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>('all');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    // Initialize with debug time if available
    return getCurrentTimeInMinutes();
  });
  const [selectedCity, setSelectedCity] = useState<City>(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('selectedCity');
    // Validate saved city exists in registry, otherwise default to first city
    if (saved && cityRegistry.hasCity(saved)) {
      return saved as City;
    }
    return cityRegistry.getCityIds()[0];
  });
  const [loadedCities, setLoadedCities] = useState<City[]>([]);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // Otherwise check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [scrollToSupport, setScrollToSupport] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isStarredListOpen, setIsStarredListOpen] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Favorites hook
  const { starredPointIds, toggleStar, isStarred, starredCount } = useFavorites();
  const isStarredControlActive = showStarredOnly || isStarredListOpen;

  const handleViewportChange = (bounds: { north: number; south: number; east: number; west: number }, zoom: number) => {
    setViewportBounds(bounds);
    setCurrentZoom(zoom);
  };
  const [debugTime, setDebugTime] = useState<string>('');

  // Initial loading state: both data and map must be loaded for first time
  const initialLoading = !initialLoadComplete || !mapLoaded;
  // Data updating state: show subtle indicator instead of blocking UI
  const isUpdatingData = !dataLoaded;

  // Initialize theme color on mount
  useEffect(() => {
    initializeThemeColor();
  }, []);

  useEffect(() => {
    // Save dark mode preference and update document class
    localStorage.setItem('darkMode', darkMode.toString());
    document.documentElement.classList.toggle('dark', darkMode);

    // Update theme-color meta tag for iOS/Android status bar
    updateThemeColor(darkMode);
  }, [darkMode]);

  useEffect(() => {
    // Update current time every minute (unless debug time is set)
    const interval = setInterval(() => {
      if (!debugTime) {
        setCurrentTimeMinutes(getCurrentTimeInMinutes());
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [debugTime]);

  // Update currentTimeMinutes when debugTime changes
  useEffect(() => {
    if (debugTime) {
      const [hours, minutes] = debugTime.split(':').map(Number);
      setCurrentTimeMinutes(hours * 60 + minutes);
    } else {
      setCurrentTimeMinutes(getCurrentTimeInMinutes());
    }
  }, [debugTime]);

  useEffect(() => {
    // Save city preference
    localStorage.setItem('selectedCity', selectedCity);
  }, [selectedCity]);

  // Determine which cities should be loaded based on viewport
  // Also include the city from shared point URL if present
  const citiesToLoad = useMemo(() => {
    const cities = getCitiesInViewport(viewportBounds, currentZoom);
    let result = cities.length === 0 ? [selectedCity] : cities;
    
    // Check if there's a shared point in URL and include its city
    const sharedPointId = getPointIdFromUrl();
    if (sharedPointId) {
      const sharedPointCity = getCityFromPointId(sharedPointId);
      if (sharedPointCity && cityRegistry.hasCity(sharedPointCity) && !result.includes(sharedPointCity as City)) {
        result = [...result, sharedPointCity as City];
      }
    }
    
    return result;
  }, [viewportBounds, currentZoom, selectedCity]);

  // Check if user is viewing an unsupported area
  const isViewingUnsupportedArea = useMemo(() => {
    // Only show unsupported feedback when zoomed in enough but no cities in viewport
    if (!viewportBounds || currentZoom < MIN_DATA_LOAD_ZOOM) return false;
    const citiesInView = getCitiesInViewport(viewportBounds, currentZoom);
    return citiesInView.length === 0;
  }, [viewportBounds, currentZoom]);

  // Load data only when the set of cities changes (not on every zoom/pan)
  useEffect(() => {
    async function loadData() {
      try {
        // Check if we already have the right cities loaded
        const currentSet = new Set(loadedCities);
        const requiredSet = new Set(citiesToLoad);

        // Skip reload if we already have exactly the right cities
        if (
          currentSet.size === requiredSet.size &&
          citiesToLoad.every(city => currentSet.has(city))
        ) {
          return;
        }

        setDataLoaded(false);

        // Load data for required cities
        const data = await fetchMultipleCities(citiesToLoad);
        setPoints(data);
        setFilteredPoints(data);
        setLoadedCities(citiesToLoad);
        setError(null);
        setDataLoaded(true);
        setInitialLoadComplete(true);
      } catch (err) {
        setError('無法載入垃圾車資料，請稍後再試');
        console.error(err);
      }
    }
    loadData();
  }, [citiesToLoad.join(',')]); // Only reload when the city list changes

  useEffect(() => {
    let filtered = points;

    // Apply starred filter first
    if (showStarredOnly) {
      filtered = filtered.filter((point) => starredPointIds.includes(point.id));
    }

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
  }, [searchTerm, points, timeFilterMode, currentTimeMinutes, showStarredOnly, starredPointIds]);

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
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur-sm dark:border-neutral-800 dark:bg-black/90 md:px-6 md:py-3 lg:px-8" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Logo size={32} className="shrink-0 text-white dark:text-black" />
            <h1 className="truncate text-base font-bold text-black dark:text-white sm:text-lg md:text-xl lg:text-3xl">
              垃圾車地圖
            </h1>
            <p className="hidden whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400 md:inline">
              {cityRegistry.getAdapter(selectedCity).displayName} 收集點
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
                {cityRegistry.getCityOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
          <div className="max-w-4xl flex flex-wrap items-center gap-3">
            <TimeFilter
              selectedMode={timeFilterMode}
              onModeChange={setTimeFilterMode}
              activeCount={activeCount}
              upcomingCount={upcomingCount}
            />
            {/* Starred filter and list buttons */}
            <div
              className={`
                flex-none self-end flex items-stretch divide-x overflow-hidden rounded-md border text-xs font-medium transition-shadow
                ${
                  isStarredControlActive
                    ? 'border-amber-500 divide-amber-400/60 shadow-[0_10px_25px_-12px_rgba(251,191,36,0.8)] dark:shadow-[0_14px_30px_-15px_rgba(251,191,36,0.45)]'
                    : 'border-neutral-300 divide-neutral-200 dark:border-neutral-700 dark:divide-neutral-700'
                }
              `}
            >
              <button
                type="button"
                aria-pressed={showStarredOnly}
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500
                  ${
                    showStarredOnly
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-neutral-700 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/90'
                  }
                `}
                title={showStarredOnly ? '顯示全部站點' : '只顯示收藏站點'}
              >
                <Star className="h-4 w-4" strokeWidth={2} fill={showStarredOnly ? 'currentColor' : 'none'} />
                <span>收藏</span>
                {starredCount > 0 && (
                  <span className={`${showStarredOnly ? 'text-amber-100' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    ({starredCount})
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-expanded={isStarredListOpen}
                onClick={() => setIsStarredListOpen(!isStarredListOpen)}
                className={`
                  flex items-center justify-center px-2.5 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500
                  ${
                    isStarredListOpen
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/90'
                  }
                `}
                title="查看收藏列表"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isStarredListOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 hidden flex-wrap gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 md:mt-3 md:flex md:text-xs">
          <span className="rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
            總共 {points.length} 個收集點
            {loadedCities.length > 1 && (
              <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400">
                (雙北資料)
              </span>
            )}
          </span>
          {searchTerm && (
            <span className="rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900">
              顯示 {filteredPoints.length} 個結果
            </span>
          )}
          <span className="hidden rounded border border-neutral-200 bg-neutral-100 px-2 py-1 dark:border-neutral-800 dark:bg-neutral-900 md:inline">
            運行中 {activeCount} 班、即將到站 {upcomingCount} 班
          </span>
          {currentZoom < MIN_DATA_LOAD_ZOOM && (
            <span className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400">
              放大以載入資料 (目前縮放: {currentZoom.toFixed(1)})
            </span>
          )}
        </div>
      </header>

      <main id="main-content" className="flex-1 flex flex-col min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <section className="relative flex-1 min-h-[320px] overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Full-screen loading only on initial load */}
          {initialLoading && (
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
          {/* Show map after initial load, even during data updates */}
          {initialLoadComplete && !error && (
            <>
              <Map
                points={selectedRoute ? points : filteredPoints}
                darkMode={darkMode}
                onMapLoaded={handleMapLoaded}
                selectedRoute={selectedRoute}
                onRouteSelect={setSelectedRoute}
                onViewportChange={handleViewportChange}
                currentTimeMinutes={currentTimeMinutes}
                starredPointIds={starredPointIds}
                onToggleStar={toggleStar}
                isStarredListOpen={isStarredListOpen}
                onCloseStarredList={() => setIsStarredListOpen(false)}
                allPoints={points}
              />
              {/* Subtle loading indicator for data updates */}
              {isUpdatingData && (
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-neutral-300 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-black/90">
                  <div className="h-4 w-4 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400 rounded-full spinner" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">更新資料中...</span>
                </div>
              )}
              {/* Feedback button for unsupported areas */}
              {isViewingUnsupportedArea && (
                <div className="absolute bottom-24 left-4 right-4 z-20 mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50/95 backdrop-blur-sm px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950/95 md:bottom-4 md:left-4 md:right-auto">
                  <div className="flex items-start gap-3">
                    <MessageSquarePlus className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                        此區域尚未支援
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        目前僅支援台北市、新北市、台中市與高雄市
                      </p>
                      <a
                        href="https://github.com/yukaii/garbage/issues/new?title=請求支援新城市&body=希望支援的城市："
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
                      >
                        在 GitHub 上回報需求
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

      </main>

      {/* Ad Section - Mobile and Desktop */}
      {import.meta.env.VITE_ADSENSE_CLIENT_ID && import.meta.env.VITE_ADSENSE_SLOT_ID && (
        <aside className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
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

      <footer className="hidden border-t border-neutral-200 bg-neutral-100 px-4 py-3 text-[11px] text-neutral-600 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-400 md:px-6 md:py-4 md:text-xs lg:px-8 md:block" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            資料來源：台北市、新北市與台中市政府開放資料平台。
            <button
              onClick={() => {
                setScrollToSupport(false);
                setIsAboutOpen(true);
              }}
              className="ml-1 text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
              type="button"
            >
              查看完整說明
            </button>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setScrollToSupport(true);
                setIsAboutOpen(true);
              }}
              className="text-sky-600 underline-offset-4 hover:underline dark:text-sky-400"
              type="button"
            >
              請我喝咖啡
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
        onClose={() => {
          setIsAboutOpen(false);
          setScrollToSupport(false);
        }}
        totalPoints={points.length}
        activeCount={activeCount}
        upcomingCount={upcomingCount}
        debugTime={debugTime}
        onDebugTimeChange={setDebugTime}
        scrollToSupport={scrollToSupport}
      />
    </div>
  );
}

export default App;
