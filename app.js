const fileTreeDiv = document.getElementById("fileTree");
const uploadBtn = document.getElementById("uploadBtn");
const fileSearch = document.getElementById("fileSearch");
const editorWrapper = document.getElementById("editorWrapper");
const fullScreenOverlay = document.getElementById("fullScreenOverlay");
const editorHeader = document.getElementById("viewerHeader");
const recentFilesList = document.getElementById("recentFilesList");
const welcomeSection = document.getElementById("welcomeSection");

function setActiveFileHeader(filename) {
  editorHeader.textContent = filename || "No file selected";
  docxName = filename;
}

let zipFilesMap = {};
let xmlWorker;
const fileCache = {};
let selectedFileLi = null;
let docxName;
let currentContextMenuFile = null;
let contextMenu = null;

const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp"];
function isImageFile(path) {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return imageExtensions.includes(ext);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("docxViewerDB", 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files"))
        db.createObjectStore("files", { keyPath: "path" });
      if (!db.objectStoreNames.contains("recentFiles"))
        db.createObjectStore("recentFiles", { keyPath: "name" });
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveFileToDB(path, content) {
  const db = await openDB();
  const tx = db.transaction("files", "readwrite");
  tx.objectStore("files").put({ path, content });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function loadFileFromDB(path) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(path);
    req.onsuccess = () => resolve(req.result?.content || null);
    req.onerror = () => resolve(null);
  });
}

async function saveRecentFile(name, fileData) {
  const db = await openDB();
  const tx = db.transaction("recentFiles", "readwrite");
  tx.objectStore("recentFiles").put({
    name,
    timestamp: Date.now(),
    data: fileData,
  });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function getRecentFiles() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("recentFiles", "readonly");
    const req = tx.objectStore("recentFiles").getAll();
    req.onsuccess = () => {
      const files = req.result || [];
      files.sort((a, b) => b.timestamp - a.timestamp);
      resolve(files.slice(0, 10));
    };
    req.onerror = () => resolve([]);
  });
}

async function deleteRecentFile(name) {
  const db = await openDB();
  const tx = db.transaction("recentFiles", "readwrite");
  tx.objectStore("recentFiles").delete(name);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

const hiddenInput = document.createElement("input");
hiddenInput.type = "file";
hiddenInput.accept = ".docx";
hiddenInput.style.display = "none";
document.body.appendChild(hiddenInput);

uploadBtn.addEventListener("click", () => {
  hiddenInput.value = "";
  hiddenInput.click();
});

hiddenInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
  fullScreenOverlay.style.display = "none";
});

welcomeSection.addEventListener("click", () => {
  hiddenInput.value = "";
  hiddenInput.click();
});

welcomeSection.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    hiddenInput.value = "";
    hiddenInput.click();
  }
});

["dragover", "drop"].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault());
});

fullScreenOverlay.addEventListener("drop", (e) => {
  handleFile(e.dataTransfer.files[0]);
  fullScreenOverlay.style.display = "none";
});

fullScreenOverlay.addEventListener("dragover", (e) => {
  fullScreenOverlay.style.background = "rgba(40,40,40,0.95)";
});

fullScreenOverlay.addEventListener("dragleave", (e) => {
  fullScreenOverlay.style.background = "rgba(30,30,30,0.95)";
});

