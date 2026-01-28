# 仕訳アシスタント - プロジェクト概要

## アプリURL
https://shohyo-ai-scan.vercel.app/

## 概要
レシート・領収書・PDF等の証憑をAIで読み取り、Money Forward互換CSVとして出力する会計補助アプリ

## 技術スタック
- React 19 + TypeScript
- Vite 6
- Tailwind CSS (CDN)
- Google Gemini API
- Recharts (グラフ)
- Vercel (ホスティング)

## ファイル構成
```
scan/
├── App.tsx                 # メインアプリ（タブ管理、設定状態）
├── index.html              # HTMLエントリー
├── index.tsx               # Reactエントリー
├── types.ts                # 型定義（Transaction, HistoryBatch, AppTab, PageTransactions, ScanResult）
├── components/
│   ├── scanner/
│   │   ├── ScannerTab.tsx      # スキャン機能（メイン画面）
│   │   ├── FileUploadSection.tsx  # ファイルアップロード・解析UI
│   │   ├── TransactionTable.tsx   # 取引一覧テーブル
│   │   ├── HistorySection.tsx     # 履歴管理
│   │   └── ...
│   ├── MasterTab.tsx       # 設定タブ
│   └── Toast.tsx           # 通知コンポーネント
├── services/
│   ├── geminiService.ts    # Gemini API連携、モデル定義、マルチページ処理
│   └── pdfUtils.ts         # PDF分割・画像化ユーティリティ
└── docs/
    ├── 使い方ガイド.md
    └── 使い方ガイド.html
```

## 主要機能

### 元帳種別（ScannerTab.tsx）
| 種別 | 基本科目 | 税区分デフォルト | インボイスデフォルト |
|------|---------|-----------------|-------------------|
| 現金 | 現金 or 短期借入金（選択可） | AIが判定 | AIが判定 |
| 預金 | 普通預金 | 対象外 | 非適格 |
| クレカ | 未払金 | 対象外 | 非適格 |

### 元帳補助科目（LedgerSubAccounts）
| キー | 用途 | 説明 |
|------|------|------|
| cash | 現金 | 現金の補助科目リスト |
| shortTermLoan | 短期借入金 | 短期借入金の補助科目リスト |
| deposit | 普通預金 | 普通預金の補助科目リスト |
| credit | 未払金 | 未払金の補助科目リスト |

### AIモデル（geminiService.ts）
| モデルID | 名称 | 説明 |
|----------|------|------|
| gemini-3-flash-preview | Gemini 3 Flash | 無料・最新・高速（デフォルト・おすすめ） |
| gemini-2.5-flash | Gemini 2.5 Flash | 無料・高速・安定版 |
| gemini-2.5-flash-lite | Gemini 2.5 Flash-Lite | 無料・最速 |
| gemini-2.5-pro | Gemini 2.5 Pro | 有料・高精度 |
| gemini-3-pro-preview | Gemini 3 Pro | 有料・最新・最高精度 |

### インボイス区分（ScannerTab.tsx）
プルダウン選択式（select要素）
| 値 | 表示 |
|----|------|
| "" | 未選択 |
| "適格" | 適格 |
| "非適格" | 非適格 |

### 税区分リスト（ScannerTab.tsx DEFAULT_TAX_CATEGORIES）
- 課税売上 10%
- 課税売上 (軽)8%
- 課税仕入 10%
- 課税仕入 (軽)8%
- 対象外仕入
- 非課税仕入
- 対象外

### UI表示ルール
- 相手勘定科目の色: 支払（負の金額）= 赤、入金（正の金額）= 青
- 金額の色: 支払 = 赤、入金 = 青

### 大容量PDF対応（複数ページ分割スキャン）
- 複数ページのPDFは自動的にページごとに分割して解析
- ページタブで各ページの結果を切り替え表示
- 「全ページ」タブで統合表示
- 解析中は進捗バーでページ処理状況を表示
- 各ページで最大3回リトライ（レート制限・ネットワークエラー時）
- 一部ページがエラーでも他ページは正常に処理続行

## データ型

```typescript
interface Transaction {
  id: string;
  date: string;           // YYYY/MM/DD
  description: string;    // 摘要（店名）
  amount: number;         // 符号付き金額
  type: 'income' | 'expense';
  kamoku?: string;        // 勘定科目
  subKamoku?: string;     // 補助科目
  invoiceNumber?: string; // 適格/非適格
  taxCategory?: string;   // 税区分
}
```

## LocalStorageキー
- `kakeibo_ai_gemini_api_key` - APIキー
- `kakeibo_ai_gemini_model` - 選択モデル
- `kakeibo_ai_clients` - クライアント一覧
- `kakeibo_ai_accounts_[クライアント名]` - 勘定科目マスタ（LedgerSubAccounts含む）
- `kakeibo_ai_rules_[クライアント名]` - 学習ルール
- `kakeibo_ai_history` - 履歴
- `kakeibo_ai_custom_tax_categories` - カスタム税区分

## 開発コマンド
```bash
npm install     # 依存関係インストール
npm run dev     # 開発サーバー起動
npm run build   # ビルド
npx tsc --noEmit # 型チェック
```

## デプロイ
GitHub (rik-56/shohyo-ai-scan) → Vercel 自動デプロイ
