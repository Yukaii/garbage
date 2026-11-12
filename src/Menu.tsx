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
}

export function Menu({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
  onAboutClick,
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
      className="absolute right-4 top-14 z-50 w-56 origin-top-right rounded-xl border border-neutral-200 bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="py-1">
        <button
          onClick={() => {
            onToggleDarkMode();
          }}
          className="flex w-full items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {darkMode ? (
            <Sun className="mr-3 h-4 w-4" />
          ) : (
            <Moon className="mr-3 h-4 w-4" />
          )}
          {darkMode ? '切換亮色模式' : '切換深色模式'}
        </button>

        <button
          onClick={() => {
            onAboutClick();
            onClose();
          }}
          className="flex w-full items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Info className="mr-3 h-4 w-4" />
          關於本站
        </button>

        <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />

        <a
          href="https://github.com/yukaii/garbage/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          onClick={onClose}
        >
          <GitHubMark className="mr-3 h-4 w-4" />
          回報問題
        </a>

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onAboutClick(); // This should trigger the modal which has the buy me a coffee logic
            // Ideally we should pass a specific handler for support
            onClose();
          }}
          className="flex w-full items-center px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950/30"
        >
          <Coffee className="mr-3 h-4 w-4" />
          請我喝咖啡
        </a>
      </div>
    </div>
  );
}
