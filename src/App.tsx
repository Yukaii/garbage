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
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="title">台北市垃圾車即時地圖</h1>
          <p className="subtitle">Taipei Trash Collection Map</p>
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="搜尋行政區、里別、地點或路線..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="clear-button"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="stats">
          <span className="stat-item">
            總共 {points.length} 個收集點
          </span>
          {searchTerm && (
            <span className="stat-item">
              顯示 {filteredPoints.length} 個結果
            </span>
          )}
        </div>
      </header>

      <main className="map-container">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>載入中...</p>
          </div>
        )}
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && <Map points={filteredPoints} />}
      </main>
    </div>
  );
}

export default App;
