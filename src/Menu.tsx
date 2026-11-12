import { Moon, Sun, Info, Coffee } from 'lucide-react';

// lucide-react 1.0 removed brand icons; this is GitHub's mark from Octicons (MIT)
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}
import { useEffect, useRef } from 'react';

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAboutClick: () => void;
  onSupportClick?: () => void;
}

export function Menu({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
  onAboutClick,
  onSupportClick,
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-4 top-14 z-50 w-56 origin-top-right rounded-xl border border-neutral-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md focus:outline-none dark:border-neutral-800 dark:bg-neutral-900/95 md:right-6"
    >
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onToggleDarkMode();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          {darkMode ? (
            <Sun className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          )}
          {darkMode ? '切換亮色模式' : '切換深色模式'}
        </button>

        <button
          type="button"
          onClick={() => {
            onAboutClick();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <Info className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          關於本站
        </button>

        <div className="my-1.5 h-px bg-neutral-200/80 dark:bg-neutral-800" />

        <a
          href="https://github.com/yukaii/garbage/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onClick={onClose}
        >
          <GitHubMark className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          回報問題
        </a>

        <button
          type="button"
          onClick={() => {
            if (onSupportClick) {
              onSupportClick();
            } else {
              onAboutClick();
            }
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
        >
          <Coffee className="h-4 w-4" />
          請我喝咖啡
        </button>
      </div>
    </div>
  );
}
