import { Star, ChevronDown } from 'lucide-react';
import TimeFilter, { type TimeFilterMode } from './TimeFilter';

interface FilterBarProps {
  timeFilterMode: TimeFilterMode;
  onTimeFilterChange: (mode: TimeFilterMode) => void;
  showStarredOnly: boolean;
  onToggleStarred: () => void;
  activeCount: number;
  upcomingCount: number;
  isStarredListOpen: boolean;
  onToggleStarredList: () => void;
  starredCount: number;
  className?: string;
}

export function FilterBar({
  timeFilterMode,
  onTimeFilterChange,
  showStarredOnly,
  onToggleStarred,
  activeCount,
  upcomingCount,
  isStarredListOpen,
  onToggleStarredList,
  starredCount,
  className = '',
}: FilterBarProps) {
  return (
    <div
      className={`w-full border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/90 ${className}`}
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 no-scrollbar md:justify-start md:px-6">
        {/* Time Filter Group */}
        <div className="flex-none">
          <TimeFilter
            selectedMode={timeFilterMode}
            onModeChange={onTimeFilterChange}
            activeCount={activeCount}
            upcomingCount={upcomingCount}
            compact={true}
          />
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px flex-none bg-neutral-200 dark:bg-neutral-800" />

        {/* Starred Group */}
        <div className="flex flex-none items-center">
          <div className="flex h-8 items-stretch divide-x divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              onClick={onToggleStarred}
              className={`
                flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors
                ${
                  showStarredOnly
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }
              `}
            >
              <Star
                className={`h-3.5 w-3.5 ${showStarredOnly ? 'text-white' : 'text-amber-500'}`}
                fill={showStarredOnly ? 'currentColor' : 'none'}
              />
              <span>收藏</span>
              {starredCount > 0 && (
                <span className={`tabular-nums ${showStarredOnly ? 'text-amber-100' : 'text-neutral-400 dark:text-neutral-500'}`}>
                  ({starredCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onToggleStarredList}
              aria-label={isStarredListOpen ? '關閉收藏列表' : '開啟收藏列表'}
              className={`
                flex items-center justify-center px-2 transition-colors
                ${
                  isStarredListOpen
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                }
              `}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isStarredListOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
