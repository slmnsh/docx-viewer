// File tree rendering and filtering logic
const fileTreeDiv = document.getElementById("fileTree")
const fileSearch = document.getElementById("fileSearch")

let selectedFileLi = null

// Supported image extensions
const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp"]

// Declare variables before using them
const zipFilesMap = {} // Placeholder for zipFilesMap
const openTab = () => {} // Placeholder for openTab
const fileCache = {} // Placeholder for fileCache
const loadFileFromDB = async () => {} // Placeholder for loadFileFromDB
const docxName = "" // Placeholder for docxName
const showLoading = () => {} // Placeholder for showLoading
const xmlWorker = {} // Placeholder for xmlWorker
const saveFileToDB = async () => {} // Placeholder for saveFileToDB

function isImageFile(path) {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase()
  return imageExtensions.includes(ext)
}

function getFileClass(path) {
  if (isImageFile(path)) return "file file-image"
  if (path.endsWith(".xml")) return "file file-xml"
  if (path.endsWith(".txt")) return "file file-text"
  if (path.match(/\.(ttf|otf|woff|woff2)$/i)) return "file file-font"
  return "file file-default"
}

function renderFileTree(tree) {
  fileTreeDiv.innerHTML = ""
  fileTreeDiv.appendChild(renderTree(tree))
}

function renderTree(obj, path = "") {
  const ul = document.createElement("ul")
  Object.keys(obj)
    .sort((a, b) => {
      const aF = obj[a] !== null,
        bF = obj[b] !== null
      if (aF && !bF) return -1
      if (!aF && bF) return 1
      return a.localeCompare(b)
    })
    .forEach((key) => {
      const fullPath = path ? path + "/" + key : key
      const li = document.createElement("li")

      const labelDiv = document.createElement("div")
      labelDiv.className = "labelContainer"
      const nameSpan = document.createElement("span")
      nameSpan.textContent = key
      nameSpan.className = "fileName"
      labelDiv.appendChild(nameSpan)

      li.appendChild(labelDiv)
      if (obj[key]) {
        li.className = "folder collapsed"
        const childUl = renderTree(obj[key], fullPath)
        li.appendChild(childUl)
        labelDiv.addEventListener("click", (e) => {
          e.stopPropagation()
          li.classList.toggle("collapsed")
          childUl.style.display = li.classList.contains("collapsed") ? "none" : "block"
        })
      } else {
        li.className = getFileClass(fullPath)

        // Three-dot menu
        const actionsDiv = document.createElement("div")
        actionsDiv.className = "fileActionsMenu"
        const toggle = document.createElement("span")
        toggle.textContent = "⋮"
        toggle.className = "menuToggle"
        const dropdown = document.createElement("div")
        dropdown.className = "fileActionsDropdown"
        const copyBtn = document.createElement("button")
        copyBtn.textContent = "Copy Path"
        const downloadBtn = document.createElement("button")
        downloadBtn.textContent = "Download"
        dropdown.appendChild(copyBtn)
        dropdown.appendChild(downloadBtn)
        actionsDiv.appendChild(toggle)
        actionsDiv.appendChild(dropdown)
        labelDiv.appendChild(actionsDiv)

        toggle.addEventListener("click", (e) => {
          e.stopPropagation()
          actionsDiv.classList.toggle("open")
        })
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          navigator.clipboard.writeText(fullPath)
          actionsDiv.classList.remove("open")
        })
        downloadBtn.addEventListener("click", async (e) => {
          e.stopPropagation()
          const fd = zipFilesMap[fullPath]
          if (!fd) return
          const blob = await fd.async("blob")
          const a = document.createElement("a")
          a.href = URL.createObjectURL(blob)
          a.download = fullPath.split("/").pop()
          a.click()
          actionsDiv.classList.remove("open")
        })

        labelDiv.addEventListener("click", async (e) => {
          e.stopPropagation()
          if (selectedFileLi) selectedFileLi.classList.remove("selected")
          li.classList.add("selected")
          selectedFileLi = li

          const fd = zipFilesMap[fullPath]
          if (!fd) return

          const fileName = fullPath.split("/").pop()

          // Handle images
          if (isImageFile(fullPath)) {
            const blob = await fd.async("blob")
            const url = URL.createObjectURL(blob)
            openTab(fullPath, fileName, url, "image")
            return
          }

          // Check in-memory cache
          if (fileCache[fullPath]) {
            const type = fullPath.endsWith(".xml") ? "xml" : "plaintext"
            openTab(fullPath, fileName, fileCache[fullPath], type)
            return
          }

          // Check IndexedDB
          const cached = await loadFileFromDB(docxName + "/" + fullPath)
          if (cached) {
            fileCache[fullPath] = cached
            const type = fullPath.endsWith(".xml") ? "xml" : "plaintext"
            openTab(fullPath, fileName, cached, type)
            return
          }

          // Load file content
          const text = await fd.async("text")
          if (fullPath.endsWith(".xml")) {
            showLoading()
            xmlWorker.postMessage({ text, path: fullPath, fileName })
          } else {
            fileCache[fullPath] = text
            saveFileToDB(docxName + "/" + fullPath, text)
            openTab(fullPath, fileName, text, "plaintext")
          }
        })
      }
      ul.appendChild(li)
    })
  return ul
}

// Recursive search/filter
function filterTree(query, ulElement) {
  let anyVisible = false
  ulElement.querySelectorAll(":scope > li").forEach((li) => {
    const name = li.querySelector(".fileName")?.textContent.toLowerCase() || ""
    const childUl = li.querySelector("ul")
    let childVisible = false
    if (childUl) childVisible = filterTree(query, childUl)
    const match = name.includes(query)
    li.style.display = match || childVisible ? "block" : "none"
    anyVisible = anyVisible || match || childVisible
  })
  return anyVisible
}

fileSearch.addEventListener("input", () => {
  const query = fileSearch.value.toLowerCase()
  const topUl = fileTreeDiv.querySelector("ul")
  if (topUl) filterTree(query, topUl)
})

function updateFileTreeSelection(path) {
  if (selectedFileLi) selectedFileLi.classList.remove("selected")

  const allFiles = fileTreeDiv.querySelectorAll("li.file")
  allFiles.forEach((li) => {
    const labelDiv = li.querySelector(".labelContainer")
    if (labelDiv) {
      const fileNameSpan = labelDiv.querySelector(".fileName")
      if (fileNameSpan) {
        let currentPath = ""
        let node = li
        const parts = []

        while (node && node !== fileTreeDiv) {
          const nameSpan = node.querySelector(":scope > .labelContainer > .fileName")
          if (nameSpan) {
            parts.unshift(nameSpan.textContent)
          }
          node = node.parentElement?.closest("li")
        }

        currentPath = parts.join("/")

        if (currentPath === path) {
          li.classList.add("selected")
          selectedFileLi = li
        }
      }
    }
  })
}
