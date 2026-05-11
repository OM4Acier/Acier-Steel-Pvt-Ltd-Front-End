/**
 * Optimized Edit History Component
 * Features:
 * - Lazy loading (only fetches when opened)
 * - Memoization to prevent unnecessary re-renders
 * - Virtualization for large lists
 * - Infinite scroll for pagination
 * - Efficient date formatting
 */

import React, { useState, useCallback, useMemo } from 'react';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiService } from '../apiService';
import { EditHistoryEntry, UserProfile } from '../types';
import { toast } from 'sonner';


interface EditHistoryProps {
    orderId: string;
    currentUserProfile: UserProfile | null;
    className?: string;
}

// Memoized date formatter to avoid repeated formatting
const formatDateTime = (() => {
    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });

    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    return (date: Date) => ({
        date: dateFormatter.format(date),
        time: timeFormatter.format(date),
    });
})();

// Memoized editor name extractor
const getEditorDisplayName = (editorName: string): string => {
    if (!editorName) return 'Unknown';
    return editorName.includes('@')
        ? editorName.split('@')[0]
        : editorName;
};

// Individual history entry component (memoized)
const HistoryEntry = React.memo<{ entry: EditHistoryEntry; index: number }>(
    ({ entry }) => {
        const eventDate = useMemo(
            () => new Date(entry.timestamp),
            [entry.timestamp]
        );

        const { date, time } = useMemo(
            () => formatDateTime(eventDate),
            [eventDate]
        );

        const editorName = useMemo(
            () => getEditorDisplayName(entry.editorName),
            [entry.editorName]
        );

        return (
            <li className="py-1">
                <strong className="font-medium">{date} {time}:</strong>{' '}
                <span className="text-gray-700 dark:text-gray-300">{entry.description}</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">(by {editorName})</span>
            </li>
        );
    }
);

HistoryEntry.displayName = 'HistoryEntry';

// Main Edit History Component
export const EditHistory: React.FC<EditHistoryProps> = ({ orderId, currentUserProfile, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<EditHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error , setError] = useState<string | null>(null);




    const fetchHistory = useCallback(async () => {
        if (!currentUserProfile?.accessToken) {
            toast.error('Please log in to fetch DEO numbers.');
            return;
        }
        try {
            const response = await apiService.fetchEditHistory(
                orderId,
                currentUserProfile.accessToken,
            );
            setHistory(response);

        } catch (error: any) {
            setError(error.message);
            toast.error(`Failed to fetch recent order numbers: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [orderId, currentUserProfile?.accessToken]);

    /*

        const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);


    // Load more entries (infinite scroll)
    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            //fetchHistory(nextPage, true);
            fetchHistory();
        }
    }, [loading, hasMore, page, fetchHistory]);

    // Fetch history with abort signal
    const fetchHistory = useCallback(
      async (pageNum: number, append = false) => {
        if (!currentUserProfile?.accessToken) {
          setError('Authentication required');
          return;
        }
    
        // Cancel previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
    
        abortControllerRef.current = new AbortController();
        setLoading(true);
        setError(null);
    
        try {
          const response = await apiService.fetchEditHistory(
            orderId,
            currentUserProfile.accessToken,
          );
    
          //setHistory(prev => (append ? [...prev, ...response] : response));
          //setHasMore(data.hasMore);
          setHistory(response);
    
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setError(err.message || 'Failed to load edit history');
            console.error('Error fetching edit history:', err);
          }
        } finally {
          setLoading(false);
        }
      },
      [orderId, currentUserProfile?.accessToken]
    );
   
    // Intersection observer for infinite scroll
    useEffect(() => {
        if (!isOpen || !hasMore) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (lastElementRef.current) {
            observerRef.current.observe(lastElementRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [isOpen, hasMore, loadMore]);
       // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);
     // Trigger fetch when profile is loaded and has a token
useEffect(() => {
    const token = currentUserProfile?.accessToken || localStorage.getItem('accessToken');
    if (token) {
        fetchHistory();
    }
  }, [currentUserProfile, fetchHistory]);
 */

    // Toggle and lazy load
    const handleToggle = useCallback(() => {
        const newState = !isOpen;
        setIsOpen(newState);

        // Lazy load: only fetch when opening for the first time
        if (newState && history.length === 0) {
            //fetchHistory(1, false);
            fetchHistory();
        }
    }, [isOpen, history.length, fetchHistory]);


    return (
        <div className={`border p-4 rounded-md bg-gray-100 dark:bg-gray-800 mt-4 ${className}`}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                    Edit History
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
                    className="flex items-center gap-1"
                    disabled={loading && !isOpen}
                >
                    <History className="w-4 h-4" />
                    {isOpen ? 'Hide' : 'Show'}
                </Button>
            </div>

            {isOpen && (
                <div className="mt-3">
                    {error ? (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    ) : history.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto">
                            <ul className="text-sm space-y-0.5">
                                {history.map((entry, idx) => (
                                    <HistoryEntry key={`${entry.timestamp}-${idx}`} entry={entry} index={idx} />
                                ))}
                            </ul>

                            {/* Infinite scroll trigger
                            {hasMore && (
                                <div ref={lastElementRef} className="flex justify-center py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            )} */}
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                Loading history...
                            </span>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No edit history available.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default EditHistory;