import React from 'react';
import { Filter, X } from 'lucide-react';
import { FilterState } from './hooks/useFilters';

interface FilterPanelProps {
  filterText: string;
  onFilterTextChange: (value: string) => void;
  filters: FilterState;
  onFilterChange: (field: keyof FilterState, value: string) => void;
  filterOptions: {
    kamoku: string[];
    subKamoku: string[];
    invoiceNumber: string[];
    taxCategory: string[];
  };
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
  hasActiveFilters: boolean;
  onClearAllFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filterText,
  onFilterTextChange,
  filters,
  onFilterChange,
  filterOptions,
  showFilterPanel,
  onToggleFilterPanel,
  hasActiveFilters,
  onClearAllFilters,
  filteredCount,
  totalCount
}) => {
  return (
    <>
      {/* Filter controls */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:flex-none sm:w-48">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filterText}
            onChange={e => onFilterTextChange(e.target.value)}
            placeholder="摘要でフィルター"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
            aria-label="摘要でフィルター"
          />
        </div>
        <button
          onClick={onToggleFilterPanel}
          className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1 transition-all ${
            showFilterPanel || hasActiveFilters
              ? 'bg-orange-50 border-orange-300 text-orange-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-orange-300'
          }`}
          aria-expanded={showFilterPanel}
          aria-label="詳細フィルター"
        >
          <Filter className="w-4 h-4" />
          詳細
        </button>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Date From */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">取引日（開始）</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => onFilterChange('dateFrom', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              />
            </div>
            {/* Date To */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">取引日（終了）</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => onFilterChange('dateTo', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              />
            </div>
            {/* Kamoku */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">相手勘定科目</label>
              <select
                value={filters.kamoku}
                onChange={e => onFilterChange('kamoku', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              >
                <option value="">すべて</option>
                {filterOptions.kamoku.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            {/* SubKamoku */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">補助科目</label>
              <select
                value={filters.subKamoku}
                onChange={e => onFilterChange('subKamoku', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              >
                <option value="">すべて</option>
                {filterOptions.subKamoku.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Invoice */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">インボイス</label>
              <select
                value={filters.invoiceNumber}
                onChange={e => onFilterChange('invoiceNumber', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              >
                <option value="">すべて</option>
                <option value="適格">適格</option>
                <option value="非適格">非適格</option>
              </select>
            </div>
            {/* Tax Category */}
            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-medium">税区分</label>
              <select
                value={filters.taxCategory}
                onChange={e => onFilterChange('taxCategory', e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
              >
                <option value="">すべて</option>
                {filterOptions.taxCategory.map(tc => (
                  <option key={tc} value={tc}>{tc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter count and clear */}
          <div className="flex justify-between items-center">
            {hasActiveFilters && (
              <span className="text-xs text-slate-500">
                {totalCount}件中 <span className="font-semibold text-orange-600">{filteredCount}件</span> を表示中
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={onClearAllFilters}
                className="text-xs text-slate-500 hover:text-orange-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                フィルターをクリア
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
