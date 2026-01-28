// 勘定科目のデフォルトリスト
export const DEFAULT_ACCOUNTS = [
  '旅費交通費', '消耗品費', '接待交際費', '通信費', '水道光熱費',
  '地代家賃', '租税公課', '保険料', '広告宣伝費', '支払手数料',
  '会議費', '福利厚生費', '新聞図書費', '修繕費', '外注費',
  '仮払金', '仮受金', '売掛金', '買掛金'
];

// 税区分のデフォルトリスト
export const DEFAULT_TAX_CATEGORIES = [
  '課税売上 10%',
  '課税売上 (軽)8%',
  '課税仕入 10%',
  '課税仕入 (軽)8%',
  '対象外仕入',
  '非課税仕入',
  '対象外'
];

// UI カラーパレット
export const UI_COLORS = {
  // 収支の色
  expense: {
    text: 'text-red-700',
    textStrong: 'text-red-700 font-semibold',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  income: {
    text: 'text-blue-700',
    textStrong: 'text-blue-700 font-semibold',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  // テーブルスタイル
  table: {
    header: 'bg-slate-100 text-slate-700 font-semibold',
    headerSticky: 'bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10',
    rowHover: 'hover:bg-orange-50/50',
    rowToggled: 'bg-amber-50 border-l-4 border-l-amber-400',
    rowToggledHover: 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400',
  },
  // ボタンスタイル
  button: {
    primary: 'bg-orange-600 hover:bg-orange-700 text-white font-medium',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300',
    success: 'bg-green-600 hover:bg-green-700 text-white font-medium',
    danger: 'bg-red-600 hover:bg-red-700 text-white font-medium',
  },
  // 状態表示
  status: {
    success: 'text-green-700 bg-green-50 border-green-200',
    error: 'text-red-700 bg-red-50 border-red-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  // 学習済みマーク
  learned: {
    icon: 'text-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
} as const;
