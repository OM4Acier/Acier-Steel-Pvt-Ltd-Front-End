"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as BasicCalendar } from "@/components/ui/basic-calendar";
import { NavbarExtension } from "@/context/NavbarExtensionContext";
import { NavButton } from "@/components/NavButton";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { SheetRowCard } from "./SheetRowCard";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  RefreshCcw,
  Search,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutGrid,
} from "lucide-react";
import {
  sheetReaderApi,
  type SheetReadResponse,
  type SheetOptionsResponse,
} from "@/lib/api/endpoints/sheetReaderApi";

const LIMIT_OPTIONS = [
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "200", label: "200" },
  { value: "500", label: "500" },
];

const SORT_DIR_OPTIONS = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

export default function SheetHistoryPage() {
  // Metadata from /options
  const [sources, setSources] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [distinct, setDistinct] = useState<Record<string, string[]>>({});

  // Form state
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(200);

  // Request state
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<SheetReadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = resp?.data ?? [];
  const totalPages = resp?.totalPages ?? 0;

  // Load the sources list once.
  const loadSources = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const opt: SheetOptionsResponse = await sheetReaderApi.options();
      if (opt.success) {
        setSources(opt.sources ?? []);
      } else {
        toast.error("Could not load sources", { description: opt.error });
      }
    } catch (err: any) {
      if (err.message !== "Request cancelled") {
        toast.error("Network Error", { description: "Failed to load sheet sources." });
      }
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // When a source is chosen, load its columns + distinct values.
  const loadSourceMeta = useCallback(async (src: string) => {
    if (!src) return;
    try {
      const opt = await sheetReaderApi.options(src);
      if (opt.success) {
        setColumns(opt.columns ?? []);
        setDistinct(opt.distinct ?? {});
        // Reset field selections that depend on this source's schema.
        setFilterColumn("");
        setFilterValue("");
        setSortBy("");
      } else {
        toast.error("Could not load source metadata", { description: opt.error });
      }
    } catch (err: any) {
      if (err.message !== "Request cancelled") {
        toast.error("Network Error", { description: "Failed to load source metadata." });
      }
    }
  }, []);

  const onSourceChange = (src: string) => {
    setSource(src);
    setResp(null);
    loadSourceMeta(src);
  };

  const fetchData = useCallback(async () => {
    if (!source) {
      toast.error("Source is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Build params manually so filterColumn/filterValue and from/to are only
      // ever sent as complete pairs (the backend rejects half-specified filters,
      // and a lone filterColumn otherwise returns zero rows → false "No matching rows").
      const params: Parameters<typeof sheetReaderApi.read>[0] = { source, sortDir };
      if (search.trim()) params.search = search.trim();
      if (filterColumn && filterValue) {
        params.filterColumn = filterColumn;
        params.filterValue = filterValue;
      }
      if (from && to) {
        params.from = format(from, "yyyy-MM-dd");
        params.to = format(to, "yyyy-MM-dd");
      }
      if (sortBy) params.sortBy = sortBy;
      params.page = page;
      params.limit = limit;

      const result = await sheetReaderApi.read(params);

      if (result.success) {
        setResp(result);
        if (result.returnedRows === 0) {
          toast.info("No matching rows", { description: "The filters returned zero rows." });
        }
      } else {
        setResp(null);
        const msg = result.error ?? "Failed to read sheet";
        setError(msg);
        toast.error("Failed to read sheet", { description: msg });
      }
    } catch (err: any) {
      if (err.message === "Request cancelled") return;
      const msg = err?.message ?? "A network error occurred.";
      setError(msg);
      toast.error("Network Error", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [source, search, filterColumn, filterValue, from, to, sortBy, sortDir, page, limit]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [source, search, filterColumn, filterValue, from, to, sortBy, sortDir, limit]);

  const sourceOptions = sources.map((s) => ({ value: s, label: s }));
  const columnOptions = columns.map((c) => ({ value: c, label: c }));
  const distinctValues = filterColumn ? (distinct[filterColumn] ?? []) : [];
  const filterValueOptions = distinctValues.map((v) => ({ value: v, label: v }));

  return (
    <div className="relative min-h-screen">
      {/* Aurora backdrop */}
      <div className="aurora-bg" aria-hidden>
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      <NavbarExtension>
        <NavButton type="refresh" onClick={fetchData} isLoading={loading} />
      </NavbarExtension>

      <main className="relative mx-auto max-w-7xl px-2 py-6 md:px-6">
        {/* Title */}
        <div className="mb-6 px-1">
          <h1 className="graffiti text-3xl md:text-4xl">Sheet History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read filtered + paginated rows from a Google Sheet source. Authenticated with your Clerk session.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass mb-6 flex items-center justify-center gap-2 rounded-2xl p-5 text-chart-3">
            <RefreshCcw className="h-5 w-5 animate-spin" />
            <span className="font-medium">Loading Sheet History…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass mb-6 rounded-2xl border-destructive/40 p-5">
            <p className="text-sm font-semibold text-destructive">Error</p>
            <p className="mt-1 text-sm text-destructive/90">{error}</p>
          </div>
        )}

        {/* Filter card (glass) */}
        <Card className="glass mb-6 rounded-2xl border-0 p-4 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-chart-3" /> Filters
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Pick a source, then refine with search, column filters, and a date range.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source */}
            <SelectDropdown
              options={sourceOptions}
              value={source}
              onValueChange={onSourceChange}
              placeholder={loadingMeta ? "Loading sources…" : "Select source (e.g. leads)"}
              triggerClassName="w-full"
              searchable
              searchPlaceholder="Search sources…"
            />

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Input
                  placeholder="Search all columns…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              <SelectDropdown
                options={columnOptions}
                value={filterColumn}
                onValueChange={(v) => {
                  setFilterColumn(v);
                  setFilterValue("");
                }}
                placeholder="Filter column"
                triggerClassName="w-full"
              />

              <SelectDropdown
                options={filterValueOptions}
                value={filterValue}
                onValueChange={setFilterValue}
                placeholder={filterColumn ? "Filter value" : "Pick a column first"}
                triggerClassName="w-full"
                disabled={!filterColumn}
                searchable
                searchPlaceholder="Search values…"
              />

              {/* From date (fixed `timestamp` column) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {from ? format(from, "PPP") : <span>From date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <BasicCalendar mode="single" selected={from} onSelect={setFrom} initialFocus />
                </PopoverContent>
              </Popover>

              {/* To date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                    {to ? format(to, "PPP") : <span>To date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <BasicCalendar mode="single" selected={to} onSelect={setTo} initialFocus />
                </PopoverContent>
              </Popover>

              <SelectDropdown
                options={columnOptions}
                value={sortBy}
                onValueChange={setSortBy}
                placeholder="Sort by column"
                triggerClassName="w-full"
              />

              <SelectDropdown
                options={SORT_DIR_OPTIONS}
                value={sortDir}
                onValueChange={(v) => setSortDir(v as "asc" | "desc")}
                placeholder="Sort direction"
                triggerClassName="w-full"
              />

              <SelectDropdown
                options={LIMIT_OPTIONS}
                value={String(limit)}
                onValueChange={(v) => setLimit(Number(v))}
                placeholder="Rows per page"
                triggerClassName="w-full"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={fetchData}
                disabled={loading || !source}
                className="bg-chart-3 text-white hover:bg-chart-3/90"
              >
                <Search className="mr-2 h-4 w-4" /> Fetch History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results as a card grid */}
        {resp && (
          <Card className="glass rounded-2xl border-0 p-4 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutGrid className="h-5 w-5 text-chart-3" />
                {resp.returnedRows} / {resp.totalRows} rows
                <span className="text-sm font-normal text-muted-foreground">
                  (Source: {resp.source} · Tab: {resp.tab})
                </span>
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Page {resp.page} of {totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  No rows match the current filters.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((row, i) => (
                    <SheetRowCard key={i} row={row} columns={resp.columns} index={i} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
