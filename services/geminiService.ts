import { Transaction, PageTransactions } from "../types";
import { PageImage, extractPdfPages, getPdfPageCount } from "./pdfUtils";

// Error codes for manual mode and API mode
export type AnalysisErrorCode = 'INVALID_RESPONSE' | 'API_KEY_INVALID' | 'RATE_LIMITED' | 'API_ERROR' | 'FILE_TOO_LARGE' | 'NETWORK_ERROR';

export class AnalysisError extends Error {
  code: AnalysisErrorCode;

  constructor(code: AnalysisErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AnalysisError';
  }
}

export const errorMessages: Record<AnalysisErrorCode, string> = {
  'INVALID_RESPONSE': '解析結果の形式が不正です。再試行してください。',
  'API_KEY_INVALID': 'APIキーが無効です。設定を確認してください。',
  'RATE_LIMITED': 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
  'API_ERROR': 'API呼び出しエラーが発生しました。',
  'FILE_TOO_LARGE': 'ファイルサイズが大きすぎます。50MB以下のファイルを使用してください。',
  'NETWORK_ERROR': 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
};

// Maximum file size in bytes (50MB)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Estimates the original file size from base64 encoded data.
 * Base64 encoding increases size by approximately 33%.
 */
export const estimateFileSizeFromBase64 = (base64Data: string): number => {
  // Remove padding and calculate
  const padding = (base64Data.match(/=/g) || []).length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
};

// Helper to normalize date to YYYY/MM/DD
const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return "";

  // Replace commonly used separators with slashes
  let normalized = dateStr.replace(/[\.\-年]/g, '/').replace(/月/g, '/').replace(/日/g, '');

  // Attempt to parse standard formats
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const y = parts[0].trim();
    const m = parts[1].trim().padStart(2, '0');
    const d = parts[2].trim().padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  return dateStr; // Return original if parsing fails
};

/**
 * Returns the analysis prompt for manual AI mode.
 * Users can copy this prompt and paste it into ChatGPT/Claude web interface.
 * @param autoKamoku - If true, AI will guess account items; otherwise returns null
 */
