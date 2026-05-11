'use client';

import { useState, useEffect, FC, ReactNode } from 'react';
import { HelpCircle, Link, List, LucideIcon, MessageCircle, Moon, Phone, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';



interface GuideRowProps {
  syntax: string;
  result: ReactNode;
  icon?: LucideIcon;
  colorClass?: string;
}

export const ThemeToggle = () => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Read initial theme once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme');

      if (storedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        setDarkMode(true);
      } else if (storedTheme === 'light') {
        document.documentElement.classList.remove('dark');
        setDarkMode(false);
      } else {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        setDarkMode(prefersDark);
      }
    }
  }, []);

  const toggleTheme = () => {
    const isDark = !darkMode;
    setDarkMode(isDark);

    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
<Button
  variant="outline"
  size="icon"
  onClick={toggleTheme}
  className="rounded-full bg-green-100 hover:bg-green-150 text-green-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-green-300"
>
  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
  <span className="sr-only">Toggle theme</span>
</Button>
  );
};





export const GuideRow: FC<GuideRowProps>  = ({ syntax, result, icon: Icon, colorClass = 'text-gray-700 dark:text-gray-200' }) => (
  <div className="grid grid-cols-[1fr_minmax(0,1fr)] gap-x-4 py-1.5 items-center border-b border-gray-100 dark:border-gray-700 last:border-b-0">
    {/* Syntax Column (Code look) */}
    <code className="text-[11px] bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 font-mono px-2 py-1 rounded-md overflow-x-auto whitespace-nowrap">
      {syntax}
    </code>
    {/* Result Column (Formatted look) */}
    <div className={`flex items-center text-sm ${colorClass}`}>
      {Icon && <Icon className="w-3.5 h-3.5 mr-2 flex-shrink-0" />}
      <span className="truncate">{result}</span>
    </div>
  </div>
);

export const FormattingGuidePopover = () => {
    // Data structure for easy mapping and clean rendering
    const formatItems = [
        { syntax: '*bold text*', result: <strong>Bold Text</strong>, description: 'Bold Text' },
        { syntax: '_italic text_', result: <em>Italic Text</em>, description: 'Italic Text' },
        { syntax: '[Link Text](url)', result: <a href="#" className="text-blue-500 underline flex items-center"><Link className="w-3.5 h-3.5 mr-1"/>Link Text</a>, description: 'Link Text', colorClass: 'text-blue-500' },
        { syntax: '@phone:9876543210', result: 'Clickable Phone', icon: Phone, colorClass: 'text-green-600' },
        { syntax: '@wa:9876543210', result: 'WhatsApp Link', icon: MessageCircle, colorClass: 'text-teal-500' },
        { syntax: '==highlight==', result: <mark className="bg-yellow-300 px-1 rounded">Highlight</mark>, description: 'Highlighted Text' },
        { syntax: '~~strikethrough~~', result: <del>Strikethrough</del>, description: 'Strikethrough' },
        { syntax: '- List item', result: '• List Item', icon: List, colorClass: 'text-purple-500' },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-900 transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ml-2"
                    aria-label="Formatting guide"
                >
                    <HelpCircle className="w-4 h-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[340px] bg-white dark:bg-gray-800 p-4 text-xs shadow-2xl rounded-xl z-[10]">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 border-b pb-2 border-gray-200 dark:border-gray-700">
                    Quick Formatting Guide
                </h3>
                <div className="space-y-1">
                    {formatItems.map((item, index) => (
                        <GuideRow
                            key={index}
                            syntax={item.syntax}
                            result={item.result}
                            icon={item.icon}
                            colorClass={item.colorClass}
                        />
                    ))}
                </div>
                <p className="mt-3 text-[10px] text-gray-500 dark:text-gray-400">
                    *For complex lists or code blocks, use standard Markdown.
                </p>
            </PopoverContent>
        </Popover>
    );
};
