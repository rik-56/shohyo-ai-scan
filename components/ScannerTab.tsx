import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Camera, FileText, Download, Trash2, AlertCircle, CheckCircle2, Settings, CreditCard, Landmark, Coins, Filter, Save, Plus, Briefcase, X, ArrowUpDown, History, FileClock, BookmarkPlus, CheckSquare, Square, Receipt, Bot, Loader2 } from 'lucide-react';
import { Transaction, HistoryBatch } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Toast, useToast } from './Toast';
import { analyzeWithGemini, AnalysisError, errorMessages, GeminiModelId } from '../services/geminiService';

// Props interface for ScannerTab
interface ScannerTabProps {
  geminiApiKey: string;
  geminiModel: GeminiModelId;
  customTaxCategories: string[];
}

// Common account items for autocomplete
const COMMON_KAMOKU = [
  '旅費交通費', '消耗品費', '接待交際費', '通信費', '水道光熱費',
  '地代家賃', '租税公課', '保険料', '広告宣伝費', '支払手数料',
  '会議費', '福利厚生費', '新聞図書費', '修繕費', '外注費',
  '仮払金', '仮受金', '売掛金', '買掛金', '雑費'
];

// Default tax categories
const DEFAULT_TAX_CATEGORIES = [
  '課税売上 10%',
  '課税売上 (軽)8%',
  '課税仕入 10%',
  '課税仕入 (軽)8%',
  '対象外仕入',
  '非課税仕入',
  '対象外'
];

// Storage keys moved to parent (App.tsx) for centralized management

type BookType = 'cash' | 'deposit' | 'credit';
type FileState = {
  type: 'image' | 'pdf' | 'csv';
  previewUrl: string | null; // For images
  name: string;
  data: string; // Base64 or Text
  mimeType: string;
} | null;

type RuleValue = { kamoku: string; subKamoku: string };
type RulesMap = Record<string, RuleValue>;

const STORAGE_KEY_CLIENTS = 'kakeibo_ai_clients';
const STORAGE_PREFIX_RULES = 'kakeibo_ai_rules_';
const STORAGE_KEY_HISTORY = 'kakeibo_ai_history';

