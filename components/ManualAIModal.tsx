import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, AlertCircle, CheckCircle2, Bot } from 'lucide-react';
import { getAnalysisPrompt, parseManualJsonResponse, AnalysisError, errorMessages } from '../services/geminiService';
import { Transaction } from '../types';

interface ManualAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (transactions: Transaction[]) => void;
}

type ValidationState = {
  isValid: boolean;
  message: string;
  transactionCount?: number;
};

export const ManualAIModal: React.FC<ManualAIModalProps> = ({
  isOpen,
  onClose,
  onAnalysisComplete
}) => {
  const [prompt] = useState(() => getAnalysisPrompt());
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({ isValid: false, message: '' });
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setJsonInput('');
      setCopied(false);
      setValidation({ isValid: false, message: '' });
      setError(null);
    }
  }, [isOpen]);

  // Validate JSON as user types
  useEffect(() => {
    if (!jsonInput.trim()) {
      setValidation({ isValid: false, message: '' });
      return;
    }

    try {
      const transactions = parseManualJsonResponse(jsonInput);
      setValidation({
        isValid: true,
        message: `${transactions.length}件の取引が検出されました`,
        transactionCount: transactions.length
      });
      setError(null);
    } catch (err) {
      if (err instanceof AnalysisError) {
        setValidation({ isValid: false, message: err.message });
      } else {
        setValidation({ isValid: false, message: 'JSONの解析に失敗しました' });
      }
    }
  }, [jsonInput]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAnalyze = () => {
    if (!validation.isValid) return;

    try {
      const transactions = parseManualJsonResponse(jsonInput);
      onAnalysisComplete(transactions);
      onClose();
    } catch (err) {
      if (err instanceof AnalysisError) {
        setError(errorMessages[err.code] || err.message);
      } else {
        setError('解析に失敗しました');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-ai-modal-title"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border-4 border-orange-100 animate-bounce-in">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h3 id="manual-ai-modal-title" className="text-xl font-bold text-stone-700 flex items-center gap-2">
            <Bot className="text-orange-500 w-6 h-6" />
            AI解析（手動モード）
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Copy Prompt */}
          <div className="space-y-3">
            <h4 className="font-bold text-stone-700 flex items-center gap-2">
              <span className="bg-orange-500 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center">1</span>
              プロンプトをコピー
            </h4>
            <div className="bg-stone-50 rounded-2xl border-2 border-stone-100 p-4 max-h-40 overflow-y-auto">
              <pre className="text-xs text-stone-600 whitespace-pre-wrap font-mono">{prompt}</pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyToClipboard}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    コピー完了
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    コピー
                  </>
                )}
              </button>
              <button
                onClick={() => openExternalLink('https://chatgpt.com/')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                ChatGPT
              </button>
              <button
                onClick={() => openExternalLink('https://claude.ai/')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Claude
              </button>
              <button
                onClick={() => openExternalLink('https://aistudio.google.com/app/prompts/new_chat')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Gemini
              </button>
            </div>
            <p className="text-xs text-stone-400">
              同じファイル（画像/PDF/CSV）をAIにアップロードし、上記のプロンプトを貼り付けてください。
            </p>
          </div>

          {/* Step 2: Paste JSON Response */}
          <div className="space-y-3">
            <h4 className="font-bold text-stone-700 flex items-center gap-2">
              <span className="bg-orange-500 text-white w-6 h-6 rounded-full text-sm flex items-center justify-center">2</span>
              AIの応答（JSON）を貼り付け
            </h4>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`[
  {"date": "2024/01/15", "description": "セブンイレブン", "amount": 1000, "type": "expense", "invoiceNumber": "適格", "taxCategory": "課税仕入 (軽)8%"},
  {"date": "2024/01/20", "description": "売上入金", "amount": 50000, "type": "income", "invoiceNumber": null, "taxCategory": "課税売上 10%"}
]`}
              className="w-full h-48 p-4 rounded-2xl border-2 border-stone-200 bg-stone-50 outline-none focus:border-orange-400 focus:bg-white font-mono text-sm resize-none transition-colors"
              aria-label="JSON応答を貼り付け"
            />

            {/* Validation Feedback */}
            {jsonInput.trim() && (
              <div className={`flex items-center gap-2 p-3 rounded-xl ${
                validation.isValid
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {validation.isValid ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{validation.message}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-stone-100">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!validation.isValid}
              className={`flex-1 py-3 rounded-2xl font-bold text-white shadow-lg transition-all ${
                validation.isValid
                  ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-orange-100'
                  : 'bg-stone-200 cursor-not-allowed'
              }`}
            >
              解析を実行
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.9); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