export const getAnalysisPrompt = (autoKamoku: boolean = false): string => {
  const kamokuInstruction = autoKamoku
    ? `4. **Account Item (勘定科目) - AI推測モード**:
   - 店舗名・サービス名から最も適切な勘定科目を推測してください。
   - 以下のキーワードと金額ルールを参考に判定してください。

   **【経費の勘定科目と判定キーワード】**

   **旅費交通費** - 交通・移動関連:
     - 鉄道: JR, 新幹線, 私鉄, 地下鉄, メトロ, 駅, PASMO, Suica, ICOCA, manaca, TOICA
     - タクシー: タクシー, Uber, DiDi, GO, S.RIDE, 第一交通, 日本交通, MKタクシー
     - 航空: ANA, JAL, 航空券, 空港, ピーチ, ジェットスター, スカイマーク
     - 車両: 駐車場, コインパーキング, 高速道路, ETC, 有料道路
     - ガソリン: ENEOS, 出光, コスモ石油, 昭和シェル, キグナス, 宇佐美, ガソリン

   **消耗品費** - 日用品・事務用品:
     - コンビニ: セブンイレブン, ローソン, ファミリーマート, ミニストップ, デイリーヤマザキ, セイコーマート, NewDays
     - 100円ショップ: ダイソー, セリア, キャンドゥ, 100均, ワッツ
     - 文具・事務用品: 文房具, コクヨ, アスクル, カウネット, オフィスデポ
     - EC・家電: Amazon, 楽天, ヨドバシ, ビックカメラ, ケーズデンキ, エディオン, ジョーシン, コジマ
     - ホームセンター: カインズ, コーナン, DCM, ビバホーム, ロイヤル, ナフコ
     - ドラッグストア: マツキヨ, ウエルシア, ツルハ, サンドラッグ, スギ薬局, ココカラ

   **会議費** - 打ち合わせ・軽食 (金額 ≤5,000円の飲食):
     - カフェ: スターバックス, ドトール, タリーズ, コメダ, 珈琲館, ベローチェ, サンマルク, プロント, 喫茶店, カフェ
     - ファミレス: ガスト, サイゼリヤ, デニーズ, ジョナサン, ロイヤルホスト, ジョイフル, ココス
     - ファストフード: マクドナルド, モスバーガー, ケンタッキー, 吉野家, 松屋, すき家, なか卯, CoCo壱

   **接待交際費** - 接待・贈答 (金額 >5,000円の飲食、またはギフト):
     - 居酒屋: 居酒屋, 酒場, 焼鳥, 串カツ, 鳥貴族, 和民, 魚民, 塚田農場, 八剣伝
     - 高級飲食: 焼肉, 寿司, 鮨, 料亭, 割烹, 懐石, フレンチ, イタリアン, 中華料理, ステーキ
     - バー・クラブ: バー, Bar, スナック, クラブ, ラウンジ
     - 贈答品: お中元, お歳暮, 贈答品, ギフト, 手土産, お土産, 菓子折り, 花束, 胡蝶蘭

   **通信費** - 通信・郵送:
     - 通信: NTT, ドコモ, au, KDDI, ソフトバンク, 楽天モバイル, ワイモバイル, UQ, mineo
     - インターネット: フレッツ, 光回線, プロバイダ, OCN, So-net, BIGLOBE
     - 郵送: 郵便局, 日本郵便, レターパック, ゆうパック, 切手, はがき
     - 宅配: ヤマト運輸, 佐川急便, 宅急便, クロネコ

   **水道光熱費** - 公共料金:
     - 電力: 東京電力, 関西電力, 中部電力, 東北電力, 九州電力, 北海道電力, 電気代
     - ガス: 東京ガス, 大阪ガス, 東邦ガス, 西部ガス, ガス代
     - 水道: 水道局, 水道代

   **支払手数料** - 金融・決済手数料:
     - 銀行: 振込手数料, ATM手数料, 銀行手数料, 送金手数料
     - 決済: PayPay, LINE Pay, 楽天ペイ, メルペイ, d払い, au PAY
     - カード: クレジットカード年会費, カード手数料

   **新聞図書費** - 書籍・新聞:
     - 書店: 紀伊國屋, 丸善, ジュンク堂, TSUTAYA, 三省堂, 有隣堂
     - 電子書籍: Kindle, 楽天Kobo, honto
     - 新聞: 日経, 読売, 朝日, 毎日, 産経, 新聞

   **福利厚生費** - 従業員福利:
     - フィットネス: スポーツジム, フィットネス, ティップネス, コナミ, ルネサンス, ゴールドジム
     - 健康: 健康診断, 人間ドック, 社員食堂

   **広告宣伝費** - 広告・宣伝:
     - Web広告: Google広告, Facebook広告, Instagram広告, Twitter広告, Yahoo広告, LINE広告
     - 印刷: チラシ, ポスター, パンフレット, 名刺印刷

   **地代家賃** - 賃貸:
     - 家賃, 賃料, 共益費, 管理費, 駐車場代（月極）

   **租税公課** - 税金・公的費用:
     - 印紙, 収入印紙, 登録免許税, 自動車税, 固定資産税

   **保険料** - 保険:
     - 生命保険, 損害保険, 火災保険, 自動車保険

   **修繕費** - 修理・メンテナンス:
     - 修理, 修繕, メンテナンス, 点検

   **外注費** - 外部委託:
     - 外注, 業務委託, 制作費

   **【金額ベースの判定ルール】**
   - 飲食店で ≤5,000円 → 会議費
   - 飲食店で >5,000円 → 接待交際費
   - ギフト・贈答品・手土産 → 接待交際費（金額問わず）
   - コンビニで ≤1,000円 → 消耗品費（日用品購入と推定）
   - コンビニで >1,000円 → 会議費（飲食物購入と推定）

   **【収益の勘定科目】**
   - 売上高: 売上, 売上入金, 代金回収, 請求書入金
   - 受取利息: 利息, 利子
   - 雑収入: 還付金, キャッシュバック, ポイント還元

   **【禁止科目】**
   - 「雑費」「雑支出」「その他」「経費」→ 使用禁止

   **【重要】判定できない場合のフォールバック**:
   - 経費で判定できない場合 → 必ず「仮払金」を使用
   - 収益で判定できない場合 → 必ず「仮受金」を使用
   - 曖昧なカテゴリを推測するよりも、仮払金/仮受金を使用してください。`
    : `4. **Account Item (勘定科目)**:
   - **STRICT RULE**: Return NULL (or empty string) for ALL transactions.
   - Do not attempt to guess the account item (e.g., do not guess "Travel Expense" for a taxi).
   - The application logic handles defaults.`;

  return `You are an expert accountant AI. Analyze this document (Image, PDF, or CSV text) of a bank book, receipt, or credit card statement and extract transactions.

Instructions:
1. **Date (CRITICAL)**:
   - Extract in YYYY/MM/DD format.
   - **Receipts/Handwriting**: Look very carefully for the date. It might be faint or handwritten.
   - **Japanese Eras**: You MUST convert Japanese years correctly.
     - 'R' or '令和' is Reiwa. (R1=2019, R2=2020, R3=2021, R4=2022, R5=2023, R6=2024, R7=2025).
     - 'H' or '平成' is Heisei. (H30=2018, H31=2019).
   - **Missing Year**: If the date is written as "12/05" without a year, look for a year printed elsewhere on the receipt (e.g., top or bottom). If absolutely no year is found, assume the current year, but prioritize finding the printed year.

2. **Description (摘要) - CRITICAL**:
   - **For Receipts/領収書**: You MUST use the STORE NAME (店名) as the description.
     - Look at the TOP of the receipt for the store/company name (e.g., "セブンイレブン", "ローソン", "スターバックス コーヒー", "吉野家")
     - NEVER use product names, item names, or what was purchased (e.g., "コーヒー", "おにぎり", "牛丼")
     - Keep it concise: store name only, no address, phone number, or branch name
   - **For Bank/Credit Card Statements**: Extract the merchant/payee name exactly as it appears.
   - Examples of CORRECT descriptions: "セブンイレブン", "Amazon", "楽天市場", "ENEOS"
   - Examples of WRONG descriptions: "コーヒー", "書籍代", "ガソリン代", "食料品"

3. **Amount & Type (CRITICAL)**:
   - **Credit Card Statements**: Almost ALL transactions are 'expense'. Only mark as 'income' if it is explicitly a "Refund" (返金) or "Rebate".
   - **Bank Books (PDF/Image)**:
     - Locate the table headers. Look for "支払金額", "出金", "お支払い" (Payment/Withdrawal). These are 'expense'.
     - Look for "預り金額", "入金", "お預り" (Deposit/Income). These are 'income'.
     - If the table has two Amount columns, determining which is which is CRITICAL. Usually, the Left numerical column is Expense (Withdrawal), and the Right is Income (Deposit), OR verify via the header row.
     - If parsing a PDF, pay strict attention to the X-coordinate alignment of numbers to determine the column.
   - **Receipts**:
     - Always 'expense'.
     - **Amount Detection**: Look for "合計" (Total), "領収金額" (Receipt Amount), "お会計", or the largest, boldest number on the page.
     - **Ignore** subtotals (小計), tax (消費税), or change (お釣り). We only want the final total paid.
     - Handle separators correctly (e.g., "1,000" is 1000).

${kamokuInstruction}

5. **Sub-Account Item (補助科目)**:
   - Return NULL.

6. **Invoice Status (インボイス区分)**:
   - Check if the document has a "適格請求書発行事業者登録番号" (Qualified Invoice Issuer Registration Number).
   - This is a number starting with "T" followed by 13 digits (e.g., T1234567890123).
   - Commonly found in receipt headers, footers, or near company name/address.
   - **Return value**:
     - If T-number is found: return "適格"
     - If no T-number is found: return "非適格"
   - Only applicable for receipts/invoices. For bank/credit card statements, return null.

7. **Tax Category (税区分)**:
   - Determine the tax category based on the transaction:
     - "課税仕入 10%" - Standard taxable purchase (default for most receipts)
     - "課税仕入 (軽)8%" - Reduced rate for food/beverages (飲食料品)
     - "対象外仕入" - Non-taxable items (stamps, government fees, etc.)
     - "非課税仕入" - Tax-exempt purchases (insurance, certain medical expenses)
     - "課税売上 10%" - Standard taxable sales (income)
     - "課税売上 (軽)8%" - Reduced rate sales (income from food/beverages)
   - **Detection hints**:
     - Look for tax rate indicators: "10%", "8%", "軽減税率", "※印", "軽", etc.
     - Food/beverages (コンビニ食品, スーパー食料品, 飲食店テイクアウト): "課税仕入 (軽)8%"
     - General office supplies, transportation, services: "課税仕入 10%"
     - If income type, use "課税売上 10%" or "課税売上 (軽)8%" accordingly
   - Default to "課税仕入 10%" for expense and "課税売上 10%" for income if unsure.

**OUTPUT FORMAT**: Return ONLY a valid JSON array. No markdown, no code blocks, no explanation.
Example:
[
  {"date": "2024/01/15", "description": "セブンイレブン", "amount": 1000, "type": "expense", "kamoku": ${autoKamoku ? '"消耗品費"' : 'null'}, "invoiceNumber": "適格", "taxCategory": "課税仕入 (軽)8%"},
  {"date": "2024/01/15", "description": "文具店", "amount": 500, "type": "expense", "kamoku": ${autoKamoku ? '"消耗品費"' : 'null'}, "invoiceNumber": "非適格", "taxCategory": "課税仕入 10%"},
  {"date": "2024/01/20", "description": "売上入金", "amount": 50000, "type": "income", "kamoku": ${autoKamoku ? '"売上高"' : 'null'}, "invoiceNumber": null, "taxCategory": "課税売上 10%"}
]`;
};

