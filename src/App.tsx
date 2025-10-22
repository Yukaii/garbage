import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
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

function App() {
  const [points, setPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
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
        setLoading(true);
        const data = await fetchTrashCollectionPoints(selectedCity);
        setPoints(data);
        setFilteredPoints(data);
        setError(null);
      } catch (err) {
        setError('無法載入垃圾車資料，請稍後再試');
        console.error(err);
      } finally {
        setLoading(false);
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

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <header className="bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800 z-50 px-4 py-3 md:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-black dark:text-white mb-0.5">
              {selectedCity === 'taipei' ? '台北市' : '新北市'}垃圾車即時地圖
            </h1>
            <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400">
              {selectedCity === 'taipei' ? 'Taipei' : 'New Taipei'} Trash Collection Map
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value as City)}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm bg-white dark:bg-neutral-900 text-black dark:text-white hover:border-black dark:hover:border-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
            >
              <option value="taipei">台北市</option>
              <option value="new-taipei">新北市</option>
            </select>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center justify-center w-9 h-9 border border-neutral-300 dark:border-neutral-700 rounded-md hover:border-black dark:hover:border-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all text-black dark:text-white"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <div className="relative mb-3 max-w-2xl">
          <input
            type="text"
            placeholder="搜尋行政區、里別、地點或路線..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pr-10 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm focus:outline-none focus:border-black dark:focus:border-white bg-white dark:bg-neutral-900 text-black dark:text-white placeholder-neutral-500 dark:placeholder-neutral-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="mb-3 max-w-4xl">
          <TimeFilter
            selectedMode={timeFilterMode}
            onModeChange={setTimeFilterMode}
            activeCount={activeCount}
            upcomingCount={upcomingCount}
          />
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded">
            總共 {points.length} 個收集點
          </span>
          {searchTerm && (
            <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded">
              顯示 {filteredPoints.length} 個結果
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50">
            <div className="w-12 h-12 border-4 border-neutral-200 dark:border-neutral-800 border-t-black dark:border-t-white rounded-full spinner"></div>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">載入中...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-50">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {!loading && !error && <Map points={filteredPoints} darkMode={darkMode} />}
      </main>
    </div>
  );
}

export default App;
