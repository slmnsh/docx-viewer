// Monaco editor setup and management
let monacoEditor
let editorContainer

function displayFileInMonaco(content, language, viewState) {
  editorContainer.style.display = ""
  if (monacoEditor) {
    if (!monacoEditor.getModel()) {
      const model = monacoEditor.createModel(content, "xml")
      monacoEditor.setModel(model)
    } else {
      monacoEditor.getModel().setLanguageId("xml")
      monacoEditor.setValue(content)
    }

    // Restore scroll position if available, otherwise go to top
    if (viewState) {
      monacoEditor.restoreViewState(viewState)
      monacoEditor.focus()
    } else {
      monacoEditor.revealPosition({ lineNumber: 1, column: 1 })
    }
  }
}

function setupMonaco() {
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs",
    },
  })

  require(["vs/editor/editor.main"], () => {
    monacoEditor = window.monaco.editor.create(document.getElementById("editorContainer"), {
      value: "",
      language: "plaintext",
      theme: "vs-dark",
      automaticLayout: true,
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    })

    window.monaco.languages.registerFoldingRangeProvider("xml", {
      provideFoldingRanges: (model) => {
        const ranges = []
        const stack = []
        for (let i = 1; i <= model.getLineCount(); i++) {
          const line = model.getLineContent(i).trim()
          const open = line.match(/^<([a-zA-Z0-9:_-]+)(\s|>|$)/)
          const close = line.match(/^<\/([a-zA-Z0-9:_-]+)>/)
          if (open && !line.endsWith("/>")) stack.push({ tag: open[1], start: i })
          else if (close && stack.length > 0) {
            const last = stack.pop()
            if (last.tag === close[1] && i > last.start)
              ranges.push({
                start: last.start,
                end: i,
                kind: window.monaco.languages.FoldingRangeKind.Region,
              })
          }
        }
        return ranges
      },
    })

    renderRecentFiles()
  })
}

function renderRecentFiles() {
  // Placeholder for rendering recent files logic
  console.log("Rendering recent files...")
}

document.addEventListener("DOMContentLoaded", () => {
  editorContainer = document.getElementById("editorContainer")
  setupMonaco()
})
