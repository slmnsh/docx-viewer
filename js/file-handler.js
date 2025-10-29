// File upload and DOCX loading logic
const hiddenInput = document.createElement("input")
hiddenInput.type = "file"
hiddenInput.accept = ".docx"
hiddenInput.style.display = "none"
document.body.appendChild(hiddenInput)

const uploadBtn = document.getElementById("uploadBtn")
const fullScreenOverlay = document.getElementById("fullScreenOverlay")
const welcomeSection = document.getElementById("welcomeSection")

uploadBtn.addEventListener("click", () => {
  hiddenInput.value = ""
  hiddenInput.click()
})

hiddenInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0])
  fullScreenOverlay.style.display = "none"
})

welcomeSection.addEventListener("click", () => {
  hiddenInput.value = ""
  hiddenInput.click()
})

welcomeSection.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    hiddenInput.value = ""
    hiddenInput.click()
  }
})

// Drag and drop support
;["dragover", "drop"].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault())
})

fullScreenOverlay.addEventListener("drop", (e) => {
  handleFile(e.dataTransfer.files[0])
  fullScreenOverlay.style.display = "none"
})

fullScreenOverlay.addEventListener("dragover", (e) => {
  fullScreenOverlay.style.background = "rgba(40,40,40,0.95)"
})

fullScreenOverlay.addEventListener("dragleave", (e) => {
  fullScreenOverlay.style.background = "rgba(30,30,30,0.95)"
})

// Global state
let zipFilesMap = {}
let docxName

// Declare variables before using them
const JSZip = window.JSZip // Assuming JSZip is available globally
const saveRecentFile = async (fileName, arrayBuffer) => {
  // Implementation for saving recent file
}
const renderRecentFiles = async () => {
  // Implementation for rendering recent files
}
const renderFileTree = (tree) => {
  // Implementation for rendering file tree
}
const clearAllTabs = () => {
  // Implementation for clearing all tabs
}

async function handleFile(file, fromRecent = false) {
  if (!file) return

  let arrayBuffer
  if (fromRecent) {
    arrayBuffer = file
  } else {
    arrayBuffer = await file.arrayBuffer()
    const fileName = file.name
    await saveRecentFile(fileName, arrayBuffer)
    await renderRecentFiles()
  }

  const zip = await JSZip.loadAsync(arrayBuffer)
  zipFilesMap = {}
  Object.keys(zip.files).forEach((path) => {
    if (!zip.files[path].dir) zipFilesMap[path] = zip.files[path]
  })

  const tree = buildTree(Object.keys(zipFilesMap))
  renderFileTree(tree)

  if (!fromRecent) {
    setActiveFileHeader(file.name)
  }

  clearAllTabs()
}

function buildTree(files) {
  const root = {}
  files.forEach((path) => {
    const parts = path.split("/")
    let cur = root
    parts.forEach((part, idx) => {
      cur[part] = cur[part] || (idx === parts.length - 1 ? null : {})
      cur = cur[part] || {}
    })
  })
  return root
}

function setActiveFileHeader(filename) {
  const editorHeader = document.getElementById("viewerHeader")
  editorHeader.textContent = filename || "No file selected"
  docxName = filename
}
