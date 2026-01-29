import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Settings, Coins, Landmark, CreditCard, FileText, ChevronDown, ChevronRight, BookmarkPlus, AlertCircle, HelpCircle } from 'lucide-react';
import { Transaction, HistoryBatch, AccountMasterMap, AccountMasterConfig, LearningRulesMap, PageTransactions, ScanResult } from '../../types';
import { Toast, useToast } from '../Toast';
import { analyzeWithGemini, analyzeMultiPagePdf, isPdfMultiPage, AnalysisError, GeminiModelId, MultiPageProgress } from '../../services/geminiService';
import { DEFAULT_ACCOUNTS, DEFAULT_TAX_CATEGORIES } from '../../constants';

import { ClientSelector } from './ClientSelector';
import { FileUploadSection, FileState, PdfProcessMode } from './FileUploadSection';
import { TransactionTable } from './TransactionTable';
import { HistorySection } from './HistorySection';
import { ChartSection } from './ChartSection';
import { Combobox } from './Combobox';
import { useFilters, useLearningRules, useHistory } from './hooks';

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

type BookType = 'cash' | 'deposit' | 'credit';
type CashAccountType = '現金' | '短期借入金';

const STORAGE_KEY_CLIENTS = 'kakeibo_ai_clients';

// Simple Tooltip Component
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <span className="group relative inline-flex items-center">
    {children}
    <span className="pointer-events-none absolute top-full left-0 mt-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal z-50 w-64 text-left shadow-lg">
      {text}
      <span className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-800" />
    </span>
  </span>
);

// Help Icon with Tooltip
const HelpTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip text={text}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-orange-500 cursor-help ml-1" />
  </Tooltip>
);