async function handleFile(file, fromRecent = false) {
  if (!file) return;

  let arrayBuffer;
  if (fromRecent) {
    arrayBuffer = file;
  } else {
    arrayBuffer = await file.arrayBuffer();
    const fileName = file.name;
    await saveRecentFile(fileName, arrayBuffer);
    await renderRecentFiles();
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  zipFilesMap = {};
  Object.keys(zip.files).forEach((path) => {
    if (!zip.files[path].dir) zipFilesMap[path] = zip.files[path];
  });
  const tree = buildTree(Object.keys(zipFilesMap));
  fileTreeDiv.innerHTML = "";
  fileTreeDiv.appendChild(renderTree(tree));

  if (!fromRecent) {
    setActiveFileHeader(file.name);
  }
}

function buildTree(files) {
  const root = {};
  files.forEach((path) => {
    const parts = path.split("/");
    let cur = root;
    parts.forEach((part, idx) => {
      cur[part] = cur[part] || (idx === parts.length - 1 ? null : {});
      cur = cur[part] || {};
    });
  });
  return root;
}

function getFileClass(path) {
  if (isImageFile(path)) return "file file-image";
  if (path.endsWith(".xml")) return "file file-xml";
  if (path.endsWith(".txt")) return "file file-text";
  if (path.match(/\.(ttf|otf|woff|woff2)$/i)) return "file file-font";
  return "file file-default";
}

function showContextMenu(x, y, fullPath, fileName) {
  hideContextMenu();

  currentContextMenuFile = { path: fullPath, name: fileName };

  contextMenu = document.createElement("div");
  contextMenu.className = "fileContextMenu";

  const openBtn = document.createElement("button");
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", () => {
    openFileInActivePane(fullPath, fileName);
    hideContextMenu();
  });

  const openHBtn = document.createElement("button");
  openHBtn.textContent = "Open in Horizontal Split";
  openHBtn.addEventListener("click", () => {
    openFileInNewSplit(fullPath, fileName, "horizontal");
    hideContextMenu();
  });

  const openVBtn = document.createElement("button");
  openVBtn.textContent = "Open in Vertical Split";
  openVBtn.addEventListener("click", () => {
    openFileInNewSplit(fullPath, fileName, "vertical");
    hideContextMenu();
  });

  const separator = document.createElement("div");
  separator.className = "separator";

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy Path";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(fullPath);
    hideContextMenu();
  });

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "Download";
  downloadBtn.addEventListener("click", async () => {
    const fd = zipFilesMap[fullPath];
    if (!fd) return;
    const blob = await fd.async("blob");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fullPath.split("/").pop();
    a.click();
    hideContextMenu();
  });

  contextMenu.appendChild(openBtn);
  contextMenu.appendChild(openHBtn);
  contextMenu.appendChild(openVBtn);
  contextMenu.appendChild(separator);
  contextMenu.appendChild(copyBtn);
  contextMenu.appendChild(downloadBtn);

  contextMenu.style.left = x + "px";
  contextMenu.style.top = y + "px";

  document.body.appendChild(contextMenu);
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

document.addEventListener("click", hideContextMenu);
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".fileContextMenu")) {
    hideContextMenu();
  }
});

async function openFileInActivePane(fullPath, fileName) {
  const activePane = splitManager.getActivePane();
  if (!activePane) return;

  await loadAndOpenFile(fullPath, fileName, activePane);
}

async function openFileInNewSplit(fullPath, fileName, direction) {
  const activePane = splitManager.getActivePane();
  if (!activePane) return;

  splitManager.splitPane(activePane.id, direction);
  const newPane = splitManager.getActivePane();

  await loadAndOpenFile(fullPath, fileName, newPane);
}

async function loadAndOpenFile(fullPath, fileName, pane) {
  const fd = zipFilesMap[fullPath];
  if (!fd) return;

  if (isImageFile(fullPath)) {
    const blob = await fd.async("blob");
    const url = URL.createObjectURL(blob);
    pane.openTab(fullPath, fileName, url, "image");
    return;
  }

  if (fileCache[fullPath]) {
    const type = fullPath.endsWith(".xml") ? "xml" : "plaintext";
    pane.openTab(fullPath, fileName, fileCache[fullPath], type);
    return;
  }

  const cached = await loadFileFromDB(docxName + "/" + fullPath);
  if (cached) {
    fileCache[fullPath] = cached;
    const type = fullPath.endsWith(".xml") ? "xml" : "plaintext";
    pane.openTab(fullPath, fileName, cached, type);
    return;
  }

  const text = await fd.async("text");
  if (fullPath.endsWith(".xml")) {
    xmlWorker.postMessage({ text, path: fullPath, fileName, paneId: pane.id });
  } else {
    fileCache[fullPath] = text;
    saveFileToDB(docxName + "/" + fullPath, text);
    pane.openTab(fullPath, fileName, text, "plaintext");
  }
}

function renderTree(obj, path = "") {
  const ul = document.createElement("ul");
  Object.keys(obj)
    .sort((a, b) => {
      const aF = obj[a] !== null,
        bF = obj[b] !== null;
      if (aF && !bF) return -1;
      if (!aF && bF) return 1;
      return a.localeCompare(b);
    })
    .forEach((key) => {
      const fullPath = path ? path + "/" + key : key;
      const li = document.createElement("li");

      const labelDiv = document.createElement("div");
      labelDiv.className = "labelContainer";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = key;
      nameSpan.className = "fileName";
      labelDiv.appendChild(nameSpan);

      li.appendChild(labelDiv);
      if (obj[key]) {
        li.className = "folder collapsed";
        const childUl = renderTree(obj[key], fullPath);
        li.appendChild(childUl);
        labelDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          li.classList.toggle("collapsed");
          childUl.style.display = li.classList.contains("collapsed")
            ? "none"
            : "block";
        });
      } else {
        li.className = getFileClass(fullPath);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "fileActionsMenu";
        const toggle = document.createElement("span");
        toggle.textContent = "⋮";
        toggle.className = "menuToggle";
        const dropdown = document.createElement("div");
        dropdown.className = "fileActionsDropdown";
        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy Path";
        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "Download";
        dropdown.appendChild(copyBtn);
        dropdown.appendChild(downloadBtn);
        actionsDiv.appendChild(toggle);
        actionsDiv.appendChild(dropdown);
        labelDiv.appendChild(actionsDiv);

        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          actionsDiv.classList.toggle("open");
        });
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(fullPath);
          actionsDiv.classList.remove("open");
        });
        downloadBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fd = zipFilesMap[fullPath];
          if (!fd) return;
          const blob = await fd.async("blob");
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = fullPath.split("/").pop();
          a.click();
          actionsDiv.classList.remove("open");
        });

        labelDiv.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (selectedFileLi) selectedFileLi.classList.remove("selected");
          li.classList.add("selected");
          selectedFileLi = li;

          const fileName = fullPath.split("/").pop();
          await openFileInActivePane(fullPath, fileName);
        });

        labelDiv.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (selectedFileLi) selectedFileLi.classList.remove("selected");
          li.classList.add("selected");
          selectedFileLi = li;

          const fileName = fullPath.split("/").pop();
          showContextMenu(e.clientX, e.clientY, fullPath, fileName);
        });
      }
      ul.appendChild(li);
    });
  return ul;
}

