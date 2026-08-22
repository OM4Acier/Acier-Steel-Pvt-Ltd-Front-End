// components/ui/SelectDropdown.tsx
// Reusable, accessible select built on the shadcn Select primitive.
// Options are passed in as data (single source of truth) rather than
// hard-coded <SelectItem> lists scattered across components.
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
  /** Stable unique value stored in state / sent to the API. */
  value: string;
  /** Human-readable label shown to the user. */
  label: string;
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
  children,
  ...rest
}) => {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={triggerClassName} aria-label={rest['aria-label']}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className={opt.className}>
            {opt.label}
          </SelectItem>
        ))}
        {children}
      </SelectContent>
    </Select>
  );
};
