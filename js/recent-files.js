// Recent files UI and logic
const recentFilesList = document.getElementById("recentFilesList")
const fullScreenOverlay = document.getElementById("fullScreenOverlay")

async function renderRecentFiles() {
  const recentFiles = await getRecentFiles()

  if (recentFiles.length === 0) {
    recentFilesList.innerHTML = '<div id="noRecentFiles">No recent files</div>'
    return
  }

  recentFilesList.innerHTML = ""
  recentFiles.forEach((file) => {
    const item = document.createElement("div")
    item.className = "recentFileItem"
    item.setAttribute("role", "button")
    item.setAttribute("tabindex", "0")

    const icon = document.createElement("span")
    icon.className = "material-icons"
    icon.textContent = "description"

    const info = document.createElement("div")
    info.className = "recentFileInfo"

    const name = document.createElement("div")
    name.className = "recentFileName"
    name.textContent = file.name

    const date = document.createElement("div")
    date.className = "recentFileDate"
    const fileDate = new Date(file.timestamp)
    date.textContent = fileDate.toLocaleDateString() + " " + fileDate.toLocaleTimeString()

    info.appendChild(name)
    info.appendChild(date)

    const deleteBtn = document.createElement("button")
    deleteBtn.className = "material-icons recentFileDelete"
    deleteBtn.textContent = "close"
    deleteBtn.setAttribute("aria-label", "Delete " + file.name)
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation()
      await deleteRecentFile(file.name)
      await renderRecentFiles()
    })

    item.appendChild(icon)
    item.appendChild(info)
    item.appendChild(deleteBtn)

    const openFile = async () => {
      setActiveFileHeader(file.name)
      await handleFile(file.data, true)
      fullScreenOverlay.style.display = "none"
    }

    item.addEventListener("click", openFile)
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openFile()
      }
    })

    recentFilesList.appendChild(item)
  })
}

// Declare variables here or import them from other modules
async function getRecentFiles() {
  // Implementation for getting recent files
}

async function deleteRecentFile(fileName) {
  // Implementation for deleting a recent file
}

function setActiveFileHeader(fileName) {
  // Implementation for setting the active file header
}

async function handleFile(fileData, isRecent) {
  // Implementation for handling file data
}
