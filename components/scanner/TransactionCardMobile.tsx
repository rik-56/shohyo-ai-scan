import React from 'react';
import { Trash2, ArrowUpDown, FolderOpen, Tag, FileCheck, Receipt, GraduationCap, AlertTriangle } from 'lucide-react';
import { Transaction } from '../../types';
import { UI_COLORS } from '../../constants';

interface TransactionCardMobileProps {
  transaction: Transaction;
  onUpdate: (field: keyof Transaction, value: any) => void;
  onToggleSign: () => void;
  onDelete: () => void;
  availableKamokuList: string[];
  getSubAccountsForKamoku: (kamoku: string) => string[];
  allTaxCategories: string[];
  hasMatchingRule: boolean;
  isDuplicate?: boolean;
}

export const TransactionCardMobile: React.FC<TransactionCardMobileProps> = ({
  transaction: t,
  onUpdate,
  onToggleSign,
  onDelete,
  availableKamokuList,
  getSubAccountsForKamoku,
  allTaxCategories,
  hasMatchingRule,
  isDuplicate
}) => {
  const isExpense = t.amount < 0;

  return (
    <div className={`rounded-xl overflow-hidden shadow-sm ${t.toggled ? UI_COLORS.table.rowToggled : 'border border-slate-200 bg-white'}`}>
      {/* Card Header */}
      <div className={`flex items-center justify-between p-3 ${isExpense ? 'bg-red-50' : 'bg-blue-50'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${isExpense ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {isExpense ? '支出' : '収入'}
          </span>
          {isDuplicate && (
            <span className="text-amber-500" title="重複の可能性があります">
              <AlertTriangle className="w-4 h-4" />
            </span>
          )}
          <input
            type="date"
            value={t.date.replace(/\//g, '-')}
            onChange={e => onUpdate('date', e.target.value.replace(/-/g, '/'))}
            className="text-sm text-slate-600 bg-transparent outline-none focus:bg-white rounded px-2 py-1.5 border border-transparent focus:border-orange-500 focus:ring-1 focus:ring-orange-500 min-h-[44px]"
            aria-label="取引日"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSign}
            className="p-2.5 min-w-[44px] min-h-[44px] text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center"
            aria-label="収支を切り替え"
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 min-w-[44px] min-h-[44px] text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
            aria-label="取引を削除"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4">
        {/* 摘要・金額 */}
        <div className="flex items-start justify-between gap-3">
          <input
            value={t.description}
            onChange={e => onUpdate('description', e.target.value)}
            title={t.description}
            className="flex-1 font-semibold text-slate-800 bg-transparent outline-none focus:bg-slate-50 rounded px-2 py-2 border border-transparent focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-base min-h-[44px]"
            aria-label="摘要"
          />
          <input
            type="number"
            value={t.amount}
            onChange={e => onUpdate('amount', parseFloat(e.target.value) || 0)}
            className={`text-right bg-slate-50 px-3 py-2 outline-none focus:bg-white rounded-lg border border-slate-200 focus:border-orange-500 font-bold text-xl w-36 min-h-[44px] ${isExpense ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
            aria-label="金額"
          />
        </div>

        {/* 勘定科目 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
              <FolderOpen className="w-3 h-3" /> 勘定科目
            </label>
            <input
              list={`kamoku-list-mobile-${t.id}`}
              value={t.kamoku || ''}
              placeholder={isExpense ? '仮払金' : '仮受金'}
              onChange={e => onUpdate('kamoku', e.target.value)}
              className={`w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm font-semibold min-h-[44px] ${isExpense ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
            />
            <datalist id={`kamoku-list-mobile-${t.id}`}>
              {availableKamokuList.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
              <Tag className="w-3 h-3" /> 補助科目
            </label>
            <input
              list={`subkamoku-list-mobile-${t.id}`}
              value={t.subKamoku || ''}
              placeholder="-"
              onChange={e => onUpdate('subKamoku', e.target.value)}
              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
            />
            <datalist id={`subkamoku-list-mobile-${t.id}`}>
              {getSubAccountsForKamoku(t.kamoku || '').map(sub => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
          </div>
        </div>

        {/* インボイス・税区分 */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
              <FileCheck className="w-3 h-3" /> インボイス
            </label>
            <select
              value={t.invoiceNumber || ''}
              onChange={e => onUpdate('invoiceNumber', e.target.value)}
              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
            >
              <option value="">未選択</option>
              <option value="適格">適格</option>
              <option value="非適格">非適格</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
              <Receipt className="w-3 h-3" /> 税区分
            </label>
            <select
              value={t.taxCategory || ''}
              onChange={e => onUpdate('taxCategory', e.target.value)}
              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
            >
              {allTaxCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 学習済みマーク */}
        {hasMatchingRule && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
            <GraduationCap className="w-4 h-4" />
            <span>この摘要は学習済みです</span>
          </div>
        )}
      </div>
    </div>
  );
};
