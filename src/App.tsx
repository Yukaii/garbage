import { useEffect, useState, useMemo } from 'react';
import { MessageSquarePlus, RotateCw } from 'lucide-react';
import Map from './Map';
import { type TimeFilterMode } from './TimeFilter';
import {
  fetchMultipleCities,
  getCitiesInViewport,
  MIN_DATA_LOAD_ZOOM,
  getPointStatus,
  isWithinTimeWindow,
  type City
} from './api';
import { servesOn } from './cities/schedule';
import { taipeiClock, type TaipeiClock } from './utils/taipeiTime';
import { cityRegistry } from './cities/cityRegistry';
import type { UnifiedTrashCollectionPoint } from './types';
import './App.css';
import AboutModal from './AboutModal';
import AdSense from './AdSense';
import { updateThemeColor, initializeThemeColor } from './utils/themeColor';
import { useFavorites } from './hooks/useFavorites';
import { useDataMeta, oldestUpdate } from './hooks/useDataMeta';
import { getPointIdFromUrl, getCityFromPointId } from './utils/share';
import { Navbar } from './Navbar';
import { FilterBar } from './FilterBar';
import { Menu } from './Menu';

function App() {
  const [points, setPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `?q=` makes searches linkable (and is the target of the site's SearchAction structured data)
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>('all');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  // Taiwan time and weekday; debug time (About dialog) overrides the minutes only
  const [realClock, setRealClock] = useState<TaipeiClock>(() => taipeiClock());
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
  const [failedCities, setFailedCities] = useState<City[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    // Otherwise check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const { starredPointIds, toggleStar, starredCount } = useFavorites();
  const dataMeta = useDataMeta();
  const dataUpdatedAt = oldestUpdate(dataMeta, loadedCities);

  const handleViewportChange = (bounds: { north: number; south: number; east: number; west: number }, zoom: number) => {
    setViewportBounds(bounds);
    setCurrentZoom(zoom);
  };
  const [debugTime, setDebugTime] = useState<string>('');

  // Initial loading state: both data and map must be loaded for first time
  const initialLoading = !initialLoadComplete || !mapLoaded;
  // Data updating state: show subtle indicator instead of blocking UI
  const isUpdatingData = !dataLoaded;

  // Keep the search term in the URL so a search can be shared or deep-linked
  useEffect(() => {
    const url = new URL(window.location.href);
    if (searchTerm) url.searchParams.set('q', searchTerm);
    else url.searchParams.delete('q');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [searchTerm]);

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
    // Tick on the minute so countdowns and statuses stay current; also picks up midnight
    const interval = setInterval(() => setRealClock(taipeiClock()), 60000);
    // A backgrounded tab's timers are throttled; resync as soon as it's visible again
    const onVisible = () => document.visibilityState === 'visible' && setRealClock(taipeiClock());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const clock = useMemo<TaipeiClock>(() => {
    if (!debugTime) return realClock;
    const [hours, minutes] = debugTime.split(':').map(Number);
    return { ...realClock, minutes: (hours ?? 0) * 60 + (minutes ?? 0) };
  }, [realClock, debugTime]);
  const currentTimeMinutes = clock.minutes;

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

  // Taichung's map data is today's stops only, so it is refetched when the Taiwan date changes
  const loadKey = [
    [...citiesToLoad].sort().join(','),
    citiesToLoad.includes('taichung') ? realClock.weekday : '',
    reloadToken,
  ].join('|');

  // Load data only when the set of cities changes (not on every zoom/pan)
  useEffect(() => {
    if (loadKey === loadedKey) return;
    let cancelled = false;
    setDataLoaded(false);

    fetchMultipleCities(citiesToLoad).then(({ points: data, loaded, failed }) => {
      if (cancelled) return;
      setFailedCities(failed);
      // Before anything has loaded there is no map to fall back to; afterwards the banner is enough
      if (loaded.length === 0 && failed.length > 0 && !initialLoadComplete) {
        setError('無法載入垃圾車資料，請檢查網路連線或稍後再試');
        return;
      }
      setPoints(data);
      setLoadedCities(loaded);
      setLoadedKey(loadKey);
      setError(null);
      setDataLoaded(true);
      setInitialLoadComplete(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadKey]); // eslint-disable-line react-hooks/exhaustive-deps -- loadKey encodes citiesToLoad

  const retryLoad = () => {
    setError(null);
    setReloadToken(token => token + 1);
  };

  // Search and starred filters don't depend on the clock, so they aren't redone every minute
  const searchedPoints = useMemo(() => {
    let filtered = points;
    if (showStarredOnly) {
      const starred = new Set(starredPointIds);
      filtered = filtered.filter(point => starred.has(point.id));
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((point) =>
        point.district.toLowerCase().includes(search) ||
        point.village.toLowerCase().includes(search) ||
        point.location.toLowerCase().includes(search) ||
        point.route.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [points, showStarredOnly, starredPointIds, searchTerm]);

  const filteredPoints = useMemo(() => {
    if (timeFilterMode === 'all') return searchedPoints;
    if (timeFilterMode === 'now') {
      return searchedPoints.filter(point => getPointStatus(point, clock) === 'active');
    }
    const windowMinutes = { '30min': 30, '1hour': 60, '3hours': 180 }[timeFilterMode];
    return searchedPoints.filter(point =>
      servesOn(point, clock.weekday) &&
      isWithinTimeWindow(point.arrivalTime, point.departureTime, clock.minutes, windowMinutes)
    );
  }, [searchedPoints, timeFilterMode, clock]);

  // Active and upcoming counts for the time filter (stops not served today count as neither)
  const { activeCount, upcomingCount } = useMemo(() => {
    let active = 0;
    let upcoming = 0;
    for (const point of points) {
      const status = getPointStatus(point, clock);
      if (status === 'active') active++;
      else if (status === 'upcoming') upcoming++;
    }
    return { activeCount: active, upcomingCount: upcoming };
  }, [points, clock]);

  const handleMapLoaded = () => {
    setMapLoaded(true);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-white dark:bg-black">
      <Navbar
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
      />
      <FilterBar
        timeFilterMode={timeFilterMode}
        onTimeFilterChange={setTimeFilterMode}
        showStarredOnly={showStarredOnly}
        onToggleStarred={() => setShowStarredOnly(!showStarredOnly)}
        activeCount={activeCount}
        upcomingCount={upcomingCount}
        isStarredListOpen={isStarredListOpen}
        onToggleStarredList={() => setIsStarredListOpen(!isStarredListOpen)}
        starredCount={starredCount}
      />
      <Menu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onAboutClick={() => setIsAboutOpen(true)}
      />

      <main id="main-content" className="flex-1 flex flex-col min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <section className="relative flex-1 min-h-[320px] overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Full-screen loading only on initial load */}
          {initialLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50 h-full w-full">
              <div className="w-12 h-12 border-4 border-neutral-200 dark:border-neutral-800 border-t-black dark:border-t-white rounded-full spinner" />
              <p className="mt-4 text-neutral-600 dark:text-neutral-400">載入地圖與站點資料中…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={retryLoad}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                重試
              </button>
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
                clock={clock}
                starredPointIds={starredPointIds}
                onToggleStar={toggleStar}
                isStarredListOpen={isStarredListOpen}
                onCloseStarredList={() => setIsStarredListOpen(false)}
                allPoints={points}
              />
              {/* Subtle loading indicator for data updates */}
              {failedCities.length > 0 && dataLoaded && (
                <div role="alert" className="absolute top-4 left-4 right-4 z-20 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-red-300 bg-red-50/95 px-4 py-3 text-sm text-red-800 shadow-lg backdrop-blur-sm dark:border-red-800 dark:bg-red-950/95 dark:text-red-200">
                  <span className="flex-1">
                    無法載入{failedCities.map(city => cityRegistry.getAdapter(city).displayName).join('、')}的資料
                  </span>
                  <button
                    type="button"
                    onClick={retryLoad}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-red-100 dark:hover:bg-red-900"
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                    重試
                  </button>
                </div>
              )}
              {isUpdatingData && (
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-neutral-300 bg-white/95 backdrop-blur-sm px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-black/90">
                  <div className="h-4 w-4 border-2 border-neutral-300 dark:border-neutral-600 border-t-blue-600 dark:border-t-blue-400 rounded-full spinner" />
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">載入縣市資料中…</span>
                </div>
              )}
              {/* Feedback button for unsupported areas */}
              {isViewingUnsupportedArea && (
                <div className="absolute bottom-24 left-4 right-4 z-20 mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50/95 backdrop-blur-sm px-4 py-3 shadow-lg dark:border-amber-700 dark:bg-amber-950/95 md:bottom-4 md:left-4 md:right-auto">
                  <div className="flex items-start gap-3">
                    <MessageSquarePlus className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                        此區域尚未收錄資料
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                        目前支援台北市、新北市、台中市與高雄市。想查詢其他縣市嗎？
                      </p>
                      <a
                        href="https://github.com/yukaii/garbage/issues/new?title=請求支援新城市&body=希望支援的城市："
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
                      >
                        前往 GitHub 許願新增縣市
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
            資料來源：台北市、新北市、台中市與高雄市政府開放資料平台{dataUpdatedAt && `，資料更新於 ${dataUpdatedAt}`}（實際時間以現場清運為準）。
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
        dataMeta={dataMeta}
      />
    </div>
  );
}

export default App;
