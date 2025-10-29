class SplitPane {
  constructor(id, container) {
    this.id = id;
    this.container = container;
    this.tabs = [];
    this.activeTabPath = null;
    this.editor = null;
    this.element = null;
    this.editorContainer = null;
    this.imageContainer = null;
  }

  createUI() {
    const pane = document.createElement('div');
    pane.className = 'splitPane';
    pane.dataset.paneId = this.id;

    const header = document.createElement('div');
    header.className = 'paneHeader';

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'paneTabsContainer';

    const actions = document.createElement('div');
    actions.className = 'paneActions';

    const splitHBtn = document.createElement('button');
    splitHBtn.className = 'paneActionBtn';
    splitHBtn.textContent = 'splitscreen';
    splitHBtn.title = 'Split Horizontally';
    splitHBtn.addEventListener('click', () => splitManager.splitPane(this.id, 'horizontal'));

    const splitVBtn = document.createElement('button');
    splitVBtn.className = 'paneActionBtn';
    splitVBtn.textContent = 'view_week';
    splitVBtn.title = 'Split Vertically';
    splitVBtn.addEventListener('click', () => splitManager.splitPane(this.id, 'vertical'));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'paneActionBtn';
    closeBtn.textContent = 'close';
    closeBtn.title = 'Close Pane';
    closeBtn.addEventListener('click', () => splitManager.closePane(this.id));

    actions.appendChild(splitHBtn);
    actions.appendChild(splitVBtn);
    actions.appendChild(closeBtn);

    header.appendChild(tabsContainer);
    header.appendChild(actions);

    const editorContainer = document.createElement('div');
    editorContainer.className = 'paneEditorContainer';

    const imageContainer = document.createElement('div');
    imageContainer.className = 'paneImageContainer';
    const img = document.createElement('img');
    imageContainer.appendChild(img);

    pane.appendChild(header);
    pane.appendChild(editorContainer);
    pane.appendChild(imageContainer);

    this.element = pane;
    this.tabsContainer = tabsContainer;
    this.editorContainer = editorContainer;
    this.imageContainer = imageContainer;

    pane.addEventListener('click', () => splitManager.setActivePane(this.id));

    return pane;
  }

  initEditor() {
    if (this.editor || !window.monaco) return;

    this.editor = monaco.editor.create(this.editorContainer, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
    });

    monaco.languages.registerFoldingRangeProvider('xml', {
      provideFoldingRanges: function (model) {
        const ranges = [];
        const stack = [];
        for (let i = 1; i <= model.getLineCount(); i++) {
          const line = model.getLineContent(i).trim();
          const open = line.match(/^<([a-zA-Z0-9:_-]+)(\s|>|$)/);
          const close = line.match(/^<\/([a-zA-Z0-9:_-]+)>/);
          if (open && !line.endsWith('/>')) stack.push({ tag: open[1], start: i });
          else if (close && stack.length > 0) {
            const last = stack.pop();
            if (last.tag === close[1] && i > last.start)
              ranges.push({
                start: last.start,
                end: i,
                kind: monaco.languages.FoldingRangeKind.Region,
              });
          }
        }
        return ranges;
      },
    });
  }

  openTab(path, name, content, type) {
    const existingTab = this.tabs.find(t => t.path === path);
    if (existingTab) {
      this.switchToTab(path);
      return;
    }

    if (this.activeTabPath && this.editor) {
      const currentTab = this.tabs.find(t => t.path === this.activeTabPath);
      if (currentTab && currentTab.type !== 'image') {
        currentTab.viewState = this.editor.saveViewState();
      }
    }

    this.tabs.push({ path, name, content, type });
    this.activeTabPath = path;
    this.renderTabs();
    this.displayContent(content, type);
  }

  closeTab(path) {
    const index = this.tabs.findIndex(t => t.path === path);
    if (index === -1) return;

    this.tabs.splice(index, 1);

    if (this.activeTabPath === path) {
      if (this.tabs.length > 0) {
        const newActiveTab = this.tabs[Math.max(0, index - 1)];
        this.activeTabPath = newActiveTab.path;
        this.displayContent(newActiveTab.content, newActiveTab.type, newActiveTab.viewState);
      } else {
        this.activeTabPath = null;
        if (this.editor) this.editor.setValue('');
        this.imageContainer.style.display = 'none';
      }
    }

    this.renderTabs();
  }

  switchToTab(path) {
    const tab = this.tabs.find(t => t.path === path);
    if (!tab) return;

    if (this.activeTabPath && this.editor) {
      const currentTab = this.tabs.find(t => t.path === this.activeTabPath);
      if (currentTab && currentTab.type !== 'image') {
        currentTab.viewState = this.editor.saveViewState();
      }
    }

    this.activeTabPath = path;
    this.renderTabs();
    this.displayContent(tab.content, tab.type, tab.viewState);
  }

  renderTabs() {
    this.tabsContainer.innerHTML = '';
    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (tab.path === this.activeTabPath ? ' active' : '');

      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = tab.name;
      label.title = tab.path;

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.path);
      });

      tabEl.appendChild(label);
      tabEl.appendChild(closeBtn);
      tabEl.addEventListener('click', () => this.switchToTab(tab.path));
      this.tabsContainer.appendChild(tabEl);
    });
  }

  displayContent(content, type, viewState) {
    if (type === 'image') {
      this.editorContainer.style.display = 'none';
      this.imageContainer.style.display = 'flex';
      this.imageContainer.querySelector('img').src = content;
    } else {
      this.imageContainer.style.display = 'none';
      this.editorContainer.style.display = '';
      this.displayFileInEditor(content, type, viewState);
    }
  }

  displayFileInEditor(content, language, viewState) {
    if (!this.editor) {
      this.initEditor();
    }

    if (this.editor) {
      if (!this.editor.getModel()) {
        const model = monaco.editor.createModel(content, 'xml');
        this.editor.setModel(model);
      } else {
        monaco.editor.setModelLanguage(this.editor.getModel(), 'xml');
        this.editor.setValue(content);
      }

      if (viewState) {
        this.editor.restoreViewState(viewState);
        this.editor.focus();
      } else {
        this.editor.revealPosition({ lineNumber: 1, column: 1 });
      }
    }
  }

  dispose() {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
}

