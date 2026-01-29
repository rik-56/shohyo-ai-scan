import React from 'react';
import { X, Upload, Bot, FileSpreadsheet, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

const steps = [
  {
    icon: Upload,
    title: '1. 証憑をアップロード',
    description: 'レシート・領収書・通帳のPDFや画像をアップロードします',
  },
  {
    icon: Bot,
    title: '2. AIが自動解析',
    description: 'Gemini AIが日付・金額・摘要を自動抽出します',
  },
  {
    icon: FileSpreadsheet,
    title: '3. CSVでエクスポート',
    description: 'Money Forward互換のCSVとして出力できます',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-bounce-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">仕訳アシスタントへようこそ</h2>
          <p className="text-orange-100 text-sm mt-1">AIで証憑解析を自動化</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-500 text-white">
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{step.title}</h3>
                  <p className="text-sm text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
          >
            スキップ
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 transition-colors"
          >
            始める
            <ArrowRight className="w-4 h-4" />
          </button>
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
