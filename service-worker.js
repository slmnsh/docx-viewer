const DB_NAME = "DocxViewerECMA";
const STORE_NAME = "pages";
const PDF_URL = "/ecma-standard.pdf";

let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: "pageNum" });
    };
  });
}

function savePageToDB(pageNum, text) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ pageNum, text });
    tx.oncomplete = () => resolve();
  });
}

function getAllPagesFromDB() {
  return new Promise((resolve) => {
    if (!db) return resolve("");
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const pages = req.result.sort((a, b) => a.pageNum - b.pageNum);
      resolve(pages.map(p => p.text).join("\n"));
    };
    req.onerror = () => resolve("");
  });
}

async function extractAndStorePDF() {
  try {
    // Load PDF.js from CDN
    importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js");
    self.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";

    await initDB();
    
    // Fetch with download progress tracking
    self.postMessage({ type: "download_start", message: "Downloading PDF..." });
    
    const response = await fetch(PDF_URL);
    if (!response.ok) throw new Error("PDF fetch failed");
    
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('content-length');
    let receivedLength = 0;
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      
      const pct = Math.round((receivedLength / contentLength) * 100);
      self.postMessage({ type: "download_progress", current: receivedLength, total: contentLength, percent: pct });
    }

    const buffer = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      buffer.set(chunk, position);
      position += chunk.length;
    }

    self.postMessage({ type: "download_complete", size: receivedLength });
    self.postMessage({ type: "extraction_start", message: "Extracting PDF..." });
    
    const pdf = await self.pdfjsLib.getDocument({ data: buffer }).promise;
    const totalPages = pdf.numPages;
    let extractedCount = 0;

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(" ");
        await savePageToDB(i, text);
        extractedCount++;

        if (i % 500 === 0) {
          const pct = Math.round((i / totalPages) * 100);
          self.postMessage({ type: "extraction_progress", current: i, total: totalPages, percent: pct });
        }
      } catch (e) {
        console.error(`SW: Page ${i} failed:`, e);
      }
    }

    const allText = await getAllPagesFromDB();
    self.postMessage({ 
      type: "complete", 
      content: allText,
      pages: extractedCount,
      size: allText.length 
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error.toString() });
  }
}

self.onmessage = (event) => {
  const { command } = event.data;
  if (command === "extractECMA") {
    extractAndStorePDF();
  }
};