function filterTree(query, ulElement) {
  let anyVisible = false;
  ulElement.querySelectorAll(":scope > li").forEach((li) => {
    const name =
      li.querySelector(".fileName")?.textContent.toLowerCase() || "";
    const childUl = li.querySelector("ul");
    let childVisible = false;
    if (childUl) childVisible = filterTree(query, childUl);
    const match = name.includes(query);
    li.style.display = match || childVisible ? "block" : "none";
    anyVisible = anyVisible || match || childVisible;
  });
  return anyVisible;
}

fileSearch.addEventListener("input", () => {
  const query = fileSearch.value.toLowerCase();
  const topUl = fileTreeDiv.querySelector("ul");
  if (topUl) filterTree(query, topUl);
});

(function initWorker() {
  const blob = new Blob(
    [
      `
        importScripts('https://cdn.jsdelivr.net/npm/xml-formatter@3.6.7/dist/browser/xml-formatter-singleton.js');
        self.onmessage = function(e){
          const { text, path, paneId } = e.data;
          try {
            const formatted = xmlFormatter(text);
            self.postMessage({ success:true, formatted, path, paneId });
          } catch(err){
            self.postMessage({ success:false, error: err.message, path, paneId });
          }
        };
      `,
    ],
    { type: "application/javascript" }
  );

  xmlWorker = new Worker(URL.createObjectURL(blob));

  xmlWorker.onmessage = function (e) {
    const { success, formatted, error, path, fileName, paneId } = e.data;
    const pane = splitManager.panes.get(paneId);
    if (!pane) return;

    if (success) {
      fileCache[path] = formatted;
      saveFileToDB(docxName + "/" + path, formatted);
      const name = fileName || path.split("/").pop();
      pane.openTab(path, name, formatted, "xml");
    } else {
      const name = fileName || path.split("/").pop();
      pane.openTab(path, name, "Error formatting XML: " + error, "plaintext");
    }
  };
})();

async function renderRecentFiles() {
  const recentFiles = await getRecentFiles();

  if (recentFiles.length === 0) {
    recentFilesList.innerHTML = '<div id="noRecentFiles">No recent files</div>';
    return;
  }

  recentFilesList.innerHTML = "";
  recentFiles.forEach((file) => {
    const item = document.createElement("div");
    item.className = "recentFileItem";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");

    const icon = document.createElement("span");
    icon.className = "material-icons";
    icon.textContent = "description";

    const info = document.createElement("div");
    info.className = "recentFileInfo";

    const name = document.createElement("div");
    name.className = "recentFileName";
    name.textContent = file.name;

    const date = document.createElement("div");
    date.className = "recentFileDate";
    const fileDate = new Date(file.timestamp);
    date.textContent =
      fileDate.toLocaleDateString() + " " + fileDate.toLocaleTimeString();

    info.appendChild(name);
    info.appendChild(date);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "material-icons recentFileDelete";
    deleteBtn.textContent = "close";
    deleteBtn.setAttribute("aria-label", "Delete " + file.name);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteRecentFile(file.name);
      await renderRecentFiles();
    });

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(deleteBtn);

    const openFile = async () => {
      setActiveFileHeader(file.name);
      await handleFile(file.data, true);
      fullScreenOverlay.style.display = "none";
    };

    item.addEventListener("click", openFile);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFile();
      }
    });

    recentFilesList.appendChild(item);
  });
}

function setupMonaco() {
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs",
    },
  });

  require(["vs/editor/editor.main"], function () {
    splitManager.init(editorWrapper);
    renderRecentFiles();
  });
}

document.addEventListener("DOMContentLoaded", setupMonaco);
