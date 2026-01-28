import React, { useState, useEffect } from 'react';
import { Receipt, Settings, Lightbulb, Building2 } from 'lucide-react';
import { ScannerTab } from './components/scanner/ScannerTab';
import { MasterTab } from './components/MasterTab';
import { CompanyMasterTab } from './components/CompanyMasterTab';
import { AppTab, AccountMasterConfig, AccountMasterMap, AccountWithSubAccounts, LearningRulesMap } from './types';
import { GeminiModelId } from './services/geminiService';
import { DEFAULT_ACCOUNTS } from './constants';

// Storage keys for centralized settings
const STORAGE_KEY_GEMINI_API_KEY = 'kakeibo_ai_gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = 'kakeibo_ai_gemini_model';
const STORAGE_KEY_CUSTOM_TAX_CATEGORIES = 'kakeibo_ai_custom_tax_categories';
const STORAGE_KEY_CLIENTS = 'kakeibo_ai_clients';
const STORAGE_PREFIX_ACCOUNT_MASTER = 'kakeibo_ai_accounts_';
const STORAGE_PREFIX_RULES = 'kakeibo_ai_rules_';

// 旧形式の型定義（マイグレーション用）
type OldAccountMasterConfig = {
  defaultAccounts: string[];
  customAccounts: string[];
};

// 新形式のデフォルト勘定科目マスタを生成
const createDefaultAccountMaster = (): AccountMasterConfig => ({
  accounts: DEFAULT_ACCOUNTS.map(name => ({ name, subAccounts: [] })),
  ledgerSubAccounts: { cash: [], shortTermLoan: [], deposit: [], credit: [] }
});

// 旧形式から新形式へのマイグレーション
const migrateAccountMaster = (old: OldAccountMasterConfig): AccountMasterConfig => {
  const allAccounts = [...old.defaultAccounts, ...old.customAccounts];
  return {
    accounts: allAccounts.map(name => ({ name, subAccounts: [] })),
    ledgerSubAccounts: { cash: [], shortTermLoan: [], deposit: [], credit: [] }
  };
};

