# 仕訳アシスタント

レシートや領収書の写真を撮るだけで、AIが自動的に仕訳データを作成する会計補助アプリです。

## アプリURL

**https://shohyo-ai-scan.vercel.app/**

スマホ・PCどちらからでもアクセスできます。

## 主な機能

- レシート・領収書・PDFをAIで自動解析
- 勘定科目の編集・学習機能
- Money Forward互換CSVの出力
- 複数クライアント（会社）の管理
- 月別収支グラフの表示
- 出力履歴の保存・管理

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19 |
| ビルドツール | Vite 6 |
| 言語 | TypeScript |
| AI API | Google Gemini API |
| スタイル | Tailwind CSS |
| グラフ | Recharts |
| ホスティング | Vercel |

## 開発

### ローカルで実行

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### ビルド

```bash
npm run build
```

## ドキュメント

- [使い方ガイド](docs/使い方ガイド.md) - スマホ向けの操作説明
- [CLAUDE.md](CLAUDE.md) - プロジェクト技術仕様

## ライセンス

Private
