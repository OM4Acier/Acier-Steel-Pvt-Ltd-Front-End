/**
 * useConfigCache – localStorage-backed config cache for AppScript data
 *
 * Strategy:
 *   1. On mount, instantly return cached data from localStorage (zero latency).
 *   2. If the cache is older than CACHE_TTL, silently fetch fresh data in the background.
 *   3. The "Sync" button always forces a live fetch, bypasses cache, and writes fresh data.
 *   4. Serial numbers (lastSerialNumber, nextSerialNumber) are NEVER cached —
 *      they are always fetched live because they change on every submission.
 *
 * Cache key format:  `ims_config_cache`
 * TTL:               ~4 months (120 days)
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface Vendor {
  vendorName: string;
  vendorGst: string;
}

export interface ConfigData {
  brands: string[];
  materialGrades: string[];
  thicknesses: string[];
  coatings: string[];
  widths: string[];
  types: string[];
  vendors: Vendor[];
  lastSerialNumber: string | null;
  nextSerialNumber: string | null;
}

/** The subset of config that is safe to cache (rarely changes). */
interface CacheableConfig {
  brands: string[];
  materialGrades: string[];
  thicknesses: string[];
  coatings: string[];
  widths: string[];
  types: string[];
  vendors: Vendor[];
}

interface CacheEnvelope {
  version: number;
  timestamp: number;
  data: CacheableConfig;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CACHE_KEY = 'ims_config_cache';
const CACHE_VERSION = 1;

/** 120 days in milliseconds (~4 months) */
const CACHE_TTL_MS = 120 * 24 * 60 * 60 * 1000;

// ─── CACHE READ / WRITE ─────────────────────────────────────────────────────

function readCache(): CacheEnvelope | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const envelope: CacheEnvelope = JSON.parse(raw);
    if (envelope.version !== CACHE_VERSION) return null;
    return envelope;
  } catch {
    return null;
  }
}

function writeCache(data: CacheableConfig): void {
  try {
    const envelope: CacheEnvelope = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function isCacheStale(envelope: CacheEnvelope): boolean {
  return Date.now() - envelope.timestamp > CACHE_TTL_MS;
}

function extractCacheableFields(config: ConfigData): CacheableConfig {
  return {
    brands: config.brands,
    materialGrades: config.materialGrades,
    thicknesses: config.thicknesses,
    coatings: config.coatings,
    widths: config.widths,
    types: config.types,
    vendors: config.vendors,
  };
}

export function clearConfigCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

// ─── HOOK ───────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseConfigCacheReturn {
  config: ConfigData | null;
  isRefreshing: boolean;
  isCached: boolean;
  cacheAge: string | null;
  /** Fetch live data from server, bypass cache, and update cache. */
  syncLive: () => Promise<void>;
}

export function useConfigCache(appScriptUrl: string): UseConfigCacheReturn {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // Helper: compute human-readable cache age
  const computeCacheAge = useCallback((timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  }, []);

  // Core fetch logic
  const fetchFromServer = useCallback(async (): Promise<ConfigData> => {
    const response = await fetch(`${appScriptUrl}?action=getConfig`);
    if (!response.ok) throw new Error('Connection failed');
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message || 'Server Error');
    return result.data as ConfigData;
  }, [appScriptUrl]);

  // On mount: load cache first, then background-refresh if stale
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    const cached = readCache();

    if (cached) {
      // Instantly hydrate UI with cached dropdown data + null serials
      const hydratedConfig: ConfigData = {
        ...cached.data,
        lastSerialNumber: null,
        nextSerialNumber: null,
      };
      setConfig(hydratedConfig);
      setIsCached(true);
      setCacheAge(computeCacheAge(cached.timestamp));
    }

    // Always fetch live serial numbers (and fresh config if cache is stale)
    const shouldRefreshConfig = !cached || isCacheStale(cached);

    setIsRefreshing(true);
    fetchFromServer()
      .then((liveData) => {
        setConfig(liveData);
        setIsCached(false);
        setCacheAge(null);

        if (shouldRefreshConfig) {
          writeCache(extractCacheableFields(liveData));
        } else if (cached) {
          // Cache is still valid, just update serial numbers
          // but also refresh the cache with latest dropdown data silently
          writeCache(extractCacheableFields(liveData));
        }
      })
      .catch(() => {
        // If fetch fails and we have cache, keep using cached data
        if (!cached) {
          setConfig(null);
        }
      })
      .finally(() => setIsRefreshing(false));
  }, [fetchFromServer, computeCacheAge]);

  // Sync button: force live fetch, update cache, clear staleness indicator
  const syncLive = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const liveData = await fetchFromServer();
      setConfig(liveData);
      setIsCached(false);
      setCacheAge(null);
      writeCache(extractCacheableFields(liveData));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchFromServer]);

  return { config, isRefreshing, isCached, cacheAge, syncLive };
}
