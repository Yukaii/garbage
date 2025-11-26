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
    <div className={`w-full bg-white border-b border-neutral-200 dark:bg-black dark:border-neutral-800 ${className}`}>
      <div className="flex items-center gap-3 px-4 py-2 overflow-x-auto no-scrollbar md:px-6 md:justify-start">
        
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
        <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 flex-none mx-1" />

        {/* Starred Group */}
        <div className="flex-none flex items-center">
          <div className="flex items-stretch divide-x divide-neutral-200 rounded-md border border-neutral-200 bg-white dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-900">
            <button
              type="button"
              onClick={onToggleStarred}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${
                  showStarredOnly
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }
              `}
            >
              <Star
                className="h-3.5 w-3.5"
                fill={showStarredOnly ? 'currentColor' : 'none'}
              />
              <span>收藏</span>
              {starredCount > 0 && (
                <span className={showStarredOnly ? 'text-amber-100' : 'text-neutral-500'}>
                  ({starredCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onToggleStarredList}
              className={`
                flex items-center justify-center px-2 py-1.5 transition-colors
                ${
                  isStarredListOpen
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }
              `}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
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
