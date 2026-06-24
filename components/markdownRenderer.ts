// markdownRenderer.ts
// Renders stored text to HTML for preview/display.
// Supports: bold (**), headings (#/##/###), lists, blockquote,
// divider, inline code, fenced code, tables, links, @phone/@wa/@email.
// No math expressions — intentionally removed.

import { z } from 'zod';

// ── Zod schemas (co-located for compatibility) ────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

export const quickTaskSchema = z.object({
  employeeId: z.string().min(1, 'You must select an employee'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.date().optional(),
});

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const phoneIcon =
  `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">` +
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>` +
  `</svg>`;

const waIcon =
  `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">` +
  `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>` +
  `</svg>`;

const mailIcon =
  `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">` +
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>` +
  `</svg>`;

const linkIcon =
  `<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">` +
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>` +
  `</svg>`;

// ── Table renderer ────────────────────────────────────────────────────────────

const renderTable = (block: string): string => {
  const lines = block.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return block;
  const parseRow = (row: string) =>
    row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const headers = parseRow(lines[0]);
  const aligns = parseRow(lines[1]).map((c) => {
    if (/^:-+:$/.test(c)) return 'text-center';
    if (/-+:$/.test(c)) return 'text-right';
    return 'text-left';
  });
  const rows = lines.slice(2).map(parseRow);
  const ths = headers
    .map(
      (h, i) =>
        `<th class="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 ${aligns[i] ?? 'text-left'} border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm first:rounded-tl-md last:rounded-tr-md last:border-r-0">${h}</th>`,
    )
    .join('');
  const trs = rows
    .map(
      (row) =>
        `<tr class="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">${row
          .map(
            (cell, i) =>
              `<td class="px-4 py-2 text-slate-600 dark:text-slate-300 ${aligns[i] ?? 'text-left'} border-r border-slate-100 dark:border-slate-800 last:border-r-0">${cell}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return (
    `<div class="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-black/5">` +
    `<table class="w-full text-sm border-collapse bg-white dark:bg-slate-900">` +
    (ths ? `<thead><tr>${ths}</tr></thead>` : '') +
    `<tbody>${trs}</tbody></table></div>`
  );
};

// ── Main renderer ─────────────────────────────────────────────────────────────

export const renderMarkdownText = (text: string | undefined): string => {
  if (!text) return '<span class="text-slate-400 italic text-sm">No content provided</span>';

  let html = text;

  // Fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return (
      `<div class="group relative my-4">` +
      `<pre class="rounded-xl bg-slate-950 text-slate-100 text-[13px] p-4 overflow-x-auto leading-relaxed border border-slate-800 shadow-lg font-mono">` +
      `<div class="absolute right-3 top-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold opacity-0 group-hover:opacity-100 transition-opacity">${lang || 'code'}</div>` +
      `<code class="language-${lang}">${escaped}</code></pre></div>`
    );
  });

  // Tables
  html = html.replace(/((?:\|.+\|[ \t]*(?:\n|$)){2,})/g, (m) => renderTable(m));

  // Images
  html = html.replace(/!\[(.*?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 border border-slate-200 dark:border-slate-800 shadow-sm"/>');

  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 class="text-[12px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-[13px] font-bold text-slate-700 dark:text-slate-200 uppercase">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-[0.1em] border-l-2 border-indigo-500 pl-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">$1</h1>');

  // Blockquote
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="border-l-4 border-indigo-500/50 text-slate-600 dark:text-slate-400 italic bg-indigo-50/30 dark:bg-indigo-900/10 rounded-r-lg ring-1 ring-indigo-500/5">$1</blockquote>',
  );

  // Divider
  html = html.replace(/^---+$/gm, '<hr class="my-8 border-slate-200 dark:border-slate-800"/>');

  // Bold — **text** (double asterisk, backward compat)
  html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong class="font-bold text-slate-950 dark:text-white selection:bg-indigo-200 dark:selection:bg-indigo-900/50">$2</strong>');

  // Bold — *text* (single asterisk, primary format)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<strong class="font-bold text-slate-950 dark:text-white selection:bg-indigo-200 dark:selection:bg-indigo-900/50">$1</strong>');

  // Italic — _text_ only (underscore)
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="opacity-60 line-through text-slate-500">$1</del>');

  // Inline code `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-2 py-0.5 rounded-md text-[13px] bg-slate-100 dark:bg-slate-800/80 font-mono text-indigo-600 dark:text-indigo-400 border border-slate-200/50 dark:border-slate-700/50">$1</code>',
  );

  // Links [text](url)
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline underline-offset-4 decoration-indigo-600/30 hover:decoration-indigo-600 inline-flex items-center gap-1 transition-all">${linkIcon}$1</a>`,
  );

  // @phone:
  html = html.replace(
    /@phone:(\d{7,})/g,
    `<a href="tel:+91$1" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-100 transition-colors">${phoneIcon}+91 $1</a>`,
  );

  // @wa:
  html = html.replace(
    /@wa:(\d{7,})/g,
    `<a href="https://wa.me/91$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold border border-green-100 dark:border-green-800/50 hover:bg-green-100 transition-colors">${waIcon}WhatsApp</a>`,
  );

  // @email:
  html = html.replace(
    /@email:([\w.+\-]+@[\w.\-]+\.\w+)/g,
    `<a href="mailto:$1" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 font-semibold border border-violet-100 dark:border-violet-800/50 hover:bg-violet-100 transition-colors">${mailIcon}$1</a>`,
  );


  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
};

// ── Strip markdown → plain text ───────────────────────────────────────────────

export const stripMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/@phone:(\d+)/g, '$1')
    .replace(/@wa:(\d+)/g, '$1')
    .replace(/@email:([\w.+\-]+@[\w.\-]+\.\w+)/g, '$1')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/^[*\-]\s+(\[[ x]\]\s+)?/gm, '');
};