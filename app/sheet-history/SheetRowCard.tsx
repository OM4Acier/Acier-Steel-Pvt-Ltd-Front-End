// app/sheet-history/SheetRowCard.tsx
//
// Reusable, data-driven card for a single sheet row. ONE shared field layout is
// used two ways so the preview card and the detail card never diverge:
//   - <SheetRowCard />        → compact glass card in the results grid.
//                               Front shows ONLY the key fields (date, DEO no,
//                               client, organization). After a 3s hover the
//                               remaining fields fade in.
//   - <SheetRowDetailDialog /> → full-screen glass dialog reusing the SAME
//                               <SheetRowFields /> layout, with rich markdown
//                               rendering for free-text columns and bordered
//                               SECTIONS for visual identification.
//
// Column names are dynamic (the backend returns arbitrary sheet columns), so we
// detect the "key" columns by pattern and fall back gracefully when absent.
"use client";

import React, { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Maximize2, Clock } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { SheetRow, SheetValue } from "@/lib/api/endpoints/sheetReaderApi";
import { renderMarkdownText } from "@/components/markdownRenderer";

/* ── Column detection (sheet columns are dynamic) ── */

function pickKeyColumns(columns: string[]): {
  date: string | undefined;
  deo: string | undefined;
  client: string | undefined;
  org: string | undefined;
} {
  const used = new Set<string>();
  const find = (patterns: RegExp[]): string | undefined => {
    const c = columns.find((x) => !used.has(x) && patterns.some((p) => p.test(x)));
    if (c) used.add(c);
    return c;
  };
  const date = find([/timestamp/i, /\bdate\b/i, /created/i, /\btime\b/i, /datetime/i]);
  const deo = find([/deo[\s_]?no/i, /deonumber/i, /\bdeo\b/i, /diary/i, /ref[\s_]?no/i]);
  const client = find([
    /client\s*name/i,
    /clientname/i,
    /customer/i,
    /party/i,
    /buyer/i,
    /\bclient\b/i,
  ]);
  const org = find([
    /organi[sz]ation/i,
    /\borg\b/i,
    /company/i,
    /firm/i,
    /company\s*name/i,
  ]);
  return { date, deo, client, org };
}

/* Rich-text columns rendered through the order markdown renderer. */
const RICH_COLUMN = /note|description|remark|comment|detail|message|address|info|instruction|terms|summary|body/i;

/* ── Value formatting ── */

function parseToDate(v: SheetValue | undefined): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // epoch seconds vs ms
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** dd-MM-yyyy HH:mm (user spec: dd-MM-YYYY hh:MM). */
function formatDate(v: SheetValue | undefined): string {
  const d = parseToDate(v);
  return d ? format(d, "dd-MM-yyyy HH:mm") : "—";
}

