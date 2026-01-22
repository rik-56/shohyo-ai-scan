
export interface Transaction {
  id: string;
  date: string; // YYYY/MM/DD
  description: string;
  amount: number;
  type: 'income' | 'expense';
  memo?: string;
  kamoku?: string; // Opposite Account Item (相手勘定科目)
  subKamoku?: string; // Opposite Sub-Account Item (相手補助科目)
  invoiceNumber?: string; // T番号 (インボイス番号)
  taxCategory?: string; // 税区分（課税仕入10%、軽減8%など）
}

// 勘定科目と紐づく補助科目
export type AccountWithSubAccounts = {
  name: string;           // 勘定科目名
  subAccounts: string[];  // 補助科目リスト
};

// 元帳種別ごとの補助科目（複数対応）
export type LedgerSubAccounts = {
  cash: string[];           // 現金の補助科目リスト
  shortTermLoan: string[];  // 短期借入金の補助科目リスト
  deposit: string[];        // 普通預金の補助科目リスト
  credit: string[];         // 未払金の補助科目リスト
};

// 拡張された勘定科目マスタ（会社別）
export type AccountMasterConfig = {
  accounts: AccountWithSubAccounts[];  // 勘定科目+補助科目
  ledgerSubAccounts: LedgerSubAccounts; // 元帳補助科目
};

export type AccountMasterMap = Record<string, AccountMasterConfig>;

export interface HistoryBatch {
  id: string;
  timestamp: number;
  client: string;
  name: string; // 追加: 保存名
  transactions: Transaction[];
  totalAmount: number;
  count: number;
  previewUrl?: string | null; // 追加: 証憑のプレビュー画像
  fileType?: 'image' | 'pdf' | 'csv'; // 追加: ファイル形式
}

export enum AppTab {
  SCANNER = 'scanner',
  MASTER = 'master'
}
