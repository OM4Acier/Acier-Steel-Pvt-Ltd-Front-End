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
import { sheetReaderApi, type SheetReadResponse } from "@/lib/api/endpoints/sheetReaderApi";

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
  const [source, setSource] = useState("");

  const [search, setSearch] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(200);

  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<SheetReadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = resp?.columns ?? [];
  const rows = resp?.data ?? [];

  const fetchData = useCallback(async () => {
    if (!source.trim()) {
      toast.error("Source key is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await sheetReaderApi.read({
        source: source.trim(),
        search: search.trim() || undefined,
        filterColumn: filterColumn.trim() || undefined,
        filterValue: filterValue.trim() || undefined,
        dateColumn: dateColumn.trim() || undefined,
        from: from ? format(from, "yyyy-MM-dd") : undefined,
        to: to ? format(to, "yyyy-MM-dd") : undefined,
        sortBy: sortBy.trim() || undefined,
        sortDir,
        page,
        limit,
      });

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
  }, [source, search, filterColumn, filterValue, dateColumn, from, to, sortBy, sortDir, page, limit]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [source, search, filterColumn, filterValue, dateColumn, from, to, sortBy, sortDir, limit]);

  const totalPages = resp?.totalPages ?? 0;

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
            {/* Source key */}
            <div className="relative">
              <Input
                placeholder="Source key (e.g. leads)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="pl-9"
              />
              <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            {/* Filters row */}
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

              <Input
                placeholder="Filter column (exact match)"
                value={filterColumn}
                onChange={(e) => setFilterColumn(e.target.value)}
              />
              <Input
                placeholder="Filter value"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />

              <Input
                placeholder="Date column (YYYY-MM-DD)"
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
              />

              {/* From date */}
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

              <Input
                placeholder="Sort by column"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
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
                disabled={loading}
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
                    {columns.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length || 1} className="text-center text-gray-500 py-8">
                        No rows match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
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
