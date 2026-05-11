// components/markdownRenderer.ts - Enhanced Markdown Renderer with Math & Icons
// src/utils/validators.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});
/*
export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    role: z.enum(['manager', 'employee'], {
      required_error: 'You must select a role',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // Path to show error
  });*/

export const quickTaskSchema = z.object({
  employeeId: z.string().min(1, 'You must select an employee'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.date().optional(),
});

// Type exports for forms
//export type LoginFormFields = z.infer<typeof loginSchema>;
//export type RegisterFormFields = z.infer<typeof registerSchema>;
//export type QuickTaskFormFields = z.infer<typeof quickTaskSchema>;

export const renderMarkdownText = (text: string | undefined): string => {
  if (!text) return 'N/A';

  let html = text;

  // Math calculations with icon support: {{CALC:2+2}} or {{2+2}}
  html = html.replace(/\{\{(?:CALC:)?([^}]+)\}\}/g, (match, expression) => {
    try {
      // Safe evaluation with basic math operations
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`'use strict'; return (${sanitized})`)();
      
      // Format result (round to 2 decimals if needed)
      const formatted = Number.isInteger(result) ? result : result.toFixed(2);
      
      return `<span class="inline-flex items-center  px-2 py-0.5 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 text-blue-800 dark:text-blue-200 rounded font-mono text-sm  border border-blue-300 dark:border-blue-700">${formatted}</span>`;
    } catch {
      return match; // Return original if calculation fails
    }
  });

  // Money calculations: {{MONEY:price:quantity}} → Total
  html = html.replace(/\{\{MONEY:([^:]+):([^}]+)\}\}/g, (match, price, quantity) => {
    try {
      const p = parseFloat(price.replace(/[^0-9.]/g, ''));
      const q = parseFloat(quantity.replace(/[^0-9.]/g, ''));
      const total = (p * q).toFixed(2);
      
      return `<span class="inline-flex items-center  px-2 py-0.5 bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900 dark:to-green-800 text-green-800 dark:text-green-200 rounded font-mono text-sm  border border-green-300 dark:border-green-700">₹${total}</span>`;
    } catch {
      return match;
    }
  });

  // Percentage calculations: {{PERCENT:base:percent}} → Result
  html = html.replace(/\{\{PERCENT:([^:]+):([^}]+)\}\}/g, (match, base, percent) => {
    try {
      const b = parseFloat(base.replace(/[^0-9.]/g, ''));
      const p = parseFloat(percent.replace(/[^0-9.]/g, ''));
      const result = ((b * p) / 100).toFixed(2);
      
      return `<span class="inline-flex items-center  px-2 py-0.5 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900 dark:to-purple-800 text-purple-800 dark:text-purple-200 rounded font-mono text-sm  border border-purple-300 dark:border-purple-700">${result}% (${result})</span>`;
    } catch {
      return match;
    }
  });

 
  // Bold text: **text** or *text*
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<strong class="font-bold text-gray-900 dark:text-white">$1</strong>');

  // Italic text: _text_
  html = html.replace(/_(.+?)_/g, '<em class="italic text-gray-700 dark:text-gray-300">$1</em>');

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500 dark:text-gray-400">$1</del>');

  // Highlight: ==text==
  html = html.replace(/==(.+?)==/g, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');

  // Links: [text](url)
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>$1</a>'
  );

  // Phone numbers: @phone:1234567890
  html = html.replace(
    /@phone:(\d{10})/g,
    '<a href="tel:+91$1" class="inline-flex items-center gap-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>+91 $1</a>'
  );

  // WhatsApp: @wa:1234567890
  html = html.replace(
    /@wa:(\d{10})/g,
    '<a href="https://wa.me/91$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>WhatsApp</a>'
  );

  // Line breaks: \n -> <br/>
  html = html.replace(/\n/g, '<br/>');

  // Bullet lists: - item or * item
  html = html.replace(/^[*-]\s+(.+)$/gm, '<li class="ml-4">• $1</li>');

  return html;
};

// Helper function to strip markdown for plain text display
export const stripMarkdown = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/\{\{[^}]+\}\}/g, '[calc]') // Remove all calculations
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1') // Remove italic
    .replace(/~~([^~]+)~~/g, '$1') // Remove strikethrough
    .replace(/==([^=]+)==/g, '$1') // Remove highlight
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/@phone:(\d+)/g, '$1') // Remove phone prefix
    .replace(/@wa:(\d+)/g, '$1') // Remove WhatsApp prefix
    .replace(/@email:([\w.+-]+@[\w.-]+\.\w+)/g, '$1'); // Remove email prefix
};