class SplitManager {
  constructor() {
    this.panes = new Map();
    this.nextPaneId = 1;
    this.activePaneId = null;
    this.splitStructure = null;
  }

  init(container) {
    this.container = container;
    const initialPane = this.createPane();
    this.container.appendChild(initialPane.element);
    this.setActivePane(initialPane.id);
  }

  createPane() {
    const pane = new SplitPane(this.nextPaneId++, this.container);
    pane.createUI();
    this.panes.set(pane.id, pane);
    return pane;
  }

  setActivePane(paneId) {
    this.panes.forEach(pane => {
      pane.element.classList.remove('active');
    });

    const pane = this.panes.get(paneId);
    if (pane) {
      pane.element.classList.add('active');
      this.activePaneId = paneId;
    }
  }

  getActivePane() {
    return this.panes.get(this.activePaneId);
  }

  openInPane(paneId, path, name, content, type) {
    const pane = this.panes.get(paneId);
    if (pane) {
      pane.openTab(path, name, content, type);
      this.setActivePane(paneId);
    }
  }

  splitPane(paneId, direction) {
    const pane = this.panes.get(paneId);
    if (!pane) return;

    const newPane = this.createPane();

    const splitContainer = document.createElement('div');
    splitContainer.className = `splitContainer ${direction}`;

    const resizer = document.createElement('div');
    resizer.className = `splitResizer ${direction}`;

    const parent = pane.element.parentElement;
    const index = Array.from(parent.children).indexOf(pane.element);

    parent.removeChild(pane.element);

    splitContainer.appendChild(pane.element);
    splitContainer.appendChild(resizer);
    splitContainer.appendChild(newPane.element);

    if (index >= 0 && index < parent.children.length) {
      parent.insertBefore(splitContainer, parent.children[index]);
    } else {
      parent.appendChild(splitContainer);
    }

    this.setupResizer(resizer, splitContainer, direction);

    if (window.monaco) {
      newPane.initEditor();
    }

    this.setActivePane(newPane.id);
  }

  setupResizer(resizer, container, direction) {
    let startPos = 0;
    let startSize1 = 0;
    let startSize2 = 0;
    let pane1, pane2;

    const onMouseDown = (e) => {
      e.preventDefault();
      resizer.classList.add('dragging');

      const children = Array.from(container.children).filter(c => c.classList.contains('splitPane') || c.classList.contains('splitContainer'));
      pane1 = children[0];
      pane2 = children[1];

      if (direction === 'vertical') {
        startPos = e.clientX;
        startSize1 = pane1.offsetWidth;
        startSize2 = pane2.offsetWidth;
      } else {
        startPos = e.clientY;
        startSize1 = pane1.offsetHeight;
        startSize2 = pane2.offsetHeight;
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (direction === 'vertical') {
        const delta = e.clientX - startPos;
        const newSize1 = startSize1 + delta;
        const newSize2 = startSize2 - delta;
        const total = startSize1 + startSize2;

        if (newSize1 > 100 && newSize2 > 100) {
          pane1.style.flex = `0 0 ${(newSize1 / total) * 100}%`;
          pane2.style.flex = `0 0 ${(newSize2 / total) * 100}%`;
        }
      } else {
        const delta = e.clientY - startPos;
        const newSize1 = startSize1 + delta;
        const newSize2 = startSize2 - delta;
        const total = startSize1 + startSize2;

        if (newSize1 > 100 && newSize2 > 100) {
          pane1.style.flex = `0 0 ${(newSize1 / total) * 100}%`;
          pane2.style.flex = `0 0 ${(newSize2 / total) * 100}%`;
        }
      }
    };

    const onMouseUp = () => {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);
  }

  closePane(paneId) {
    if (this.panes.size <= 1) return;

    const pane = this.panes.get(paneId);
    if (!pane) return;

    pane.dispose();

    const element = pane.element;
    const parent = element.parentElement;

    if (parent.classList.contains('splitContainer')) {
      const siblings = Array.from(parent.children).filter(c =>
        c.classList.contains('splitPane') || c.classList.contains('splitContainer')
      );
      const sibling = siblings.find(s => s !== element);
      const grandParent = parent.parentElement;

      if (sibling) {
        grandParent.replaceChild(sibling, parent);
      } else {
        grandParent.removeChild(parent);
      }
    } else {
      parent.removeChild(element);
    }

    this.panes.delete(paneId);

    if (this.activePaneId === paneId) {
      const firstPane = this.panes.values().next().value;
      if (firstPane) {
        this.setActivePane(firstPane.id);
      }
    }
  }
}

const splitManager = new SplitManager();