export const ScannerTab: React.FC<ScannerTabProps> = ({
  geminiApiKey,
  geminiModel,
  customTaxCategories,
  accountMasters,
  onClientAdd,
  onClientDelete,
  onLearningRulesChange
}) => {
  // Client management
  const [clients, setClients] = useState<string[]>(['株式会社サンプル']);
  const [selectedClient, setSelectedClient] = useState<string>('株式会社サンプル');

  // File state
  const [fileState, setFileState] = useState<FileState>(null);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // History management (using custom hook)
  const {
    history,
    viewingHistoryId,
    setViewingHistoryId,
    isSelectionMode,
    setIsSelectionMode,
    selectedHistoryIds,
    saveToHistory,
    toggleHistorySelection,
    deleteSelectedHistory,
    exitSelectionMode
  } = useHistory();

  // Save Dialog State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [tempSaveName, setTempSaveName] = useState('');

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Book type and base account
  const [bookType, setBookType] = useState<BookType>('cash');
  const [cashAccountType, setCashAccountType] = useState<CashAccountType>('現金');
  const [baseAccount, setBaseAccount] = useState('現金');
  const [subAccount, setSubAccount] = useState('');

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAutoKamoku, setAiAutoKamoku] = useState<boolean>(false);

  // Multi-page PDF State
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(0); // 0 = 全ページ
  const [multiPageProgress, setMultiPageProgress] = useState<MultiPageProgress | null>(null);

  // PDF処理モード: 'single' | 'split'
  const [pdfProcessMode, setPdfProcessMode] = useState<PdfProcessMode>('single');

  // Pre-selection for kamoku/subKamoku
  const [preSelectedKamoku, setPreSelectedKamoku] = useState<string>('');
  const [preSelectedSubKamoku, setPreSelectedSubKamoku] = useState<string>('');

  // Batch edit state
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [batchKamoku, setBatchKamoku] = useState('');
  const [batchSubKamoku, setBatchSubKamoku] = useState('');
  const [batchTaxCategory, setBatchTaxCategory] = useState('');
  const [batchInvoice, setBatchInvoice] = useState('');

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);

  // Settings accordion state
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Toast notification
  const { toasts, showToast, removeToast } = useToast();

  // Custom hooks
  const { learningRules, updateRule, hasMatchingRule } = useLearningRules(selectedClient, onLearningRulesChange);

  const {
    filterText,
    setFilterText,
    filters,
    updateFilter,
    showFilterPanel,
    setShowFilterPanel,
    filteredTransactions,
    filterOptions,
    hasActiveFilters,
    clearAllFilters
  } = useFilters(transactions);

  // Duplicate detection
  const duplicates = useMemo(() => {
    const results: { id: string; matchingIds: string[] }[] = [];
    const checked = new Set<string>();

    const similarity = (s1: string, s2: string): number => {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      if (longer.length === 0) return 1.0;
      if (longer.toLowerCase().includes(shorter.toLowerCase())) {
        return shorter.length / longer.length + 0.2;
      }
      let matches = 0;
      for (let i = 0; i < shorter.length; i++) {
        if (s2.toLowerCase().includes(s1.toLowerCase()[i])) matches++;
      }
      return matches / longer.length;
    };

    for (let i = 0; i < transactions.length; i++) {
      const t1 = transactions[i];
      if (checked.has(t1.id)) continue;

      const matchingIds: string[] = [];
      for (let j = i + 1; j < transactions.length; j++) {
        const t2 = transactions[j];
        if (t1.date === t2.date && Math.abs(t1.amount) === Math.abs(t2.amount)) {
          if (similarity(t1.description, t2.description) >= 0.8) {
            matchingIds.push(t2.id);
            checked.add(t2.id);
          }
        }
      }
      if (matchingIds.length > 0) {
        results.push({ id: t1.id, matchingIds });
        checked.add(t1.id);
      }
    }
    return results;
  }, [transactions]);

  const isDuplicate = useCallback((id: string): boolean => {
    return duplicates.some(d => d.id === id || d.matchingIds.includes(id));
  }, [duplicates]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (transactions.length > 0) {
          setTempSaveName(fileState?.name.split('.')[0] || '');
          setIsSaveModalOpen(true);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (transactions.length > 0) downloadCSV();
      }
      if (e.key === 'Escape') {
        if (isSaveModalOpen) setIsSaveModalOpen(false);
        if (confirmDialog?.isOpen) setConfirmDialog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transactions.length, fileState, isSaveModalOpen, confirmDialog]);

  // Load clients from localStorage
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
        console.error('Failed to parse clients:', e);
        const defaultClients = ['株式会社サンプル'];
        setClients(defaultClients);
        setSelectedClient(defaultClients[0]);
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(defaultClients));
      }
    }
  }, []);

  // Reset when client changes
  useEffect(() => {
    if (!selectedClient) return;
    if (!viewingHistoryId) {
      setTransactions([]);
      setFileState(null);
      setFilterText('');
      setScanResult(null);
      setSelectedPage(0);
    }
  }, [selectedClient]);

  // Set base account based on book type
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

  // Reset sub-account when book type changes
  useEffect(() => {
    setSubAccount('');
  }, [bookType, cashAccountType, selectedClient]);

  // Get current client's account master config
  const currentClientMaster = useMemo(() => {
    return accountMasters[selectedClient] || {
      accounts: DEFAULT_ACCOUNTS.map(name => ({ name, subAccounts: [] })),
      ledgerSubAccounts: { cash: [], shortTermLoan: [], deposit: [], credit: [] }
    };
  }, [accountMasters, selectedClient]);

  // Get available ledger sub-accounts
  const availableLedgerSubAccounts = useMemo(() => {
    const ledgerSubAccounts = currentClientMaster.ledgerSubAccounts;
    if (!ledgerSubAccounts) return [];
    switch (bookType) {
      case 'cash':
        return cashAccountType === '現金'
          ? ledgerSubAccounts.cash || []
          : ledgerSubAccounts.shortTermLoan || [];
      case 'deposit': return ledgerSubAccounts.deposit || [];
      case 'credit': return ledgerSubAccounts.credit || [];
      default: return [];
    }
  }, [bookType, cashAccountType, currentClientMaster]);

  // Get available kamoku list
  const availableKamokuList = useMemo(() => {
    return currentClientMaster.accounts.map(a => a.name);
  }, [currentClientMaster]);

  // Get sub-accounts for selected kamoku
  const availableSubKamokuList = useMemo(() => {
    const selectedAccount = currentClientMaster.accounts.find(a => a.name === preSelectedKamoku);
    return selectedAccount?.subAccounts || [];
  }, [currentClientMaster, preSelectedKamoku]);

  // Helper to get sub-accounts for any kamoku
  const getSubAccountsForKamoku = useCallback((kamokuName: string) => {
    const account = currentClientMaster.accounts.find(a => a.name === kamokuName);
    return account?.subAccounts || [];
  }, [currentClientMaster]);

  // All tax categories
  const allTaxCategories = useMemo(() => {
    return [...DEFAULT_TAX_CATEGORIES, ...customTaxCategories];
  }, [customTaxCategories]);

  // ページ選択に基づいて表示するトランザクションを決定（フィルタ前）
  const pageFilteredTransactions = useMemo(() => {
    if (!scanResult?.isMultiPage || selectedPage === 0) {
      // 全ページ表示 or 単一ページ
      return transactions;
    }
    // 選択されたページのトランザクションのIDを取得
    const selectedPageResult = scanResult.pages.find(p => p.pageNumber === selectedPage);
    const pageTransactionIds = new Set(selectedPageResult?.transactions.map(t => t.id) || []);
    // transactionsからページに該当するもののみ返す（編集後の最新状態を反映）
    return transactions.filter(t => pageTransactionIds.has(t.id));
  }, [scanResult, selectedPage, transactions]);

  // ページ選択 + テキスト/フィルタを適用した最終的な表示データ
  const displayFilteredTransactions = useMemo(() => {
    if (!scanResult?.isMultiPage || selectedPage === 0) {
      // 全ページ表示の場合はfilteredTransactionsをそのまま使用
      return filteredTransactions;
    }
    // ページ選択がある場合は、filteredTransactionsをさらにページでフィルター
    const selectedPageResult = scanResult.pages.find(p => p.pageNumber === selectedPage);
    const pageTransactionIds = new Set(selectedPageResult?.transactions.map(t => t.id) || []);
    return filteredTransactions.filter(t => pageTransactionIds.has(t.id));
  }, [scanResult, selectedPage, filteredTransactions]);

  // Monthly chart data
  const monthlyChartData = useMemo(() => {
    const map: Record<string, { month: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, income: 0, expense: 0 };
      if (t.amount > 0) map[m].income += t.amount;
      else map[m].expense += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  // Client handlers
  const handleClientChange = (client: string) => {
    setSelectedClient(client);
    setViewingHistoryId(null);
  };

  const handleAddClient = (name: string) => {
    const updatedClients = [...clients, name];
    setClients(updatedClients);
    setSelectedClient(name);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
    onClientAdd?.(name);
  };

  const handleDeleteClient = (name: string) => {
    if (clients.length <= 1) return;
    showConfirm(`「${name}」を削除しますか？`, () => {
      const updatedClients = clients.filter(c => c !== name);
      setClients(updatedClients);
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updatedClients));
      if (selectedClient === name) setSelectedClient(updatedClients[0]);
      onClientDelete?.(name);
    });
  };

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  }, []);

  // File handlers
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

    if (isCsv) reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  // トランザクションを加工する共通関数
  const processTransactions = useCallback((results: Transaction[]): Transaction[] => {
    return results.map(t => {
      const rule = learningRules[t.description];
      const signedAmount = t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount);
      const isDepositOrCredit = bookType === 'deposit' || bookType === 'credit';
      const effectiveTaxCategory = isDepositOrCredit ? '対象外' : (t.taxCategory || '');
      const effectiveInvoice = isDepositOrCredit ? '非適格' : (t.invoiceNumber || '');

      let effectiveKamoku: string;
      let effectiveSubKamoku: string;
      if (rule?.kamoku) {
        effectiveKamoku = rule.kamoku;
        effectiveSubKamoku = rule.subKamoku || '';
      } else if (aiAutoKamoku && t.kamoku) {
        effectiveKamoku = t.kamoku;
        effectiveSubKamoku = t.subKamoku || '';
      } else {
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
    });
  }, [learningRules, bookType, aiAutoKamoku]);

  // Analysis handler
  const handleGeminiAnalysis = async () => {
    if (!fileState || !geminiApiKey) return;
    if (fileState.type === 'csv') {
      showToast('CSVファイルはAI解析に対応していません。', 'error');
      return;
    }

    setIsAnalyzing(true);
    setMultiPageProgress(null);
    setScanResult(null);
    setSelectedPage(0);

    try {
      // PDFの場合、処理モードに基づいて分割するか判定
      if (fileState.type === 'pdf') {
        const isMultiPage = await isPdfMultiPage(fileState.data);

        // モードに基づいて分割するか決定
        const shouldSplit = pdfProcessMode === 'split' && isMultiPage;

        if (shouldSplit && isMultiPage) {
          // 複数ページPDFの分割処理
          console.log('[Analysis] Multi-page PDF detected, starting page-by-page analysis (mode:', pdfProcessMode, ')');

          const pageResults = await analyzeMultiPagePdf(
            fileState.data,
            geminiApiKey,
            geminiModel,
            aiAutoKamoku,
            (progress) => setMultiPageProgress(progress)
          );

          // 各ページの結果を加工
          const processedPages: PageTransactions[] = pageResults.map(page => ({
            pageNumber: page.pageNumber,
            transactions: processTransactions(page.transactions),
            error: page.error
          }));

          // 全ページの取引を統合
          const allTransactions = processedPages.flatMap(p => p.transactions);

          // ScanResult を設定
          setScanResult({
            isMultiPage: true,
            pages: processedPages,
            transactions: allTransactions
          });

          setTransactions(allTransactions);

          // 結果のサマリー
          const successPages = processedPages.filter(p => !p.error).length;
          const errorPages = processedPages.filter(p => p.error).length;
          const totalTxns = allTransactions.length;

          if (errorPages > 0) {
            showToast(`${successPages}ページ成功、${errorPages}ページでエラーが発生しました（計${totalTxns}件）`, 'warning');
          } else {
            showToast(`${processedPages.length}ページから${totalTxns}件の取引を抽出しました！`, 'success');
          }

          setMultiPageProgress(null);
          return;
        }
      }

      // 単一ページまたは画像の場合（従来の処理）
      const results = await analyzeWithGemini(
        fileState.data,
        fileState.mimeType,
        geminiApiKey,
        geminiModel,
        aiAutoKamoku
      );

      const processedTransactions = processTransactions(results);

      // 単一ページの結果を設定
      setScanResult({
        isMultiPage: false,
        pages: [{
          pageNumber: 1,
          transactions: processedTransactions
        }],
        transactions: processedTransactions
      });

      setTransactions(processedTransactions);

      // Check for duplicates and warn
      if (duplicates.length > 0) {
        showToast(`${duplicates.length}件の重複の可能性がある取引があります。`, 'warning');
      } else {
        showToast('AI自動解析が完了しました！', 'success');
      }
    } catch (error) {
      console.error('[Gemini Analysis] Error:', error);
      if (error instanceof AnalysisError) {
        showToast(error.message, 'error');
      } else {
        showToast(`解析中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
      setMultiPageProgress(null);
    }
  };

  // Transaction handlers
  const updateTransaction = (id: string, field: keyof Transaction, value: any) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    if (field === 'kamoku' || field === 'subKamoku') {
      const target = transactions.find(t => t.id === id);
      if (target?.description) {
        updateRule(
          target.description,
          field === 'kamoku' ? value : (target.kamoku || ''),
          field === 'subKamoku' ? value : (target.subKamoku || '')
        );
      }
    }
  };

  const toggleTransactionSign = (id: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        amount: -t.amount,
        toggled: !t.toggled,
        kamoku: t.kamoku === '仮払金' ? '仮受金' : t.kamoku === '仮受金' ? '仮払金' : t.kamoku
      };
    }));
  };

  const deleteTransaction = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;
    if (!window.confirm(`「${target.date} ${target.description}」を削除しますか？`)) return;

    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('取引を削除しました', 'success', {
      label: '元に戻す',
      onClick: () => {
        setTransactions(prev => [...prev, target]);
        showToast('取引を復活しました', 'success');
      }
    });
  };

  // Batch edit handlers
  const toggleTransactionSelection = (id: string) => {
    const newSet = new Set(selectedTransactionIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTransactionIds(newSet);
  };

  const selectAllTransactions = () => {
    if (selectedTransactionIds.size === displayFilteredTransactions.length) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(displayFilteredTransactions.map(t => t.id)));
    }
  };

  const applyBatchEdit = () => {
    if (selectedTransactionIds.size === 0) return;

    setTransactions(prev => prev.map(t => {
      if (!selectedTransactionIds.has(t.id)) return t;
      const updates: Partial<Transaction> = {};
      if (batchKamoku) {
        updates.kamoku = batchKamoku;
        if (t.description) {
          updateRule(t.description, batchKamoku, batchSubKamoku || t.subKamoku || '');
        }
      }
      if (batchSubKamoku) updates.subKamoku = batchSubKamoku;
      if (batchTaxCategory) updates.taxCategory = batchTaxCategory;
      if (batchInvoice) updates.invoiceNumber = batchInvoice;
      return { ...t, ...updates };
    }));

    showToast(`${selectedTransactionIds.size}件の取引を更新しました`, 'success');
    cancelBatchEdit();
  };

  const cancelBatchEdit = () => {
    setSelectedTransactionIds(new Set());
    setBatchKamoku('');
    setBatchSubKamoku('');
    setBatchTaxCategory('');
    setBatchInvoice('');
    setIsBatchEditMode(false);
  };

  // Save handler
  const handleSaveToHistory = () => {
    if (transactions.length === 0 || !tempSaveName.trim()) return;

    const result = saveToHistory(
      transactions,
      selectedClient,
      tempSaveName.trim(),
      fileState?.previewUrl || null,
      fileState?.type || 'image'
    );

    setIsSaveModalOpen(false);
    setTempSaveName('');

    if (result.quotaExceeded) {
      showToast('ストレージ容量が不足しています。古い履歴を削除してから再度お試しください。', 'error');
    } else if (result.batch) {
      showToast('履歴を保存しました！', 'success');
    }
  };

  // History handlers
  const handleLoadHistory = (batch: HistoryBatch) => {
    setTransactions(batch.transactions);
    setSelectedClient(batch.client);
    setViewingHistoryId(batch.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSelectedHistory = () => {
    if (selectedHistoryIds.size === 0) return;
    showConfirm(`${selectedHistoryIds.size}件の履歴を削除しますか？`, () => {
      const count = deleteSelectedHistory();
      showToast(`${count}件の履歴を削除しました`, 'success');
    });
  };

  // CSV Injection対策: 値をエスケープする関数
  const escapeCsvValue = (value: string | number): string => {
    if (typeof value === 'number') return String(value);
    if (!value) return '';
    const str = String(value);
    // カンマ、改行、ダブルクォート、または式の先頭記号（=, +, -, @）を含む場合はエスケープ
    if (str.match(/[",\n\r]/) || /^[=+\-@]/.test(str)) {
      // 式の先頭記号がある場合は先頭にシングルクォートを追加してExcel式攻撃を防止
      const escaped = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${escaped.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // CSV download
  const downloadCSV = () => {
    const headers = ["取引日", "借方勘定科目", "借方補助科目", "借方金額", "貸方勘定科目", "貸方補助科目", "貸方金額", "摘要", "インボイス区分", "税区分"];
    const rows = transactions.map(t => {
      const amount = Math.abs(t.amount);
      const isExpense = t.amount < 0;
      const effectiveKamoku = preSelectedKamoku || t.kamoku || (isExpense ? "仮払金" : "仮受金");
      const effectiveSubKamoku = preSelectedSubKamoku || t.subKamoku || "";
      const effectiveTaxCategory = t.taxCategory || '';

      return [
        escapeCsvValue(t.date),
        escapeCsvValue(isExpense ? effectiveKamoku : baseAccount),
        escapeCsvValue(isExpense ? effectiveSubKamoku : subAccount),
        amount,
        escapeCsvValue(isExpense ? baseAccount : effectiveKamoku),
        escapeCsvValue(isExpense ? subAccount : effectiveSubKamoku),
        amount,
        escapeCsvValue(t.description),
        escapeCsvValue(t.invoiceNumber || ""),
        escapeCsvValue(effectiveTaxCategory)
      ].join(",");
    });

    const blob = new Blob(
      [new Uint8Array([0xEF, 0xBB, 0xBF]), headers.join(",") + "\n" + rows.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `MF_${tempSaveName || selectedClient}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Client Selector */}
      <ClientSelector
        clients={clients}
        selectedClient={selectedClient}
        onClientChange={handleClientChange}
        onClientAdd={handleAddClient}
        onClientDelete={handleDeleteClient}
        isMobile={isMobile}
      />

      <div className="space-y-6">
        {/* Settings Section */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            {selectedClient} の帳簿設定
            <HelpTip text="証憑の種類に応じて元帳を選択してください。選択した元帳が仕訳の貸方/借方に自動設定されます。" />
          </h2>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Book Type Selection */}
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

            {/* Sub-account Selection */}
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

          {/* Pre-selection for Kamoku/SubKamoku (Accordion) */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                CSV出力時の勘定科目（事前選択）
                <HelpTip text="全取引に同じ勘定科目を設定する場合に便利です。例：経費精算でほぼ全て旅費交通費の場合など。" />
              </h3>
              <div className="flex items-center gap-2">
                {preSelectedKamoku && (
                  <span className="text-xs text-orange-600">
                    {preSelectedKamoku}{preSelectedSubKamoku ? ` / ${preSelectedSubKamoku}` : ''}
                  </span>
                )}
                {isSettingsExpanded ? (
                  <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400 transition-transform" />
                )}
              </div>
            </button>
            {isSettingsExpanded && (
            <>
            <p className="text-xs text-slate-500 mb-4 mt-3">
              ここで選択した科目が、CSV出力時にすべての取引に適用されます（空欄の場合は個別設定が使われます）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手勘定科目</label>
                <div className="flex items-center gap-2">
                  <Combobox
                    value={preSelectedKamoku}
                    onChange={(value) => {
                      setPreSelectedKamoku(value);
                      setPreSelectedSubKamoku('');
                    }}
                    options={availableKamokuList}
                    placeholder="入力して検索 または 選択..."
                    className="flex-1"
                  />
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">相手補助科目</label>
                <div className="flex items-center gap-2">
                  <Combobox
                    value={preSelectedSubKamoku}
                    onChange={setPreSelectedSubKamoku}
                    options={availableSubKamokuList}
                    placeholder={availableSubKamokuList.length > 0 ? "入力して検索 または 選択..." : "自由入力（マスタ未登録）"}
                    className="flex-1"
                    allowFreeInput={availableSubKamokuList.length === 0}
                  />
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
            </>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        <FileUploadSection
          fileState={fileState}
          onFileChange={processFile}
          onFileClear={() => { setFileState(null); setScanResult(null); setSelectedPage(0); }}
          viewingHistoryId={viewingHistoryId}
          viewingHistoryName={history.find(h => h.id === viewingHistoryId)?.name}
          onExitHistoryView={() => { setViewingHistoryId(null); setTransactions([]); setScanResult(null); setSelectedPage(0); }}
          geminiApiKey={geminiApiKey}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleGeminiAnalysis}
          aiAutoKamoku={aiAutoKamoku}
          onAiAutoKamokuChange={setAiAutoKamoku}
          transactionCount={transactions.length}
          multiPageProgress={multiPageProgress}
          pdfProcessMode={pdfProcessMode}
          onPdfProcessModeChange={setPdfProcessMode}
          bookType={bookType}
        />

        {/* Page Tabs for Multi-Page PDF */}
        {scanResult?.isMultiPage && transactions.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-slate-700">ページ別表示</span>
              <span className="text-xs text-slate-500">
                （{scanResult.pages.length}ページ、計{transactions.length}件）
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedPage(0)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedPage === 0
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全ページ ({transactions.length}件)
              </button>
              {scanResult.pages.map((page) => (
                <button
                  key={page.pageNumber}
                  onClick={() => setSelectedPage(page.pageNumber)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                    selectedPage === page.pageNumber
                      ? 'bg-orange-500 text-white shadow-sm'
                      : page.error
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  P{page.pageNumber}
                  <span className={`text-xs ${selectedPage === page.pageNumber ? 'text-orange-100' : ''}`}>
                    ({page.transactions.length}件)
                  </span>
                  {page.error && <AlertCircle className="w-3 h-3 text-red-500" />}
                </button>
              ))}
            </div>
            {/* 選択中のページにエラーがある場合の詳細表示 */}
            {selectedPage > 0 && scanResult.pages.find(p => p.pageNumber === selectedPage)?.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">ページ{selectedPage}でエラーが発生しました</span>
                </div>
                <p className="mt-1 text-xs text-red-600">
                  {scanResult.pages.find(p => p.pageNumber === selectedPage)?.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {transactions.length > 0 && (
          <div className="space-y-6">
            <ChartSection data={monthlyChartData} />

            <TransactionTable
              transactions={pageFilteredTransactions}
              filteredTransactions={displayFilteredTransactions}
              isMobile={isMobile}
              onUpdateTransaction={updateTransaction}
              onToggleSign={toggleTransactionSign}
              onDeleteTransaction={deleteTransaction}
              availableKamokuList={availableKamokuList}
              getSubAccountsForKamoku={getSubAccountsForKamoku}
              allTaxCategories={allTaxCategories}
              learningRules={learningRules}
              filterText={filterText}
              onFilterTextChange={setFilterText}
              filters={filters}
              onFilterChange={updateFilter}
              filterOptions={filterOptions}
              showFilterPanel={showFilterPanel}
              onToggleFilterPanel={() => setShowFilterPanel(!showFilterPanel)}
              hasActiveFilters={hasActiveFilters}
              onClearAllFilters={clearAllFilters}
              isBatchEditMode={isBatchEditMode}
              onToggleBatchEditMode={() => setIsBatchEditMode(!isBatchEditMode)}
              selectedTransactionIds={selectedTransactionIds}
              onToggleTransactionSelection={toggleTransactionSelection}
              onSelectAllTransactions={selectAllTransactions}
              batchKamoku={batchKamoku}
              setBatchKamoku={setBatchKamoku}
              batchSubKamoku={batchSubKamoku}
              setBatchSubKamoku={setBatchSubKamoku}
              batchTaxCategory={batchTaxCategory}
              setBatchTaxCategory={setBatchTaxCategory}
              batchInvoice={batchInvoice}
              setBatchInvoice={setBatchInvoice}
              onApplyBatchEdit={applyBatchEdit}
              onCancelBatchEdit={cancelBatchEdit}
              onSave={() => {
                setTempSaveName(fileState?.name.split('.')[0] || '');
                setIsSaveModalOpen(true);
              }}
              onDownloadCSV={downloadCSV}
              isDuplicate={isDuplicate}
            />
          </div>
        )}

        {/* History Section */}
        <HistorySection
          history={history}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => setIsSelectionMode(true)}
          selectedHistoryIds={selectedHistoryIds}
          onToggleHistorySelection={toggleHistorySelection}
          onDeleteSelected={handleDeleteSelectedHistory}
          onCancelSelection={exitSelectionMode}
          onLoadHistory={handleLoadHistory}
        />
      </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-xl animate-bounce-in">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <BookmarkPlus className="text-orange-600" />証憑保存
            </h3>
            <p className="text-sm text-slate-500 mb-5">後から確認しやすい名前を付けてください。</p>
            <input
              autoFocus
              value={tempSaveName}
              onChange={e => setTempSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveToHistory()}
              placeholder="例: 11月分ガソリン代"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 mb-5 font-medium"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="flex-1 py-2.5 text-slate-500 font-medium hover:bg-slate-50 rounded-lg transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveToHistory}
                disabled={!tempSaveName.trim()}
                className={`flex-1 py-2.5 rounded-lg font-medium text-white transition-all ${!tempSaveName.trim() ? 'bg-slate-200' : 'bg-orange-600 hover:bg-orange-700 active:scale-[0.99]'}`}
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" role="alertdialog" aria-modal="true">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-xl animate-bounce-in">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center gap-2">
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
      {toasts.map((toast) => (
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
