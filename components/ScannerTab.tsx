import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Upload, Camera, FileText, Download, Trash2, AlertCircle, CheckCircle2, Settings, CreditCard, Landmark, Coins, Filter, Plus, Briefcase, X, ArrowUpDown, FileClock, BookmarkPlus, CheckSquare, Square, Receipt, Bot, Loader2, ChevronDown, Calendar, CircleDollarSign, FolderOpen, Tag, FileCheck, GraduationCap, HelpCircle } from 'lucide-react';
import { Transaction, HistoryBatch, AccountMasterMap, AccountMasterConfig, LearningRulesMap } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Toast, useToast } from './Toast';
import { analyzeWithGemini, AnalysisError, errorMessages, GeminiModelId } from '../services/geminiService';
import { DEFAULT_ACCOUNTS, DEFAULT_TAX_CATEGORIES, UI_COLORS } from '../constants';

// Props interface for ScannerTab
interface ScannerTabProps {
  geminiApiKey: string;
  geminiModel: GeminiModelId;
  customTaxCategories: string[];
  accountMasters: AccountMasterMap;
  onClientAdd?: (clientName: string) => void;
  onClientDelete?: (clientName: string) => void;
  allLearningRules?: Record<string, LearningRulesMap>;
  onLearningRulesChange?: (clientName: string, rules: LearningRulesMap) => void;
}

// Storage keys moved to parent (App.tsx) for centralized management

type BookType = 'cash' | 'deposit' | 'credit';
type CashAccountType = '現金' | '短期借入金';
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

// Simple Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <span className="group relative inline-flex items-center">
    {children}
    <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 max-w-xs text-center shadow-lg">
      {text}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
    </span>
  </span>
);

// Help Icon with Tooltip
const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip text={text}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500 cursor-help ml-1" />
  </Tooltip>
);

