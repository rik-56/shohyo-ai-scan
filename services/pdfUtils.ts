import * as pdfjsLib from 'pdfjs-dist';
// Vite用: workerファイルをURLとしてインポート
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.jsのWorkerをローカルバンドルから読み込み
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * ページ画像の情報
 */
export interface PageImage {
  pageNumber: number;
  dataUrl: string;  // base64画像（data:image/png;base64,...形式）
  mimeType: string;
}

/**
 * Base64データからArrayBufferを作成
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  // data URL prefixを除去
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * PDFのページ数を取得
 * @param pdfData - Base64エンコードされたPDFデータ（data URL形式可）
 * @returns ページ数
 */
export const getPdfPageCount = async (pdfData: string): Promise<number> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(pdfData);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error('[PDF Utils] Failed to get page count:', error);
    throw new Error('PDFのページ数取得に失敗しました');
  }
};

/**
 * PDFをページごとに画像化
 * @param pdfData - Base64エンコードされたPDFデータ（data URL形式可）
 * @param scale - レンダリング解像度（デフォルト: 2.0 = 高解像度）
 * @returns ページ画像の配列
 */
export const extractPdfPages = async (
  pdfData: string,
  scale: number = 2.0
): Promise<PageImage[]> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(pdfData);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pages: PageImage[] = [];

    console.log(`[PDF Utils] Extracting ${numPages} pages...`);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // Canvasを作成
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas context is not available');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // PDFページをCanvasにレンダリング
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;

        // CanvasをPNG画像に変換
        const dataUrl = canvas.toDataURL('image/png');

        pages.push({
          pageNumber: pageNum,
          dataUrl: dataUrl,
          mimeType: 'image/png'
        });

        console.log(`[PDF Utils] Page ${pageNum}/${numPages} extracted`);

        // メモリ解放
        page.cleanup();
      } catch (pageError) {
        console.error(`[PDF Utils] Failed to extract page ${pageNum}:`, pageError);
        // 個別ページのエラーは記録するが、処理を続行
        pages.push({
          pageNumber: pageNum,
          dataUrl: '',
          mimeType: 'image/png'
        });
      }
    }

    return pages;
  } catch (error) {
    console.error('[PDF Utils] Failed to extract pages:', error);
    throw new Error('PDFのページ抽出に失敗しました');
  }
};

/**
 * 単一ページをPDF画像から抽出
 * @param pdfData - Base64エンコードされたPDFデータ
 * @param pageNumber - 抽出するページ番号（1始まり）
 * @param scale - レンダリング解像度
 * @returns ページ画像
 */
export const extractSinglePage = async (
  pdfData: string,
  pageNumber: number,
  scale: number = 2.0
): Promise<PageImage> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(pdfData);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pageNumber < 1 || pageNumber > pdf.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}. PDF has ${pdf.numPages} pages.`);
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context is not available');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;

    const dataUrl = canvas.toDataURL('image/png');

    page.cleanup();

    return {
      pageNumber,
      dataUrl,
      mimeType: 'image/png'
    };
  } catch (error) {
    console.error(`[PDF Utils] Failed to extract page ${pageNumber}:`, error);
    throw new Error(`ページ ${pageNumber} の抽出に失敗しました`);
  }
};
