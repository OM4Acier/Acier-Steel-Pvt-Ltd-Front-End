// components/ui/SelectDropdown.tsx
// Reusable, accessible select built on the shadcn Select primitive.
// Options are passed in as data (single source of truth) rather than
// hard-coded <SelectItem> lists scattered across components.
//
// Optional `searchable` mode adds an inline filter input at the top of the
// popover (powers the org-contact / sales-exec picker that can have many
// users). Each option's `label` is the only text shown; `subLabel` (e.g. an
// email) is NOT displayed but is still matched when filtering.
import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export interface SelectOption {
  /** Stable unique value stored in state / sent to the API. */
  value: string;
  /** Primary human-readable label shown to the user. */
  label: string;
  /** Optional secondary line (e.g. email) rendered under the label. */
  subLabel?: string;
  /** Optional extra classes for this specific option (e.g. color coding). */
  className?: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  /** Enable an inline filter input inside the popover (for long lists). */
  searchable?: boolean;
  /** Placeholder for the inline search input. */
  searchPlaceholder?: string;
  /**
   * Optional extra children (e.g. dynamically-loaded options such as shipping
   * addresses) rendered after the static `options` list.
   */
  children?: React.ReactNode;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  triggerClassName,
  contentClassName,
  id,
  disabled,
  searchable = false,
  searchPlaceholder = 'Search…',
  children,
  ...rest
}) => {
  const [query, setQuery] = useState('');

  const filtered = searchable && query
    ? options.filter((o) =>
        `${o.label} ${o.subLabel ?? ''}`.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const handleSelect = (v: string) => {
    onValueChange?.(v);
    setQuery('');
  };

  return (
    <Select value={value} onValueChange={handleSelect} disabled={disabled}>
      <SelectTrigger id={id} className={triggerClassName} aria-label={rest['aria-label']}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {searchable && (
          <div
            className="flex items-center gap-2 w-full px-2 pb-2 mb-1 border-b border-gray-100 dark:border-white/10"
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0 pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-sm"
            />
          </div>
        )}
        {filtered.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className={opt.className}>
            {opt.label}
          </SelectItem>
        ))}
        {children}
      </SelectContent>
    </Select>
  );
};
