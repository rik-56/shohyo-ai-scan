
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
