import { Transaction } from "../types";

// Error codes for manual mode and API mode
export type AnalysisErrorCode = 'INVALID_RESPONSE' | 'API_KEY_INVALID' | 'RATE_LIMITED' | 'API_ERROR';

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
  'API_ERROR': 'API呼び出しエラーが発生しました。'
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
 */
export const getAnalysisPrompt = (): string => {
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

4. **Account Item (勘定科目)**:
   - **STRICT RULE**: Return NULL (or empty string) for ALL transactions.
   - Do not attempt to guess the account item (e.g., do not guess "Travel Expense" for a taxi).
   - The application logic handles defaults.

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
  {"date": "2024/01/15", "description": "セブンイレブン", "amount": 1000, "type": "expense", "invoiceNumber": "適格", "taxCategory": "課税仕入 (軽)8%"},
  {"date": "2024/01/15", "description": "文具店", "amount": 500, "type": "expense", "invoiceNumber": "非適格", "taxCategory": "課税仕入 10%"},
  {"date": "2024/01/20", "description": "売上入金", "amount": 50000, "type": "income", "invoiceNumber": null, "taxCategory": "課税売上 10%"}
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
        throw new AnalysisError('INVALID_RESPONSE', `JSONパースエラー: 有効なJSON形式ではありません`);
      }
    } else {
      throw new AnalysisError('INVALID_RESPONSE', `JSONパースエラー: 有効なJSON形式ではありません`);
    }
  }

  if (!Array.isArray(rawData)) {
    throw new AnalysisError('INVALID_RESPONSE', '解析結果が配列形式ではありません');
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

    // Determine default tax category based on type if not provided
    const defaultTaxCategory = item.type === 'income' ? '課税売上 10%' : '課税仕入 10%';

    return {
      id: `txn-${Date.now()}-${index}`,
      date: normalizeDate(item.date),
      description: String(item.description),
      amount: typeof item.amount === 'string' ? parseFloat(item.amount.replace(/,/g, '')) : Number(item.amount),
      type: item.type as 'income' | 'expense',
      kamoku: item.kamoku || null,
      subKamoku: item.subKamoku || null,
      invoiceNumber: item.invoiceNumber || null,
      taxCategory: item.taxCategory || defaultTaxCategory
    };
  });
};

/**
 * Analyzes a document using Google Gemini API.
 * Supports images (JPG, PNG, etc.) and PDFs.
 *
 * @param fileData - Base64 encoded file data (with or without data URL prefix)
 * @param mimeType - MIME type of the file (e.g., 'image/jpeg', 'application/pdf')
 * @param apiKey - Google Gemini API key
 * @returns Promise<Transaction[]> - Parsed transactions
 */
export const analyzeWithGemini = async (
  fileData: string,
  mimeType: string,
  apiKey: string
): Promise<Transaction[]> => {
  // Remove data URL prefix if present
  const base64Data = fileData.includes(',')
    ? fileData.split(',')[1]
    : fileData;

  const prompt = getAnalysisPrompt();

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
      maxOutputTokens: 8192
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    console.log('[Gemini API] Sending request...');
    console.log('[Gemini API] MIME type:', mimeType);
    console.log('[Gemini API] Data length:', base64Data.length);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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

    // Extract text from Gemini response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new AnalysisError('INVALID_RESPONSE', 'Geminiからの応答が空です。');
    }

    // Parse the JSON response using the enhanced parser
    return parseManualJsonResponse(textContent);

  } catch (error) {
    if (error instanceof AnalysisError) {
      throw error;
    }

    // Network or other errors
    throw new AnalysisError('API_ERROR', `API呼び出しエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
};
