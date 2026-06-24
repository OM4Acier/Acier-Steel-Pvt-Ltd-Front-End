// RichTextarea.tsx — Business document composer v4
//
// v4 upgrades:
// • Removed product list — compose from fragment templates only
// • Bold uses *text* (single asterisk) to match markdown renderer
// • Ghost inline autocomplete — type a keyword, see template preview
//   inline at low contrast, press Tab to accept or keep typing to dismiss
// • Templates split into small reusable fragments instead of monoliths
// • Command menu ("/") positioned at cursor within viewport bounds

import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link,
  Image as ImageIcon,
  Minus,
  Eye,
  LayoutTemplate,
  ChevronRight,
} from 'lucide-react';
import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { renderMarkdownText } from './markdownRenderer';
import { Button } from '@/components/ui/button';
import { Label } from './ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TextTemplate {
  id: string;
  label: string;
  emoji: string;
  category: string;
  /** Full template body — uses [placeholder] tokens as tab stops */
  body: string;
  /** Trigger keywords for ghost autocomplete */
  triggers: string[];
}

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  type: 'template' | 'formatting';
  /** Text inserted — may contain [placeholder] tab stops */
  content: string;
  emoji?: string;
  description?: string;
}

interface TabStop {
  start: number;
  end: number;
  name: string;
}

interface GhostSuggestion {
  /** Full template body to insert */
  templateBody: string;
  /** The matched keyword in user's text */
  matchedWord: string;
  /** Start position of the matched word in textarea */
  wordStart: number;
  /** End position of the matched word in textarea */
  wordEnd: number;
  /** Template label for attribution */
  label: string;
}

