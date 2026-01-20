import React, { useState } from 'react';
import { Settings, Key, Eye, EyeOff, CheckCircle2, Plus, X, Tag, Briefcase, BookOpen, Cpu } from 'lucide-react';
import { GEMINI_MODELS, GeminiModelId } from '../services/geminiService';

// Default tax categories
const DEFAULT_TAX_CATEGORIES = [
  '課税売上 10%',
  '課税売上 (軽)8%',
  '課税仕入 10%',
  '課税仕入 (軽)8%',
  '対象外仕入',
  '非課税仕入'
];

// Common default accounts
const DEFAULT_ACCOUNTS = [
  '旅費交通費', '消耗品費', '接待交際費', '通信費', '水道光熱費',
  '地代家賃', '租税公課', '保険料', '広告宣伝費', '支払手数料',
  '会議費', '福利厚生費', '新聞図書費', '修繕費', '外注費',
  '仮払金', '仮受金', '売掛金', '買掛金', '雑費'
];

type AccountMasterMap = Record<string, string[]>;

interface MasterTabProps {
  geminiApiKey: string;
  onApiKeyChange: (key: string) => void;
  geminiModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  customTaxCategories: string[];
  onCustomTaxCategoriesChange: (categories: string[]) => void;
  clients: string[];
  accountMasters: AccountMasterMap;
  onAccountMasterChange: (clientName: string, accounts: string[]) => void;
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
  const [selectedClient, setSelectedClient] = useState<string>(clients[0] || '');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState('');

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

  // Get current client's custom accounts
  const currentClientAccounts = accountMasters[selectedClient] || [];

  const handleAddAccount = () => {
    if (!newAccount.trim() || !selectedClient) return;
    // Check for duplicates
    const allAccounts = [...DEFAULT_ACCOUNTS, ...currentClientAccounts];
    if (allAccounts.includes(newAccount.trim())) {
      return; // Already exists
    }
    onAccountMasterChange(selectedClient, [...currentClientAccounts, newAccount.trim()]);
    setNewAccount('');
    setIsAddingAccount(false);
  };

  const handleDeleteAccount = (account: string) => {
    onAccountMasterChange(selectedClient, currentClientAccounts.filter(a => a !== account));
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Gemini API Key Setting */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
        <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-orange-500" />
          Gemini API キー設定
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-stone-500">
            Google AI StudioでAPIキーを取得して設定すると、ファイルをアップロードするだけで自動解析できます。
            手動モードでも「自動解析」オプションが利用可能になります。
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-orange-500 hover:underline font-medium"
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
                className="w-full p-3.5 pr-12 rounded-2xl border-2 border-stone-100 bg-stone-50 outline-none focus:border-orange-300 focus:bg-white text-sm font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                aria-label={showApiKey ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {geminiApiKey && (
              <button
                onClick={() => onApiKeyChange('')}
                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-all"
              >
                削除
              </button>
            )}
          </div>

          {geminiApiKey ? (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4" />
              APIキーが設定されています。AI自動解析が利用可能です。
            </div>
          ) : (
            <div className="text-sm text-stone-400 bg-stone-50 rounded-xl p-3">
              APIキーが未設定です。手動モード（ChatGPT / Claude Web）のみ利用可能です。
            </div>
          )}
        </div>
      </div>

      {/* Gemini Model Selection */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
        <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-500" />
          AIモデル選択
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-stone-500">
            使用するGeminiモデルを選択できます。有料モデルはより高精度ですが、APIの課金が発生します。
          </p>

          <div className="grid gap-3">
            {GEMINI_MODELS.map(model => (
              <label
                key={model.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  geminiModel === model.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-stone-100 bg-stone-50 hover:border-stone-200'
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
                  geminiModel === model.id ? 'border-orange-500 bg-orange-500' : 'border-stone-300'
                }`}>
                  {geminiModel === model.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-stone-700">{model.name}</div>
                  <div className="text-sm text-stone-500">{model.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Tax Category Master */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
        <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2">
          <Tag className="w-5 h-5 text-orange-500" />
          税区分マスタ
        </h2>

        <div className="space-y-6">
          {/* Default Categories */}
          <div>
            <h3 className="text-sm font-bold text-stone-500 mb-3">デフォルト税区分</h3>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TAX_CATEGORIES.map(cat => (
                <span
                  key={cat}
                  className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-sm font-medium"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Custom Categories */}
          <div>
            <h3 className="text-sm font-bold text-stone-500 mb-3">カスタム税区分</h3>
            {customTaxCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {customTaxCategories.map(cat => (
                  <span
                    key={cat}
                    className="group flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium"
                  >
                    {cat}
                    <button
                      onClick={() => handleDeleteTaxCategory(cat)}
                      className="ml-1 p-0.5 hover:bg-orange-200 rounded-full transition-colors"
                      aria-label={`${cat}を削除`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 mb-4">カスタム税区分はまだ追加されていません。</p>
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
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-orange-200 bg-white outline-none focus:border-orange-400 text-sm"
                />
                <button
                  onClick={handleAddTaxCategory}
                  disabled={!newTaxCategory.trim()}
                  className="bg-orange-500 text-white p-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsAddingTaxCategory(false); setNewTaxCategory(''); }}
                  className="text-stone-400 hover:text-stone-600 p-2.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTaxCategory(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-orange-500 font-bold hover:bg-orange-50 rounded-xl border-2 border-dashed border-orange-200 transition-all"
              >
                <Plus className="w-4 h-4" />
                カスタム税区分を追加
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Item Master (per company) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
        <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-500" />
          勘定科目マスタ（会社別）
        </h2>

        <div className="space-y-6">
          {/* Company Selection */}
          <div>
            <h3 className="text-sm font-bold text-stone-500 mb-3">会社を選択</h3>
            <div className="flex flex-wrap gap-2">
              {clients.map(client => (
                <button
                  key={client}
                  onClick={() => setSelectedClient(client)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    selectedClient === client
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-stone-100 text-stone-600 hover:bg-orange-100 hover:text-orange-600'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  {client}
                </button>
              ))}
            </div>
          </div>

          {selectedClient && (
            <>
              {/* Default Accounts */}
              <div>
                <h3 className="text-sm font-bold text-stone-500 mb-3">デフォルト勘定科目（共通）</h3>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_ACCOUNTS.map(acc => (
                    <span
                      key={acc}
                      className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-sm font-medium"
                    >
                      {acc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Custom Accounts for selected company */}
              <div>
                <h3 className="text-sm font-bold text-stone-500 mb-3">
                  「{selectedClient}」のカスタム勘定科目
                </h3>
                {currentClientAccounts.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {currentClientAccounts.map(acc => (
                      <span
                        key={acc}
                        className="group flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {acc}
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          className="ml-1 p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                          aria-label={`${acc}を削除`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 mb-4">
                    「{selectedClient}」のカスタム勘定科目はまだ追加されていません。
                  </p>
                )}

                {/* Add Custom Account */}
                {isAddingAccount ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newAccount}
                      onChange={e => setNewAccount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                      placeholder="例: 研究開発費"
                      className="flex-1 px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-white outline-none focus:border-blue-400 text-sm"
                    />
                    <button
                      onClick={handleAddAccount}
                      disabled={!newAccount.trim()}
                      className="bg-blue-500 text-white p-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setIsAddingAccount(false); setNewAccount(''); }}
                      className="text-stone-400 hover:text-stone-600 p-2.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingAccount(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-blue-500 font-bold hover:bg-blue-50 rounded-xl border-2 border-dashed border-blue-200 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    カスタム勘定科目を追加
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
