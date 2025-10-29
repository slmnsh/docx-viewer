// Global state and shared variables
let xmlWorker
let monacoEditor
let editorContainer
const zipFilesMap = {}
const docxName = ""
const selectedFileLi = null
const openTabs = []
const activeTabPath = null
const fileCache = {}

// DOM elements
const tabsContainer = document.getElementById("tabsContainer")
const imageContainer = document.getElementById("imageContainer")
const docxImage = document.getElementById("docxImage")
const fileTreeDiv = document.getElementById("fileTree")
const fileSearch = document.getElementById("fileSearch")
const editorLoading = document.getElementById("editorLoading")
const uploadBtn = document.getElementById("uploadBtn")
const fullScreenOverlay = document.getElementById("fullScreenOverlay")
const welcomeSection = document.getElementById("welcomeSection")
const recentFilesList = document.getElementById("recentFilesList")