/**
 * Utility to get caret coordinates (x, y) in pixels within a textarea,
 * relative to the viewport (for fixed/absolute positioning).
 */
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  const mirror = document.createElement('div');
  const mirrorStyle = mirror.style;

  mirrorStyle.whiteSpace = 'pre-wrap';
  mirrorStyle.wordWrap = 'break-word';
  mirrorStyle.position = 'absolute';
  mirrorStyle.visibility = 'hidden';
  mirrorStyle.top = '0';
  mirrorStyle.left = '0';

  [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'boxSizing',
    'width',
  ].forEach((prop) => {
    (mirrorStyle as any)[prop] = (style as any)[prop];
  });

  mirror.textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  mirror.appendChild(span);

  document.body.appendChild(mirror);
  const { offsetLeft: spanLeft, offsetTop: spanTop } = span;
  document.body.removeChild(mirror);

  return {
    left: rect.left + spanLeft - element.scrollLeft,
    top: rect.top + spanTop - element.scrollTop,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Templates — Small reusable fragments instead of monolithic templates
// ─────────────────────────────────────────────────────────────────────────────

export const RICH_TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: 'billing-address',
    label: 'Billing Address',
    emoji: '🏢',
    category: 'Address',
    triggers: ['billing', 'bill'],
    body: `BILLING ADDRESS:
[Name]
[Billing Address]
GST No. [GST Number]`,
  },
  {
    id: 'delivery-address',
    label: 'Delivery Address',
    emoji: '📍',
    category: 'Address',
    triggers: ['delivery', 'shipping', 'ship'],
    body: `DELIVERY ADDRESS:
[Delivery Address]
Site Person: [Contact Person]`,
  },
  {
    id: 'customer-info',
    label: 'Customer Info',
    emoji: '👤',
    category: 'Address',
    triggers: ['customer', 'client', 'party'],
    body: `[Customer Name]
[Address]
GST No. [GST Number]`,
  },

  {
    id: 'product-line',
    label: 'Product Line Item',
    emoji: '📦',
    category: 'Product',
    triggers: ['product', 'item', 'line'],
    body: `[product]
   Quantity = [qty]
   Price = [rate] + GST`,
  },

  {
    id: 'product-first',
    label: 'First Product Item',
    emoji: '📦',
    category: 'Product',
    triggers: ['1.'],
    body: `**PRODUCTS:**
1. [product]
   Quantity = [qty]
   Price = [rate] + GST`,
  },

  ...[2, 3, 4, 5, 6, 7, 8, 9].map((num) => ({
    id: `product-item-${num}`,
    label: `Product Item ${num}`,
    emoji: '📦',
    category: 'Product',
    triggers: [`${num}.`],
    body: `${num}. [product]
   Quantity = [qty]
   Price = [rate] + GST`,
  })),

  {
    id: 'Weight-option',
    label: 'Weight-option',
    emoji: '📦',
    category: 'Product',
    triggers: ['Kanta'],
    body: `*Kanta Weight*`,
  },

  {
    id: 'total-amount',
    label: 'Total Amount',
    emoji: '💰',
    category: 'Pricing',
    triggers: ['total', 'amount'],
    body: `**TOTAL INVOICE AMOUNT SHOULD BE ₹[amount] ONLY**`,
  },

  {
    id: 'payment',
    label: 'Payment Terms',
    emoji: '💳',
    category: 'Terms',
    triggers: ['payment', 'pay'],
    body: `*Payment [term]*`,
  },

  {
    id: 'payment-option',
    label: 'Payment Option',
    emoji: '💳',
    category: 'Terms',
    triggers: ['immediate'],
    body: `Immediate`,
  },

  {
    id: 'transport-amount',
    label: 'Transport Amount',
    emoji: '🚛',
    category: 'Terms',
    triggers: ['transport', 'freight'],
    body: `Transportation charges: ₹[amount] + GST`,
  },

  {
    id: 'phone-contact',
    label: 'Phone Contact',
    emoji: '📞',
    category: 'Contact',
    triggers: ['phone', 'call', 'mobile'],
    body: `Contact: @phone:[mobile]`,
  },

  {
    id: 'whatsapp-contact',
    label: 'WhatsApp Contact',
    emoji: '💬',
    category: 'Contact',
    triggers: ['whatsapp', 'wa'],
    body: `Contact: @wa:[mobile]`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Ghost autocomplete trigger map — built from template triggers
// ─────────────────────────────────────────────────────────────────────────────

interface TriggerEntry {
  keyword: string;
  template: TextTemplate;
}

const buildTriggerMap = (templates: TextTemplate[]): TriggerEntry[] => {
  const entries: TriggerEntry[] = [];
  for (const tpl of templates) {
    for (const trigger of tpl.triggers) {
      entries.push({ keyword: trigger.toLowerCase(), template: tpl });
    }
  }
  // Sort by keyword length descending so longer matches take priority
  entries.sort((a, b) => b.keyword.length - a.keyword.length);
  return entries;
};

const TRIGGER_MAP = buildTriggerMap(RICH_TEXT_TEMPLATES);

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Find all [placeholder] token positions in text, top-to-bottom. */
const getTabStops = (text: string): TabStop[] => {
  const stops: TabStop[] = [];
  const regex = /\[([^\]\n]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    stops.push({
      start: match.index,
      end: match.index + match[0].length,
      name: match[1],
    });
  }
  return stops;
};

/**
 * Detect if the current context triggers a command menu.
 * Only supports "/" trigger now (product N. removed).
 */
const detectCommandTrigger = (
  text: string,
  cursorPos: number,
): { trigger: string; filter: string } | null => {
  const before = text.substring(0, cursorPos);

  // Slash trigger: "/filter"
  const slashMatch = before.match(/\/([a-zA-Z0-9]*)$/);
  if (slashMatch) {
    return { trigger: '/', filter: slashMatch[1] };
  }

  return null;
};

/**
 * Get the current word being typed (for ghost autocomplete).
 * Looks backward from cursor to find the start of the current
 * word or phrase on the current line.
 */
const getCurrentWordContext = (
  text: string,
  cursorPos: number,
): { word: string; wordStart: number; wordEnd: number } | null => {
  const before = text.substring(0, cursorPos);
  // Get current line content before cursor
  const lastNewline = before.lastIndexOf('\n');
  const lineContent = before.substring(lastNewline + 1);

  if (!lineContent.trim()) return null;

  // Match the last word(s) — up to 2 words for multi-word triggers, allowing dots
  const oneWordMatch = lineContent.match(/([\w.]+)$/);

  if (!oneWordMatch) return null;

  // Try 2-word first, then 1-word
  const word = oneWordMatch[1];
  const wordStart = cursorPos - word.length;

  return {
    word: word.toLowerCase(),
    wordStart,
    wordEnd: cursorPos,
  };
};

/**
 * Find a matching ghost suggestion for the text being typed.
 */
const findGhostSuggestion = (
  text: string,
  cursorPos: number,
): GhostSuggestion | null => {
  const ctx = getCurrentWordContext(text, cursorPos);
  if (!ctx || ctx.word.length < 2) return null; // Minimum 2 chars to trigger

  for (const entry of TRIGGER_MAP) {
    if (entry.keyword.startsWith(ctx.word) && entry.keyword !== ctx.word) {
      return {
        templateBody: entry.template.body,
        matchedWord: ctx.word,
        wordStart: ctx.wordStart,
        wordEnd: ctx.wordEnd,
        label: entry.template.label,
      };
    }
    // Exact match — also suggest (user typed full keyword)
    if (entry.keyword === ctx.word) {
      return {
        templateBody: entry.template.body,
        matchedWord: ctx.word,
        wordStart: ctx.wordStart,
        wordEnd: ctx.wordEnd,
        label: entry.template.label,
      };
    }
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// FormatButton — tooltip-wrapped ghost icon button
// ─────────────────────────────────────────────────────────────────────────────

interface FormatButtonProps {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
  className?: string;
}

const FormatButton: React.FC<FormatButtonProps> = ({ icon, label, onClick, className }) => (
  <TooltipProvider delayDuration={600}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn(
            'h-7 w-7 p-0 text-gray-500 dark:text-gray-400',
            'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100',
            'transition-colors rounded',
            className,
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ─────────────────────────────────────────────────────────────────────────────
// SmartCommandMenu — Floating menu for templates + formatting (no products)
// ─────────────────────────────────────────────────────────────────────────────

interface SmartCommandMenuProps {
  filter: string;
  items: CommandItem[];
  coords: { left: number; top: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (item: CommandItem) => void;
  onDismiss: () => void;
}

const SmartCommandMenu: React.FC<SmartCommandMenuProps> = ({
  filter,
  items,
  coords,
  containerRef,
  onSelect,
  onDismiss,
}) => {
  const [highlightIdx, setHighlightIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const lf = filter.toLowerCase().trim();
  const filtered = items.filter((item) => {
    return (
      item.label.toLowerCase().includes(lf) ||
      item.category.toLowerCase().includes(lf) ||
      (item.description?.toLowerCase() || '').includes(lf)
    );
  });

  useEffect(() => {
    setHighlightIdx(0);
  }, [filter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[highlightIdx]);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [filtered, highlightIdx, onSelect, onDismiss]);

  // Compute position relative to container, clamped to viewport
  const computedStyle = useMemo(() => {
    const container = containerRef.current;
  
    // ✅ Always define top first
    const top = coords.top + 24;
  
    if (!container) {
      return { left: coords.left, top };
    }
  
    const containerRect = container.getBoundingClientRect();
    let left = coords.left - containerRect.left;
  
    // Clamp: don't overflow right side
    const menuWidth = 288; // w-72
    if (left + menuWidth > containerRect.width) {
      left = containerRect.width - menuWidth - 8;
    }
  
    if (left < 0) left = 8;
  
    return { left, top };
  }, [coords, containerRef]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute z-[9900] w-72',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-800',
        'rounded-xl shadow-2xl overflow-hidden',
        'animate-in fade-in zoom-in-95 duration-100',
      )}
     style={{
  left: computedStyle.left,
  top: computedStyle.top,
}}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Commands
        </span>
        <span className="text-[9px] text-slate-400 font-mono">↑↓ Enter</span>
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            onMouseEnter={() => setHighlightIdx(i)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3 group',
              i === highlightIdx
                ? 'bg-indigo-600 text-white shadow-md'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
            )}
          >
            {item.emoji ? (
              <span className="text-sm shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">{item.emoji}</span>
            ) : (
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                i === highlightIdx ? "bg-white/20" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
              )}>
                <LayoutTemplate className="w-3.5 h-3.5" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-semibold leading-tight truncate',
                i === highlightIdx ? 'text-white' : 'text-slate-900 dark:text-slate-100'
              )}>
                {item.label}
              </p>
              <p className={cn(
                'text-[10px] truncate mt-0.5',
                i === highlightIdx ? 'text-indigo-100' : 'text-slate-500'
              )}>
                {item.category}
              </p>
            </div>

            {i === highlightIdx && <ChevronRight className="w-4 h-4 text-white/50" />}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GhostOverlay — Shows ghost autocomplete text inline
// ─────────────────────────────────────────────────────────────────────────────

interface GhostOverlayProps {
  suggestion: GhostSuggestion;
  textarea: HTMLTextAreaElement;
}

const GhostOverlay: React.FC<GhostOverlayProps> = ({ suggestion, textarea }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Mirror textarea styling to position ghost text exactly
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const style = window.getComputedStyle(textarea);
    overlay.style.fontFamily = style.fontFamily;
    overlay.style.fontSize = style.fontSize;
    overlay.style.fontWeight = style.fontWeight;
    overlay.style.letterSpacing = style.letterSpacing;
    overlay.style.lineHeight = style.lineHeight;
    overlay.style.paddingTop = style.paddingTop;
    overlay.style.paddingRight = style.paddingRight;
    overlay.style.paddingBottom = style.paddingBottom;
    overlay.style.paddingLeft = style.paddingLeft;
    overlay.style.width = style.width;
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.wordWrap = 'break-word';
    overlay.style.overflowWrap = 'break-word';
  }, [textarea]);

  // Build mirrored text: real text + ghost suggestion
  const textBefore = textarea.value.substring(0, suggestion.wordEnd);
  const textAfter = textarea.value.substring(suggestion.wordEnd);
  const ghostPreview = suggestion.templateBody.substring(0, 120) + (suggestion.templateBody.length > 120 ? '…' : '');

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-[1]"
      style={{
        scrollBehavior: 'auto',
        marginTop: textarea.scrollTop ? -textarea.scrollTop : 0,
      }}
    >
      {/* Invisible text to position the ghost correctly */}
      <span className="invisible whitespace-pre-wrap break-words">{textBefore}</span>
      {/* Ghost suggestion text */}
      <span className="text-slate-400/40 dark:text-slate-500/35 whitespace-pre-wrap break-words">
        {ghostPreview}
      </span>
      {/* Rest fades out */}
      <span className="invisible whitespace-pre-wrap break-words">{textAfter}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Ghost Hint Badge — Shows what Tab will insert
// ─────────────────────────────────────────────────────────────────────────────

const GhostHintBadge: React.FC<{ label: string }> = ({ label }) => (
  <div className="absolute top-2 right-12 z-[5] pointer-events-none select-none animate-in fade-in slide-in-from-right-2 duration-200">
    <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
      <kbd className="font-mono bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-500 shadow-sm text-[9px]">Tab</kbd>
      {label}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TemplatePicker — appears below textarea when Tab pressed on empty field,
//                  or inline popover from toolbar Templates button
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Preview popover
// ─────────────────────────────────────────────────────────────────────────────

const PreviewPopover: React.FC<{ value: string }> = ({ value }) => (
  <Popover>
    <TooltipProvider delayDuration={600}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm"
              className="absolute bottom-3 right-3 h-8 w-8 p-0 text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-full transition-all duration-200 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 shadow-sm hover:shadow z-[10]">
              <Eye className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">Preview formatted output</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <PopoverContent className="w-[420px] sm:w-[500px] p-0 z-[9100] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200" align="end">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" /> Live Render Preview
        </span>
      </div>
      <div className="p-5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {value ? (
          <div
            className="prose prose-sm xl:prose-base dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdownText(value) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <Eye className="w-8 h-8 opacity-20" />
            <p className="text-xs italic">Start typing to see preview...</p>
          </div>
        )}
      </div>
    </PopoverContent>
  </Popover>
);

// ─────────────────────────────────────────────────────────────────────────────
// RichTextarea — main component
// ─────────────────────────────────────────────────────────────────────────────

export interface RichTextareaProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  className?: string;
  //showTemplates?: boolean;
  enableAutocomplete?: boolean;
}

const FORMATTING_COMMANDS: CommandItem[] = [
  { id: 'h1', label: 'Heading 1', category: 'Formatting', type: 'formatting', content: '# ', emoji: 'H1' },
  { id: 'h2', label: 'Heading 2', category: 'Formatting', type: 'formatting', content: '## ', emoji: 'H2' },
  { id: 'h3', label: 'Heading 3', category: 'Formatting', type: 'formatting', content: '### ', emoji: 'H3' },
  { id: 'bold', label: 'Bold', category: 'Formatting', type: 'formatting', content: '*[text]*', emoji: 'B' },
  { id: 'italic', label: 'Italic', category: 'Formatting', type: 'formatting', content: '_[text]_', emoji: 'I' },
  { id: 'strikethrough', label: 'Strikethrough', category: 'Formatting', type: 'formatting', content: '~~[text]~~', emoji: 'S' },
  { id: 'bullet-list', label: 'Bullet List', category: 'Formatting', type: 'formatting', content: '- [item]', emoji: '•' },
  { id: 'numbered-list', label: 'Numbered List', category: 'Formatting', type: 'formatting', content: '1. [item]', emoji: '1.' },
  { id: 'task-list', label: 'Task List', category: 'Formatting', type: 'formatting', content: '- [ ] [task]', emoji: '☑' },
  { id: 'quote', label: 'Blockquote', category: 'Formatting', type: 'formatting', content: '> ', emoji: '‟' },
  { id: 'code-inline', label: 'Inline Code', category: 'Formatting', type: 'formatting', content: '`[code]`', emoji: '</>' },
  { id: 'code-block', label: 'Code Block', category: 'Formatting', type: 'formatting', content: '```\n[code]\n```', emoji: '{}' },
  { id: 'table', label: 'Table', category: 'Formatting', type: 'formatting', content: '| Header 1 | Header 2 |\n|----------|----------|\n| [Cell 1] | [Cell 2] |', emoji: '⊞' },
  { id: 'divider', label: 'Divider', category: 'Formatting', type: 'formatting', content: '\n---\n', emoji: '—' },
  { id: 'link', label: 'Link', category: 'Formatting', type: 'formatting', content: '[[text]]([url])', emoji: '🔗' },
  { id: 'image', label: 'Image', category: 'Formatting', type: 'formatting', content: '![[alt]]([url])', emoji: '🖼' },
];

export const RichTextarea: React.FC<RichTextareaProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Type / for commands, or start typing for suggestions…',
  rows = 7,
  label,
  className,
  //showTemplates = false,
  enableAutocomplete = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [commandTrigger, setCommandTrigger] = useState<{ trigger: string; filter: string } | null>(null);
  const [menuCoords, setMenuCoords] = useState({ left: 0, top: 0 });
  const [ghostSuggestion, setGhostSuggestion] = useState<GhostSuggestion | null>(null);

  const commandItems = useMemo(() => {
    const templates: CommandItem[] = RICH_TEXT_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      category: t.category,
      type: 'template',
      content: t.body,
      emoji: t.emoji,
    }));
    return [...FORMATTING_COMMANDS, ...templates];
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────
  const tabStops = useMemo(() => getTabStops(value), [value]);
  const remainingCnt = tabStops.length;

  // ── smart update preventing React cursor bugs ─────────────────────────────
  const smartReplaceText = useCallback((newText: string, selStart: number, selEnd: number) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(ta, newText);
      const ev = new Event('input', { bubbles: true });
      ta.dispatchEvent(ev);
    } else {
      onChange({ target: { id, value: newText } as HTMLTextAreaElement } as React.ChangeEvent<HTMLTextAreaElement>);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(selStart, selEnd);
      }
    }, 0);
  }, [id, onChange]);

  // ── toolbar handlers ──────────────────────────────────────────────────────
  const applyFormat = useCallback((prefix: string, suffix = '', defaultValue = 'text') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: cur } = ta;
    const selected = cur.substring(s, e) || defaultValue;
    const inserted = `${prefix}${selected}${suffix}`;
    const newText = cur.substring(0, s) + inserted + cur.substring(e);
    smartReplaceText(newText, s + prefix.length, s + prefix.length + selected.length);
  }, [smartReplaceText]);

  const applyLinePrefix = useCallback((prefix: string, defaultLine = 'Item') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: cur } = ta;
    const selected = cur.substring(s, e) || defaultLine;
    const lined = selected.split('\n').map((l) => `${prefix}${l}`).join('\n');
    const newText = cur.substring(0, s) + lined + cur.substring(e);
    smartReplaceText(newText, s + prefix.length, s + lined.length);
  }, [smartReplaceText]);

  // ── Accept ghost suggestion ───────────────────────────────────────────────
  const acceptGhostSuggestion = useCallback(() => {
    if (!ghostSuggestion) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const { wordStart, wordEnd, templateBody } = ghostSuggestion;
    const text = ta.value;

    // Replace the typed keyword with the full template body
    const newText = text.substring(0, wordStart) + templateBody + text.substring(wordEnd);

    setGhostSuggestion(null);

    const stops = getTabStops(newText);
    const localStops = stops.filter((st) => st.start >= wordStart && st.end <= wordStart + templateBody.length);
    if (localStops.length > 0) {
      smartReplaceText(newText, localStops[0].start, localStops[0].end);
    } else {
      smartReplaceText(newText, wordStart + templateBody.length, wordStart + templateBody.length);
    }
  }, [ghostSuggestion, smartReplaceText]);

  // ── Unified Command Insertion ─────────────────────────────────────────────
  const handleCommandSelect = useCallback((item: CommandItem) => {
    const ta = textareaRef.current;
    if (!ta || !commandTrigger) return;

    const text = ta.value;
    const cursorPos = ta.selectionStart;
    const before = text.substring(0, cursorPos);

    const replacement = item.content;
    let newText = "";
    let localOffset = 0;

    if (commandTrigger.trigger === '/') {
      const lastSlashIdx = before.lastIndexOf('/');
      newText = text.substring(0, lastSlashIdx) + replacement + text.substring(cursorPos);
      localOffset = lastSlashIdx;
    }

    setCommandTrigger(null);
    setGhostSuggestion(null);

    const snippetEnd = localOffset + replacement.length;
    const allStops = getTabStops(newText);
    const localStops = allStops.filter((s) => s.start >= localOffset && s.end <= snippetEnd);

    if (localStops.length > 0) {
      smartReplaceText(newText, localStops[0].start, localStops[0].end);
    } else {
      smartReplaceText(newText, snippetEnd, snippetEnd);
    }
  }, [commandTrigger, smartReplaceText]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.target;
    onChange(e);

    // Check for "/" command trigger
    const trigger = detectCommandTrigger(ta.value, ta.selectionStart);
    setCommandTrigger(trigger);

    if (trigger && textareaRef.current) {
      const coords = getCaretCoordinates(textareaRef.current, ta.selectionStart);
      setMenuCoords(coords);
      setGhostSuggestion(null); // No ghost when command menu is open
      return;
    }

    // Check for ghost autocomplete
    if (!trigger && enableAutocomplete) {
      const ghost = findGhostSuggestion(ta.value, ta.selectionStart);
      setGhostSuggestion(ghost);
    } else {
      setGhostSuggestion(null);
    }
  }, [onChange, enableAutocomplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;

    if (e.key === 'Escape') {
      if (ghostSuggestion) { setGhostSuggestion(null); return; }
      if (commandTrigger) { setCommandTrigger(null); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormat('*', '*');
      return;
    }

    if (commandTrigger && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      return;
    }

    // Tab key — multi-purpose
    if (e.key === 'Tab') {
      // 1. Ghost suggestion → accept it
      if (ghostSuggestion) {
        e.preventDefault();
        acceptGhostSuggestion();
        return;
      }

      // 2. Command trigger open → dismiss
      if (commandTrigger) {
        e.preventDefault();
        setCommandTrigger(null);
        return;
      }

      // 3. Navigate tab stops
      const stops = getTabStops(value);
      if (stops.length === 0) return;

      e.preventDefault();

      const cursor = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      const isBackward = e.shiftKey;

      const currentStop = stops.find((s) => s.start === cursor && s.end === selEnd);

      let newText = value;
      let adjustedCursor = cursor;

      if (currentStop) {
        newText = value.substring(0, currentStop.start) + value.substring(currentStop.end);
        adjustedCursor = currentStop.start;
      }

      const newStops = getTabStops(newText);

      if (newStops.length === 0) {
        if (newText !== value) smartReplaceText(newText, adjustedCursor, adjustedCursor);
        return;
      }

      let targetStop: TabStop;
      if (isBackward) {
        const before = newStops.filter((s) => s.end < adjustedCursor);
        targetStop = before.length > 0 ? before[before.length - 1] : newStops[newStops.length - 1];
      } else {
        const after = newStops.filter((s) => s.start >= adjustedCursor);
        targetStop = after.length > 0 ? after[0] : newStops[0];
      }

      smartReplaceText(newText, targetStop.start, targetStop.end);
      return;
    }
  }, [value, commandTrigger, ghostSuggestion, smartReplaceText, acceptGhostSuggestion]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (wrapperRef.current?.contains(e.relatedTarget as Node)) return;
    setIsFocused(false);
    setGhostSuggestion(null);
  }, []);


  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id} className="font-semibold text-sm text-gray-700 dark:text-gray-300">
          {label}
        </Label>
      )}

      <div className="flex items-center gap-1 px-2 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-t-xl border-b border-slate-200 dark:border-slate-800 z-10 relative overflow-x-auto no-scrollbar">
        <FormatButton icon={<Bold className="w-4 h-4" />} label="Bold (*text*)" onClick={() => applyFormat('*', '*')} />
        <FormatButton icon={<Italic className="w-4 h-4" />} label="Italic (_text_)" onClick={() => applyFormat('_', '_')} />
        <FormatButton icon={<Strikethrough className="w-4 h-4" />} label="Strikethrough (~~text~~)" onClick={() => applyFormat('~~', '~~')} />

        <span className="border-l border-slate-200 dark:border-slate-700 mx-1 h-4 self-center shrink-0" />

        <FormatButton icon={<List className="w-4 h-4" />} label="Bullet list (- )" onClick={() => applyLinePrefix('- ')} />
        <FormatButton icon={<ListOrdered className="w-4 h-4" />} label="Numbered list (1. )" onClick={() => applyLinePrefix('1. ')} />
        <FormatButton icon={<CheckSquare className="w-4 h-4" />} label="Task list (- [ ] )" onClick={() => applyLinePrefix('- [ ] ')} />

        <span className="border-l border-slate-200 dark:border-slate-700 mx-1 h-4 self-center shrink-0" />

        <FormatButton icon={<Quote className="w-4 h-4" />} label="Quote (> )" onClick={() => applyLinePrefix('> ')} />
        <FormatButton icon={<Code className="w-4 h-4" />} label="Inline code (`code`)" onClick={() => applyFormat('`', '`')} />
        <FormatButton icon={<Minus className="w-4 h-4" />} label="Divider (---)" onClick={() => applyFormat('\n---\n', '', '')} className="text-slate-500" />

        <span className="border-l border-slate-200 dark:border-slate-700 mx-1 h-4 self-center shrink-0" />

        <FormatButton icon={<Link className="w-4 h-4" />} label="Link ([text](url))" onClick={() => applyFormat('[', '](url)', 'text')} />
        <FormatButton icon={<ImageIcon className="w-4 h-4" />} label="Image (![alt](url))" onClick={() => applyFormat('![', '](url)', 'alt text')} />

        <div className="flex-1 min-w-[20px]" />
      </div>

      <div
        ref={wrapperRef}
        className={cn(
          'relative flex flex-col rounded-xl border transition-all duration-300 shadow-sm overflow-visible',
          isFocused
            ? 'border-indigo-400 dark:border-indigo-500 ring-4 ring-indigo-500/10 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50',
        )}
      >
        {/* Ghost overlay — shows inline autocomplete suggestion */}
        {ghostSuggestion && textareaRef.current && (
          <GhostOverlay suggestion={ghostSuggestion} textarea={textareaRef.current} />
        )}

        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={rows}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-h-[180px] font-mono text-[14px] rounded-none',
            'focus-visible:ring-0 focus-visible:ring-offset-0 border-0',
            'bg-transparent resize-y pl-4 pr-12 py-3 leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400',
            'custom-scrollbar transition-colors relative z-[2]'
          )}
        />

        {/* Ghost hint badge — shows Tab shortcut */}
        {ghostSuggestion && (
          <GhostHintBadge label={ghostSuggestion.label} />
        )}

        {remainingCnt > 0 && isFocused && (
          <div className="absolute bottom-3 left-4 flex items-center gap-1.5 pointer-events-none select-none z-[10]">
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold transparent px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-left-2">
              {remainingCnt} field{remainingCnt > 1 ? 's' : ''} remaining · Tab to navigate
            </span>
          </div>
        )}



        <PreviewPopover value={value} />

        {commandTrigger && (
          <SmartCommandMenu
            filter={commandTrigger.filter}
            items={commandItems}
            coords={menuCoords}
            containerRef={wrapperRef}
            onSelect={handleCommandSelect}
            onDismiss={() => setCommandTrigger(null)}
          />
        )}


      </div>
    </div>
  );
};