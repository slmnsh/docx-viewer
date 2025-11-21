// Import PDF.js library - using ES module build
importScripts('https://mozilla.github.io/pdf.js/build/pdf.mjs');

const DB_NAME = "DocxViewerECMA";
const STORE_NAME = "pdf_binary";
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
      if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function downloadPDF() {
  try {
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({ type: "download_start" });
    });
    
    const response = await fetch(PDF_URL);
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
    
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('content-length');
    let receivedLength = 0;
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (contentLength > 0) {
        const pct = Math.round((receivedLength / contentLength) * 100);
        clients.forEach(client => {
          client.postMessage({ type: "download_progress", percent: pct });
        });
      }
    }

    const buffer = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      buffer.set(chunk, position);
      position += chunk.length;
    }

    await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: "pdf", data: buffer });
    
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });

    clients.forEach(client => {
      client.postMessage({ type: "download_complete", size: receivedLength });
    });
  } catch (error) {
    console.error("PDF download failed:", error);
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: "error", message: error.toString() });
    });
  }
}

async function extractPDF() {
  try {
    const clients = await self.clients.matchAll();
    
    clients.forEach(client => {
      client.postMessage({ type: "extraction_start" });
    });
    
    // Set up PDF.js worker - CRITICAL: must be done before getDocument
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
      console.log("PDF.js worker configured");
    } else {
      throw new Error("PDF.js not loaded in service worker");
    }
    
    // Get PDF binary from IndexedDB
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    
    const pdfBinary = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("pdf");
      req.onsuccess = () => resolve(req.result?.data);
      req.onerror = () => resolve(null);
    });
    
    if (!pdfBinary) {
      throw new Error("PDF binary not found in cache");
    }
    
    // Extract text using PDF.js - following Mozilla examples pattern
    const loadingTask = pdfjsLib.getDocument({ data: pdfBinary });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    const totalPages = pdf.numPages;
    let extractedText = "";
    let extractedCount = 0;

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ");
        extractedText += pageText + "\n";
        extractedCount++;

        if (i % Math.max(1, Math.floor(totalPages / 10)) === 0) {
          const pct = Math.round((i / totalPages) * 100);
          clients.forEach(client => {
            client.postMessage({ type: "extraction_progress", percent: pct });
          });
          console.log(`Extracted ${i}/${totalPages}`);
        }
      } catch (e) {
        console.warn(`Page ${i} extraction failed:`, e.message);
      }
    }

    console.log(`Extraction complete: ${extractedCount} pages, ${(extractedText.length/1024/1024).toFixed(1)}MB`);
    
    clients.forEach(client => {
      client.postMessage({ 
        type: "extraction_complete", 
        text: extractedText, 
        pages: extractedCount 
      });
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: "extraction_error", message: error.toString() });
    });
  }
}

self.onmessage = (event) => {
  try {
    const { command } = event.data;
    if (command === "downloadPDF") {
      downloadPDF();
    } else if (command === "extractPDF") {
      extractPDF();
    }
  } catch (e) {
    console.error("Service Worker error:", e);
  }
};
