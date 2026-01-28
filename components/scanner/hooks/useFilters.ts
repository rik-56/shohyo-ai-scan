import { useState, useMemo } from 'react';
import { Transaction } from '../../../types';

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  kamoku: string;
  subKamoku: string;
  invoiceNumber: string;
  taxCategory: string;
}

const initialFilters: FilterState = {
  dateFrom: '',
  dateTo: '',
  kamoku: '',
  subKamoku: '',
  invoiceNumber: '',
  taxCategory: ''
};

export const useFilters = (transactions: Transaction[]) => {
  const [filterText, setFilterText] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Filter transactions based on all filter criteria
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Text filter for description
      if (filterText && !t.description.toLowerCase().includes(filterText.toLowerCase())) return false;
      // Date range filter
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      // Kamoku filter
      if (filters.kamoku && t.kamoku !== filters.kamoku) return false;
      // SubKamoku filter
      if (filters.subKamoku && t.subKamoku !== filters.subKamoku) return false;
      // Invoice filter
      if (filters.invoiceNumber && t.invoiceNumber !== filters.invoiceNumber) return false;
      // Tax category filter
      if (filters.taxCategory && t.taxCategory !== filters.taxCategory) return false;
      return true;
    });
  }, [transactions, filterText, filters]);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const kamokuSet = new Set<string>();
    const subKamokuSet = new Set<string>();
    const invoiceSet = new Set<string>();
    const taxCategorySet = new Set<string>();
    transactions.forEach(t => {
      if (t.kamoku) kamokuSet.add(t.kamoku);
      if (t.subKamoku) subKamokuSet.add(t.subKamoku);
      if (t.invoiceNumber) invoiceSet.add(t.invoiceNumber);
      if (t.taxCategory) taxCategorySet.add(t.taxCategory);
    });
    return {
      kamoku: Array.from(kamokuSet).sort(),
      subKamoku: Array.from(subKamokuSet).sort(),
      invoiceNumber: Array.from(invoiceSet).sort(),
      taxCategory: Array.from(taxCategorySet).sort()
    };
  }, [transactions]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return !!(filterText || filters.dateFrom || filters.dateTo || filters.kamoku || filters.subKamoku || filters.invoiceNumber || filters.taxCategory);
  }, [filterText, filters]);

  // Clear all filters
  const clearAllFilters = () => {
    setFilterText('');
    setFilters(initialFilters);
  };

  // Update a single filter field
  const updateFilter = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return {
    filterText,
    setFilterText,
    filters,
    setFilters,
    updateFilter,
    showFilterPanel,
    setShowFilterPanel,
    filteredTransactions,
    filterOptions,
    hasActiveFilters,
    clearAllFilters
  };
};
