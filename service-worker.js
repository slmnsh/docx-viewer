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
    // Get all clients controlled by this service worker
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

self.onmessage = (event) => {
  try {
    const { command } = event.data;
    if (command === "downloadPDF") {
      downloadPDF();
    }
  } catch (e) {
    console.error("Service Worker error:", e);
  }
};
