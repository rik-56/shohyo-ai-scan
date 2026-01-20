import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Camera, FileText, Download, Trash2, AlertCircle, CheckCircle2, Settings, CreditCard, Landmark, Coins, Filter, Save, Plus, Briefcase, X, ArrowUpDown, History, FileClock, BookmarkPlus, CheckSquare, Square, Receipt, Bot, Loader2 } from 'lucide-react';
import { Transaction, HistoryBatch } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Toast, useToast } from './Toast';
import { ManualAIModal } from './ManualAIModal';
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
  '非課税仕入'
];

// Storage keys moved to parent (App.tsx) for centralized management

type BookType = 'cash';
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

  // Manual AI Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Pre-selection for kamoku/subKamoku (applied to all transactions before CSV export)
  const [preSelectedKamoku, setPreSelectedKamoku] = useState<string>('');
  const [preSelectedSubKamoku, setPreSelectedSubKamoku] = useState<string>('');

  // Global tax category selection (for new transactions without AI-detected category)
  // Empty string means AI's detection is used as-is
  const [defaultTaxCategory, setDefaultTaxCategory] = useState<string>('');

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

  // Base account is always cash (現金出納帳)
  const BASE_ACCOUNT = '現金';

  useEffect(() => {
    setBaseAccount(BASE_ACCOUNT);
  }, []);

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

  // Handler for manual AI mode completion
  const handleManualAnalysisComplete = (results: Transaction[]) => {
    setTransactions(results.map(t => {
      const rule = learningRules[t.description];
      const signedAmount = t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount);
      return {
        ...t,
        amount: signedAmount,
        kamoku: rule?.kamoku || (t.type === 'income' ? '仮受金' : '仮払金'),
        subKamoku: rule?.subKamoku || '',
        invoiceNumber: t.invoiceNumber || '',
        taxCategory: t.taxCategory || ''
      };
    }));
    showToast('解析が完了しました！', 'success');
  };

  // Handler for automatic Gemini analysis
  const handleGeminiAnalysis = async () => {
    if (!fileState || !geminiApiKey) return;

    // CSV files are not supported for image analysis
    if (fileState.type === 'csv') {
      showToast('CSVファイルは自動解析に対応していません。手動モードをご利用ください。', 'error');
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
        return {
          ...t,
          amount: signedAmount,
          kamoku: rule?.kamoku || (t.type === 'income' ? '仮受金' : '仮払金'),
          subKamoku: rule?.subKamoku || '',
          invoiceNumber: t.invoiceNumber || '',
          taxCategory: t.taxCategory || ''
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
      const effectiveTaxCategory = t.taxCategory || defaultTaxCategory;

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
      <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 min-w-max" role="tablist" aria-label="クライアント選択">
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
            className={`group relative flex items-center gap-2 px-5 py-3 rounded-full cursor-pointer border-2 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${selectedClient === c ? 'bg-orange-500 border-orange-500 text-white font-bold' : 'bg-white border-stone-200 text-stone-500 hover:border-orange-200 hover:text-orange-500'}`}
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
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-200 rounded-full shadow-sm">
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClient()}
              placeholder="会社名"
              className="text-sm outline-none w-32 bg-transparent"
              aria-label="新しいクライアント名"
            />
            <button onClick={handleAddClient} className="bg-orange-500 text-white p-1 rounded-full" aria-label="クライアントを追加">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingClient(true)}
            className="flex items-center gap-1 px-4 py-3 text-stone-400 border-2 border-dashed rounded-full bg-white/50 hover:border-orange-200 hover:text-orange-500 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
            aria-label="新しいクライアントを追加"
          >
            <Plus className="w-4 h-4" />追加
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* Settings */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white relative overflow-hidden">
          <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-orange-500" />{selectedClient} の帳簿設定</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-stone-500">元帳の種類</label>
              <div className="flex gap-3">
                <div className="flex-1 py-3 rounded-2xl border-2 flex flex-col items-center bg-orange-50 border-orange-400 text-orange-700">
                  <Coins />
                  <span className="text-xs font-bold">現金出納帳</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-stone-500">補助科目設定</label>
              <input value={subAccount} onChange={e => setSubAccount(e.target.value)} placeholder="例: 三菱UFJ銀行" className="w-full p-3.5 rounded-2xl border-2 border-stone-100 bg-stone-50 outline-none" />
              <div className="text-xs text-stone-400">現在の元帳科目: <span className="font-bold text-stone-600">{baseAccount}</span></div>
            </div>
          </div>

          {/* Pre-selection for Kamoku/SubKamoku */}
          <div className="mt-8 pt-6 border-t-2 border-stone-100">
            <h3 className="text-sm font-bold text-stone-500 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              CSV出力時の勘定科目（事前選択）
            </h3>
            <p className="text-xs text-stone-400 mb-4">
              ここで選択した科目が、CSV出力時にすべての取引に適用されます（空欄の場合は個別設定が使われます）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400">相手勘定科目</label>
                <input
                  list="kamoku-suggestions"
                  value={preSelectedKamoku}
                  onChange={e => setPreSelectedKamoku(e.target.value)}
                  placeholder="例: 消耗品費（空欄で個別設定優先）"
                  className="w-full p-3 rounded-xl border-2 border-stone-100 bg-stone-50 outline-none focus:border-orange-300 focus:bg-white text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400">相手補助科目</label>
                <input
                  value={preSelectedSubKamoku}
                  onChange={e => setPreSelectedSubKamoku(e.target.value)}
                  placeholder="例: 事務用品（空欄で個別設定優先）"
                  className="w-full p-3 rounded-xl border-2 border-stone-100 bg-stone-50 outline-none focus:border-orange-300 focus:bg-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scan Section */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
          <h2 className="text-lg font-bold text-stone-700 mb-6 flex items-center gap-2"><Camera className="w-5 h-5 text-orange-500" />証憑スキャン</h2>
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
              className="border-4 border-dashed border-stone-200 rounded-3xl p-12 flex flex-col items-center text-stone-400 cursor-pointer hover:bg-orange-50 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:bg-orange-50"
              aria-label="ファイルをアップロード"
            >
              <Upload className="w-10 h-10 mb-4" />
              <p className="font-bold text-lg">クリックしてファイルをアップロード</p>
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
            <div className="flex items-center justify-between bg-stone-50 border-2 p-6 rounded-2xl">
              <div className="flex items-center gap-4"><FileClock className="w-8 h-8 text-stone-400" /><div><p className="font-bold">「{history.find(h => h.id === viewingHistoryId)?.name}」を表示中</p><p className="text-sm">修正して再度保存やCSV出力が可能です。</p></div></div>
              <button onClick={() => { setViewingHistoryId(null); setTransactions([]); }} className="px-4 py-2 bg-white border-2 rounded-xl text-stone-500 font-bold hover:bg-stone-50 transition-all">新規スキャン</button>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8">
              <div className="relative w-full md:w-1/3 aspect-video bg-stone-100 rounded-2xl overflow-hidden border-2 flex items-center justify-center">
                {fileState?.previewUrl ? <img src={fileState.previewUrl} className="w-full h-full object-contain" alt="アップロードされた画像" /> : <div className="text-stone-400 flex flex-col items-center"><FileText className="w-12 h-12 mb-2" />{fileState?.name}</div>}
                <button onClick={() => setFileState(null)} className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-sm hover:bg-red-50 transition-all" aria-label="ファイルを削除"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-4">
                {geminiApiKey ? (
                  <>
                    <button
                      onClick={handleGeminiAnalysis}
                      disabled={isAnalyzing}
                      aria-label="AI自動解析を開始"
                      className="w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <button
                      onClick={() => setIsManualModalOpen(true)}
                      disabled={isAnalyzing}
                      className="w-full py-3 rounded-xl font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-60"
                    >
                      <FileText className="w-4 h-4" />
                      手動モード（ChatGPT/Claude）
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsManualModalOpen(true)}
                      aria-label="AI解析を開始"
                      className="w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]"
                    >
                      <Bot className="w-5 h-5" />
                      AI解析を実行する
                    </button>
                    <p className="text-xs text-stone-400 text-center">
                      ChatGPT / Claude Webを使用して解析します
                    </p>
                    <p className="text-xs text-orange-500 text-center bg-orange-50 rounded-lg py-2 px-3">
                      💡 設定でGemini APIキーを入力すると、自動解析が利用できます
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {!viewingHistoryId && fileState && transactions.length === 0 && (
          <div className="bg-white p-12 rounded-3xl shadow-lg border-2 border-white text-center">
            <Receipt className="w-16 h-16 mx-auto text-stone-300 mb-4" />
            <h3 className="text-xl font-bold text-stone-500 mb-2">取引データがありません</h3>
            <p className="text-stone-400 mb-4">「AI解析を実行する」ボタンをクリックして証憑を解析してください。</p>
            <div className="text-sm text-stone-400 bg-stone-50 rounded-xl p-4 inline-block">
              <p className="font-bold mb-1">対応フォーマット:</p>
              <p>レシート・領収書 / 通帳 / クレジットカード明細 / CSV</p>
            </div>
          </div>
        )}

        {/* Results */}
        {transactions.length > 0 && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-white">
              <div className="h-64 w-full">
                <ResponsiveContainer><BarChart data={monthlyChartData}><CartesianGrid vertical={false} stroke="#f5f5f4" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar name="収入" dataKey="income" fill="#34d399" radius={6} /><Bar name="支出" dataKey="expense" fill="#f87171" radius={6} /></BarChart></ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border-2 border-white overflow-hidden">
              {/* Header with title */}
              <div className="p-4 sm:p-6 bg-orange-50 border-b border-orange-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="font-bold text-stone-700 flex items-center gap-2 text-lg">
                    <CheckCircle2 className="text-orange-500" />仕訳プレビュー
                  </h3>
                  <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="摘要でフィルター"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-white bg-white outline-none focus:border-orange-200"
                      aria-label="摘要でフィルター"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons - separate row for better visibility */}
              <div className="p-4 bg-white border-b border-stone-100 flex flex-col sm:flex-row gap-3">
                <button onClick={() => { setTempSaveName(fileState?.name.split('.')[0] || ''); setIsSaveModalOpen(true); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95">
                  <BookmarkPlus className="w-5 h-5" />ストック保存
                </button>
                <button onClick={downloadCSV} className="flex-1 bg-green-500 hover:bg-green-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95">
                  <Download className="w-5 h-5" />CSV出力
                </button>
              </div>

              {/* Tax Category Default Selection */}
              <div className="px-6 py-4 bg-stone-50 border-b border-stone-100 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-stone-500 whitespace-nowrap">デフォルト税区分:</label>
                  <select
                    value={defaultTaxCategory}
                    onChange={e => setDefaultTaxCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-stone-200 bg-white outline-none focus:border-orange-300 text-sm font-medium"
                  >
                    {allTaxCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-stone-400 ml-auto">※ 各取引の税区分はAIが自動判定。下表で個別変更可能</p>
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
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {filteredTransactions.map(t => (
                    <div key={t.id} className="bg-stone-50 rounded-2xl p-4 border-2 border-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <input
                          value={t.date}
                          onChange={e => updateTransaction(t.id, 'date', e.target.value)}
                          className="text-sm text-stone-500 bg-transparent outline-none focus:bg-white rounded px-2 py-1 border border-transparent focus:border-orange-200 w-28"
                          aria-label="取引日"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTransactionSign(t.id)}
                            className="p-1 text-stone-400 hover:text-stone-600"
                            aria-label="収支を切り替え"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="p-1 text-stone-300 hover:text-red-500"
                            aria-label="取引を削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <input
                        value={t.description}
                        onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                        className="w-full font-bold text-stone-700 bg-transparent outline-none focus:bg-white rounded px-2 py-1 border border-transparent focus:border-orange-200 mb-3"
                        aria-label="摘要"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-stone-400 block mb-1">勘定科目</label>
                          <input
                            list="kamoku-suggestions"
                            value={t.kamoku || ''}
                            placeholder={t.amount < 0 ? '仮払金' : '仮受金'}
                            onChange={e => updateTransaction(t.id, 'kamoku', e.target.value)}
                            className={`w-full bg-white px-2 py-2 rounded-lg border border-stone-200 outline-none focus:border-orange-300 text-sm font-bold ${t.kamoku?.includes('仮') ? 'text-orange-500' : 'text-stone-700'}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-stone-400 block mb-1">補助科目</label>
                          <input
                            value={t.subKamoku || ''}
                            onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                            className="w-full bg-white px-2 py-2 rounded-lg border border-stone-200 outline-none focus:border-orange-300 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                        <span className="text-xs text-stone-400">金額 (税込)</span>
                        <input
                          type="number"
                          value={t.amount}
                          onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                          className={`text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200 font-bold text-lg w-32 ${t.amount < 0 ? 'text-red-500' : 'text-blue-600'}`}
                          aria-label="金額"
                        />
                      </div>
                      {/* T番号 */}
                      <div className="pt-2 mt-2 border-t border-stone-200">
                        <label className="text-xs text-stone-400 block mb-1">インボイス区分</label>
                        <input
                          value={t.invoiceNumber || ''}
                          onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                          placeholder="適格 / 非適格"
                          className="w-full bg-white px-2 py-2 rounded-lg border border-stone-200 outline-none focus:border-orange-300 text-xs font-mono"
                        />
                      </div>
                      {/* 税区分 */}
                      <div className="pt-2 mt-2 border-t border-stone-200">
                        <label className="text-xs text-stone-400 block mb-1">税区分</label>
                        <select
                          value={t.taxCategory || defaultTaxCategory}
                          onChange={e => updateTransaction(t.id, 'taxCategory', e.target.value)}
                          className="w-full bg-white px-2 py-2 rounded-lg border border-stone-200 outline-none focus:border-orange-300 text-xs"
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
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-4 min-w-[140px]">取引日</th>
                        <th className="px-4 py-4 min-w-[200px]">摘要</th>
                        <th className="px-4 py-4 min-w-[140px]">相手勘定科目</th>
                        <th className="px-4 py-4 min-w-[120px]">相手補助科目</th>
                        <th className="px-4 py-4 text-right min-w-[130px]">金額 (税込)</th>
                        <th className="px-4 py-4 min-w-[100px]">インボイス</th>
                        <th className="px-4 py-4 min-w-[140px]">税区分</th>
                        <th className="px-4 py-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-orange-50 transition-colors">
                          <td className="p-3">
                            <input
                              value={t.date}
                              onChange={e => updateTransaction(t.id, 'date', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200"
                              aria-label="取引日"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={t.description}
                              onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200"
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
                                className={`w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200 font-bold ${t.kamoku?.includes('仮') ? 'text-orange-500' : 'text-stone-700'}`}
                                aria-label="相手勘定科目"
                              />
                              {learningRules[t.description] && learningRules[t.description].kamoku === t.kamoku && (
                                <Save className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400" aria-label="学習済み" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              value={t.subKamoku || ''}
                              onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200"
                              aria-label="相手補助科目"
                            />
                          </td>
                          <td className="p-3 relative flex items-center">
                            <button
                              onClick={() => toggleTransactionSign(t.id)}
                              className="absolute left-1 p-1 text-stone-300 hover:text-stone-600 transition-colors"
                              aria-label="収支を切り替え"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={t.amount}
                              onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                              className={`w-full text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200 font-bold ${t.amount < 0 ? 'text-red-500' : 'text-blue-600'}`}
                              aria-label="金額"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              value={t.invoiceNumber || ''}
                              onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                              placeholder="適格 / 非適格"
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200 text-xs font-mono text-stone-500"
                              aria-label="インボイス区分"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={t.taxCategory || defaultTaxCategory}
                              onChange={e => updateTransaction(t.id, 'taxCategory', e.target.value)}
                              className="w-full bg-transparent px-1 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-200 text-xs"
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
                              className="text-stone-300 hover:text-red-500"
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
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border-2 border-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-stone-700 flex items-center gap-2"><History className="w-5 h-5 text-orange-500" />出力履歴（ストックデータ）</h2>
              <div className="flex gap-2">
                {isSelectionMode ? (
                  <>
                    <button onClick={deleteSelectedHistory} disabled={selectedHistoryIds.size === 0} className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${selectedHistoryIds.size > 0 ? 'bg-red-500 text-white shadow-md' : 'bg-stone-100 text-stone-400'}`}>選択した{selectedHistoryIds.size}件を削除</button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedHistoryIds(new Set()); }} className="text-sm font-bold text-stone-400 hover:text-stone-600 px-4 py-2">キャンセル</button>
                  </>
                ) : <button onClick={() => setIsSelectionMode(true)} className="text-sm font-bold text-orange-500 hover:bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">整理する</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map(batch => (
                <div key={batch.id} onClick={() => isSelectionMode ? toggleHistorySelection(batch.id) : null} className={`group relative bg-stone-50 rounded-2xl p-4 border-2 transition-all ${isSelectionMode ? 'cursor-pointer' : ''} ${selectedHistoryIds.has(batch.id) ? 'border-orange-400 bg-orange-50' : 'border-transparent hover:border-orange-100 hover:bg-white hover:shadow-md'}`}>
                  {isSelectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      {selectedHistoryIds.has(batch.id) ? <CheckSquare className="text-orange-500 w-5 h-5" /> : <Square className="text-stone-300 w-5 h-5" />}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-stone-200 overflow-hidden border border-stone-100 flex items-center justify-center flex-shrink-0">
                      {batch.previewUrl ? <img src={batch.previewUrl} className="w-full h-full object-cover" /> : <FileText className="text-stone-400 w-6 h-6" />}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-stone-700 truncate">{batch.name}</h4>
                      <div className="text-[10px] text-stone-400 font-mono">{new Date(batch.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-stone-200/50">
                    <div className="text-xs text-stone-500"><span className="font-bold text-stone-700">{batch.count}</span> 件</div>
                    {!isSelectionMode && (
                      <button onClick={(e) => { e.stopPropagation(); setTransactions(batch.transactions); setSelectedClient(batch.client); setViewingHistoryId(batch.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-white text-orange-500 border px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-orange-500 hover:text-white transition-all shadow-sm">確認</button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border-4 border-orange-100 animate-bounce-in">
            <h3 id="save-modal-title" className="text-xl font-bold text-stone-700 mb-2 flex items-center gap-2"><BookmarkPlus className="text-orange-500" />ストック保存</h3>
            <p className="text-sm text-stone-400 mb-6">後から確認しやすい名前を付けてください。</p>
            <input
              autoFocus
              value={tempSaveName}
              onChange={e => setTempSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveToHistory()}
              placeholder="例: 11月分ガソリン代"
              className="w-full p-4 rounded-2xl border-2 border-orange-100 bg-stone-50 outline-none focus:border-orange-400 focus:bg-white mb-6 font-bold"
              aria-label="保存名"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsSaveModalOpen(false)} className="flex-1 py-3 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-all">キャンセル</button>
              <button onClick={saveToHistory} disabled={!tempSaveName.trim()} className={`flex-1 py-3 rounded-2xl font-bold text-white shadow-lg shadow-orange-100 transition-all ${!tempSaveName.trim() ? 'bg-stone-200' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}`}>保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl border-4 border-orange-100 animate-bounce-in">
            <h3 id="confirm-dialog-title" className="text-xl font-bold text-stone-700 mb-2 flex items-center gap-2">
              <AlertCircle className="text-orange-500" />確認
            </h3>
            <p className="text-stone-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-3 text-stone-400 font-bold hover:bg-stone-50 rounded-2xl transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="flex-1 py-3 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-lg shadow-orange-100 transition-all"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual AI Modal */}
      <ManualAIModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAnalysisComplete={handleManualAnalysisComplete}
      />

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