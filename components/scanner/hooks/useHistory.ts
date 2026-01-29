import { useState, useEffect, useCallback } from 'react';
import { HistoryBatch, Transaction } from '../../../types';

const STORAGE_KEY_HISTORY = 'kakeibo_ai_history';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // Selection mode for bulk operations
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse history from localStorage:', e);
        setHistory([]);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([]));
      }
    }
  }, []);

  // Save history to localStorage with error handling
  const persistHistory = useCallback((newHistory: HistoryBatch[]): boolean => {
    try {
      setHistory(newHistory);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded:', error);
        return false;
      }
      throw error;
    }
  }, []);

  // Save result type
  type SaveResult = { batch: HistoryBatch; quotaExceeded: false } | { batch: null; quotaExceeded: true } | { batch: null; quotaExceeded: false };

  // Save a new batch to history
  const saveToHistory = useCallback((
    transactions: Transaction[],
    client: string,
    name: string,
    previewUrl: string | null,
    fileType: 'image' | 'pdf' | 'csv'
  ): SaveResult => {
    if (transactions.length === 0 || !name.trim()) return { batch: null, quotaExceeded: false };

    const newBatch: HistoryBatch = {
      id: `batch-${Date.now()}`,
      timestamp: Date.now(),
      client,
      name: name.trim(),
      transactions,
      totalAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      count: transactions.length,
      previewUrl,
      fileType
    };

    const newHistory = [newBatch, ...history];
    const success = persistHistory(newHistory);

    if (!success) {
      return { batch: null, quotaExceeded: true };
    }

    return { batch: newBatch, quotaExceeded: false };
  }, [history, persistHistory]);

  // Load a batch from history
  const loadFromHistory = useCallback((batchId: string): HistoryBatch | undefined => {
    return history.find(h => h.id === batchId);
  }, [history]);

  // Toggle history item selection
  const toggleHistorySelection = useCallback((id: string) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Delete selected history items
  const deleteSelectedHistory = useCallback(() => {
    if (selectedHistoryIds.size === 0) return 0;

    const count = selectedHistoryIds.size;
    const nextHistory = history.filter(h => !selectedHistoryIds.has(h.id));
    persistHistory(nextHistory);

    setSelectedHistoryIds(new Set());
    setIsSelectionMode(false);

    return count;
  }, [history, selectedHistoryIds, persistHistory]);

  // Delete a single history item
  const deleteHistory = useCallback((id: string) => {
    const nextHistory = history.filter(h => h.id !== id);
    persistHistory(nextHistory);

    if (viewingHistoryId === id) {
      setViewingHistoryId(null);
    }
  }, [history, viewingHistoryId, persistHistory]);

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedHistoryIds(new Set());
  }, []);

  return {
    history,
    viewingHistoryId,
    setViewingHistoryId,
    isSelectionMode,
    setIsSelectionMode,
    selectedHistoryIds,
    saveToHistory,
    loadFromHistory,
    toggleHistorySelection,
    deleteSelectedHistory,
    deleteHistory,
    exitSelectionMode
  };
};
