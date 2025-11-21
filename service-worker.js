const DB_NAME = "DocxViewerECMA";
const STORE_NAME = "pages";
const PDF_URL = "/ecma-standard.pdf";

let db = null;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: "pageNum" });
      store.createIndex("pageNum", "pageNum", { unique: true });
    };
  });
}

// Get page from IndexedDB
function getPageFromDB(pageNum) {
  return new Promise((resolve) => {
    if (!db) return resolve(null);
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(pageNum);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

// Save page to IndexedDB
function savePageToDB(pageNum, text) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ pageNum, text, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
  });
}

// Get all pages from IndexedDB
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

// Extract PDF and store pages
async function extractAndStorePDF() {
  try {
    if (!self.pdfjsLib) {
      self.importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js");
    }
    
    self.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";

    await initDB();

    const response = await fetch(PDF_URL);
    const buffer = await response.arrayBuffer();
    const pdf = await self.pdfjsLib.getDocument({ data: buffer }).promise;
    
    const totalPages = pdf.numPages;
    let extractedCount = 0;

    for (let i = 1; i <= totalPages; i++) {
      const cached = await getPageFromDB(i);
      if (cached) {
        extractedCount++;
        if (i % 10 === 0) {
          self.postMessage({ type: "progress", current: i, total: totalPages });
        }
        continue;
      }

      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(" ");
        await savePageToDB(i, text);
        extractedCount++;

        if (i % 10 === 0) {
          self.postMessage({ type: "progress", current: i, total: totalPages });
        }
      } catch (e) {
        console.error(`Failed to extract page ${i}:`, e);
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
    self.postMessage({ type: "error", message: error.message });
  }
}

// Message handler
self.onmessage = (event) => {
  const { command } = event.data;
  
  if (command === "extractECMA") {
    extractAndStorePDF();
  } else if (command === "getECMA") {
    initDB().then(() => getAllPagesFromDB()).then(content => {
      self.postMessage({ type: "ready", content });
    });
  }
};
