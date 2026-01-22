import React, { useState, useEffect } from 'react';
import { Settings, Key, Eye, EyeOff, CheckCircle2, Plus, X, Tag, Briefcase, BookOpen, Cpu, ChevronDown, ChevronRight, Coins, Landmark, CreditCard } from 'lucide-react';
import { GEMINI_MODELS, GeminiModelId } from '../services/geminiService';
import { AccountMasterConfig, AccountMasterMap, AccountWithSubAccounts } from '../types';
import { DEFAULT_ACCOUNTS, DEFAULT_TAX_CATEGORIES } from '../constants';

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
  const [selectedClient, setSelectedClient] = useState<string>(clients[0] || '');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  // 展開中の勘定科目（補助科目編集用）
  const [expandedAccountIndex, setExpandedAccountIndex] = useState<number | null>(null);
  const [isAddingSubAccount, setIsAddingSubAccount] = useState(false);
  const [newSubAccountName, setNewSubAccountName] = useState('');

  // 元帳補助科目の追加用state
  const [isAddingLedgerSub, setIsAddingLedgerSub] = useState<'cash' | 'shortTermLoan' | 'deposit' | 'credit' | null>(null);
  const [newLedgerSubName, setNewLedgerSubName] = useState('');

  // clients変更時にselectedClientが無効になった場合は最初のクライアントを選択
  useEffect(() => {
    if (!clients.includes(selectedClient) && clients.length > 0) {
      setSelectedClient(clients[0]);
    }
  }, [clients, selectedClient]);

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

  // Get current client's account config
  const currentClientConfig = accountMasters[selectedClient] || {
    accounts: DEFAULT_ACCOUNTS.map(name => ({ name, subAccounts: [] })),
    ledgerSubAccounts: { cash: [], shortTermLoan: [], deposit: [], credit: [] }
  };

  // 勘定科目の追加
  const handleAddAccount = () => {
    if (!newAccountName.trim() || !selectedClient) return;
    const existingNames = currentClientConfig.accounts.map(a => a.name);
    if (existingNames.includes(newAccountName.trim())) {
      return; // Already exists
    }
    const newAccount: AccountWithSubAccounts = {
      name: newAccountName.trim(),
      subAccounts: []
    };
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      accounts: [...currentClientConfig.accounts, newAccount]
    });
    setNewAccountName('');
    setIsAddingAccount(false);
  };

  // 勘定科目の削除
  const handleDeleteAccount = (index: number) => {
    const newAccounts = [...currentClientConfig.accounts];
    newAccounts.splice(index, 1);
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      accounts: newAccounts
    });
    if (expandedAccountIndex === index) {
      setExpandedAccountIndex(null);
    }
  };

  // 補助科目の追加
  const handleAddSubAccount = (accountIndex: number) => {
    if (!newSubAccountName.trim()) return;
    const account = currentClientConfig.accounts[accountIndex];
    if (account.subAccounts.includes(newSubAccountName.trim())) {
      return; // Already exists
    }
    const newAccounts = [...currentClientConfig.accounts];
    newAccounts[accountIndex] = {
      ...account,
      subAccounts: [...account.subAccounts, newSubAccountName.trim()]
    };
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      accounts: newAccounts
    });
    setNewSubAccountName('');
    setIsAddingSubAccount(false);
  };

  // 補助科目の削除
  const handleDeleteSubAccount = (accountIndex: number, subAccountName: string) => {
    const account = currentClientConfig.accounts[accountIndex];
    const newAccounts = [...currentClientConfig.accounts];
    newAccounts[accountIndex] = {
      ...account,
      subAccounts: account.subAccounts.filter(s => s !== subAccountName)
    };
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      accounts: newAccounts
    });
  };

  // 元帳補助科目の追加
  const handleAddLedgerSubAccount = (ledgerType: 'cash' | 'shortTermLoan' | 'deposit' | 'credit') => {
    if (!newLedgerSubName.trim()) return;
    const currentList = currentClientConfig.ledgerSubAccounts?.[ledgerType] || [];
    if (currentList.includes(newLedgerSubName.trim())) return; // 重複チェック
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      ledgerSubAccounts: {
        ...currentClientConfig.ledgerSubAccounts,
        [ledgerType]: [...currentList, newLedgerSubName.trim()]
      }
    });
    setNewLedgerSubName('');
    setIsAddingLedgerSub(null);
  };

  // 元帳補助科目の削除
  const handleDeleteLedgerSubAccount = (ledgerType: 'cash' | 'shortTermLoan' | 'deposit' | 'credit', value: string) => {
    const currentList = currentClientConfig.ledgerSubAccounts?.[ledgerType] || [];
    onAccountMasterChange(selectedClient, {
      ...currentClientConfig,
      ledgerSubAccounts: {
        ...currentClientConfig.ledgerSubAccounts,
        [ledgerType]: currentList.filter(v => v !== value)
      }
    });
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
            手動モードでも「自動解析」オプションが利用可能になります。
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
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              APIキーが未設定です。手動モード（ChatGPT / Claude Web）のみ利用可能です。
            </div>
          )}
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
                  <div className="text-sm text-slate-500">{model.description}</div>
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
              <p className="text-sm text-slate-500 mb-4">カスタム税区分はまだ追加されていません。</p>
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

      {/* Account Item Master (per company) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-600" />
          勘定科目マスタ（会社別）
        </h2>

        <div className="space-y-5">
          {/* Company Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-3">会社を選択</h3>
            <div className="flex flex-wrap gap-2">
              {clients.map(client => (
                <button
                  key={client}
                  onClick={() => { setSelectedClient(client); setExpandedAccountIndex(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    selectedClient === client
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600'
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
              {/* Ledger Sub-Accounts Section */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-orange-600" />
                  元帳補助科目（会社別）
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  元帳種別ごとの補助科目を設定します。複数登録でき、スキャン時に選択できます。
                </p>
                <div className="space-y-4">
                  {/* 現金 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Coins className="w-4 h-4" />
                      現金
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(currentClientConfig.ledgerSubAccounts?.cash || []).map(sub => (
                        <span
                          key={sub}
                          className="group flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm"
                        >
                          {sub}
                          <button
                            onClick={() => handleDeleteLedgerSubAccount('cash', sub)}
                            className="ml-1 p-0.5 hover:bg-orange-200 rounded transition-colors"
                            aria-label={`${sub}を削除`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {isAddingLedgerSub === 'cash' ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={newLedgerSubName}
                            onChange={e => setNewLedgerSubName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddLedgerSubAccount('cash')}
                            placeholder="小口現金"
                            className="px-2 py-1 rounded border border-orange-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm w-32"
                          />
                          <button
                            onClick={() => handleAddLedgerSubAccount('cash')}
                            disabled={!newLedgerSubName.trim()}
                            className="bg-orange-600 text-white p-1 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setIsAddingLedgerSub(null); setNewLedgerSubName(''); }}
                            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingLedgerSub('cash')}
                          className="flex items-center gap-1 px-2 py-1 text-orange-600 text-sm font-medium hover:bg-orange-100 rounded border border-dashed border-orange-300 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 短期借入金 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Coins className="w-4 h-4" />
                      短期借入金
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(currentClientConfig.ledgerSubAccounts?.shortTermLoan || []).map(sub => (
                        <span
                          key={sub}
                          className="group flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm"
                        >
                          {sub}
                          <button
                            onClick={() => handleDeleteLedgerSubAccount('shortTermLoan', sub)}
                            className="ml-1 p-0.5 hover:bg-green-200 rounded transition-colors"
                            aria-label={`${sub}を削除`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {isAddingLedgerSub === 'shortTermLoan' ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={newLedgerSubName}
                            onChange={e => setNewLedgerSubName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddLedgerSubAccount('shortTermLoan')}
                            placeholder="役員借入金"
                            className="px-2 py-1 rounded border border-green-300 bg-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm w-32"
                          />
                          <button
                            onClick={() => handleAddLedgerSubAccount('shortTermLoan')}
                            disabled={!newLedgerSubName.trim()}
                            className="bg-green-600 text-white p-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setIsAddingLedgerSub(null); setNewLedgerSubName(''); }}
                            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingLedgerSub('shortTermLoan')}
                          className="flex items-center gap-1 px-2 py-1 text-green-600 text-sm font-medium hover:bg-green-100 rounded border border-dashed border-green-300 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 普通預金 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Landmark className="w-4 h-4" />
                      普通預金
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(currentClientConfig.ledgerSubAccounts?.deposit || []).map(sub => (
                        <span
                          key={sub}
                          className="group flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm"
                        >
                          {sub}
                          <button
                            onClick={() => handleDeleteLedgerSubAccount('deposit', sub)}
                            className="ml-1 p-0.5 hover:bg-blue-200 rounded transition-colors"
                            aria-label={`${sub}を削除`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {isAddingLedgerSub === 'deposit' ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={newLedgerSubName}
                            onChange={e => setNewLedgerSubName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddLedgerSubAccount('deposit')}
                            placeholder="三菱UFJ銀行"
                            className="px-2 py-1 rounded border border-blue-300 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm w-32"
                          />
                          <button
                            onClick={() => handleAddLedgerSubAccount('deposit')}
                            disabled={!newLedgerSubName.trim()}
                            className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setIsAddingLedgerSub(null); setNewLedgerSubName(''); }}
                            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingLedgerSub('deposit')}
                          className="flex items-center gap-1 px-2 py-1 text-blue-600 text-sm font-medium hover:bg-blue-100 rounded border border-dashed border-blue-300 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 未払金 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CreditCard className="w-4 h-4" />
                      未払金
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(currentClientConfig.ledgerSubAccounts?.credit || []).map(sub => (
                        <span
                          key={sub}
                          className="group flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm"
                        >
                          {sub}
                          <button
                            onClick={() => handleDeleteLedgerSubAccount('credit', sub)}
                            className="ml-1 p-0.5 hover:bg-purple-200 rounded transition-colors"
                            aria-label={`${sub}を削除`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {isAddingLedgerSub === 'credit' ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={newLedgerSubName}
                            onChange={e => setNewLedgerSubName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddLedgerSubAccount('credit')}
                            placeholder="JCBカード"
                            className="px-2 py-1 rounded border border-purple-300 bg-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm w-32"
                          />
                          <button
                            onClick={() => handleAddLedgerSubAccount('credit')}
                            disabled={!newLedgerSubName.trim()}
                            className="bg-purple-600 text-white p-1 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setIsAddingLedgerSub(null); setNewLedgerSubName(''); }}
                            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingLedgerSub('credit')}
                          className="flex items-center gap-1 px-2 py-1 text-purple-600 text-sm font-medium hover:bg-purple-100 rounded border border-dashed border-purple-300 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account List with Sub-Accounts */}
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-3">
                  「{selectedClient}」の勘定科目
                  <span className="ml-2 text-xs text-slate-400 font-normal">（クリックして補助科目を編集）</span>
                </h3>
                {currentClientConfig.accounts.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {currentClientConfig.accounts.map((account, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Account Header */}
                        <div
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                            expandedAccountIndex === index ? 'bg-orange-50' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                          onClick={() => setExpandedAccountIndex(expandedAccountIndex === index ? null : index)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedAccountIndex === index ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-sm font-medium text-slate-700">{account.name}</span>
                            {account.subAccounts.length > 0 && (
                              <span className="text-xs text-slate-400">
                                （補助科目: {account.subAccounts.length}件）
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteAccount(index); }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                            aria-label={`${account.name}を削除`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Sub-Accounts (Expanded) */}
                        {expandedAccountIndex === index && (
                          <div className="p-3 bg-white border-t border-slate-200">
                            <div className="text-xs text-slate-500 mb-2">補助科目リスト</div>
                            {account.subAccounts.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {account.subAccounts.map(sub => (
                                  <span
                                    key={sub}
                                    className="group flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                                  >
                                    {sub}
                                    <button
                                      onClick={() => handleDeleteSubAccount(index, sub)}
                                      className="ml-0.5 p-0.5 hover:bg-blue-200 rounded transition-colors"
                                      aria-label={`${sub}を削除`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 mb-3">補助科目がありません</p>
                            )}

                            {/* Add Sub-Account */}
                            {isAddingSubAccount && expandedAccountIndex === index ? (
                              <div className="flex items-center gap-2">
                                <input
                                  autoFocus
                                  value={newSubAccountName}
                                  onChange={e => setNewSubAccountName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleAddSubAccount(index)}
                                  placeholder="補助科目名"
                                  className="flex-1 px-2 py-1.5 rounded border border-blue-300 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
                                />
                                <button
                                  onClick={() => handleAddSubAccount(index)}
                                  disabled={!newSubAccountName.trim()}
                                  className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => { setIsAddingSubAccount(false); setNewSubAccountName(''); }}
                                  className="text-slate-400 hover:text-slate-600 p-1.5 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setIsAddingSubAccount(true)}
                                className="flex items-center gap-1 px-2 py-1 text-blue-600 text-xs font-medium hover:bg-blue-50 rounded border border-dashed border-blue-300 transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                補助科目を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 mb-4">
                    勘定科目がありません。
                  </p>
                )}

                {/* Add Account */}
                {isAddingAccount ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newAccountName}
                      onChange={e => setNewAccountName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                      placeholder="例: 売上高"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 text-sm"
                    />
                    <button
                      onClick={handleAddAccount}
                      disabled={!newAccountName.trim()}
                      className="bg-slate-600 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setIsAddingAccount(false); setNewAccountName(''); }}
                      className="text-slate-400 hover:text-slate-600 p-2 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingAccount(true)}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg border border-dashed border-slate-300 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    勘定科目を追加
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
