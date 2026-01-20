import React, { useState, useEffect } from 'react';
import { Receipt, Settings } from 'lucide-react';
import { ScannerTab } from './components/ScannerTab';
import { MasterTab } from './components/MasterTab';
import { AppTab } from './types';
import { GeminiModelId } from './services/geminiService';

// Storage keys for centralized settings
const STORAGE_KEY_GEMINI_API_KEY = 'kakeibo_ai_gemini_api_key';
const STORAGE_KEY_GEMINI_MODEL = 'kakeibo_ai_gemini_model';
const STORAGE_KEY_CUSTOM_TAX_CATEGORIES = 'kakeibo_ai_custom_tax_categories';
const STORAGE_KEY_CLIENTS = 'kakeibo_ai_clients';
const STORAGE_PREFIX_ACCOUNT_MASTER = 'kakeibo_ai_accounts_';

// Type for account master per company
type AccountMasterMap = Record<string, string[]>; // clientName -> accounts[]

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.SCANNER);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>('gemini-3-flash-preview');
  const [customTaxCategories, setCustomTaxCategories] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>(['株式会社サンプル']);
  const [accountMasters, setAccountMasters] = useState<AccountMasterMap>({});

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
                if (Array.isArray(accounts)) {
                  masters[client] = accounts;
                }
              } catch (e) {
                console.error(`Failed to parse accounts for ${client}:`, e);
              }
            }
          });
          setAccountMasters(masters);
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
  const handleAccountMasterChange = (clientName: string, accounts: string[]) => {
    setAccountMasters(prev => ({ ...prev, [clientName]: accounts }));
    localStorage.setItem(`${STORAGE_PREFIX_ACCOUNT_MASTER}${clientName}`, JSON.stringify(accounts));
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

      {/* Main Content - Both tabs are always rendered but hidden via CSS to preserve state */}
      <main className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto">
        <div className={activeTab === AppTab.SCANNER ? '' : 'hidden'}>
          <ScannerTab
            geminiApiKey={geminiApiKey}
            geminiModel={geminiModel}
            customTaxCategories={customTaxCategories}
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

      <footer className="py-6 text-center text-slate-400 text-xs">
        <p>ChatGPT / Claude Web / Gemini API対応</p>
      </footer>
    </div>
  );
};

export default App;