export const ScannerTab: React.FC<ScannerTabProps> = ({ geminiApiKey, geminiModel, customTaxCategories }) => {
  const [clients, setClients] = useState<string[]>(['株式会社サンプル']);
  const [selectedClient, setSelectedClient] = useState<string>('株式会社サンプル');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const [fileState, setFileState] = useState<FileState>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // Save Dialog State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [tempSaveName, setTempSaveName] = useState('');

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Bulk Delete State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  const [bookType, setBookType] = useState<BookType>('cash');
  const [baseAccount, setBaseAccount] = useState('現金');
  const [subAccount, setSubAccount] = useState('');
  const [filterText, setFilterText] = useState<string>('');
  const [learningRules, setLearningRules] = useState<RulesMap>({});

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Pre-selection for kamoku/subKamoku (applied to all transactions before CSV export)
  const [preSelectedKamoku, setPreSelectedKamoku] = useState<string>('');
  const [preSelectedSubKamoku, setPreSelectedSubKamoku] = useState<string>('');


  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Deleted transaction for undo functionality
  const [lastDeletedTransaction, setLastDeletedTransaction] = useState<Transaction | null>(null);

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const savedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (savedClients) {
      try {
        const parsed = JSON.parse(savedClients);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setClients(parsed);
          setSelectedClient(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse clients from localStorage:', e);
        // Reset to default on corruption
        const defaultClients = ['株式会社サンプル'];
        setClients(defaultClients);
        setSelectedClient(defaultClients[0]);
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(defaultClients));
      }
    }

    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse history from localStorage:', e);
        // Reset to empty on corruption
        setHistory([]);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([]));
      }
    }

    // API key and custom tax categories are now managed by parent component
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    if (!viewingHistoryId) {
      setTransactions([]);
      setFileState(null);
      setFilterText('');
    }
    const storageKey = `${STORAGE_PREFIX_RULES}${selectedClient}`;
    const savedRules = localStorage.getItem(storageKey);
    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules);
        const migratedRules: RulesMap = {};
        Object.entries(parsed).forEach(([key, val]) => {
          migratedRules[key] = typeof val === 'string' ? { kamoku: val, subKamoku: '' } : val as RuleValue;
        });
        setLearningRules(migratedRules);
      } catch (e) {
        console.error('Failed to parse rules from localStorage:', e);
        // Reset to empty on corruption
        setLearningRules({});
        localStorage.setItem(storageKey, JSON.stringify({}));
      }
    } else {
      setLearningRules({});
    }
  }, [selectedClient]);

  // Set base account based on book type
  useEffect(() => {
    switch (bookType) {
      case 'cash':
        setBaseAccount('現金');
        break;
      case 'deposit':
        setBaseAccount('普通預金');
        break;
      case 'credit':
        setBaseAccount('未払金');
        break;
    }
  }, [bookType]);

  const handleAddClient = () => {
    if (!newClientName.trim()) return;
    const updatedClients = [...clients, newClientName.trim()];
    setClients(updatedClients);
    setSelectedClient(newClientName.trim());
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    setNewClientName('');
    setIsAddingClient(false);
  };

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  }, []);

  const handleDeleteClient = (clientName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clients.length <= 1) return;
    showConfirm(`「${clientName}」を削除しますか？`, () => {
      const updatedClients = clients.filter(c => c !== clientName);
      setClients(updatedClients);
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
      if (selectedClient === clientName) setSelectedClient(updatedClients[0]);
    });
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
    const isPdf = file.type === 'application/pdf';
    reader.onloadend = () => {
      setFileState({
        type: isCsv ? 'csv' : isPdf ? 'pdf' : 'image',
        previewUrl: !isCsv && !isPdf ? reader.result as string : null,
        name: file.name,
        data: reader.result as string,
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png')
      });
      setTransactions([]);
      setViewingHistoryId(null);
    };
    reader.onerror = () => {
      showToast(`ファイル「${file.name}」の読み込みに失敗しました。`, 'error');
      setFileState(null);
    };
    if (isCsv) reader.readAsText(file); else reader.readAsDataURL(file);
  };

  // Handler for automatic Gemini analysis
  const handleGeminiAnalysis = async () => {
    if (!fileState || !geminiApiKey) return;

    // CSV files are not supported for image analysis
    if (fileState.type === 'csv') {
      showToast('CSVファイルはAI解析に対応していません。', 'error');
      return;
    }

    setIsAnalyzing(true);
    try {
      const results = await analyzeWithGemini(
        fileState.data,
        fileState.mimeType,
        geminiApiKey,
        geminiModel
      );

      setTransactions(results.map(t => {
        const rule = learningRules[t.description];
        const signedAmount = t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount);

        // 預金・クレカの場合は「対象外」「非適格」をデフォルト（AIの判定を上書き）
        const isDepositOrCredit = bookType === 'deposit' || bookType === 'credit';
        const effectiveTaxCategory = isDepositOrCredit ? '対象外' : (t.taxCategory || '');
        const effectiveInvoice = isDepositOrCredit ? '非適格' : (t.invoiceNumber || '');

        return {
          ...t,
          amount: signedAmount,
          kamoku: rule?.kamoku || (t.type === 'income' ? '仮受金' : '仮払金'),
          subKamoku: rule?.subKamoku || '',
          invoiceNumber: effectiveInvoice,
          taxCategory: effectiveTaxCategory
        };
      }));
      showToast('AI自動解析が完了しました！', 'success');
    } catch (error) {
      console.error('[Gemini Analysis] Error:', error);
      if (error instanceof AnalysisError) {
        showToast(error.message, 'error');
      } else {
        showToast(`解析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // All available tax categories (default + custom from props)
  const allTaxCategories = useMemo(() => {
    return [...DEFAULT_TAX_CATEGORIES, ...customTaxCategories];
  }, [customTaxCategories]);

  const updateTransaction = (id: string, field: keyof Transaction, value: any) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    if (field === 'kamoku' || field === 'subKamoku') {
      const target = transactions.find(t => t.id === id);
      if (target?.description) {
        const updatedRules = { ...learningRules, [target.description]: { kamoku: field === 'kamoku' ? value : (target.kamoku || ''), subKamoku: field === 'subKamoku' ? value : (target.subKamoku || '') } };
        setLearningRules(updatedRules);
        localStorage.setItem(`${STORAGE_PREFIX_RULES}${selectedClient}`, JSON.stringify(updatedRules));
      }
    }
  };

  const toggleTransactionSign = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount: -t.amount, kamoku: t.kamoku === '仮払金' ? '仮受金' : t.kamoku === '仮受金' ? '仮払金' : t.kamoku } : t));
  };

  // Delete transaction with confirmation and undo capability
  const deleteTransaction = (id: string) => {
    const targetTransaction = transactions.find(t => t.id === id);
    if (!targetTransaction) return;

    // Confirmation dialog
    if (!window.confirm('この取引を削除しますか？')) return;

    setLastDeletedTransaction(targetTransaction);
    setTransactions(prev => prev.filter(t => t.id !== id));

    showToast('取引を削除しました', 'success', {
      label: '元に戻す',
      onClick: () => {
        setTransactions(prev => [...prev, targetTransaction]);
        setLastDeletedTransaction(null);
        showToast('取引を復活しました', 'success');
      }
    });
  };

  const saveToHistory = () => {
    if (transactions.length === 0 || !tempSaveName.trim()) return;
    const newBatch: HistoryBatch = {
      id: `batch-${Date.now()}`,
      timestamp: Date.now(),
      client: selectedClient,
      name: tempSaveName.trim(),
      transactions: transactions,
      totalAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      count: transactions.length,
      previewUrl: fileState?.previewUrl || null,
      fileType: fileState?.type || 'image'
    };
    const newHistory = [newBatch, ...history];
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
    setIsSaveModalOpen(false);
    setTempSaveName('');
    showToast('履歴を保存しました！', 'success');
  };

  const toggleHistorySelection = (id: string) => {
    const next = new Set(selectedHistoryIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedHistoryIds(next);
  };

  const deleteSelectedHistory = () => {
    if (selectedHistoryIds.size === 0) return;
    showConfirm(`${selectedHistoryIds.size}件の履歴を削除しますか？`, () => {
      const nextHistory = history.filter(h => !selectedHistoryIds.has(h.id));
      setHistory(nextHistory);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(nextHistory));
      setSelectedHistoryIds(new Set());
      setIsSelectionMode(false);
      showToast('履歴を削除しました', 'success');
    });
  };

  const downloadCSV = () => {
    const headers = ["取引日", "借方勘定科目", "借方補助科目", "借方金額", "貸方勘定科目", "貸方補助科目", "貸方金額", "摘要", "インボイス区分", "税区分"];
    const rows = transactions.map(t => {
      const amount = Math.abs(t.amount);
      const isExpense = t.amount < 0;

      // Use pre-selected kamoku if set, otherwise fall back to transaction's kamoku or default
      const effectiveKamoku = preSelectedKamoku || t.kamoku || (isExpense ? "仮払金" : "仮受金");
      const effectiveSubKamoku = preSelectedSubKamoku || t.subKamoku || "";

      // Use per-transaction tax category
      const effectiveTaxCategory = t.taxCategory || '';

      return [
        t.date,
        isExpense ? effectiveKamoku : baseAccount,
        isExpense ? effectiveSubKamoku : subAccount,
        amount,
        isExpense ? baseAccount : effectiveKamoku,
        isExpense ? subAccount : effectiveSubKamoku,
        amount,
        `"${t.description.replace(/"/g, '""')}"`,
        t.invoiceNumber || "",
        effectiveTaxCategory
      ].join(",");
    });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `MF_${tempSaveName || selectedClient}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    // Clean up the object URL to prevent memory leak
    URL.revokeObjectURL(url);
  };

  const monthlyChartData = useMemo(() => {
    const map: Record<string, any> = {};
    transactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, income: 0, expense: 0 };
      if (t.amount > 0) map[m].income += t.amount; else map[m].expense += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  const filteredTransactions = useMemo(() => filterText ? transactions.filter(t => t.description.toLowerCase().includes(filterText.toLowerCase())) : transactions, [transactions, filterText]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Client Tabs */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 min-w-max" role="tablist" aria-label="クライアント選択">
        {clients.map((c, index) => (
          <div
            key={c}
            role="tab"
            tabIndex={0}
            aria-selected={selectedClient === c}
            onClick={() => { setSelectedClient(c); setViewingHistoryId(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedClient(c);
                setViewingHistoryId(null);
              }
            }}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${selectedClient === c ? 'bg-orange-600 border-orange-600 text-white font-medium' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600'}`}
          >
            <Briefcase className="w-4 h-4" />{c}
            {clients.length > 1 && (
              <button
                onClick={(e) => handleDeleteClient(c, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 focus:opacity-100"
                aria-label={`${c}を削除`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {isAddingClient ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-orange-300 rounded-lg">
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClient()}
              placeholder="会社名"
              className="text-sm outline-none w-32 bg-transparent"
              aria-label="新しいクライアント名"
            />
            <button onClick={handleAddClient} className="bg-orange-600 text-white p-1 rounded" aria-label="クライアントを追加">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingClient(true)}
            className="flex items-center gap-1 px-4 py-2 text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white hover:border-orange-300 hover:text-orange-600 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            aria-label="新しいクライアントを追加"
          >
            <Plus className="w-4 h-4" />追加
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Settings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2"><Settings className="w-5 h-5 text-orange-600" />{selectedClient} の帳簿設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">元帳の種類</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setBookType('cash')}
                  className={`flex-1 py-3 rounded-lg border flex flex-col items-center transition-all ${
                    bookType === 'cash'
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-200'
                  }`}
                >
                  <Coins className="w-5 h-5" />
                  <span className="text-xs font-medium mt-1">現金</span>
                </button>
                <button
                  onClick={() => setBookType('deposit')}
                  className={`flex-1 py-3 rounded-lg border flex flex-col items-center transition-all ${
                    bookType === 'deposit'
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-200'
                  }`}
                >
                  <Landmark className="w-5 h-5" />
                  <span className="text-xs font-medium mt-1">預金</span>
                </button>
                <button
                  onClick={() => setBookType('credit')}
                  className={`flex-1 py-3 rounded-lg border flex flex-col items-center transition-all ${
                    bookType === 'credit'
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-orange-200'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs font-medium mt-1">クレカ</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">補助科目設定</label>
              <input value={subAccount} onChange={e => setSubAccount(e.target.value)} placeholder="例: 三菱UFJ銀行" className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
              <div className="text-xs text-slate-500">現在の元帳科目: <span className="font-medium text-slate-700">{baseAccount}</span></div>
            </div>
          </div>

          {/* Pre-selection for Kamoku/SubKamoku */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              CSV出力時の勘定科目（事前選択）
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ここで選択した科目が、CSV出力時にすべての取引に適用されます（空欄の場合は個別設定が使われます）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手勘定科目</label>
                <input
                  list="kamoku-suggestions"
                  value={preSelectedKamoku}
                  onChange={e => setPreSelectedKamoku(e.target.value)}
                  placeholder="例: 消耗品費（空欄で個別設定優先）"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手補助科目</label>
                <input
                  value={preSelectedSubKamoku}
                  onChange={e => setPreSelectedSubKamoku(e.target.value)}
                  placeholder="例: 事務用品（空欄で個別設定優先）"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scan Section */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2"><Camera className="w-5 h-5 text-orange-600" />証憑スキャン</h2>
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
              className="border-2 border-dashed border-slate-300 rounded-lg p-10 flex flex-col items-center text-slate-400 cursor-pointer hover:bg-slate-50 hover:border-orange-300 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              aria-label="ファイルをアップロード"
            >
              <Upload className="w-10 h-10 mb-4" />
              <p className="font-medium text-base">クリックしてファイルをアップロード</p>
              <p className="text-sm mt-2">対応形式: 画像 (JPG, PNG), PDF, CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.csv"
                onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
                aria-hidden="true"
              />
            </div>
          ) : viewingHistoryId ? (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-5 rounded-lg">
              <div className="flex items-center gap-4"><FileClock className="w-8 h-8 text-slate-400" /><div><p className="font-medium text-slate-700">「{history.find(h => h.id === viewingHistoryId)?.name}」を表示中</p><p className="text-sm text-slate-500">修正して再度保存やCSV出力が可能です。</p></div></div>
              <button onClick={() => { setViewingHistoryId(null); setTransactions([]); }} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-all">新規スキャン</button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative w-full md:w-1/3 aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                {fileState?.previewUrl ? <img src={fileState.previewUrl} className="w-full h-full object-contain" alt="アップロードされた画像" /> : <div className="text-slate-400 flex flex-col items-center"><FileText className="w-12 h-12 mb-2" />{fileState?.name}</div>}
                <button onClick={() => setFileState(null)} className="absolute top-2 right-2 bg-white p-2 rounded-lg shadow-sm hover:bg-red-50 transition-all" aria-label="ファイルを削除"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-3">
                {geminiApiKey ? (
                  <button
                    onClick={handleGeminiAnalysis}
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
                ) : (
                  <div className="text-center space-y-3">
                    <button disabled className="w-full py-3 rounded-lg font-medium text-white bg-slate-300 cursor-not-allowed flex items-center justify-center gap-3">
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
        </div>

        {/* Empty State */}
        {!viewingHistoryId && fileState && transactions.length === 0 && (
          <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center">
            <Receipt className="w-14 h-14 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">取引データがありません</h3>
            <p className="text-slate-500 mb-4">「AI解析を実行する」ボタンをクリックして証憑を解析してください。</p>
            <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 inline-block">
              <p className="font-medium mb-1">対応フォーマット:</p>
              <p>レシート・領収書 / 通帳 / クレジットカード明細 / CSV</p>
            </div>
          </div>
        )}

        {/* Results */}
        {transactions.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="h-64 w-full">
                <ResponsiveContainer><BarChart data={monthlyChartData}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar name="収入" dataKey="income" fill="#22c55e" radius={4} /><Bar name="支出" dataKey="expense" fill="#ef4444" radius={4} /></BarChart></ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header with title */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="text-orange-600 w-5 h-5" />仕訳プレビュー
                  </h3>
                  <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="摘要でフィルター"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                      aria-label="摘要でフィルター"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons - separate row for better visibility */}
              <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setTempSaveName(fileState?.name.split('.')[0] || ''); setIsSaveModalOpen(true); }} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99]">
                  <BookmarkPlus className="w-5 h-5" />ストック保存
                </button>
                <button onClick={downloadCSV} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99]">
                  <Download className="w-5 h-5" />CSV出力
                </button>
              </div>

              {/* Kamoku Autocomplete Datalist */}
              <datalist id="kamoku-suggestions">
                {COMMON_KAMOKU.map(k => <option key={k} value={k} />)}
                {(Object.values(learningRules) as RuleValue[]).map((rule, i) =>
                  rule.kamoku && !COMMON_KAMOKU.includes(rule.kamoku) ?
                    <option key={`learned-${i}`} value={rule.kamoku} /> : null
                )}
              </datalist>

              {/* Mobile Card Layout */}
              {isMobile ? (
                <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredTransactions.map(t => (
                    <div key={t.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <input
                          value={t.date}
                          onChange={e => updateTransaction(t.id, 'date', e.target.value)}
                          className="text-sm text-slate-600 bg-transparent outline-none focus:bg-white rounded px-2 py-1 border border-transparent focus:border-orange-500 w-28"
                          aria-label="取引日"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTransactionSign(t.id)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            aria-label="収支を切り替え"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                            aria-label="取引を削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <input
                        value={t.description}
                        onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                        className="w-full font-medium text-slate-700 bg-transparent outline-none focus:bg-white rounded px-2 py-1 border border-transparent focus:border-orange-500 mb-3"
                        aria-label="摘要"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">勘定科目</label>
                          <input
                            list="kamoku-suggestions"
                            value={t.kamoku || ''}
                            placeholder={t.amount < 0 ? '仮払金' : '仮受金'}
                            onChange={e => updateTransaction(t.id, 'kamoku', e.target.value)}
                            className={`w-full bg-white px-2 py-2 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm font-medium ${t.kamoku?.includes('仮') ? 'text-orange-600' : 'text-slate-700'}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">補助科目</label>
                          <input
                            value={t.subKamoku || ''}
                            onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                            className="w-full bg-white px-2 py-2 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500">金額 (税込)</span>
                        <input
                          type="number"
                          value={t.amount}
                          onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                          className={`text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-semibold text-lg w-32 ${t.amount < 0 ? 'text-red-600' : 'text-blue-600'}`}
                          aria-label="金額"
                        />
                      </div>
                      {/* T番号 */}
                      <div className="pt-2 mt-2 border-t border-slate-200">
                        <label className="text-xs text-slate-500 block mb-1">インボイス区分</label>
                        <input
                          value={t.invoiceNumber || ''}
                          onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                          placeholder="適格 / 非適格"
                          className="w-full bg-white px-2 py-2 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-xs font-mono"
                        />
                      </div>
                      {/* 税区分 */}
                      <div className="pt-2 mt-2 border-t border-slate-200">
                        <label className="text-xs text-slate-500 block mb-1">税区分</label>
                        <select
                          value={t.taxCategory || ''}
                          onChange={e => updateTransaction(t.id, 'taxCategory', e.target.value)}
                          className="w-full bg-white px-2 py-2 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-xs"
                        >
                          {allTaxCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop Table Layout */
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-medium uppercase sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left min-w-[140px]">取引日</th>
                        <th className="px-4 py-3 text-left min-w-[200px]">摘要</th>
                        <th className="px-4 py-3 text-left min-w-[140px]">相手勘定科目</th>
                        <th className="px-4 py-3 text-left min-w-[120px]">相手補助科目</th>
                        <th className="px-4 py-3 text-right min-w-[130px]">金額 (税込)</th>
                        <th className="px-4 py-3 text-left min-w-[100px]">インボイス</th>
                        <th className="px-4 py-3 text-left min-w-[140px]">税区分</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <input
                              value={t.date}
                              onChange={e => updateTransaction(t.id, 'date', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
                              aria-label="取引日"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={t.description}
                              onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
                              aria-label="摘要"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                list="kamoku-suggestions"
                                value={t.kamoku || ''}
                                placeholder={t.amount < 0 ? '仮払金' : '仮受金'}
                                onChange={e => updateTransaction(t.id, 'kamoku', e.target.value)}
                                className={`w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-medium ${t.kamoku?.includes('仮') ? 'text-orange-600' : 'text-slate-700'}`}
                                aria-label="相手勘定科目"
                              />
                              {learningRules[t.description] && learningRules[t.description].kamoku === t.kamoku && (
                                <Save className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-500" aria-label="学習済み" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              value={t.subKamoku || ''}
                              onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
                              aria-label="相手補助科目"
                            />
                          </td>
                          <td className="p-3 relative flex items-center">
                            <button
                              onClick={() => toggleTransactionSign(t.id)}
                              className="absolute left-1 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                              aria-label="収支を切り替え"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={t.amount}
                              onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                              className={`w-full text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-blue-600'}`}
                              aria-label="金額"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={t.invoiceNumber || ''}
                              onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                              placeholder="適格 / 非適格"
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 text-xs font-mono text-slate-600"
                              aria-label="インボイス区分"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={t.taxCategory || ''}
                              onChange={e => updateTransaction(t.id, 'taxCategory', e.target.value)}
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
                              onClick={() => deleteTransaction(t.id)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label="取引を削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2"><History className="w-5 h-5 text-orange-600" />出力履歴（ストックデータ）</h2>
              <div className="flex gap-2">
                {isSelectionMode ? (
                  <>
                    <button onClick={deleteSelectedHistory} disabled={selectedHistoryIds.size === 0} className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${selectedHistoryIds.size > 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>選択した{selectedHistoryIds.size}件を削除</button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedHistoryIds(new Set()); }} className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">キャンセル</button>
                  </>
                ) : <button onClick={() => setIsSelectionMode(true)} className="text-sm font-medium text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg border border-orange-200">整理する</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map(batch => (
                <div key={batch.id} onClick={() => isSelectionMode ? toggleHistorySelection(batch.id) : null} className={`group relative bg-slate-50 rounded-lg p-4 border transition-all ${isSelectionMode ? 'cursor-pointer' : ''} ${selectedHistoryIds.has(batch.id) ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-300 hover:bg-white hover:shadow-sm'}`}>
                  {isSelectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      {selectedHistoryIds.has(batch.id) ? <CheckSquare className="text-orange-600 w-5 h-5" /> : <Square className="text-slate-400 w-5 h-5" />}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-lg bg-slate-200 overflow-hidden border border-slate-200 flex items-center justify-center flex-shrink-0">
                      {batch.previewUrl ? <img src={batch.previewUrl} className="w-full h-full object-cover" /> : <FileText className="text-slate-400 w-5 h-5" />}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-medium text-slate-700 truncate">{batch.name}</h4>
                      <div className="text-[10px] text-slate-500 font-mono">{new Date(batch.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500"><span className="font-medium text-slate-700">{batch.count}</span> 件</div>
                    {!isSelectionMode && (
                      <button onClick={(e) => { e.stopPropagation(); setTransactions(batch.transactions); setSelectedClient(batch.client); setViewingHistoryId(batch.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-white text-orange-600 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all">確認</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-xl animate-bounce-in">
            <h3 id="save-modal-title" className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2"><BookmarkPlus className="text-orange-600" />ストック保存</h3>
            <p className="text-sm text-slate-500 mb-5">後から確認しやすい名前を付けてください。</p>
            <input
              autoFocus
              value={tempSaveName}
              onChange={e => setTempSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveToHistory()}
              placeholder="例: 11月分ガソリン代"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 mb-5 font-medium"
              aria-label="保存名"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-2.5 text-slate-500 font-medium hover:bg-slate-50 rounded-lg transition-all">キャンセル</button>
              <button onClick={saveToHistory} disabled={!tempSaveName.trim()} className={`flex-1 py-2.5 rounded-lg font-medium text-white transition-all ${!tempSaveName.trim() ? 'bg-slate-200' : 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99]'}`}>保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-xl animate-bounce-in">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <AlertCircle className="text-orange-600" />確認
            </h3>
            <p className="text-slate-600 mb-5">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 text-slate-500 font-medium hover:bg-slate-50 rounded-lg transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-2.5 rounded-lg font-medium text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.99] transition-all"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          action={toast.action}
        />
      ))}

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