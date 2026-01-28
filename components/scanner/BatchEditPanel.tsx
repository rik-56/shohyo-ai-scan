import React from 'react';
import { X } from 'lucide-react';

interface BatchEditPanelProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onCancel: () => void;
  onApply: () => void;
  batchKamoku: string;
  setBatchKamoku: (value: string) => void;
  batchSubKamoku: string;
  setBatchSubKamoku: (value: string) => void;
  batchTaxCategory: string;
  setBatchTaxCategory: (value: string) => void;
  batchInvoice: string;
  setBatchInvoice: (value: string) => void;
  availableKamokuList: string[];
  getSubAccountsForKamoku: (kamoku: string) => string[];
  allTaxCategories: string[];
}

export const BatchEditPanel: React.FC<BatchEditPanelProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onCancel,
  onApply,
  batchKamoku,
  setBatchKamoku,
  batchSubKamoku,
  setBatchSubKamoku,
  batchTaxCategory,
  setBatchTaxCategory,
  batchInvoice,
  setBatchInvoice,
  availableKamokuList,
  getSubAccountsForKamoku,
  allTaxCategories
}) => {
  const hasChanges = batchKamoku || batchSubKamoku || batchTaxCategory || batchInvoice;

  return (
    <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50/50 -mx-4 -mb-4 px-4 pb-4 sm:-mx-5 sm:px-5 sm:-mb-5 sm:pb-5 rounded-b-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onSelectAll}
            className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:border-orange-300 transition-all"
          >
            {selectedCount === totalCount ? '全選択解除' : '全選択'}
          </button>
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-orange-600">{selectedCount}</span>件選択中
          </span>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          キャンセル
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {/* Batch Kamoku */}
        <div className="space-y-1">
          <label className="text-xs text-slate-600 font-medium">勘定科目</label>
          <select
            value={batchKamoku}
            onChange={e => setBatchKamoku(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
          >
            <option value="">変更なし</option>
            {availableKamokuList.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        {/* Batch SubKamoku */}
        <div className="space-y-1">
          <label className="text-xs text-slate-600 font-medium">補助科目</label>
          <select
            value={batchSubKamoku}
            onChange={e => setBatchSubKamoku(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
          >
            <option value="">変更なし</option>
            {batchKamoku && getSubAccountsForKamoku(batchKamoku).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {/* Batch Tax Category */}
        <div className="space-y-1">
          <label className="text-xs text-slate-600 font-medium">税区分</label>
          <select
            value={batchTaxCategory}
            onChange={e => setBatchTaxCategory(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
          >
            <option value="">変更なし</option>
            {allTaxCategories.map(tc => (
              <option key={tc} value={tc}>{tc}</option>
            ))}
          </select>
        </div>
        {/* Batch Invoice */}
        <div className="space-y-1">
          <label className="text-xs text-slate-600 font-medium">インボイス</label>
          <select
            value={batchInvoice}
            onChange={e => setBatchInvoice(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
          >
            <option value="">変更なし</option>
            <option value="適格">適格</option>
            <option value="非適格">非適格</option>
          </select>
        </div>
      </div>

      <button
        onClick={onApply}
        disabled={selectedCount === 0 || !hasChanges}
        className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        選択した{selectedCount}件に適用
      </button>
    </div>
  );
};
