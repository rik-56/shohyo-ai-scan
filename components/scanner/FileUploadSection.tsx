import React, { useRef, useState } from 'react';
import { Upload, Camera, FileText, Trash2, FileClock, Bot, Loader2, Receipt, HelpCircle, FileStack } from 'lucide-react';
import { MultiPageProgress } from '../../services/geminiService';

// Simple Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <span className="group relative inline-flex items-center">
    {children}
    <span className="pointer-events-none absolute top-full left-0 mt-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal z-50 w-64 text-left shadow-lg">
      {text}
      <span className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-800" />
    </span>
  </span>
);

// Help Icon with Tooltip
const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip text={text}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500 cursor-help ml-1" />
  </Tooltip>
);

export type FileState = {
  type: 'image' | 'pdf' | 'csv';
  previewUrl: string | null;
  name: string;
  data: string;
  mimeType: string;
} | null;

export type PdfProcessMode = 'single' | 'split';

interface FileUploadSectionProps {
  fileState: FileState;
  onFileChange: (file: File) => void;
  onFileClear: () => void;
  viewingHistoryId: string | null;
  viewingHistoryName?: string;
  onExitHistoryView: () => void;
  geminiApiKey: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  aiAutoKamoku: boolean;
  onAiAutoKamokuChange: (value: boolean) => void;
  transactionCount: number;
  // 複数ページPDF対応
  multiPageProgress?: MultiPageProgress | null;
  // PDF処理モード選択
  pdfProcessMode: PdfProcessMode;
  onPdfProcessModeChange: (mode: PdfProcessMode) => void;
  // 元帳タイプ（注意書き表示用）
  bookType: 'cash' | 'deposit' | 'credit';
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  fileState,
  onFileChange,
  onFileClear,
  viewingHistoryId,
  viewingHistoryName,
  onExitHistoryView,
  geminiApiKey,
  isAnalyzing,
  onAnalyze,
  aiAutoKamoku,
  onAiAutoKamokuChange,
  transactionCount,
  multiPageProgress,
  pdfProcessMode,
  onPdfProcessModeChange,
  bookType
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileChange(file);
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
        <Camera className="w-5 h-5 text-orange-600" />
        証憑スキャン
      </h2>

