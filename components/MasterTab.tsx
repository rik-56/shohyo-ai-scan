import React, { useState, useRef } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, Plus, X, Tag, Cpu, Download, Upload } from 'lucide-react';
import { GEMINI_MODELS, GeminiModelId } from '../services/geminiService';
import { AccountMasterConfig, AccountMasterMap } from '../types';
import { DEFAULT_TAX_CATEGORIES } from '../constants';

interface MasterTabProps {
  geminiApiKey: string;
  onApiKeyChange: (key: string) => void;
  geminiModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  customTaxCategories: string[];
  onCustomTaxCategoriesChange: (categories: string[]) => void;
  clients: string[];
  accountMasters: AccountMasterMap;
  onAccountMasterChange: (clientName: string, config: AccountMasterConfig) => void;
}

export const MasterTab: React.FC<MasterTabProps> = ({
  geminiApiKey,
  onApiKeyChange,
  geminiModel,
  onModelChange,
  customTaxCategories,
  onCustomTaxCategoriesChange,
  clients,
  accountMasters,
  onAccountMasterChange
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAddingTaxCategory, setIsAddingTaxCategory] = useState(false);
  const [newTaxCategory, setNewTaxCategory] = useState('');

  // インポート用ファイル入力ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // エクスポート機能
  const handleExport = () => {
    // LocalStorageからデータを収集
    // セキュリティ上の理由からAPIキーは除外
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        // geminiApiKey は除外（セキュリティ上の理由）
        geminiModel: geminiModel,
        customTaxCategories: customTaxCategories,
        clients: clients,
        accountMasters: {} as Record<string, AccountMasterConfig>
      }
    };

    // 各クライアントの勘定科目マスタを収集
    clients.forEach(client => {
      if (accountMasters[client]) {
        exportData.data.accountMasters[client] = accountMasters[client];
      }
    });

    // JSONファイルとしてダウンロード
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `仕訳アシスタント_バックアップ_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // インポート機能
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        // バージョンチェック
        if (!importData.version || !importData.data) {
          alert('無効なバックアップファイルです。');
          return;
        }

        // マージ確認
        if (!confirm('インポートファイルのデータを追加・更新しますか？\n（既存の会社データは保持されます）')) {
          return;
        }

        // データを復元
        const data = importData.data;

        // APIキーはセキュリティ上の理由からインポートしない（既に除外済み）

        // AIモデル
        if (data.geminiModel) {
          localStorage.setItem('kakeibo_ai_gemini_model', data.geminiModel);
          onModelChange(data.geminiModel);
        }

        // カスタム税区分（マージ）
        if (data.customTaxCategories) {
          const existingTaxCats = JSON.parse(localStorage.getItem('kakeibo_ai_custom_tax_categories') || '[]') as string[];
          const mergedTaxCats = [...new Set([...existingTaxCats, ...data.customTaxCategories])];
          localStorage.setItem('kakeibo_ai_custom_tax_categories', JSON.stringify(mergedTaxCats));
          onCustomTaxCategoriesChange(mergedTaxCats);
        }

        // クライアント一覧（マージ）
        if (data.clients) {
          const existingClients = JSON.parse(localStorage.getItem('kakeibo_ai_clients') || '[]') as string[];
          const mergedClients = [...new Set([...existingClients, ...data.clients])];
          localStorage.setItem('kakeibo_ai_clients', JSON.stringify(mergedClients));
        }

        // 勘定科目マスタ（会社別）
        if (data.accountMasters) {
          Object.entries(data.accountMasters).forEach(([clientName, config]) => {
            localStorage.setItem(`kakeibo_ai_accounts_${clientName}`, JSON.stringify(config));
            onAccountMasterChange(clientName, config as AccountMasterConfig);
          });
        }

        alert('設定を復元しました。ページを再読み込みします。');
        window.location.reload();
      } catch (error) {
        console.error('Import error:', error);
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);

    // ファイル入力をリセット（同じファイルを再選択可能にする）
    event.target.value = '';
  };

  const handleAddTaxCategory = () => {
    if (!newTaxCategory.trim()) return;
    // Check for duplicates
    const allCategories = [...DEFAULT_TAX_CATEGORIES, ...customTaxCategories];
    if (allCategories.includes(newTaxCategory.trim())) {
      return; // Already exists
    }
    onCustomTaxCategoriesChange([...customTaxCategories, newTaxCategory.trim()]);
    setNewTaxCategory('');
    setIsAddingTaxCategory(false);
  };

  const handleDeleteTaxCategory = (category: string) => {
    onCustomTaxCategoriesChange(customTaxCategories.filter(c => c !== category));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Gemini API Key Setting */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <Key className="w-5 h-5 text-orange-600" />
          Gemini API キー設定
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Google AI StudioでAPIキーを取得して設定すると、ファイルをアップロードするだけで自動解析できます。
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline font-medium"
          >
            APIキーを取得する →
          </a>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={e => onApiKeyChange(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2.5 pr-12 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showApiKey ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {geminiApiKey && (
              <button
                onClick={() => onApiKeyChange('')}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-all"
              >
                削除
              </button>
            )}
          </div>

          {geminiApiKey ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4" />
              APIキーが設定されています。AI自動解析が利用可能です。
            </div>
          ) : (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              APIキーが未設定です。上記リンクからAPIキーを取得して設定してください。
            </div>
          )}

          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
            <strong>セキュリティに関する注意:</strong> APIキーはブラウザのセッションストレージに保存され、タブを閉じると自動的に消去されます。
            毎回のセッション開始時にAPIキーの再入力が必要です。
          </div>
        </div>
      </div>

      {/* Gemini Model Selection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-600" />
          AIモデル選択
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            使用するGeminiモデルを選択できます。有料モデルはより高精度ですが、APIの課金が発生します。
          </p>

          <div className="grid gap-2">
            {GEMINI_MODELS.map(model => (
              <label
                key={model.id}
                className={`flex items-center gap-4 p-3.5 rounded-lg border cursor-pointer transition-all ${
                  geminiModel === model.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="geminiModel"
                  value={model.id}
                  checked={geminiModel === model.id}
                  onChange={() => onModelChange(model.id)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  geminiModel === model.id ? 'border-orange-600 bg-orange-600' : 'border-slate-300'
                }`}>
                  {geminiModel === model.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-700">{model.name}</div>
                  <div className="text-sm text-slate-600">{model.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Tax Category Master */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <Tag className="w-5 h-5 text-orange-600" />
          税区分マスタ
        </h2>

        <div className="space-y-5">
          {/* Default Categories */}
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-3">デフォルト税区分</h3>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TAX_CATEGORIES.map(cat => (
                <span
                  key={cat}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Custom Categories */}
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-3">カスタム税区分</h3>
            {customTaxCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {customTaxCategories.map(cat => (
                  <span
                    key={cat}
                    className="group flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm"
                  >
                    {cat}
                    <button
                      onClick={() => handleDeleteTaxCategory(cat)}
                      className="ml-1 p-0.5 hover:bg-orange-200 rounded transition-colors"
                      aria-label={`${cat}を削除`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-4">カスタム税区分はまだ追加されていません。</p>
            )}

            {/* Add Custom Category */}
            {isAddingTaxCategory ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newTaxCategory}
                  onChange={e => setNewTaxCategory(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTaxCategory()}
                  placeholder="例: 輸入仕入 10%"
                  className="flex-1 px-3 py-2 rounded-lg border border-orange-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                />
                <button
                  onClick={handleAddTaxCategory}
                  disabled={!newTaxCategory.trim()}
                  className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsAddingTaxCategory(false); setNewTaxCategory(''); }}
                  className="text-slate-400 hover:text-slate-600 p-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTaxCategory(true)}
                className="flex items-center gap-2 px-4 py-2 text-orange-600 font-medium hover:bg-orange-50 rounded-lg border border-dashed border-orange-300 transition-all"
              >
                <Plus className="w-4 h-4" />
                カスタム税区分を追加
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Backup Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <Download className="w-5 h-5 text-orange-600" />
          データバックアップ
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            設定データをファイルに保存・復元できます。ブラウザのキャッシュクリア前にエクスポートしておくことをお勧めします。
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm transition-all"
            >
              <Download className="w-4 h-4" />
              エクスポート
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition-all border border-slate-300"
            >
              <Upload className="w-4 h-4" />
              インポート
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="font-medium mb-1">エクスポートされるデータ:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>AIモデル設定</li>
              <li>カスタム税区分</li>
              <li>クライアント一覧</li>
              <li>勘定科目マスタ（会社別）</li>
            </ul>
            <p className="mt-2 text-orange-600">※ Gemini APIキーはセキュリティ上の理由から除外されます</p>
          </div>
        </div>
      </div>
    </div>
  );
};
