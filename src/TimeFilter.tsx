import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getCurrentTimeFormatted } from './api';

export type TimeFilterMode = 'all' | 'now' | '30min' | '1hour' | '3hours';

interface TimeFilterProps {
  selectedMode: TimeFilterMode;
  onModeChange: (mode: TimeFilterMode) => void;
  activeCount: number;
  upcomingCount: number;
}

export default function TimeFilter({ selectedMode, onModeChange, activeCount, upcomingCount }: TimeFilterProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeFormatted());

  useEffect(() => {
    // Update current time every 30 seconds
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeFormatted());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const filters: { mode: TimeFilterMode; label: string; count?: number }[] = [
    { mode: 'all', label: '全部時段' },
    { mode: 'now', label: '現在營運', count: activeCount },
    { mode: '30min', label: '30 分鐘內' },
    { mode: '1hour', label: '1 小時內' },
    { mode: '3hours', label: '3 小時內' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
        <span className="font-medium text-black dark:text-white">
          目前時間：{currentTime}
        </span>
        {activeCount > 0 && (
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
            {activeCount} 輛營運中
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map(({ mode, label, count }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md transition-all
              ${
                selectedMode === mode
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
              }
            `}
          >
            {label}
            {count !== undefined && count > 0 && selectedMode !== mode && (
              <span className="ml-1 text-neutral-500 dark:text-neutral-500">({count})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
