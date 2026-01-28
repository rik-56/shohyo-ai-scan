import React from 'react';
import { Trash2, ArrowUpDown, CheckSquare, Square, GraduationCap, AlertTriangle } from 'lucide-react';
import { Transaction } from '../../types';
import { UI_COLORS } from '../../constants';

interface TransactionRowProps {
  transaction: Transaction;
  onUpdate: (field: keyof Transaction, value: any) => void;
  onToggleSign: () => void;
  onDelete: () => void;
  availableKamokuList: string[];
  getSubAccountsForKamoku: (kamoku: string) => string[];
  allTaxCategories: string[];
  hasMatchingRule: boolean;
  isBatchEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  isDuplicate?: boolean;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction: t,
  onUpdate,
  onToggleSign,
  onDelete,
  availableKamokuList,
  getSubAccountsForKamoku,
  allTaxCategories,
  hasMatchingRule,
  isBatchEditMode,
  isSelected,
  onToggleSelection,
  isDuplicate
}) => {
  const isExpense = t.amount < 0;

  return (
    <tr className={`transition-colors ${
      isSelected ? 'bg-orange-50' :
      t.toggled ? UI_COLORS.table.rowToggledHover :
      UI_COLORS.table.rowHover
    }`}>
      <td className="p-2 text-center">
        {isBatchEditMode ? (
          <button
            onClick={onToggleSelection}
            className={`p-2 rounded-lg transition-all ${
              isSelected
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600'
            }`}
            aria-label={isSelected ? '選択解除' : '選択'}
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={onToggleSign}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
              isExpense
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
            }`}
            aria-label="収支を切り替え"
            title={isExpense ? '支払（クリックで入金に切替）' : '入金（クリックで支払に切替）'}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isExpense ? '支' : '収'}</span>
          </button>
        )}
      </td>

      <td className="p-3">
        <input
          value={t.date}
          onChange={e => onUpdate('date', e.target.value)}
          className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
          aria-label="取引日"
        />
      </td>

      <td className="p-3">
        <div className="flex items-center gap-1">
          <input
            value={t.description}
            onChange={e => onUpdate('description', e.target.value)}
            title={t.description}
            className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 truncate"
            aria-label="摘要"
          />
          {isDuplicate && (
            <span
              className="flex-shrink-0 text-amber-500"
              title="重複の可能性があります"
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
          )}
        </div>
      </td>

      <td className="p-3">
        <div className="relative">
          <input
            list={`kamoku-list-${t.id}`}
            value={t.kamoku || ''}
            placeholder={isExpense ? '仮払金' : '仮受金'}
            onChange={e => onUpdate('kamoku', e.target.value)}
            className={`w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-semibold ${
              isExpense ? UI_COLORS.expense.text : UI_COLORS.income.text
            }`}
            aria-label="相手勘定科目"
          />
          <datalist id={`kamoku-list-${t.id}`}>
            {availableKamokuList.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {hasMatchingRule && (
            <span
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50"
              title="学習済み"
            >
              <GraduationCap className={`w-3 h-3 ${UI_COLORS.learned.icon}`} />
            </span>
          )}
        </div>
      </td>

      <td className="p-3">
        <input
          list={`subkamoku-list-${t.id}`}
          value={t.subKamoku || ''}
          placeholder="-"
          onChange={e => onUpdate('subKamoku', e.target.value)}
          className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
          aria-label="相手補助科目"
        />
        <datalist id={`subkamoku-list-${t.id}`}>
          {getSubAccountsForKamoku(t.kamoku || '').map(sub => (
            <option key={sub} value={sub} />
          ))}
        </datalist>
      </td>

      <td className="p-3">
        <input
          type="number"
          value={t.amount}
          onChange={e => onUpdate('amount', parseFloat(e.target.value) || 0)}
          className={`w-full text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-bold text-base ${
            isExpense ? UI_COLORS.expense.text : UI_COLORS.income.text
          }`}
          aria-label="金額"
        />
      </td>

      <td className="p-3">
        <select
          value={t.invoiceNumber || ''}
          onChange={e => onUpdate('invoiceNumber', e.target.value)}
          className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 text-xs"
          aria-label="インボイス区分"
        >
          <option value="">未選択</option>
          <option value="適格">適格</option>
          <option value="非適格">非適格</option>
        </select>
      </td>

      <td className="p-3">
        <select
          value={t.taxCategory || ''}
          onChange={e => onUpdate('taxCategory', e.target.value)}
          className="w-full bg-transparent px-1 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 text-xs"
          aria-label="税区分"
        >
          {allTaxCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </td>

      <td className="p-3 text-center">
        <button
          onClick={onDelete}
          className="text-slate-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 rounded p-1 -m-1 transition-colors"
          aria-label="取引を削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