/**
 * Parses JSON response from manual AI mode (ChatGPT/Claude web interface) or Gemini API.
 * Validates the structure and normalizes the data.
 * Handles markdown code blocks, explanatory text before/after JSON, and various formatting issues.
 */
export const parseManualJsonResponse = (jsonText: string): Transaction[] => {
  // Try to extract JSON from markdown code blocks if present
  let cleanedText = jsonText.trim();

  // Remove markdown code block markers (multiple patterns)
  const codeBlockPatterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /`([\[\{][\s\S]*?[\]\}])`/
  ];

  for (const pattern of codeBlockPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      cleanedText = match[1].trim();
      break;
    }
  }

  // If no code block found, try to extract JSON array from text
  // This handles cases where AI adds explanatory text before/after JSON
  if (!cleanedText.startsWith('[') && !cleanedText.startsWith('{')) {
    // Look for JSON array in the text
    const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      cleanedText = jsonArrayMatch[0];
    }
  }

  // Clean up common formatting issues
  // Remove trailing commas before ] or }
  cleanedText = cleanedText.replace(/,(\s*[\]\}])/g, '$1');

  // 不完全なJSON（閉じ括弧がない）を検出
  if (cleanedText.startsWith('[') && !cleanedText.endsWith(']')) {
    throw new AnalysisError('INVALID_RESPONSE',
      'JSONが途中で切れています（トークン制限超過の可能性）。PDFを分割してお試しください。');
  }

  // Handle empty array case (no transactions found)
  if (cleanedText === '[]' || cleanedText.trim() === '[]') {
    return [];
  }

  let rawData: any[];
  try {
    rawData = JSON.parse(cleanedText);
  } catch (parseError) {
    // Try one more time: find the last valid JSON array
    const lastBracketMatch = cleanedText.match(/\[\s*\{[\s\S]*?\}\s*\]/g);
    if (lastBracketMatch && lastBracketMatch.length > 0) {
      try {
        // Try the last match (often the actual data)
        rawData = JSON.parse(lastBracketMatch[lastBracketMatch.length - 1]);
      } catch {
        // Provide more detailed error message with response preview for debugging
        const preview = cleanedText.substring(0, 200).replace(/\n/g, ' ');
        throw new AnalysisError('INVALID_RESPONSE', `JSONパースエラー: 有効なJSON形式ではありません。レスポンス先頭: ${preview}...`);
      }
    } else {
      // Provide more detailed error message with response preview for debugging
      const preview = cleanedText.substring(0, 200).replace(/\n/g, ' ');
      throw new AnalysisError('INVALID_RESPONSE', `JSONパースエラー: 有効なJSON形式ではありません。レスポンス先頭: ${preview}...`);
    }
  }

  if (!Array.isArray(rawData)) {
    throw new AnalysisError('INVALID_RESPONSE', '解析結果が配列形式ではありません');
  }

  // Handle empty array (no transactions in document)
  if (rawData.length === 0) {
    return [];
  }

  // Validate and normalize each item
  return rawData.map((item: any, index: number) => {
    // Validate required fields
    if (!item.date || !item.description || item.amount === undefined || !item.type) {
      throw new AnalysisError('INVALID_RESPONSE', `取引 ${index + 1} に必須フィールドが不足しています (date, description, amount, type)`);
    }

    // Validate type field
    if (item.type !== 'income' && item.type !== 'expense') {
      throw new AnalysisError('INVALID_RESPONSE', `取引 ${index + 1} のtypeは 'income' または 'expense' である必要があります`);
    }

    return {
      id: `txn-${Date.now()}-${index}`,
      date: normalizeDate(item.date),
      description: String(item.description),
      amount: typeof item.amount === 'string' ? parseFloat(item.amount.replace(/,/g, '')) : Number(item.amount),
      type: item.type as 'income' | 'expense',
      kamoku: item.kamoku || null,
      subKamoku: item.subKamoku || null,
      invoiceNumber: item.invoiceNumber || null,
      taxCategory: item.taxCategory || null
    };
  });
};

