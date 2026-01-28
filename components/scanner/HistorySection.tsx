import React from 'react';
import { History, FileText, CheckSquare, Square, HelpCircle } from 'lucide-react';
import { HistoryBatch } from '../../types';

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

// Help Icon with Tooltip
const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip text={text}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500 cursor-help ml-1" />
  </Tooltip>
);

interface HistorySectionProps {
  history: HistoryBatch[];
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedHistoryIds: Set<string>;
  onToggleHistorySelection: (id: string) => void;
  onDeleteSelected: () => void;
  onCancelSelection: () => void;
  onLoadHistory: (batch: HistoryBatch) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  isSelectionMode,
  onToggleSelectionMode,
  selectedHistoryIds,
  onToggleHistorySelection,
  onDeleteSelected,
  onCancelSelection,
  onLoadHistory
}) => {
  if (history.length === 0) return null;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
          <History className="w-5 h-5 text-orange-600" />
          出力履歴（ストックデータ）
          <HelpTip text="証憑保存した仕訳データの一覧です。「確認」で再度編集・CSV出力ができます。" />
        </h2>
        <div className="flex gap-2">
          {isSelectionMode ? (
            <>
              <button
                onClick={onDeleteSelected}
                disabled={selectedHistoryIds.size === 0}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                  selectedHistoryIds.size > 0
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                選択した{selectedHistoryIds.size}件を削除
              </button>
              <button
                onClick={onCancelSelection}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2"
              >
                キャンセル
              </button>
            </>
          ) : (
            <button
              onClick={onToggleSelectionMode}
              className="text-sm font-medium text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg border border-orange-200"
            >
              整理する
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {history.map(batch => (
          <div
            key={batch.id}
            onClick={() => isSelectionMode && onToggleHistorySelection(batch.id)}
            className={`group relative bg-slate-50 rounded-lg p-4 border transition-all ${
              isSelectionMode ? 'cursor-pointer' : ''
            } ${
              selectedHistoryIds.has(batch.id)
                ? 'border-orange-400 bg-orange-50'
                : 'border-slate-200 hover:border-orange-300 hover:bg-white hover:shadow-sm'
            }`}
          >
            {isSelectionMode && (
              <div className="absolute top-3 left-3 z-10">
                {selectedHistoryIds.has(batch.id) ? (
                  <CheckSquare className="text-orange-600 w-5 h-5" />
                ) : (
                  <Square className="text-slate-400 w-5 h-5" />
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-lg bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center flex-shrink-0">
                {batch.previewUrl ? (
                  <img src={batch.previewUrl} className="w-full h-full object-cover" alt="" />
                ) : (
                  <FileText className="text-slate-400 w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden">
                <h4 className="font-medium text-slate-700 truncate">{batch.name}</h4>
                <div className="text-[10px] text-slate-500 font-mono">
                  {new Date(batch.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{batch.count}</span> 件
              </div>
              {!isSelectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadHistory(batch);
                  }}
                  className="bg-white text-orange-600 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all"
                >
                  確認
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
