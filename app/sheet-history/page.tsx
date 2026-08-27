"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as BasicCalendar } from "@/components/ui/basic-calendar";
import { NavbarExtension } from "@/context/NavbarExtensionContext";
import { NavButton } from "@/components/NavButton";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  RefreshCcw,
  Search,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Database,
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
    <div className="min-h-screen bg-gray-50">
      <NavbarExtension>
        <NavButton type="refresh" onClick={fetchData} isLoading={loading} />
      </NavbarExtension>

      {loading && (
        <Card className="mb-6 border-blue-400 border-2 bg-blue-50 shadow-lg animate-pulse rounded-xl">
          <CardContent className="p-4 flex items-center justify-center text-blue-700 text-lg font-medium">
            <RefreshCcw className="animate-spin mr-2" /> Loading Sheet History…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-red-400 border-2 bg-red-50 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
            <CardDescription className="text-red-600">Failed to read sheet.</CardDescription>
          </CardHeader>
          <CardContent className="text-red-800">
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <main className="max-w-7xl mx-auto px-[2px] py-6 md:px-6 mt-6">
        <Card className="rounded-xl shadow-lg p-4 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-600" /> Sheet History
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Read filtered + paginated rows from a Google Sheet source. Authenticated with your Clerk session.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Input
                  placeholder="Search all columns…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Search className="mr-2 h-4 w-4" /> Fetch History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {resp && (
          <Card className="rounded-xl shadow-lg p-4">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {resp.returnedRows} / {resp.totalRows} rows
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (Source: {resp.source} · Tab: {resp.tab})
                </span>
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Page {resp.page} of {totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {resp.columns.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={resp.columns.length || 1} className="text-center text-gray-500 py-8">
                        No rows match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, i) => (
                      <TableRow key={i}>
                        {resp.columns.map((c) => (
                          <TableCell key={c}>{String(row[c] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm text-gray-600">
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