export const ScannerTab: React.FC<ScannerTabProps> = ({ geminiApiKey, geminiModel, customTaxCategories, accountMasters, onClientAdd, onClientDelete, allLearningRules, onLearningRulesChange }) => {
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
  const [cashAccountType, setCashAccountType] = useState<CashAccountType>('現金');
  const [baseAccount, setBaseAccount] = useState('現金');
  const [subAccount, setSubAccount] = useState('');
  const [filterText, setFilterText] = useState<string>('');
  const [learningRules, setLearningRules] = useState<RulesMap>({});

  // Advanced filter state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    kamoku: '',
    subKamoku: '',
    invoiceNumber: '',
    taxCategory: ''
  });

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Pre-selection for kamoku/subKamoku (applied to all transactions before CSV export)
  const [preSelectedKamoku, setPreSelectedKamoku] = useState<string>('');
  const [preSelectedSubKamoku, setPreSelectedSubKamoku] = useState<string>('');

  // Searchable combobox state for kamoku selection
  const [kamokuSearchText, setKamokuSearchText] = useState<string>('');
  const [isKamokuDropdownOpen, setIsKamokuDropdownOpen] = useState(false);
  const [kamokuHighlightIndex, setKamokuHighlightIndex] = useState<number>(-1);
  const kamokuInputRef = useRef<HTMLInputElement>(null);
  const kamokuDropdownRef = useRef<HTMLDivElement>(null);

  // Searchable combobox state for subKamoku selection
  const [subKamokuSearchText, setSubKamokuSearchText] = useState<string>('');
  const [isSubKamokuDropdownOpen, setIsSubKamokuDropdownOpen] = useState(false);
  const [subKamokuHighlightIndex, setSubKamokuHighlightIndex] = useState<number>(-1);
  const subKamokuInputRef = useRef<HTMLInputElement>(null);
  const subKamokuDropdownRef = useRef<HTMLDivElement>(null);

  // AI auto kamoku mode
  const [aiAutoKamoku, setAiAutoKamoku] = useState<boolean>(false);


  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Deleted transaction for undo functionality
  const [lastDeletedTransaction, setLastDeletedTransaction] = useState<Transaction | null>(null);

  // Batch edit mode
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [batchKamoku, setBatchKamoku] = useState('');
  const [batchSubKamoku, setBatchSubKamoku] = useState('');
  const [batchTaxCategory, setBatchTaxCategory] = useState('');
  const [batchInvoice, setBatchInvoice] = useState('');

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Ctrl/Cmd + S: Save to stock
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (transactions.length > 0) {
          setTempSaveName(fileState?.name.split('.')[0] || '');
          setIsSaveModalOpen(true);
        }
      }

      // Ctrl/Cmd + E: Export CSV
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (transactions.length > 0) {
          downloadCSV();
        }
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isSaveModalOpen) setIsSaveModalOpen(false);
        if (confirmDialog?.isOpen) setConfirmDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transactions.length, fileState, isSaveModalOpen, confirmDialog]);

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

  // Set base account based on book type and cash account type
  useEffect(() => {
    switch (bookType) {
      case 'cash':
        setBaseAccount(cashAccountType);
        break;
      case 'deposit':
        setBaseAccount('普通預金');
        break;
      case 'credit':
        setBaseAccount('未払金');
        break;
    }
  }, [bookType, cashAccountType]);

  // Get current client's account master config
  const currentClientMaster = useMemo(() => {
    return accountMasters[selectedClient] || {
      accounts: DEFAULT_ACCOUNTS.map(name => ({ name, subAccounts: [] })),
      ledgerSubAccounts: { cash: [], shortTermLoan: [], deposit: [], credit: [] }
    };
  }, [accountMasters, selectedClient]);

  // Get available ledger sub-accounts for current book type
  const availableLedgerSubAccounts = useMemo(() => {
    const ledgerSubAccounts = currentClientMaster.ledgerSubAccounts;
    if (!ledgerSubAccounts) return [];
    switch (bookType) {
      case 'cash':
        // cashAccountTypeに応じて分岐
        return cashAccountType === '現金'
          ? ledgerSubAccounts.cash || []
          : ledgerSubAccounts.shortTermLoan || [];
      case 'deposit': return ledgerSubAccounts.deposit || [];
      case 'credit': return ledgerSubAccounts.credit || [];
      default: return [];
    }
  }, [bookType, cashAccountType, currentClientMaster]);

  // Get all available account names from master
  const availableKamokuList = useMemo(() => {
    return currentClientMaster.accounts.map(a => a.name);
  }, [currentClientMaster]);

  // Get available sub-accounts for selected kamoku
  const availableSubKamokuList = useMemo(() => {
    const selectedAccount = currentClientMaster.accounts.find(a => a.name === preSelectedKamoku);
    return selectedAccount?.subAccounts || [];
  }, [currentClientMaster, preSelectedKamoku]);

  // Helper function to get sub-accounts for a specific kamoku (used in transaction rows)
  const getSubAccountsForKamoku = useCallback((kamokuName: string) => {
    const account = currentClientMaster.accounts.find(a => a.name === kamokuName);
    return account?.subAccounts || [];
  }, [currentClientMaster]);

  // Filter kamoku list based on search text
  const filteredKamokuList = useMemo(() => {
    if (!kamokuSearchText) return availableKamokuList;
    const lowerSearch = kamokuSearchText.toLowerCase();
    return availableKamokuList.filter(k => k.toLowerCase().includes(lowerSearch));
  }, [availableKamokuList, kamokuSearchText]);

  // Filter sub-kamoku list based on search text
  const filteredSubKamokuList = useMemo(() => {
    if (!subKamokuSearchText) return availableSubKamokuList;
    const lowerSearch = subKamokuSearchText.toLowerCase();
    return availableSubKamokuList.filter(s => s.toLowerCase().includes(lowerSearch));
  }, [availableSubKamokuList, subKamokuSearchText]);

  // Auto-fill ledger sub-account when company or book type changes
  useEffect(() => {
    // 元帳切替時は常に補助科目を空欄（なし）にリセット
    setSubAccount('');
  }, [bookType, cashAccountType, selectedClient]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kamokuDropdownRef.current && !kamokuDropdownRef.current.contains(event.target as Node) &&
          kamokuInputRef.current && !kamokuInputRef.current.contains(event.target as Node)) {
        setIsKamokuDropdownOpen(false);
      }
      if (subKamokuDropdownRef.current && !subKamokuDropdownRef.current.contains(event.target as Node) &&
          subKamokuInputRef.current && !subKamokuInputRef.current.contains(event.target as Node)) {
        setIsSubKamokuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddClient = () => {
    if (!newClientName.trim()) return;
    const trimmedName = newClientName.trim();
    const updatedClients = [...clients, trimmedName];
    setClients(updatedClients);
    setSelectedClient(trimmedName);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    // 親コンポーネントに通知して勘定科目マスタを初期化
    if (onClientAdd) {
      onClientAdd(trimmedName);
    }
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
      // 親コンポーネントに通知して勘定科目マスタも削除
      onClientDelete?.(clientName);
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
        geminiModel,
        aiAutoKamoku
      );

      setTransactions(results.map(t => {
        const rule = learningRules[t.description];
        const signedAmount = t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount);

        // 預金・クレカの場合は「対象外」「非適格」をデフォルト（AIの判定を上書き）
        const isDepositOrCredit = bookType === 'deposit' || bookType === 'credit';
        const effectiveTaxCategory = isDepositOrCredit ? '対象外' : (t.taxCategory || '');
        const effectiveInvoice = isDepositOrCredit ? '非適格' : (t.invoiceNumber || '');

        // 勘定科目の優先順位: 1. 学習ルール、2. AIおまかせモードの推測、3. デフォルト
        let effectiveKamoku: string;
        let effectiveSubKamoku: string;
        if (rule?.kamoku) {
          // 学習ルールが最優先
          effectiveKamoku = rule.kamoku;
          effectiveSubKamoku = rule.subKamoku || '';
        } else if (aiAutoKamoku && t.kamoku) {
          // AIおまかせモードで推測された科目を使用
          effectiveKamoku = t.kamoku;
          effectiveSubKamoku = t.subKamoku || '';
        } else {
          // デフォルト（仮払金/仮受金）
          effectiveKamoku = t.type === 'income' ? '仮受金' : '仮払金';
          effectiveSubKamoku = '';
        }

        return {
          ...t,
          amount: signedAmount,
          kamoku: effectiveKamoku,
          subKamoku: effectiveSubKamoku,
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
        onLearningRulesChange?.(selectedClient, updatedRules);
      }
    }
  };

  const toggleTransactionSign = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount: -t.amount, toggled: !t.toggled, kamoku: t.kamoku === '仮払金' ? '仮受金' : t.kamoku === '仮受金' ? '仮払金' : t.kamoku } : t));
  };

  // Batch edit functions
  const toggleTransactionSelection = (id: string) => {
    const newSet = new Set(selectedTransactionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTransactionIds(newSet);
  };

  const selectAllTransactions = () => {
    if (selectedTransactionIds.size === filteredTransactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  const applyBatchEdit = () => {
    if (selectedTransactionIds.size === 0) return;

    setTransactions(prev => prev.map(t => {
      if (!selectedTransactionIds.has(t.id)) return t;
      const updates: Partial<Transaction> = {};
      if (batchKamoku) {
        updates.kamoku = batchKamoku;
        // 学習ルールも更新
        if (t.description) {
          const updatedRules = { ...learningRules, [t.description]: { kamoku: batchKamoku, subKamoku: batchSubKamoku || t.subKamoku || '' } };
          setLearningRules(updatedRules);
          localStorage.setItem(`${STORAGE_PREFIX_RULES}${selectedClient}`, JSON.stringify(updatedRules));
          onLearningRulesChange?.(selectedClient, updatedRules);
        }
      }
      if (batchSubKamoku) updates.subKamoku = batchSubKamoku;
      if (batchTaxCategory) updates.taxCategory = batchTaxCategory;
      if (batchInvoice) updates.invoiceNumber = batchInvoice;
      return { ...t, ...updates };
    }));

    showToast(`${selectedTransactionIds.size}件の取引を更新しました`, 'success');
    // Reset batch edit state
    setSelectedTransactionIds(new Set());
    setBatchKamoku('');
    setBatchSubKamoku('');
    setBatchTaxCategory('');
    setBatchInvoice('');
    setIsBatchEditMode(false);
  };

  const cancelBatchEdit = () => {
    setSelectedTransactionIds(new Set());
    setBatchKamoku('');
    setBatchSubKamoku('');
    setBatchTaxCategory('');
    setBatchInvoice('');
    setIsBatchEditMode(false);
  };

  // Handlers for searchable kamoku combobox
  const handleKamokuSelect = (kamoku: string) => {
    setPreSelectedKamoku(kamoku);
    setKamokuSearchText('');
    setIsKamokuDropdownOpen(false);
    setKamokuHighlightIndex(-1);
    // Clear sub-kamoku when kamoku changes
    setPreSelectedSubKamoku('');
    setSubKamokuSearchText('');
  };

  const handleKamokuKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isKamokuDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsKamokuDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setKamokuHighlightIndex(prev => Math.min(prev + 1, filteredKamokuList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setKamokuHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (kamokuHighlightIndex >= 0 && kamokuHighlightIndex < filteredKamokuList.length) {
          handleKamokuSelect(filteredKamokuList[kamokuHighlightIndex]);
        } else if (filteredKamokuList.length > 0) {
          handleKamokuSelect(filteredKamokuList[0]);
        }
        break;
      case 'Escape':
        setIsKamokuDropdownOpen(false);
        setKamokuHighlightIndex(-1);
        break;
    }
  };

  // Handlers for searchable sub-kamoku combobox
  const handleSubKamokuSelect = (subKamoku: string) => {
    setPreSelectedSubKamoku(subKamoku);
    setSubKamokuSearchText('');
    setIsSubKamokuDropdownOpen(false);
    setSubKamokuHighlightIndex(-1);
  };

  const handleSubKamokuKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSubKamokuDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsSubKamokuDropdownOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSubKamokuHighlightIndex(prev => Math.min(prev + 1, filteredSubKamokuList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSubKamokuHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (subKamokuHighlightIndex >= 0 && subKamokuHighlightIndex < filteredSubKamokuList.length) {
          handleSubKamokuSelect(filteredSubKamokuList[subKamokuHighlightIndex]);
        } else if (filteredSubKamokuList.length > 0) {
          handleSubKamokuSelect(filteredSubKamokuList[0]);
        }
        break;
      case 'Escape':
        setIsSubKamokuDropdownOpen(false);
        setSubKamokuHighlightIndex(-1);
        break;
    }
  };

  // Delete transaction with confirmation and undo capability
  const deleteTransaction = (id: string) => {
    const targetTransaction = transactions.find(t => t.id === id);
    if (!targetTransaction) return;

    // Confirmation dialog
    if (!window.confirm(`「${targetTransaction.date} ${targetTransaction.description}」を削除しますか？`)) return;

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

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Text filter for description
      if (filterText && !t.description.toLowerCase().includes(filterText.toLowerCase())) return false;
      // Date range filter
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      // Kamoku filter
      if (filters.kamoku && t.kamoku !== filters.kamoku) return false;
      // SubKamoku filter
      if (filters.subKamoku && t.subKamoku !== filters.subKamoku) return false;
      // Invoice filter
      if (filters.invoiceNumber && t.invoiceNumber !== filters.invoiceNumber) return false;
      // Tax category filter
      if (filters.taxCategory && t.taxCategory !== filters.taxCategory) return false;
      return true;
    });
  }, [transactions, filterText, filters]);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const kamokuSet = new Set<string>();
    const subKamokuSet = new Set<string>();
    const invoiceSet = new Set<string>();
    const taxCategorySet = new Set<string>();
    transactions.forEach(t => {
      if (t.kamoku) kamokuSet.add(t.kamoku);
      if (t.subKamoku) subKamokuSet.add(t.subKamoku);
      if (t.invoiceNumber) invoiceSet.add(t.invoiceNumber);
      if (t.taxCategory) taxCategorySet.add(t.taxCategory);
    });
    return {
      kamoku: Array.from(kamokuSet).sort(),
      subKamoku: Array.from(subKamokuSet).sort(),
      invoiceNumber: Array.from(invoiceSet).sort(),
      taxCategory: Array.from(taxCategorySet).sort()
    };
  }, [transactions]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return filterText || filters.dateFrom || filters.dateTo || filters.kamoku || filters.subKamoku || filters.invoiceNumber || filters.taxCategory;
  }, [filterText, filters]);

  // Clear all filters
  const clearAllFilters = () => {
    setFilterText('');
    setFilters({
      dateFrom: '',
      dateTo: '',
      kamoku: '',
      subKamoku: '',
      invoiceNumber: '',
      taxCategory: ''
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Client Tabs - Mobile Dropdown / Desktop Tabs */}
      {isMobile ? (
        <div className="pb-4">
          <label className="text-xs font-medium text-slate-500 mb-2 block">クライアント選択</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedClient}
                onChange={(e) => { setSelectedClient(e.target.value); setViewingHistoryId(null); }}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                aria-label="クライアント選択"
              >
                {clients.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={() => setIsAddingClient(true)}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg font-medium flex items-center gap-1 hover:bg-orange-700 transition-all"
              aria-label="新しいクライアントを追加"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {isAddingClient && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-white border border-orange-300 rounded-lg">
              <input
                autoFocus
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddClient()}
                placeholder="会社名を入力"
                className="flex-1 text-sm outline-none bg-transparent"
                aria-label="新しいクライアント名"
              />
              <button onClick={handleAddClient} className="bg-orange-600 text-white px-3 py-1.5 rounded font-medium text-sm" aria-label="クライアントを追加">
                追加
              </button>
              <button onClick={() => { setIsAddingClient(false); setNewClientName(''); }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
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
      )}

      <div className="space-y-6">
        {/* Settings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            {selectedClient} の帳簿設定
            <HelpTip text="証憑の種類に応じて元帳を選択してください。選択した元帳が仕訳の貸方/借方に自動設定されます。" />
          </h2>
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
              {/* Cash Account Sub-options */}
              {bookType === 'cash' && (
                <div className="flex gap-2 mt-2 pl-1">
                  <button
                    onClick={() => setCashAccountType('現金')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      cashAccountType === '現金'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600'
                    }`}
                  >
                    現金
                  </button>
                  <button
                    onClick={() => setCashAccountType('短期借入金')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      cashAccountType === '短期借入金'
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600'
                    }`}
                  >
                    短期借入金
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">補助科目設定</label>
              {availableLedgerSubAccounts.length > 0 ? (
                <select
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">（なし）</option>
                  {availableLedgerSubAccounts.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value)}
                  placeholder="例: 三菱UFJ銀行（マスタ未登録）"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              )}
              <div className="text-xs text-slate-500">
                現在の元帳科目: <span className="font-medium text-slate-700">{baseAccount}</span>
                {availableLedgerSubAccounts.length === 0 && (
                  <span className="ml-2 text-orange-600">（設定タブで補助科目を登録できます）</span>
                )}
              </div>
            </div>
          </div>

          {/* Pre-selection for Kamoku/SubKamoku */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              CSV出力時の勘定科目（事前選択）
              <HelpTip text="全取引に同じ勘定科目を設定する場合に便利です。例：経費精算でほぼ全て旅費交通費の場合など。" />
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ここで選択した科目が、CSV出力時にすべての取引に適用されます（空欄の場合は個別設定が使われます）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kamoku Searchable Combobox */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手勘定科目</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="relative">
                      <input
                        ref={kamokuInputRef}
                        type="text"
                        value={isKamokuDropdownOpen ? kamokuSearchText : preSelectedKamoku}
                        onChange={e => {
                          setKamokuSearchText(e.target.value);
                          setIsKamokuDropdownOpen(true);
                          setKamokuHighlightIndex(-1);
                        }}
                        onFocus={() => setIsKamokuDropdownOpen(true)}
                        onKeyDown={handleKamokuKeyDown}
                        placeholder="入力して検索 または 選択..."
                        className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setIsKamokuDropdownOpen(!isKamokuDropdownOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isKamokuDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {isKamokuDropdownOpen && (
                      <div
                        ref={kamokuDropdownRef}
                        className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                      >
                        {filteredKamokuList.length > 0 ? (
                          filteredKamokuList.map((kamoku, index) => (
                            <div
                              key={kamoku}
                              onClick={() => handleKamokuSelect(kamoku)}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                index === kamokuHighlightIndex
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {kamoku}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-400">該当する勘定科目がありません</div>
                        )}
                      </div>
                    )}
                  </div>
                  {preSelectedKamoku && (
                    <button
                      onClick={() => { setPreSelectedKamoku(''); setPreSelectedSubKamoku(''); }}
                      className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-all whitespace-nowrap"
                    >
                      クリア
                    </button>
                  )}
                </div>
                {preSelectedKamoku && (
                  <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block">
                    選択中: {preSelectedKamoku}
                  </div>
                )}
              </div>

              {/* SubKamoku Searchable Combobox */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手補助科目</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="relative">
                      <input
                        ref={subKamokuInputRef}
                        type="text"
                        value={isSubKamokuDropdownOpen ? subKamokuSearchText : preSelectedSubKamoku}
                        onChange={e => {
                          setSubKamokuSearchText(e.target.value);
                          setIsSubKamokuDropdownOpen(true);
                          setSubKamokuHighlightIndex(-1);
                        }}
                        onFocus={() => availableSubKamokuList.length > 0 && setIsSubKamokuDropdownOpen(true)}
                        onKeyDown={handleSubKamokuKeyDown}
                        placeholder={availableSubKamokuList.length > 0 ? "入力して検索 または 選択..." : "自由入力（マスタ未登録）"}
                        className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                      />
                      {availableSubKamokuList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsSubKamokuDropdownOpen(!isSubKamokuDropdownOpen)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isSubKamokuDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {isSubKamokuDropdownOpen && availableSubKamokuList.length > 0 && (
                      <div
                        ref={subKamokuDropdownRef}
                        className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                      >
                        {filteredSubKamokuList.length > 0 ? (
                          filteredSubKamokuList.map((sub, index) => (
                            <div
                              key={sub}
                              onClick={() => handleSubKamokuSelect(sub)}
                              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                index === subKamokuHighlightIndex
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {sub}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-400">該当する補助科目がありません</div>
                        )}
                      </div>
                    )}
                  </div>
                  {preSelectedSubKamoku && (
                    <button
                      onClick={() => setPreSelectedSubKamoku('')}
                      className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-all whitespace-nowrap"
                    >
                      クリア
                    </button>
                  )}
                </div>
                {preSelectedSubKamoku && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                    選択中: {preSelectedSubKamoku}
                  </div>
                )}
                {availableSubKamokuList.length === 0 && preSelectedKamoku && (
                  <p className="text-xs text-slate-400 mt-1">
                    「{preSelectedKamoku}」に紐づく補助科目がマスタに登録されていません
                  </p>
                )}
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
                  <>
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
                    {/* AI Auto Kamoku Toggle */}
                    <label className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={aiAutoKamoku}
                          onChange={e => setAiAutoKamoku(e.target.checked)}
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
                        <p className="text-xs text-slate-500">ONにするとAIが勘定科目を推測します</p>
                      </div>
                    </label>
                  </>
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
        {!viewingHistoryId && fileState && transactions.length === 0 && !isAnalyzing && (
          <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center">
              <Receipt className="w-12 h-12 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">取引データがありません</h3>
            <p className="text-slate-500 mb-6">「AI自動解析」ボタンをクリックして証憑を解析してください。</p>
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
          <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-full flex items-center justify-center animate-pulse">
              <Bot className="w-12 h-12 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
              AI解析中...
            </h3>
            <p className="text-slate-500 mb-4">証憑から取引情報を読み取っています</p>
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full animate-progress" />
              </div>
              <p className="text-xs text-slate-400 mt-2">日付・金額・摘要を抽出しています...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {transactions.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="h-64 w-full">
                <ResponsiveContainer><BarChart data={monthlyChartData}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" /><YAxis /><RechartsTooltip /><Legend /><Bar name="収入" dataKey="income" fill="#22c55e" radius={4} /><Bar name="支出" dataKey="expense" fill="#ef4444" radius={4} /></BarChart></ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* Header with title */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      <CheckCircle2 className="text-orange-600 w-5 h-5" />仕訳プレビュー
                      {hasActiveFilters && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          {filteredTransactions.length}/{transactions.length}件
                        </span>
                      )}
                    </h3>
                    {/* Batch Edit Toggle */}
                    <Tooltip text="複数の取引を選択して勘定科目や税区分を一括設定できます">
                      <button
                        onClick={() => setIsBatchEditMode(!isBatchEditMode)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                          isBatchEditMode
                            ? 'bg-orange-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                        }`}
                      >
                        {isBatchEditMode ? '選択モード中' : '一括編集'}
                      </button>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none sm:w-48">
                      <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        placeholder="摘要でフィルター"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                        aria-label="摘要でフィルター"
                      />
                    </div>
                    <button
                      onClick={() => setShowFilterPanel(!showFilterPanel)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1 transition-all ${
                        showFilterPanel || hasActiveFilters
                          ? 'bg-orange-50 border-orange-300 text-orange-600'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-orange-300'
                      }`}
                      aria-expanded={showFilterPanel}
                      aria-label="詳細フィルター"
                    >
                      <Filter className="w-4 h-4" />
                      詳細
                    </button>
                  </div>
                </div>
                {/* Filter Panel */}
                {showFilterPanel && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {/* Date From */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">取引日（開始）</label>
                        <input
                          type="date"
                          value={filters.dateFrom}
                          onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        />
                      </div>
                      {/* Date To */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">取引日（終了）</label>
                        <input
                          type="date"
                          value={filters.dateTo}
                          onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        />
                      </div>
                      {/* Kamoku */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">相手勘定科目</label>
                        <select
                          value={filters.kamoku}
                          onChange={e => setFilters(prev => ({ ...prev, kamoku: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">すべて</option>
                          {filterOptions.kamoku.map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      {/* SubKamoku */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">補助科目</label>
                        <select
                          value={filters.subKamoku}
                          onChange={e => setFilters(prev => ({ ...prev, subKamoku: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">すべて</option>
                          {filterOptions.subKamoku.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {/* Invoice */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">インボイス</label>
                        <select
                          value={filters.invoiceNumber}
                          onChange={e => setFilters(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">すべて</option>
                          <option value="適格">適格</option>
                          <option value="非適格">非適格</option>
                        </select>
                      </div>
                      {/* Tax Category */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">税区分</label>
                        <select
                          value={filters.taxCategory}
                          onChange={e => setFilters(prev => ({ ...prev, taxCategory: e.target.value }))}
                          className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">すべて</option>
                          {filterOptions.taxCategory.map(tc => (
                            <option key={tc} value={tc}>{tc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {hasActiveFilters && (
                      <div className="flex justify-end">
                        <button
                          onClick={clearAllFilters}
                          className="text-xs text-slate-500 hover:text-orange-600 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          フィルターをクリア
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Batch Edit Panel */}
                {isBatchEditMode && (
                  <div className="mt-4 pt-4 border-t border-orange-200 bg-orange-50/50 -mx-4 -mb-4 px-4 pb-4 sm:-mx-5 sm:px-5 sm:-mb-5 sm:pb-5 rounded-b-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={selectAllTransactions}
                          className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:border-orange-300 transition-all"
                        >
                          {selectedTransactionIds.size === filteredTransactions.length ? '全選択解除' : '全選択'}
                        </button>
                        <span className="text-sm text-slate-600">
                          <span className="font-semibold text-orange-600">{selectedTransactionIds.size}</span>件選択中
                        </span>
                      </div>
                      <button
                        onClick={cancelBatchEdit}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        キャンセル
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {/* Batch Kamoku */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-medium">勘定科目</label>
                        <select
                          value={batchKamoku}
                          onChange={e => setBatchKamoku(e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">変更なし</option>
                          {availableKamokuList.map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      {/* Batch SubKamoku */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-medium">補助科目</label>
                        <select
                          value={batchSubKamoku}
                          onChange={e => setBatchSubKamoku(e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">変更なし</option>
                          {batchKamoku && getSubAccountsForKamoku(batchKamoku).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      {/* Batch Tax Category */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-medium">税区分</label>
                        <select
                          value={batchTaxCategory}
                          onChange={e => setBatchTaxCategory(e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">変更なし</option>
                          {allTaxCategories.map(tc => (
                            <option key={tc} value={tc}>{tc}</option>
                          ))}
                        </select>
                      </div>
                      {/* Batch Invoice */}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-medium">インボイス</label>
                        <select
                          value={batchInvoice}
                          onChange={e => setBatchInvoice(e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">変更なし</option>
                          <option value="適格">適格</option>
                          <option value="非適格">非適格</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={applyBatchEdit}
                      disabled={selectedTransactionIds.size === 0 || (!batchKamoku && !batchSubKamoku && !batchTaxCategory && !batchInvoice)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      選択した{selectedTransactionIds.size}件に適用
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons - separate row for better visibility */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setTempSaveName(fileState?.name.split('.')[0] || ''); setIsSaveModalOpen(true); }}
                  className="sm:flex-none sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
                  title="Ctrl+S"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>証憑保存</span>
                </button>
                <div className="flex-1" />
                <button
                  onClick={downloadCSV}
                  className="sm:flex-none sm:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg"
                  title="Ctrl+E"
                >
                  <Download className="w-5 h-5" />
                  <span>CSV出力</span>
                </button>
              </div>

              {/* Mobile Card Layout */}
              {isMobile ? (
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                  {filteredTransactions.map(t => (
                    <div key={t.id} className={`rounded-xl overflow-hidden shadow-sm ${t.toggled ? UI_COLORS.table.rowToggled : 'border border-slate-200 bg-white'}`}>
                      {/* Card Header */}
                      <div className={`flex items-center justify-between p-3 ${t.amount < 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${t.amount < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t.amount < 0 ? '支出' : '収入'}
                          </span>
                          <input
                            type="date"
                            value={t.date.replace(/\//g, '-')}
                            onChange={e => updateTransaction(t.id, 'date', e.target.value.replace(/-/g, '/'))}
                            className="text-sm text-slate-600 bg-transparent outline-none focus:bg-white rounded px-2 py-1.5 border border-transparent focus:border-orange-500 min-h-[44px]"
                            aria-label="取引日"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleTransactionSign(t.id)}
                            className="p-2.5 min-w-[44px] min-h-[44px] text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center"
                            aria-label="収支を切り替え"
                          >
                            <ArrowUpDown className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="p-2.5 min-w-[44px] min-h-[44px] text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                            aria-label="取引を削除"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-4">
                        {/* 摘要・金額 */}
                        <div className="flex items-start justify-between gap-3">
                          <input
                            value={t.description}
                            onChange={e => updateTransaction(t.id, 'description', e.target.value)}
                            title={t.description}
                            className="flex-1 font-semibold text-slate-800 bg-transparent outline-none focus:bg-slate-50 rounded px-2 py-2 border border-transparent focus:border-orange-500 text-base min-h-[44px]"
                            aria-label="摘要"
                          />
                          <input
                            type="number"
                            value={t.amount}
                            onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                            className={`text-right bg-slate-50 px-3 py-2 outline-none focus:bg-white rounded-lg border border-slate-200 focus:border-orange-500 font-bold text-xl w-36 min-h-[44px] ${t.amount < 0 ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
                            aria-label="金額"
                          />
                        </div>

                        {/* 勘定科目 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" /> 勘定科目
                            </label>
                            <input
                              list={`kamoku-list-mobile-${t.id}`}
                              value={t.kamoku || ''}
                              placeholder={t.amount < 0 ? '仮払金' : '仮受金'}
                              onChange={e => updateTransaction(t.id, 'kamoku', e.target.value)}
                              className={`w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm font-semibold min-h-[44px] ${t.amount < 0 ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
                            />
                            <datalist id={`kamoku-list-mobile-${t.id}`}>
                              {availableKamokuList.map(name => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1">
                              <Tag className="w-3 h-3" /> 補助科目
                            </label>
                            <input
                              list={`subkamoku-list-mobile-${t.id}`}
                              value={t.subKamoku || ''}
                              placeholder="-"
                              onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
                            />
                            <datalist id={`subkamoku-list-mobile-${t.id}`}>
                              {getSubAccountsForKamoku(t.kamoku || '').map(sub => (
                                <option key={sub} value={sub} />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        {/* インボイス・税区分 */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1">
                              <FileCheck className="w-3 h-3" /> インボイス
                            </label>
                            <select
                              value={t.invoiceNumber || ''}
                              onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
                            >
                              <option value="">未選択</option>
                              <option value="適格">適格</option>
                              <option value="非適格">非適格</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1">
                              <Receipt className="w-3 h-3" /> 税区分
                            </label>
                            <select
                              value={t.taxCategory || ''}
                              onChange={e => updateTransaction(t.id, 'taxCategory', e.target.value)}
                              className="w-full bg-white px-3 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-orange-500 text-sm min-h-[44px]"
                            >
                              {allTaxCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 学習済みマーク */}
                        {learningRules[t.description] && learningRules[t.description].kamoku === t.kamoku && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                            <GraduationCap className="w-4 h-4" />
                            <span>この摘要は学習済みです</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop Table Layout */
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className={`${UI_COLORS.table.headerSticky} text-xs`}>
                      <tr>
                        <th className="px-2 py-3 text-center w-14">
                          <span className="flex items-center justify-center gap-1">
                            <ArrowUpDown className="w-3 h-3" />
                            <span className="hidden lg:inline">収/支</span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[140px]">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-orange-600" />
                            取引日
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[200px]">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-orange-600" />
                            摘要
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[140px]">
                          <span className="flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-orange-600" />
                            相手勘定科目
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[120px]">
                          <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-orange-600" />
                            補助科目
                          </span>
                        </th>
                        <th className="px-4 py-3 text-right min-w-[130px]">
                          <span className="flex items-center justify-end gap-1.5">
                            <CircleDollarSign className="w-3.5 h-3.5 text-orange-600" />
                            金額 (税込)
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[100px]">
                          <span className="flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                            インボイス
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left min-w-[140px]">
                          <span className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-orange-600" />
                            税区分
                          </span>
                        </th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className={`transition-colors ${selectedTransactionIds.has(t.id) ? 'bg-orange-50' : t.toggled ? UI_COLORS.table.rowToggledHover : UI_COLORS.table.rowHover}`}>
                          <td className="p-2 text-center">
                            {isBatchEditMode ? (
                              <button
                                onClick={() => toggleTransactionSelection(t.id)}
                                className={`p-2 rounded-lg transition-all ${
                                  selectedTransactionIds.has(t.id)
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600'
                                }`}
                                aria-label={selectedTransactionIds.has(t.id) ? '選択解除' : '選択'}
                              >
                                {selectedTransactionIds.has(t.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleTransactionSign(t.id)}
                                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  t.amount < 0
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                                }`}
                                aria-label="収支を切り替え"
                                title={t.amount < 0 ? '支払（クリックで入金に切替）' : '入金（クリックで支払に切替）'}
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.amount < 0 ? '支' : '収'}</span>
                              </button>
                            )}
                          </td>
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
                              title={t.description}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 truncate"
                              aria-label="摘要"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                list={`kamoku-list-${t.id}`}
                                value={t.kamoku || ''}
                                placeholder={t.amount < 0 ? '仮払金' : '仮受金'}
                                onChange={e => updateTransaction(t.id, 'kamoku', e.target.value)}
                                className={`w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-semibold ${t.amount < 0 ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
                                aria-label="相手勘定科目"
                              />
                              <datalist id={`kamoku-list-${t.id}`}>
                                {availableKamokuList.map(name => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                              {learningRules[t.description] && learningRules[t.description].kamoku === t.kamoku && (
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-50" title="学習済み">
                                  <GraduationCap className={`w-3 h-3 ${UI_COLORS.learned.icon}`} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              list={`subkamoku-list-${t.id}`}
                              value={t.subKamoku || ''}
                              placeholder="-"
                              onChange={e => updateTransaction(t.id, 'subKamoku', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500"
                              aria-label="相手補助科目"
                            />
                            <datalist id={`subkamoku-list-${t.id}`}>
                              {getSubAccountsForKamoku(t.kamoku || '').map(sub => (
                                <option key={sub} value={sub} />
                              ))}
                            </datalist>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={t.amount}
                              onChange={e => updateTransaction(t.id, 'amount', parseFloat(e.target.value) || 0)}
                              className={`w-full text-right bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 font-bold text-base ${t.amount < 0 ? UI_COLORS.expense.text : UI_COLORS.income.text}`}
                              aria-label="金額"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={t.invoiceNumber || ''}
                              onChange={e => updateTransaction(t.id, 'invoiceNumber', e.target.value)}
                              className="w-full bg-transparent px-2 py-1 outline-none focus:bg-white rounded border border-transparent focus:border-orange-500 text-xs"
                              aria-label="インボイス区分"
                            >
                              <option value="">未選択</option>
                              <option value="適格">適格</option>
                              <option value="非適格">非適格</option>
                            </select>
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
                              className="text-slate-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 rounded p-1 -m-1 transition-colors"
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
              <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <History className="w-5 h-5 text-orange-600" />
                出力履歴（ストックデータ）
                <HelpTip text="証憑保存した仕訳データの一覧です。「確認」で再度編集・CSV出力ができます。" />
              </h2>
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
            <h3 id="save-modal-title" className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2"><BookmarkPlus className="text-orange-600" />証憑保存</h3>
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
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-progress { animation: progress 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};