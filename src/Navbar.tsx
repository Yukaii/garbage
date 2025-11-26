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
      className={`sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm dark:border-neutral-800 dark:bg-black/90 ${className}`}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:px-6">
        {/* Left: Logo & Title */}
        <div className={`flex items-center gap-2 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
          <Logo size={28} className="shrink-0 text-black dark:text-white" />
          <h1 className="text-lg font-bold text-black dark:text-white sm:text-xl">
            垃圾車地圖
          </h1>
        </div>

        {/* Center: Search Bar */}
        <div className={`flex-1 max-w-xl mx-4 transition-all duration-200 ${
          isSearchExpanded 
            ? 'absolute inset-0 z-10 flex items-center px-4 bg-white dark:bg-black md:static md:bg-transparent md:dark:bg-transparent md:p-0' 
            : 'hidden md:block'
        }`}>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-neutral-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜尋行政區、里別、地點或路線..."
              className="w-full rounded-full border border-neutral-200 bg-neutral-100 py-2 pl-10 pr-10 text-sm text-black placeholder-neutral-500 focus:border-black focus:outline-none focus:ring-0 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-white"
            />
            {searchTerm ? (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              isSearchExpanded && (
                <button
                  onClick={() => setIsSearchExpanded(false)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 md:hidden"
                >
                  <span className="text-xs">取消</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className={`flex items-center gap-2 ${isSearchExpanded ? 'hidden md:flex' : 'flex'}`}>
          <button
            onClick={() => setIsSearchExpanded(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 md:hidden"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value as City)}
              className="h-9 appearance-none rounded-full border border-neutral-200 bg-transparent pl-4 pr-10 text-sm font-medium text-black hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black/5 dark:border-neutral-800 dark:text-white dark:hover:bg-neutral-900 dark:focus:ring-white/10"
            >
              {cityRegistry.getCityOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          </div>

          <button
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-full text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