// Available Gemini models (Updated: 2025-01)
// Reference: https://ai.google.dev/gemini-api/docs/models
export const GEMINI_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: '無料・最新・高速（おすすめ）' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '無料・高速・安定版' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: '無料・最速' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '有料・高精度' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: '有料・最新・最高精度' },
] as const;

export type GeminiModelId = typeof GEMINI_MODELS[number]['id'];

/**
 * Analyzes a document using Google Gemini API.
 * Supports images (JPG, PNG, etc.) and PDFs.
 *
 * @param fileData - Base64 encoded file data (with or without data URL prefix)
 * @param mimeType - MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
 * @param apiKey - Google Gemini API key
 * @param model - Gemini model to use (default: gemini-2.0-flash)
 * @param autoKamoku - If true, AI will guess account items
 * @returns Promise<Transaction[]> - Parsed transactions
 */
export const analyzeWithGemini = async (
  fileData: string,
  mimeType: string,
  apiKey: string,
  model: GeminiModelId = 'gemini-2.5-flash',
  autoKamoku: boolean = false
): Promise<Transaction[]> => {
  // Remove data URL prefix if present
  const base64Data = fileData.includes(',')
    ? fileData.split(',')[1]
    : fileData;

  // Check file size
  const estimatedSize = estimateFileSizeFromBase64(base64Data);
  console.log('[Gemini API] Estimated file size:', (estimatedSize / 1024 / 1024).toFixed(2), 'MB');

  if (estimatedSize > MAX_FILE_SIZE_BYTES) {
    throw new AnalysisError(
      'FILE_TOO_LARGE',
      `ファイルサイズ（${(estimatedSize / 1024 / 1024).toFixed(1)}MB）が大きすぎます。50MB以下のファイルを使用するか、PDFを分割してください。`
    );
  }

  const prompt = getAnalysisPrompt(autoKamoku);

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 100000,
      responseMimeType: "application/json"  // 純粋なJSON出力を強制
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    console.log('[Gemini API] Sending request...');
    console.log('[Gemini API] MIME type:', mimeType);
    console.log('[Gemini API] Data length:', base64Data.length);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[Gemini API] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gemini API] Error response:', errorData);

      if (response.status === 400) {
        const msg = errorData.error?.message || '';
        if (msg.includes('API key')) {
          throw new AnalysisError('API_KEY_INVALID', 'APIキーが無効です。設定を確認してください。');
        }
        throw new AnalysisError('API_ERROR', `リクエストエラー: ${msg || 'Bad Request'}`);
      }
      if (response.status === 403) {
        throw new AnalysisError('API_KEY_INVALID', 'APIキーが無効または権限がありません。');
      }
      if (response.status === 429) {
        throw new AnalysisError('RATE_LIMITED', 'APIのレート制限に達しました。しばらく待ってから再試行してください。');
      }

      throw new AnalysisError('API_ERROR', `API呼び出しエラー (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 切り詰められたかチェック
    const finishReason = data.candidates?.[0]?.finishReason;
    console.log('[Gemini API] Finish reason:', finishReason);

    if (finishReason === 'MAX_TOKENS') {
      throw new AnalysisError('INVALID_RESPONSE',
        '応答が長すぎて途中で切れました。PDFのページ数を減らすか、分割してお試しください。');
    }

    // Extract text from Gemini response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    // デバッグ用: レスポンス内容をログ出力
    console.log('[Gemini API] Response text length:', textContent?.length);
    console.log('[Gemini API] Response preview:', textContent?.substring(0, 500));

    if (!textContent) {
      throw new AnalysisError('INVALID_RESPONSE', 'Geminiからの応答が空です。');
    }

    // Parse the JSON response using the enhanced parser
    return parseManualJsonResponse(textContent);

  } catch (error) {
    if (error instanceof AnalysisError) {
      throw error;
    }

    // Check for network-related errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AnalysisError(
        'NETWORK_ERROR',
        'ネットワークエラーが発生しました。インターネット接続を確認して再試行してください。'
      );
    }

    // Check for timeout or abort errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AnalysisError(
        'NETWORK_ERROR',
        'リクエストがタイムアウトしました。ネットワーク接続を確認して再試行してください。'
      );
    }

    // Network or other errors
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    throw new AnalysisError(
      'API_ERROR',
      `API呼び出しエラー: ${errorMessage}。ネットワーク接続を確認して再試行してください。`
    );
  }
};

// リトライ設定
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000; // ミリ秒

/**
 * リトライ可能なエラーかどうか判定
 */
const isRetryableError = (error: unknown): boolean => {
  if (error instanceof AnalysisError) {
    // レート制限とネットワークエラーはリトライ可能
    return error.code === 'RATE_LIMITED' || error.code === 'NETWORK_ERROR';
  }
  return false;
};

/**
 * スリープ関数
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 単一ページをリトライ付きで解析
 */
const analyzePageWithRetry = async (
  pageImage: PageImage,
  apiKey: string,
  model: GeminiModelId,
  autoKamoku: boolean
): Promise<PageTransactions> => {
  // 画像データが空の場合（抽出失敗）
  if (!pageImage.dataUrl) {
    return {
      pageNumber: pageImage.pageNumber,
      transactions: [],
      error: 'ページの抽出に失敗しました'
    };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Multi-Page] Page ${pageImage.pageNumber}: Attempt ${attempt}/${MAX_RETRIES}`);

      const transactions = await analyzeWithGemini(
        pageImage.dataUrl,
        pageImage.mimeType,
        apiKey,
        model,
        autoKamoku
      );

      console.log(`[Multi-Page] Page ${pageImage.pageNumber}: Success (${transactions.length} transactions)`);

      return {
        pageNumber: pageImage.pageNumber,
        transactions
      };
    } catch (error) {
      console.error(`[Multi-Page] Page ${pageImage.pageNumber}: Attempt ${attempt} failed:`, error);

      if (attempt === MAX_RETRIES || !isRetryableError(error)) {
        return {
          pageNumber: pageImage.pageNumber,
          transactions: [],
          error: error instanceof Error ? error.message : 'エラーが発生しました'
        };
      }

      // 指数バックオフでリトライ
      const delay = RETRY_DELAY_BASE * attempt;
      console.log(`[Multi-Page] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // ここに到達することはないが、TypeScript用
  return {
    pageNumber: pageImage.pageNumber,
    transactions: [],
    error: 'リトライ上限に達しました'
  };
};

/**
 * 進捗コールバックの型
 */
export interface MultiPageProgress {
  phase: 'extracting' | 'analyzing' | 'complete';
  currentPage: number;
  totalPages: number;
  message?: string;
}

/**
 * 複数ページPDFを解析
 * 各ページを順次API呼び出しし、結果を返す
 *
 * @param pdfData - Base64エンコードされたPDFデータ
 * @param apiKey - Google Gemini API key
 * @param model - 使用するGeminiモデル
 * @param autoKamoku - AIが勘定科目を推測するか
 * @param onProgress - 進捗コールバック
 * @returns ページごとの結果配列
 */
export const analyzeMultiPagePdf = async (
  pdfData: string,
  apiKey: string,
  model: GeminiModelId,
  autoKamoku: boolean,
  onProgress?: (progress: MultiPageProgress) => void
): Promise<PageTransactions[]> => {
  console.log('[Multi-Page] Starting multi-page PDF analysis...');

  // 1. ページ数を確認
  const pageCount = await getPdfPageCount(pdfData);
  console.log(`[Multi-Page] PDF has ${pageCount} pages`);

  // 2. PDFをページ画像に分割
  onProgress?.({
    phase: 'extracting',
    currentPage: 0,
    totalPages: pageCount,
    message: 'PDFをページごとに分割中...'
  });

  const pageImages = await extractPdfPages(pdfData);
  console.log(`[Multi-Page] Extracted ${pageImages.length} page images`);

  // 3. 各ページを順次解析
  const results: PageTransactions[] = [];

  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];

    onProgress?.({
      phase: 'analyzing',
      currentPage: i + 1,
      totalPages: pageCount,
      message: `ページ ${i + 1} / ${pageCount} を解析中...`
    });

    const result = await analyzePageWithRetry(
      pageImage,
      apiKey,
      model,
      autoKamoku
    );

    results.push(result);
  }

  onProgress?.({
    phase: 'complete',
    currentPage: pageCount,
    totalPages: pageCount,
    message: '解析完了'
  });

  console.log('[Multi-Page] Analysis complete');
  return results;
};

/**
 * PDFが複数ページかどうか確認
 */
export const isPdfMultiPage = async (pdfData: string): Promise<boolean> => {
  try {
    const pageCount = await getPdfPageCount(pdfData);
    return pageCount > 1;
  } catch {
    return false;
  }
};

/**
 * PDFのページ数を取得（エクスポート）
 */
export { getPdfPageCount } from './pdfUtils';
