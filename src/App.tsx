import { useEffect, useState } from 'react';
import Map from './Map';
import { fetchTrashCollectionPoints } from './api';
import type { TrashCollectionPoint } from './types';
import './App.css';

function App() {
  const [points, setPoints] = useState<TrashCollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPoints, setFilteredPoints] = useState<TrashCollectionPoint[]>([]);
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
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchTrashCollectionPoints();
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
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredPoints(points);
      return;
    }

    const filtered = points.filter((point) => {
      const search = searchTerm.toLowerCase();
      return (
        point.行政區.toLowerCase().includes(search) ||
        point.里別.toLowerCase().includes(search) ||
        point.地點.toLowerCase().includes(search) ||
        point.路線.toLowerCase().includes(search)
      );
    });
    setFilteredPoints(filtered);
  }, [searchTerm, points]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-50 px-4 py-3 md:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-0.5">
              台北市垃圾車即時地圖
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Taipei Trash Collection Map
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center min-w-9 h-9 border border-gray-300 dark:border-gray-600 rounded-md hover:border-gray-900 dark:hover:border-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-xl"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <div className="relative mb-2 max-w-2xl">
          <input
            type="text"
            placeholder="搜尋行政區、里別、地點或路線..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:border-gray-900 dark:focus:border-white bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded">
            總共 {points.length} 個收集點
          </span>
          {searchTerm && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded">
              顯示 {filteredPoints.length} 個結果
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
            <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-gray-900 dark:border-t-white rounded-full spinner"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">載入中...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 z-50">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {!loading && !error && <Map points={filteredPoints} darkMode={darkMode} />}
      </main>
    </div>
  );
}

export default App;
