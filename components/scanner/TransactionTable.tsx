import React from 'react';
import { CheckCircle2, ArrowUpDown, Calendar, FileText, FolderOpen, Tag, CircleDollarSign, FileCheck, Receipt, Download, BookmarkPlus, HelpCircle } from 'lucide-react';
import { Transaction, LearningRulesMap } from '../../types';
import { UI_COLORS } from '../../constants';
import { TransactionRow } from './TransactionRow';
import { TransactionCardMobile } from './TransactionCardMobile';
import { FilterPanel } from './FilterPanel';
import { BatchEditPanel } from './BatchEditPanel';
import { FilterState } from './hooks/useFilters';

// Simple Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <span className="group relative inline-flex items-center">
    {children}
    <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 max-w-xs text-center shadow-lg">
      {text}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
    </span>
  </span>
);

interface TransactionTableProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  isMobile: boolean;
  onUpdateTransaction: (id: string, field: keyof Transaction, value: any) => void;
  onToggleSign: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  availableKamokuList: string[];
  getSubAccountsForKamoku: (kamoku: string) => string[];
  allTaxCategories: string[];
  learningRules: LearningRulesMap;
  // Filter props
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
  // Batch edit props
  isBatchEditMode: boolean;
  onToggleBatchEditMode: () => void;
  selectedTransactionIds: Set<string>;
  onToggleTransactionSelection: (id: string) => void;
  onSelectAllTransactions: () => void;
  batchKamoku: string;
  setBatchKamoku: (value: string) => void;
  batchSubKamoku: string;
  setBatchSubKamoku: (value: string) => void;
  batchTaxCategory: string;
  setBatchTaxCategory: (value: string) => void;
  batchInvoice: string;
  setBatchInvoice: (value: string) => void;
  onApplyBatchEdit: () => void;
  onCancelBatchEdit: () => void;
  // Actions
  onSave: () => void;
  onDownloadCSV: () => void;
  // Duplicate detection
  isDuplicate?: (id: string) => boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  filteredTransactions,
  isMobile,
  onUpdateTransaction,
  onToggleSign,
  onDeleteTransaction,
  availableKamokuList,
  getSubAccountsForKamoku,
  allTaxCategories,
  learningRules,
  filterText,
  onFilterTextChange,
  filters,
  onFilterChange,
  filterOptions,
  showFilterPanel,
  onToggleFilterPanel,
  hasActiveFilters,
  onClearAllFilters,
  isBatchEditMode,
  onToggleBatchEditMode,
  selectedTransactionIds,
  onToggleTransactionSelection,
  onSelectAllTransactions,
  batchKamoku,
  setBatchKamoku,
  batchSubKamoku,
  setBatchSubKamoku,
  batchTaxCategory,
  setBatchTaxCategory,
  batchInvoice,
  setBatchInvoice,
  onApplyBatchEdit,
  onCancelBatchEdit,
  onSave,
  onDownloadCSV,
  isDuplicate
}) => {
  const hasMatchingRule = (description: string, kamoku: string | undefined): boolean => {
    const rule = learningRules[description];
    return !!(rule && rule.kamoku === kamoku);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header with title */}
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="text-orange-600 w-5 h-5" />
              仕訳プレビュー
              {hasActiveFilters && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                  {filteredTransactions.length}/{transactions.length}件
                </span>
              )}
            </h3>
            {/* Batch Edit Toggle */}
            <Tooltip text="複数の取引を選択して勘定科目や税区分を一括設定できます">
              <button
                onClick={onToggleBatchEditMode}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  isBatchEditMode
                    ? 'bg-orange-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {isBatchEditMode ? '選択モード中' : '一括編集'}
              </button>
            </Tooltip>
          </div>

          {/* Filter controls */}
          <FilterPanel
            filterText={filterText}
            onFilterTextChange={onFilterTextChange}
            filters={filters}
            onFilterChange={onFilterChange}
            filterOptions={filterOptions}
            showFilterPanel={showFilterPanel}
            onToggleFilterPanel={onToggleFilterPanel}
            hasActiveFilters={hasActiveFilters}
            onClearAllFilters={onClearAllFilters}
            filteredCount={filteredTransactions.length}
            totalCount={transactions.length}
          />
        </div>

        {/* Batch Edit Panel */}
        {isBatchEditMode && (
          <BatchEditPanel
            selectedCount={selectedTransactionIds.size}
            totalCount={filteredTransactions.length}
            onSelectAll={onSelectAllTransactions}
            onCancel={onCancelBatchEdit}
            onApply={onApplyBatchEdit}
            batchKamoku={batchKamoku}
            setBatchKamoku={setBatchKamoku}
            batchSubKamoku={batchSubKamoku}
            setBatchSubKamoku={setBatchSubKamoku}
            batchTaxCategory={batchTaxCategory}
            setBatchTaxCategory={setBatchTaxCategory}
            batchInvoice={batchInvoice}
            setBatchInvoice={setBatchInvoice}
            availableKamokuList={availableKamokuList}
            getSubAccountsForKamoku={getSubAccountsForKamoku}
            allTaxCategories={allTaxCategories}
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSave}
          className="sm:flex-none sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
          title="Ctrl+S"
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>証憑保存</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={onDownloadCSV}
          className="sm:flex-none sm:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg"
          title="Ctrl+E"
        >
          <Download className="w-5 h-5" />
          <span>CSV出力</span>
        </button>
      </div>

      {/* Table content */}
      {isMobile ? (
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {filteredTransactions.map(t => (
            <TransactionCardMobile
              key={t.id}
              transaction={t}
              onUpdate={(field, value) => onUpdateTransaction(t.id, field, value)}
              onToggleSign={() => onToggleSign(t.id)}
              onDelete={() => onDeleteTransaction(t.id)}
              availableKamokuList={availableKamokuList}
              getSubAccountsForKamoku={getSubAccountsForKamoku}
              allTaxCategories={allTaxCategories}
              hasMatchingRule={hasMatchingRule(t.description, t.kamoku)}
              isDuplicate={isDuplicate?.(t.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={`${UI_COLORS.table.headerSticky} text-xs`}>
              <tr>
                <th className="px-2 py-3 text-center w-14">
                  <span className="flex items-center justify-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    <span className="hidden lg:inline">収/支</span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[140px]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    取引日
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[200px]">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-orange-600" />
                    摘要
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[140px]">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-orange-600" />
                    相手勘定科目
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[120px]">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-600" />
                    補助科目
                  </span>
                </th>
                <th className="px-4 py-3 text-right min-w-[130px]">
                  <span className="flex items-center justify-end gap-1.5">
                    <CircleDollarSign className="w-3.5 h-3.5 text-orange-600" />
                    金額 (税込)
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[100px]">
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                    インボイス
                  </span>
                </th>
                <th className="px-4 py-3 text-left min-w-[140px]">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-orange-600" />
                    税区分
                  </span>
                </th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(t => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  onUpdate={(field, value) => onUpdateTransaction(t.id, field, value)}
                  onToggleSign={() => onToggleSign(t.id)}
                  onDelete={() => onDeleteTransaction(t.id)}
                  availableKamokuList={availableKamokuList}
                  getSubAccountsForKamoku={getSubAccountsForKamoku}
                  allTaxCategories={allTaxCategories}
                  hasMatchingRule={hasMatchingRule(t.description, t.kamoku)}
                  isBatchEditMode={isBatchEditMode}
                  isSelected={selectedTransactionIds.has(t.id)}
                  onToggleSelection={() => onToggleTransactionSelection(t.id)}
                  isDuplicate={isDuplicate?.(t.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
