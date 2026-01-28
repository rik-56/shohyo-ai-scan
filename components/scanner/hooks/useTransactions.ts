import { useState, useCallback, useMemo } from 'react';
import { Transaction } from '../../../types';
import { useToast } from '../../Toast';

export interface DuplicateInfo {
  transactionId: string;
  matchingIds: string[];
}

// Calculate string similarity (simple Levenshtein-based)
const similarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  // Simple contains check for high similarity
  if (longer.toLowerCase().includes(shorter.toLowerCase())) {
    return shorter.length / longer.length + 0.2; // Boost for contains
  }

  // Character-based similarity
  let matches = 0;
  const s1Lower = s1.toLowerCase();
  const s2Lower = s2.toLowerCase();

  for (let i = 0; i < shorter.length; i++) {
    if (s2Lower.includes(s1Lower[i])) matches++;
  }

  return matches / longer.length;
};

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastDeletedTransaction, setLastDeletedTransaction] = useState<Transaction | null>(null);
  const { showToast } = useToast();

  // Duplicate detection
  const duplicates = useMemo((): DuplicateInfo[] => {
    const results: DuplicateInfo[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      const t1 = transactions[i];
      if (checked.has(t1.id)) continue;

      const matchingIds: string[] = [];

      for (let j = i + 1; j < transactions.length; j++) {
        const t2 = transactions[j];

        // Same date and same absolute amount
        if (t1.date === t2.date && Math.abs(t1.amount) === Math.abs(t2.amount)) {
          // Check description similarity (80% threshold)
          const sim = similarity(t1.description, t2.description);
          if (sim >= 0.8) {
            matchingIds.push(t2.id);
            checked.add(t2.id);
          }
        }
      }

      if (matchingIds.length > 0) {
        results.push({ transactionId: t1.id, matchingIds });
        checked.add(t1.id);
      }
    }

    return results;
  }, [transactions]);

  // Check if a transaction is a duplicate
  const isDuplicate = useCallback((id: string): boolean => {
    return duplicates.some(
      d => d.transactionId === id || d.matchingIds.includes(id)
    );
  }, [duplicates]);

  // Update a transaction field
  const updateTransaction = useCallback((
    id: string,
    field: keyof Transaction,
    value: any
  ) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  }, []);

  // Toggle transaction sign (income <-> expense)
  const toggleTransactionSign = useCallback((id: string) => {
    setTransactions(prev =>
      prev.map(t => {
        if (t.id !== id) return t;

        return {
          ...t,
          amount: -t.amount,
          toggled: !t.toggled,
          kamoku: t.kamoku === '仮払金' ? '仮受金'
                : t.kamoku === '仮受金' ? '仮払金'
                : t.kamoku
        };
      })
    );
  }, []);

  // Delete a transaction with undo capability
  const deleteTransaction = useCallback((id: string, showToastFn?: typeof showToast) => {
    const toastFn = showToastFn || showToast;
    const targetTransaction = transactions.find(t => t.id === id);
    if (!targetTransaction) return;

    setLastDeletedTransaction(targetTransaction);
    setTransactions(prev => prev.filter(t => t.id !== id));

    toastFn?.('取引を削除しました', 'success', {
      label: '元に戻す',
      onClick: () => {
        setTransactions(prev => [...prev, targetTransaction]);
        setLastDeletedTransaction(null);
        toastFn?.('取引を復活しました', 'success');
      }
    });
  }, [transactions, showToast]);

  // Batch update multiple transactions
  const batchUpdateTransactions = useCallback((
    ids: Set<string>,
    updates: Partial<Transaction>
  ) => {
    setTransactions(prev =>
      prev.map(t => ids.has(t.id) ? { ...t, ...updates } : t)
    );
    return ids.size;
  }, []);

  // Monthly chart data
  const monthlyChartData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, income: 0, expense: 0 };
      if (t.amount > 0) map[m].income += t.amount;
      else map[m].expense += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  return {
    transactions,
    setTransactions,
    lastDeletedTransaction,
    duplicates,
    isDuplicate,
    updateTransaction,
    toggleTransactionSign,
    deleteTransaction,
    batchUpdateTransactions,
    monthlyChartData
  };
};