function plain(v: SheetValue | undefined): string {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

const URL_RE = /https?:\/\/[^\s)<>"']+/g;

/** Render plain text, converting any Google Drive (or other) URL into a link. */
function TextWithLinks({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  const urls = text.match(URL_RE) ?? [];
  return (
    <>
      {parts.map((chunk, i) => (
        <React.Fragment key={i}>
          <span className="break-words">{chunk}</span>
          {urls[i] && (
            <a
              key={`u${i}`}
              href={urls[i]}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-0.5 inline-flex items-center gap-1 break-all text-chart-3 underline underline-offset-2 hover:text-chart-3/80"
            >
              {/(drive|docs)\.google\.com/.test(urls[i]) ? "📁 Drive" : "🔗 Link"}
            </a>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

/** For rich (markdown) columns: linkify bare URLs first, then render markdown.
 *  Negative lookbehind avoids double-wrapping URLs already inside [text](url). */
function linkifyUrls(text: string): string {
  return text.replace(/(?<!\]\()https?:\/\/[^\s)<>"']+/g, (url) => {
    const isDrive = /(drive|docs)\.google\.com/.test(url);
    return `[${isDrive ? "📁 Drive" : "🔗 Link"}](${url})`;
  });
}

/* ── Shared field renderer (used by preview + detail) ── */

function SheetRowFields({
  row,
  columns,
  layout,
  reveal,
}: {
  row: SheetRow;
  columns: string[];
  layout: "preview" | "detail";
  /** preview-only: whether the secondary fields are currently revealed. */
  reveal?: boolean;
}) {
  if (columns.length === 0) return null;
  const { date, deo, client, org } = pickKeyColumns(columns);
  const dateCol = date;
  const keyCols = [date, deo, client, org].filter(Boolean) as string[];
  const primary = keyCols.length ? keyCols : columns.slice(0, 4);
  const secondary = columns.filter((c) => !primary.includes(c));

  /** Render a single value (date-aware, link-aware). */
  const renderValue = (c: string) => {
    if (dateCol === c) return formatDate(row[c]);
    const isRich = RICH_COLUMN.test(c);
    const raw = plain(row[c]);
    if (isRich) {
      return (
        <div
          className="markdown-cell leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdownText(linkifyUrls(raw)) }}
        />
      );
    }
    return <TextWithLinks text={raw} />;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Primary key fields */}
      <div className="min-w-0 space-y-1.5">
        {date && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-chart-3" />
            {formatDate(row[date])}
          </p>
        )}
        {deo && (
          <p className="text-xl font-extrabold tracking-tight text-card-foreground">
            {plain(row[deo])}
          </p>
        )}
        {client && (
          <p className="truncate text-sm font-semibold text-card-foreground">
            {plain(row[client])}
          </p>
        )}
        {org && (
          <p className="truncate text-xs text-muted-foreground">{plain(row[org])}</p>
        )}
      </div>

      {/* Secondary fields — revealed after 3s hover (preview only) */}
      {layout === "preview" && secondary.length > 0 && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-out",
            reveal ? "mt-1 max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="space-y-1.5 border-t border-border/50 pt-3">
            {secondary.map((c) => (
              <div key={c} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="shrink-0 font-medium uppercase tracking-wide text-muted-foreground">
                  {c}
                </span>
                <span className="min-w-0 truncate text-right text-card-foreground">
                  {dateCol === c ? formatDate(row[c]) : <TextWithLinks text={plain(row[c])} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail: bordered SECTIONS for visual identification */}
      {layout === "detail" && (
        <div className="space-y-4">
          {/* Section 1 — Primary identifiers */}
          <Section title="Primary Details">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {primary.map((c) => (
                <div key={c} className="min-w-0">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {c}
                  </dt>
                  <dd className="sheet-cell-value text-sm text-card-foreground">{renderValue(c)}</dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* Section 2 — Remaining short fields */}
          {secondary.filter((c) => !RICH_COLUMN.test(c)).length > 0 && (
            <Section title="Information">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {secondary
                  .filter((c) => !RICH_COLUMN.test(c))
                  .map((c) => (
                    <div key={c} className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c}
                      </dt>
                      <dd className="text-sm text-card-foreground">{renderValue(c)}</dd>
                    </div>
                  ))}
              </dl>
            </Section>
          )}

          {/* Section 3 — Rich / long text fields */}
          {secondary.filter((c) => RICH_COLUMN.test(c)).length > 0 && (
            <Section title="Notes & Description">
              <div className="space-y-4">
                {secondary
                  .filter((c) => RICH_COLUMN.test(c))
                  .map((c) => (
                    <div key={c} className="min-w-0">
                      <dt className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c}
                      </dt>
                      <dd className="sheet-cell-value text-sm text-card-foreground">{renderValue(c)}</dd>
                    </div>
                  ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

/** Bordered, clearly-separated section used in the detail card. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 p-4 shadow-sm">
      <h4 className="graffiti-tag mb-3">{title}</h4>
      {children}
    </section>
  );
}

/* ───────────────────────── Preview card ───────────────────────── */

export function SheetRowCard({
  row,
  columns,
  index,
}: {
  row: SheetRow;
  columns: string[];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  const onEnter = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRevealed(true), 3000);
  };
  const onLeave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setRevealed(false);
  };

  const { deo, client } = pickKeyColumns(columns);
  const hero = deo ?? client ?? columns[0];

  return (
    <>
      <button
        type="button"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={() => setOpen(true)}
        className={cn(
          "glass group relative flex w-full animate-float flex-col rounded-2xl p-4 text-left",
          "transition-shadow duration-300 hover:shadow-xl hover:ring-1 hover:ring-chart-3/40",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-chart-3",
        )}
        style={{ animationDelay: `${(index % 10) * 0.18}s` }}
      >
        <span className="graffiti-tag absolute right-3 top-3">
          #{String(index + 1).padStart(3, "0")}
        </span>

        <SheetRowFields row={row} columns={columns} layout="preview" reveal={revealed} />

        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-chart-3 opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" /> Open detail
        </span>
      </button>

      <SheetRowDetailDialog
        open={open}
        onOpenChange={setOpen}
        row={row}
        columns={columns}
        index={index}
        hero={hero}
      />
    </>
  );
}

/* ───────────────────────── Detail dialog (reuses SheetRowFields) ───────────────────────── */

export function SheetRowDetailDialog({
  open,
  onOpenChange,
  row,
  columns,
  index,
  hero,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: SheetRow;
  columns: string[];
  index: number;
  hero?: string;
}) {
  const title = hero ? plain(row[hero]) : "Row detail";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
        <Dialog.Content
          className={cn(
            "glass-strong fixed left-1/2 top-1/2 z-50 w-[min(92vw,640px)] overflow-x-hidden",
            "-translate-x-1/2 -translate-y-1/2 rounded-3xl p-6",
            "max-h-[88vh] overflow-y-auto dialog-custom-scrollbar pop-in",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="graffiti truncate text-xl">{title}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Record #{String(index + 1).padStart(3, "0")} · {columns.length} fields
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-chart-3/15 hover:text-card-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* SAME layout as the preview card, just expanded into sections */}
          <SheetRowFields row={row} columns={columns} layout="detail" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
