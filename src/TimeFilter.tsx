import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getCurrentTimeFormatted } from './api';

export type TimeFilterMode = 'all' | 'now' | '30min' | '1hour' | '3hours';

interface TimeFilterProps {
  selectedMode: TimeFilterMode;
  onModeChange: (mode: TimeFilterMode) => void;
  activeCount: number;
  upcomingCount: number;
  compact?: boolean;
}

export default function TimeFilter({ 
  selectedMode, 
  onModeChange, 
  activeCount, 
  compact = false 
}: TimeFilterProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentTimeFormatted());

  useEffect(() => {
    // Update current time every 30 seconds
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeFormatted());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const filters: { mode: TimeFilterMode; label: string; count?: number }[] = [
    { mode: 'all', label: '全部' },
    { mode: 'now', label: '現在', count: activeCount },
    { mode: '30min', label: '30 分鐘內' },
    { mode: '1hour', label: '1 小時內' },
    { mode: '3hours', label: '3 小時內' },
  ];

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      {!compact && (
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            目前時間：{currentTime}
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/60 dark:text-green-400">
              {activeCount} 站收運中
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {filters.map(({ mode, label, count }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`
              inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors
              ${
                selectedMode === mode
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800'
              }
            `}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`ml-1 tabular-nums ${selectedMode === mode ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400 dark:text-neutral-500'}`}>
                ({count})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
