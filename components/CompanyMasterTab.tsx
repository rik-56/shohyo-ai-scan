import React, { useState, useEffect } from 'react';
import { Settings, Plus, X, Briefcase, BookOpen, ChevronDown, ChevronRight, Coins, Landmark, CreditCard, GraduationCap, Trash2 } from 'lucide-react';
import { AccountMasterConfig, AccountMasterMap, AccountWithSubAccounts, LearningRulesMap } from '../types';
import { DEFAULT_ACCOUNTS } from '../constants';

interface CompanyMasterTabProps {
  clients: string[];
  accountMasters: AccountMasterMap;
  onAccountMasterChange: (clientName: string, config: AccountMasterConfig) => void;
  allLearningRules: Record<string, LearningRulesMap>;
  onLearningRulesChange: (clientName: string, rules: LearningRulesMap) => void;
}

export const CompanyMasterTab: React.FC<CompanyMasterTabProps> = ({
  clients,
  accountMasters,
  onAccountMasterChange,
  allLearningRules,
  onLearningRulesChange
}) => {
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
    const accountName = currentClientConfig.accounts[index]?.name || '';
    if (!confirm(`勘定科目「${accountName}」を削除しますか？`)) return;
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
    if (!confirm(`補助科目「${subAccountName}」を削除しますか？`)) return;
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
    if (!confirm(`元帳補助科目「${value}」を削除しますか？`)) return;
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
                <p className="text-xs text-slate-600 mb-4">
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
                            <div className="text-xs text-slate-600 mb-2">補助科目リスト</div>
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
                  <p className="text-sm text-slate-600 mb-4">
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

      {/* Learning Rules Management Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-orange-600" />
          学習ルール管理（会社別）
        </h2>

        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            スキャン画面で勘定科目を設定すると、摘要（店名等）に基づいて自動で学習ルールが保存されます。
            次回同じ摘要が出てきた際に自動で勘定科目が設定されます。
          </p>

          {/* Company Selection for Learning Rules */}
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-3">会社を選択</h3>
            <div className="flex flex-wrap gap-2">
              {clients.map(client => (
                <button
                  key={client}
                  onClick={() => setSelectedClient(client)}
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-600">
                  「{selectedClient}」の学習ルール
                </h3>
                {allLearningRules[selectedClient] && Object.keys(allLearningRules[selectedClient]).length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`「${selectedClient}」のすべての学習ルールを削除しますか？`)) {
                        onLearningRulesChange(selectedClient, {});
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg border border-red-200 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    全削除
                  </button>
                )}
              </div>

              {allLearningRules[selectedClient] && Object.keys(allLearningRules[selectedClient]).length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600">摘要</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600">勘定科目</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-600">補助科目</th>
                        <th className="w-16 px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.entries(allLearningRules[selectedClient]) as [string, { kamoku: string; subKamoku: string }][]).map(([description, rule]) => (
                        <tr key={description} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate" title={description}>
                            {description}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {rule.kamoku || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {rule.subKamoku || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => {
                                if (!confirm(`学習ルール「${description}」を削除しますか？`)) return;
                                const { [description]: _, ...rest } = allLearningRules[selectedClient];
                                onLearningRulesChange(selectedClient, rest);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              aria-label={`${description}のルールを削除`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
                  学習ルールはまだありません。スキャン画面で勘定科目を設定すると自動で保存されます。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
