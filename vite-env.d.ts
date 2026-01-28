/// <reference types="vite/client" />

// Vite ?url サフィックスの型宣言
declare module '*?url' {
  const src: string;
  export default src;
}

// PDF.js worker の型宣言
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const workerSrc: string;
  export default workerSrc;
}
