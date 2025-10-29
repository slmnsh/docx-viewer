// Main initialization and XML worker setup
let xmlWorker
const fileCache = {} // Declare fileCache variable
const docxName = "" // Declare docxName variable

const editorLoading = document.getElementById("editorLoading")

function showLoading() {
  editorLoading.style.display = "flex"
}

function hideLoading() {
  editorLoading.style.display = "none"
}

function saveFileToDB(filePath, content) {
  // Placeholder for saveFileToDB function
  console.log("Saving file to DB:", filePath, content)
}

function openTab(path, name, content, type) {
  // Placeholder for openTab function
  console.log("Opening tab:", path, name, content, type)
}
// Initialize XML formatting worker
;(function initWorker() {
  const blob = new Blob(
    [
      `
      importScripts('https://cdn.jsdelivr.net/npm/xml-formatter@3.6.7/dist/browser/xml-formatter-singleton.js');
      self.onmessage = function(e){
        const { text, path } = e.data;
        try {
          const formatted = xmlFormatter(text);
          self.postMessage({ success:true, formatted, path });
        } catch(err){
          self.postMessage({ success:false, error: err.message, path });
        }
      };
    `,
    ],
    { type: "application/javascript" },
  )

  xmlWorker = new Worker(URL.createObjectURL(blob))

  xmlWorker.onmessage = (e) => {
    const { success, formatted, error, path, fileName } = e.data
    if (success) {
      fileCache[path] = formatted
      saveFileToDB(docxName + "/" + path, formatted)
      const name = fileName || path.split("/").pop()
      openTab(path, name, formatted, "xml")
    } else {
      const name = fileName || path.split("/").pop()
      openTab(path, name, "Error formatting XML: " + error, "plaintext")
    }
    hideLoading()
  }
})()
