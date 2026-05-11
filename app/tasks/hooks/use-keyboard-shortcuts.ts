// app/tasks/hooks/use-keyboard-shortcuts.ts
"use client";

import { useEffect } from 'react';

type ShortcutMap = {
  [key: string]: () => void;
};

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in an input, textarea, etc.
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();
      
      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key]();
      }

      if (event.ctrlKey && shortcuts[`ctrl+${key}`]) {
        event.preventDefault();
        shortcuts[`ctrl+${key}`]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}