      {!fileState && !viewingHistoryId ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
            isDragOver
              ? 'border-orange-500 bg-orange-50 scale-[1.02]'
              : 'border-slate-300 hover:bg-slate-50 hover:border-orange-300'
          }`}
          aria-label="ファイルをアップロード"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
            isDragOver ? 'bg-orange-100' : 'bg-slate-100'
          }`}>
            <Upload className={`w-8 h-8 ${isDragOver ? 'text-orange-600' : 'text-slate-400'}`} />
          </div>
          <p className="font-semibold text-lg text-slate-700">
            {isDragOver ? 'ここにドロップ' : 'クリックまたはドラッグ&ドロップ'}
          </p>
          <p className="text-sm text-slate-600 mt-2">対応形式: 画像 (JPG, PNG), PDF, CSV</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.csv"
            onChange={handleFileSelect}
            aria-hidden="true"
          />
        </div>
      ) : viewingHistoryId ? (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-5 rounded-lg">
          <div className="flex items-center gap-4">
            <FileClock className="w-8 h-8 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">「{viewingHistoryName}」を表示中</p>
              <p className="text-sm text-slate-600">修正して再度保存やCSV出力が可能です。</p>
            </div>
          </div>
          <button
            onClick={onExitHistoryView}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-all"
          >
            新規スキャン
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Preview */}
          <div className="relative w-full md:w-1/3 aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
            {fileState?.previewUrl ? (
              <img
                src={fileState.previewUrl}
                className="w-full h-full object-contain"
                alt="アップロードされた画像"
              />
            ) : (
              <div className="text-slate-400 flex flex-col items-center">
                <FileText className="w-12 h-12 mb-2" />
                {fileState?.name}
              </div>
            )}
            <button
              onClick={onFileClear}
              className="absolute top-2 right-2 bg-white p-2 rounded-lg shadow-sm hover:bg-red-50 transition-all"
              aria-label="ファイルを削除"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>

          {/* Analysis controls */}
          <div className="flex-1 flex flex-col justify-center gap-3">
            {geminiApiKey ? (
              <>
                <button
                  onClick={onAnalyze}
                  disabled={isAnalyzing}
                  aria-label="AI自動解析を開始"
                  className="w-full py-3 rounded-lg font-medium text-white flex items-center justify-center gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Bot className="w-5 h-5" />
                      AI自動解析
                    </>
                  )}
                </button>
                {/* AI Auto Kamoku Toggle */}
                <label className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={aiAutoKamoku}
                      onChange={e => onAiAutoKamokuChange(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${aiAutoKamoku ? 'bg-orange-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aiAutoKamoku ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700 flex items-center">
                      AIおまかせモード
                      <HelpTip text="ONにするとAIが摘要から勘定科目を推測します。学習ルールがある場合はそちらが優先されます。" />
                    </span>
                    <p className="text-xs text-slate-600">ONにするとAIが勘定科目を推測します</p>
                  </div>
                </label>

                {/* 預金・クレカの場合の注意書き */}
                {aiAutoKamoku && (bookType === 'deposit' || bookType === 'credit') && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                    <strong>注意:</strong> 預金・クレカの場合、税区分は「対象外」、インボイスは「非適格」に自動設定されます。
                    勘定科目のみAIが推測します。
                  </div>
                )}

                {/* PDF処理モード選択（PDFファイルの場合のみ表示） */}
                {fileState?.type === 'pdf' && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-slate-700">PDF処理モード</span>
                      <HelpTip text="一括処理はAPIレート制限を回避できますが、大容量PDFでは精度が落ちる場合があります。ページ分割は大容量PDF向けです。" />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPdfProcessModeChange('single')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          pdfProcessMode === 'single'
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                      >
                        一括処理
                      </button>
                      <button
                        type="button"
                        onClick={() => onPdfProcessModeChange('split')}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          pdfProcessMode === 'split'
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                      >
                        ページ分割
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">
                      {pdfProcessMode === 'single' && 'PDFを一括で解析（レート制限回避）'}
                      {pdfProcessMode === 'split' && 'ページごとに分割して解析（大容量PDF向け）'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center space-y-3">
                <button
                  disabled
                  className="w-full py-3 rounded-lg font-medium text-white bg-slate-300 cursor-not-allowed flex items-center justify-center gap-3"
                >
                  <Bot className="w-5 h-5" />
                  AI自動解析
                </button>
                <p className="text-sm text-orange-600 bg-orange-50 rounded-lg py-3 px-4">
                  マスタ設定でGemini APIキーを登録してください
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!viewingHistoryId && fileState && transactionCount === 0 && !isAnalyzing && (
        <div className="mt-6 p-10 rounded-xl border border-slate-200 text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center">
            <Receipt className="w-12 h-12 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">取引データがありません</h3>
          <p className="text-slate-600 mb-6">「AI自動解析」ボタンをクリックして証憑を解析してください。</p>
          <div className="text-sm text-slate-600 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 inline-block border border-orange-100">
            <p className="font-semibold mb-2 text-orange-700">対応フォーマット</p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1 bg-white rounded-full text-xs border border-orange-200">レシート</span>
              <span className="px-3 py-1 bg-white rounded-full text-xs border border-orange-200">領収書</span>
              <span className="px-3 py-1 bg-white rounded-full text-xs border border-orange-200">通帳</span>
              <span className="px-3 py-1 bg-white rounded-full text-xs border border-orange-200">クレカ明細</span>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing State */}
      {isAnalyzing && (
        <div className="mt-6 p-10 rounded-xl border border-slate-200 text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center animate-pulse">
            {multiPageProgress ? (
              <FileStack className="w-12 h-12 text-orange-500" />
            ) : (
              <Bot className="w-12 h-12 text-orange-500" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            {multiPageProgress ? (
              multiPageProgress.phase === 'extracting' ? 'PDFを分割中...' : 'AI解析中...'
            ) : (
              'AI解析中...'
            )}
          </h3>

          {/* 複数ページ進捗表示 */}
          {multiPageProgress ? (
            <>
              <p className="text-slate-600 mb-4">
                {multiPageProgress.message || `ページ ${multiPageProgress.currentPage} / ${multiPageProgress.totalPages}`}
              </p>
              <div className="max-w-xs mx-auto">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-300"
                    style={{
                      width: `${multiPageProgress.phase === 'extracting'
                        ? 10
                        : Math.max(10, (multiPageProgress.currentPage / multiPageProgress.totalPages) * 100)
                      }%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>
                    {multiPageProgress.phase === 'extracting' ? 'PDF分割中' : `${multiPageProgress.currentPage}/${multiPageProgress.totalPages}ページ`}
                  </span>
                  <span>
                    {multiPageProgress.phase === 'extracting'
                      ? ''
                      : `${Math.round((multiPageProgress.currentPage / multiPageProgress.totalPages) * 100)}%`
                    }
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-600 mb-4">証憑から取引情報を読み取っています</p>
              <div className="max-w-xs mx-auto">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full animate-progress" />
                </div>
                <p className="text-xs text-slate-400 mt-2">日付・金額・摘要を抽出しています...</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