// 元帳補助科目のマイグレーション（string → string[]）
const migrateLedgerSubAccounts = (ledgerSubAccounts: any): { cash: string[]; shortTermLoan: string[]; deposit: string[]; credit: string[] } => {
  const migrateValue = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return [value];
    return [];
  };
  return {
    cash: migrateValue(ledgerSubAccounts?.cash),
    shortTermLoan: migrateValue(ledgerSubAccounts?.shortTermLoan),
    deposit: migrateValue(ledgerSubAccounts?.deposit),
    credit: migrateValue(ledgerSubAccounts?.credit)
  };
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCANNER);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>('gemini-3-flash-preview');
  const [customTaxCategories, setCustomTaxCategories] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>(['株式会社サンプル']);
  const [accountMasters, setAccountMasters] = useState<AccountMasterMap>({});
  const [allLearningRules, setAllLearningRules] = useState<Record<string, LearningRulesMap>>({});

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY);
    if (savedApiKey) {
      setGeminiApiKey(savedApiKey);
    }

    const savedModel = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    if (savedModel) {
      setGeminiModel(savedModel as GeminiModelId);
    }

    const savedTaxCategories = localStorage.getItem(STORAGE_KEY_CUSTOM_TAX_CATEGORIES);
    if (savedTaxCategories) {
      try {
        const parsed = JSON.parse(savedTaxCategories);
        if (Array.isArray(parsed)) {
          setCustomTaxCategories(parsed);
        }
      } catch (e) {
        console.error('Failed to parse custom tax categories:', e);
      }
    }

    // Load clients
    const savedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (savedClients) {
      try {
        const parsed = JSON.parse(savedClients);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setClients(parsed);
          // Load account masters for each client
          const masters: AccountMasterMap = {};
          parsed.forEach((client: string) => {
            const savedAccounts = localStorage.getItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${client}`);
            if (savedAccounts) {
              try {
                const accounts = JSON.parse(savedAccounts);
                // マイグレーション判定
                if (Array.isArray(accounts)) {
                  // 最古形式: カスタム科目のみの配列 → 新形式に変換
                  const migrated = migrateAccountMaster({
                    defaultAccounts: [...DEFAULT_ACCOUNTS],
                    customAccounts: accounts
                  });
                  masters[client] = migrated;
                  localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${client}`, JSON.stringify(migrated));
                } else if (accounts && typeof accounts === 'object' && 'defaultAccounts' in accounts && !('accounts' in accounts)) {
                  // 旧形式: { defaultAccounts, customAccounts } → 新形式に変換
                  const migrated = migrateAccountMaster(accounts as OldAccountMasterConfig);
                  masters[client] = migrated;
                  localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${client}`, JSON.stringify(migrated));
                } else if (accounts && typeof accounts === 'object' && 'accounts' in accounts) {
                  // 新形式: ledgerSubAccountsのマイグレーションを適用
                  const config = accounts as AccountMasterConfig;
                  const needsMigration = config.ledgerSubAccounts &&
                    (typeof config.ledgerSubAccounts.cash === 'string' ||
                     typeof config.ledgerSubAccounts.deposit === 'string' ||
                     typeof config.ledgerSubAccounts.credit === 'string');

                  if (needsMigration) {
                    const migrated: AccountMasterConfig = {
                      ...config,
                      ledgerSubAccounts: migrateLedgerSubAccounts(config.ledgerSubAccounts)
                    };
                    masters[client] = migrated;
                    localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${client}`, JSON.stringify(migrated));
                  } else {
                    masters[client] = config;
                  }
                }
              } catch (e) {
                console.error(`Failed to parse accounts for ${client}:`, e);
              }
            } else {
              // データがない場合はデフォルトで初期化
              const defaultMaster = createDefaultAccountMaster();
              masters[client] = defaultMaster;
              localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${client}`, JSON.stringify(defaultMaster));
            }
          });
          setAccountMasters(masters);

          // Load learning rules for each client
          const rules: Record<string, LearningRulesMap> = {};
          parsed.forEach((client: string) => {
            const savedRules = localStorage.getItem(`${STORAGE_PREFIX_RULES}${client}`);
            if (savedRules) {
              try {
                const parsedRules = JSON.parse(savedRules);
                // マイグレーション: 古い形式(string)から新形式({kamoku, subKamoku})に変換
                const migratedRules: LearningRulesMap = {};
                Object.entries(parsedRules).forEach(([key, val]) => {
                  migratedRules[key] = typeof val === 'string'
                    ? { kamoku: val, subKamoku: '' }
                    : val as { kamoku: string; subKamoku: string };
                });
                rules[client] = migratedRules;
              } catch (e) {
                console.error(`Failed to parse rules for ${client}:`, e);
              }
            }
          });
          setAllLearningRules(rules);
        }
      } catch (e) {
        console.error('Failed to parse clients:', e);
      }
    }
  }, []);

  // Handler for API key changes
  const handleApiKeyChange = (key: string) => {
    setGeminiApiKey(key);
    if (key) {
      localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
    }
  };

  // Handler for model changes
  const handleModelChange = (model: GeminiModelId) => {
    setGeminiModel(model);
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, model);
  };

  // Handler for custom tax categories changes
  const handleCustomTaxCategoriesChange = (categories: string[]) => {
    setCustomTaxCategories(categories);
    localStorage.setItem(STORAGE_KEY_CUSTOM_TAX_CATEGORIES, JSON.stringify(categories));
  };

  // Handler for account master changes (per company)
  const handleAccountMasterChange = (clientName: string, config: AccountMasterConfig) => {
    setAccountMasters(prev => ({ ...prev, [clientName]: config }));
    localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${clientName}`, JSON.stringify(config));
  };

  // Handler for new client added from ScannerTab
  const handleClientAdd = (clientName: string) => {
    // clients stateも更新
    setClients(prev => [...prev, clientName]);

    // accountMastersを新形式で初期化
    const newConfig = createDefaultAccountMaster();
    setAccountMasters(prev => ({ ...prev, [clientName]: newConfig }));
    localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${clientName}`, JSON.stringify(newConfig));
  };

  // Handler for client deleted from ScannerTab
  const handleClientDelete = (clientName: string) => {
    // clients stateから削除
    setClients(prev => prev.filter(c => c !== clientName));
    // accountMastersから削除
    setAccountMasters(prev => {
      const { [clientName]: _, ...rest } = prev;
      return rest;
    });
    // learningRulesから削除
    setAllLearningRules(prev => {
      const { [clientName]: _, ...rest } = prev;
      return rest;
    });
    // localStorageからも削除
    localStorage.removeItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${clientName}`);
    localStorage.removeItem(`${STORAGE_PREFIX_RULES}${clientName}`);
  };

  // Handler for learning rules changes (per company)
  const handleLearningRulesChange = (clientName: string, rules: LearningRulesMap) => {
    setAllLearningRules(prev => ({ ...prev, [clientName]: rules }));
    localStorage.setItem(`${STORAGE_PREFIX_RULES}${clientName}`, JSON.stringify(rules));
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex flex-col text-slate-700">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">仕訳アシスタント</h1>
              <p className="text-xs text-slate-500">AI証憑解析・仕訳作成支援</p>
            </div>
            <button
              onClick={() => window.open('/docs/使い方ガイド.html', '_blank')}
              className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-600 hover:bg-amber-200 rounded-lg transition-colors"
              aria-label="使い方ガイドを開く"
              title="使い方ガイド"
            >
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">Tips</span>
            </button>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1" role="tablist" aria-label="メイン機能">
            <button
              role="tab"
              aria-selected={activeTab === AppTab.SCANNER}
              onClick={() => setActiveTab(AppTab.SCANNER)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === AppTab.SCANNER
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">スキャン</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === AppTab.COMPANY_MASTER}
              onClick={() => setActiveTab(AppTab.COMPANY_MASTER)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === AppTab.COMPANY_MASTER
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">会社別マスタ</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === AppTab.MASTER}
              onClick={() => setActiveTab(AppTab.MASTER)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === AppTab.MASTER
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">設定</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content - All tabs are always rendered but hidden via CSS to preserve state */}
      <main className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto">
        <div className={activeTab === AppTab.SCANNER ? '' : 'hidden'}>
          <ScannerTab
            geminiApiKey={geminiApiKey}
            geminiModel={geminiModel}
            customTaxCategories={customTaxCategories}
            accountMasters={accountMasters}
            onClientAdd={handleClientAdd}
            onClientDelete={handleClientDelete}
            allLearningRules={allLearningRules}
            onLearningRulesChange={handleLearningRulesChange}
          />
        </div>
        <div className={activeTab === AppTab.COMPANY_MASTER ? '' : 'hidden'}>
          <CompanyMasterTab
            clients={clients}
            accountMasters={accountMasters}
            onAccountMasterChange={handleAccountMasterChange}
            allLearningRules={allLearningRules}
            onLearningRulesChange={handleLearningRulesChange}
          />
        </div>
        <div className={activeTab === AppTab.MASTER ? '' : 'hidden'}>
          <MasterTab
            geminiApiKey={geminiApiKey}
            onApiKeyChange={handleApiKeyChange}
            geminiModel={geminiModel}
            onModelChange={handleModelChange}
            customTaxCategories={customTaxCategories}
            onCustomTaxCategoriesChange={handleCustomTaxCategoriesChange}
            clients={clients}
            accountMasters={accountMasters}
            onAccountMasterChange={handleAccountMasterChange}
          />
        </div>
      </main>

    </div>
  );
};

export default App;
