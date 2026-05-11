import { Bold, Italic, DollarSign, Phone, Mail } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { renderMarkdownText } from "./markdownRenderer";
import { FormattingGuidePopover } from "./ThemeToggle";
import { Button } from '@/components/ui/button';
import { Label } from "./ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


// ==========================================================
// START: EXPORTED RICH TEXT UTILITIES
// ==========================================================

/**
 * Parses markdown-like text and custom commands into HTML with Tailwind CSS classes.
 * This is exported for potential reuse.
 */


export interface FormatButtonProps {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Exported minimal format button component for the RichTextarea toolbar.
 */
export const FormatButton: React.FC<FormatButtonProps> = ({ icon, label, onClick, className }) => (
  <Button
    type="button"
    variant="ghost" // Changed to ghost for minimal look
    size="sm"
    onClick={onClick}
    title={label}
    className={`h-7 w-7 p-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
  >
    {icon}
  </Button>
);


export interface RichTextareaProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  rows?: number;
  label?: string;
  className?: string;
}

/**
 * Exported rich text area component with toolbar and live preview.
 */


export const RichTextarea: React.FC<RichTextareaProps> = ({ id, value, onChange, placeholder, rows = 3, label, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const applyFormat = useCallback((prefix: string, suffix: string, defaultValue: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    let newText: string;
    let newCursorPos: number;

    const selectedText = currentText.substring(start, end);

    if (selectedText) {
      newText = currentText.substring(0, start) + prefix + selectedText + suffix + currentText.substring(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      const content = defaultValue || 'text';
      newText = currentText.substring(0, start) + prefix + content + suffix + currentText.substring(end);
      newCursorPos = start + prefix.length;
    }

    onChange({
      target: { id, value: newText } as HTMLTextAreaElement,
    } as React.ChangeEvent<HTMLTextAreaElement>);

    requestAnimationFrame(() => {
      textarea.value = newText;
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos + (selectedText ? selectedText.length : defaultValue.length);
      textarea.focus();
    });
  }, [id, onChange]);

  const handleInsertContact = (type: 'phone' | 'email' | 'wa') => {
    let prefix = '';
    let defaultValue = '';

    if (type === 'phone') {
      prefix = '@phone:';
      defaultValue = '1234567890';
    } else if (type === 'email') {
      prefix = '@email:';
      defaultValue = 'name@example.com';
    } else if (type === 'wa') {
      prefix = '@wa:';
      defaultValue = '1234567890';
    }

    applyFormat(prefix, '', defaultValue);
  };

  const handleInsertLink = () => {
    applyFormat('[', '](https://example.com)', 'Link Text');
  };


  return (
    <div className={`space-y-1 ${className}`}>
      <Label htmlFor={id} className="font-semibold text-gray-700 dark:text-gray-300">{label}</Label>

      {/* Toolbar - Compacted */}
      <div className="flex space-x-0.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
        <FormatButton
          icon={<Bold className="w-4 h-4" />}
          label="Bold (*bold*)"
          onClick={() => applyFormat('*', '*')}
        />
        <FormatButton
          icon={<Italic className="w-4 h-4" />}
          label="Italic (_italic_)"
          onClick={() => applyFormat('_', '_')}
        />
        <span className="border-l border-gray-300 dark:border-gray-600 mx-1 h-6 self-center"></span>
        <FormatButton
          icon={<DollarSign className="w-4 h-4" />}
          label="Math Calculation ({{100*5}})"
          onClick={() => applyFormat('{{', '}}', '100+50')}
          className="text-green-600 dark:text-green-400"
        />
        <FormatButton
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>}
          label="Insert Link ([text](url))"
          onClick={handleInsertLink}
          className="text-blue-600 dark:text-blue-400"
        />
        <span className="border-l border-gray-300 dark:border-gray-600 mx-1 h-6 self-center"></span>
        <FormatButton
          icon={<Phone className="w-4 h-4" />}
          label="Insert Phone Contact (@phone:)"
          onClick={() => handleInsertContact('phone')}
          className="text-green-600 dark:text-green-400"
        />
        <FormatButton
          icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>}
          label="Insert WhatsApp Contact (@wa:)"
          onClick={() => handleInsertContact('wa')}
          className="text-green-600 dark:text-green-400"
        />
        <FormatButton
          icon={<Mail className="w-4 h-4" />}
          label="Insert Email Contact (@email:)"
          onClick={() => handleInsertContact('email')}
          className="text-purple-600 dark:text-purple-400"
        />
        <FormattingGuidePopover />
      </div>

      {/* Textarea or Preview */}
      <div className={`relative ${isFocused ? 'ring-1 ring-blue-500 rounded-md' : ''}`}>
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="min-h-[100px] font-sans focus-visible:ring-0 peer pr-10 border-gray-300 dark:border-gray-600"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost" // Changed to ghost for minimal look
              size="icon"
              className="absolute top-1.5 right-1.5 h-7 w-7 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Preview Rich Text"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 text-xs z-[9100] bg-white dark:bg-gray-800 shadow-lg border border-blue-400 dark:border-blue-600">
            <p className="font-bold text-sm text-gray-900 dark:text-white mb-2 border-b pb-1">Formatted Preview</p>
            <div
              className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed space-y-1"
              dangerouslySetInnerHTML={{ __html: renderMarkdownText(value) }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};