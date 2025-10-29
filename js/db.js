function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("docxViewerDB", 2)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "path" })
      if (!db.objectStoreNames.contains("recentFiles")) db.createObjectStore("recentFiles", { keyPath: "name" })
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

async function saveFileToDB(path, content) {
  const db = await openDB()
  const tx = db.transaction("files", "readwrite")
  tx.objectStore("files").put({ path, content })
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function loadFileFromDB(path) {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction("files", "readonly")
    const req = tx.objectStore("files").get(path)
    req.onsuccess = () => resolve(req.result?.content || null)
    req.onerror = () => resolve(null)
  })
}

async function saveRecentFile(name, fileData) {
  const db = await openDB()
  const tx = db.transaction("recentFiles", "readwrite")
  tx.objectStore("recentFiles").put({
    name,
    timestamp: Date.now(),
    data: fileData,
  })
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function getRecentFiles() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction("recentFiles", "readonly")
    const req = tx.objectStore("recentFiles").getAll()
    req.onsuccess = () => {
      const files = req.result || []
      files.sort((a, b) => b.timestamp - a.timestamp)
      resolve(files.slice(0, 10))
    }
    req.onerror = () => resolve([])
  })
}

async function deleteRecentFile(name) {
  const db = await openDB()
  const tx = db.transaction("recentFiles", "readwrite")
  tx.objectStore("recentFiles").delete(name)
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}
