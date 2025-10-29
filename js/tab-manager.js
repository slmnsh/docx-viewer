// Tab management logic
const tabsContainer = document.getElementById("tabsContainer")
const editorContainer = document.getElementById("editorContainer")
const imageContainer = document.getElementById("imageContainer")
const docxImage = document.getElementById("docxImage")

let openTabs = []
let activeTabPath = null
const fileCache = {}

const monacoEditor = null // Declare monacoEditor variable
const updateFileTreeSelection = null // Declare updateFileTreeSelection variable
const displayFileInMonaco = null // Declare displayFileInMonaco variable

function renderTabs() {
  tabsContainer.innerHTML = ""
  openTabs.forEach((tab) => {
    const tabEl = document.createElement("div")
    tabEl.className = "tab" + (tab.path === activeTabPath ? " active" : "")

    const label = document.createElement("span")
    label.className = "tab-label"
    label.textContent = tab.name
    label.title = tab.path

    const closeBtn = document.createElement("span")
    closeBtn.className = "tab-close"
    closeBtn.innerHTML = "×"
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      closeTab(tab.path)
    })

    tabEl.appendChild(label)
    tabEl.appendChild(closeBtn)
    tabEl.addEventListener("click", () => switchToTab(tab.path))
    tabsContainer.appendChild(tabEl)
  })
}

function openTab(path, name, content, type) {
  const existingTab = openTabs.find((t) => t.path === path)
  if (existingTab) {
    switchToTab(path)
    return
  }

  // Save current tab's scroll state before opening new tab
  if (activeTabPath && monacoEditor) {
    const currentTab = openTabs.find((t) => t.path === activeTabPath)
    if (currentTab && currentTab.type !== "image") {
      currentTab.viewState = monacoEditor.saveViewState()
    }
  }

  openTabs.push({ path, name, content, type })
  activeTabPath = path
  renderTabs()
  displayContent(content, type)
}

function closeTab(path) {
  const index = openTabs.findIndex((t) => t.path === path)
  if (index === -1) return

  openTabs.splice(index, 1)

  if (activeTabPath === path) {
    if (openTabs.length > 0) {
      const newActiveTab = openTabs[Math.max(0, index - 1)]
      activeTabPath = newActiveTab.path
      displayContent(newActiveTab.content, newActiveTab.type, newActiveTab.viewState)
    } else {
      activeTabPath = null
      editorContainer.style.display = ""
      imageContainer.style.display = "none"
      if (monacoEditor) monacoEditor.setValue("")
    }
  }

  renderTabs()
}

function switchToTab(path) {
  const tab = openTabs.find((t) => t.path === path)
  if (!tab) return

  // Save current tab's scroll state before switching
  if (activeTabPath && monacoEditor) {
    const currentTab = openTabs.find((t) => t.path === activeTabPath)
    if (currentTab && currentTab.type !== "image") {
      currentTab.viewState = monacoEditor.saveViewState()
    }
  }

  activeTabPath = path
  renderTabs()
  displayContent(tab.content, tab.type, tab.viewState)
  if (updateFileTreeSelection) updateFileTreeSelection(path) // Use updateFileTreeSelection if declared
}

function displayContent(content, type, viewState) {
  if (type === "image") {
    editorContainer.style.display = "none"
    imageContainer.style.display = "flex"
    docxImage.src = content
  } else {
    imageContainer.style.display = "none"
    editorContainer.style.display = ""
    if (displayFileInMonaco) displayFileInMonaco(content, type, viewState) // Use displayFileInMonaco if declared
  }
}

function clearAllTabs() {
  openTabs = []
  activeTabPath = null
  renderTabs()
  if (monacoEditor) monacoEditor.setValue("")
}
