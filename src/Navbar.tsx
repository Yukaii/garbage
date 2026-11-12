import { Menu, Search, X, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { cityRegistry } from './cities/cityRegistry';
import type { City } from './api';
import { useState, useEffect, useRef } from 'react';

interface NavbarProps {
  selectedCity: City;
  onCityChange: (city: City) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onMenuClick: () => void;
  className?: string;
}

export function Navbar({
  selectedCity,
  onCityChange,
  searchTerm,
  onSearchChange,
  onMenuClick,
  className = '',
}: NavbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/90 ${className}`}
      style={{
        paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        {/* Left: Logo & Title */}
        <div className={`flex items-center gap-2.5 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
          <Logo size={26} className="shrink-0 text-neutral-900 dark:text-neutral-100" />
          <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-lg">
            垃圾車地圖
          </h1>
        </div>

        {/* Center: Search Bar */}
        <div className={`flex-1 max-w-xl mx-auto transition-all duration-200 ${
          isSearchExpanded 
            ? 'absolute inset-0 z-10 flex items-center px-4 bg-white dark:bg-neutral-950 md:static md:bg-transparent md:dark:bg-transparent md:p-0' 
            : 'hidden md:block'
        }`}>
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜尋行政區、里別、路名或路線…"
              className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-100/80 pl-9 pr-14 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-900"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label="清除搜尋"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              isSearchExpanded && (
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 md:hidden"
                >
                  取消
                </button>
              )
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className={`flex items-center gap-2 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
          <button
            type="button"
            onClick={() => setIsSearchExpanded(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 md:hidden"
            aria-label="搜尋"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value as City)}
              aria-label="選擇縣市"
              className="h-9 cursor-pointer appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:focus:border-neutral-600"
            >
              {cityRegistry.getCityOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
          </div>

          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
            aria-label="開啟選單"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
