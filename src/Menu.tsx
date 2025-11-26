import { Moon, Sun, Info, Coffee, Github, X } from 'lucide-react';
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
          <Github className="mr-3 h-4 w-4" />
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
