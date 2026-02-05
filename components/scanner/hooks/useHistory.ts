import { useState, useEffect, useCallback } from 'react';
import { HistoryBatch, Transaction } from '../../../types';

const STORAGE_KEY_HISTORY = 'kakeibo_ai_history';

// 最大履歴件数（自動クリーンアップ用）
const MAX_HISTORY_COUNT = 100;
// 画像付き履歴の最大件数（画像はサイズが大きいため）
const MAX_HISTORY_WITH_IMAGE_COUNT = 20;

// LocalStorage使用量の推定（概算）
const estimateStorageSize = (data: unknown): number => {
  try {
    return JSON.stringify(data).length * 2; // UTF-16 encoding
  } catch {
    return 0;
  }
};

// 利用可能なストレージ容量をチェック
const checkStorageAvailability = (): { used: number; available: boolean } => {
  try {
    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalSize += (localStorage[key]?.length || 0) * 2;
      }
    }
    // 5MB制限の80%を超えた場合はクリーンアップが必要
    const threshold = 5 * 1024 * 1024 * 0.8;
    return {
      used: totalSize,
      available: totalSize < threshold
    };
  } catch {
    return { used: 0, available: true };
  }
};

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // Selection mode for bulk operations
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // 古い履歴を自動クリーンアップする
  const autoCleanup = useCallback((currentHistory: HistoryBatch[]): HistoryBatch[] => {
    let cleanedHistory = [...currentHistory];

    // 1. 総件数が上限を超えている場合、古いものから削除
    if (cleanedHistory.length > MAX_HISTORY_COUNT) {
      console.log(`[History Cleanup] Removing ${cleanedHistory.length - MAX_HISTORY_COUNT} oldest items (exceeded ${MAX_HISTORY_COUNT})`);
      cleanedHistory = cleanedHistory.slice(0, MAX_HISTORY_COUNT);
    }

    // 2. 画像付き履歴が多すぎる場合、古い画像をnullに置換
    const historyWithImages = cleanedHistory.filter(h => h.previewUrl);
    if (historyWithImages.length > MAX_HISTORY_WITH_IMAGE_COUNT) {
      console.log(`[History Cleanup] Clearing preview images from ${historyWithImages.length - MAX_HISTORY_WITH_IMAGE_COUNT} older items`);
      // 古い順に並び替えて、上限を超える分の画像をクリア
      const sortedByTimestamp = [...historyWithImages].sort((a, b) => a.timestamp - b.timestamp);
      const imagesToClear = new Set(
        sortedByTimestamp
          .slice(0, historyWithImages.length - MAX_HISTORY_WITH_IMAGE_COUNT)
          .map(h => h.id)
      );

      cleanedHistory = cleanedHistory.map(h =>
        imagesToClear.has(h.id) ? { ...h, previewUrl: null } : h
      );
    }

    // 3. ストレージ容量が不足している場合、さらに古いものを削除
    const storageStatus = checkStorageAvailability();
    if (!storageStatus.available && cleanedHistory.length > 10) {
      console.log('[History Cleanup] Storage quota nearly exceeded, removing oldest items');
      // 10件は最低限保持、それ以上は削除
      const toRemove = Math.min(cleanedHistory.length - 10, Math.ceil(cleanedHistory.length * 0.2));
      cleanedHistory = cleanedHistory.slice(0, cleanedHistory.length - toRemove);
    }

    return cleanedHistory;
  }, []);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          // 読み込み時にもクリーンアップを実行
          const cleanedHistory = autoCleanup(parsed);
          setHistory(cleanedHistory);

          // クリーンアップが発生した場合は保存
          if (cleanedHistory.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(cleanedHistory));
          }
        }
      } catch (e) {
        console.error('Failed to parse history from localStorage:', e);
        setHistory([]);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([]));
      }
    }
  }, [autoCleanup]);

  // Save history to localStorage with error handling and auto-cleanup
  const persistHistory = useCallback((newHistory: HistoryBatch[]): boolean => {
    try {
      // まずクリーンアップを実行
      let historyToSave = autoCleanup(newHistory);

      // 保存を試行
      setHistory(historyToSave);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyToSave));
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded, attempting aggressive cleanup:', error);

        // 緊急クリーンアップ: 古い履歴の50%を削除
        try {
          const reducedHistory = newHistory.slice(0, Math.max(5, Math.floor(newHistory.length * 0.5)));
          // さらに画像もすべてクリア
          const cleanedHistory = reducedHistory.map(h => ({ ...h, previewUrl: null }));

          setHistory(cleanedHistory);
          localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(cleanedHistory));
          console.log('[History Cleanup] Emergency cleanup successful, reduced to', cleanedHistory.length, 'items');
          return true;
        } catch (retryError) {
          console.error('Emergency cleanup also failed:', retryError);
          return false;
        }
      }
      throw error;
    }
  }, [autoCleanup]);

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

  // 現在のストレージ使用状況を取得
  const getStorageStatus = useCallback(() => {
    return checkStorageAvailability();
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
    exitSelectionMode,
    getStorageStatus
  };
};
