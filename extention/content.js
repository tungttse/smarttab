// Content script for text highlighting and context menu
function clearSelection() {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
}

class TextHighlighter {
  constructor() {
    this.selectedText = '';
    this.isHighlighting = false;
    this.init();
  }

  init() {
    // Listen for text selection
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    // document.addEventListener('keyup', this.handleTextSelection.bind(this));

    // Listen for messages from background script
    // chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 🔑 giữ sendResponse mở cho async
    });
  }

  handleTextSelection(event) {
    if (document.getElementById('hilidea-context-menu')) return;

    clearTimeout(this._menuTimer);
    this._menuTimer = setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      if (selectedText) {
        this.selectedText = selectedText;
        this.showContextMenu(event);
      } else {
        this.hideContextMenu();
      }
    }, 150);
  }

  showContextMenu(event) {
    // Remove existing menu
    this.hideContextMenu();

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'hilidea-context-menu';
    menu.innerHTML = `
      <div class="hilidea-menu-content">
        <button id="hilidea-save-btn" class="hilidea-btn hilidea-save-btn">
          💡 Save & Generate Ideas
        </button>
        <button id="hilidea-cancel-btn" class="hilidea-btn hilidea-cancel-btn">
          ✕ Cancel
        </button>
      </div>
    `;

    // Position menu near cursor
    menu.style.left = event.pageX + 'px';
    menu.style.top = (event.pageY - 50) + 'px';

    document.body.appendChild(menu);

    const saveBtn = document.getElementById('hilidea-save-btn');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveHighlightedText();
      });
    }

    const outsideClickHandler = (e) => {
      if (!menu.contains(e.target)) {
        this.hideContextMenu();
        document.removeEventListener('click', outsideClickHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 0);

    // document.getElementById('hilidea-cancel-btn').addEventListener('click', () => {
    //   this.hideContextMenu();
    // });

    // // Auto-hide after 5 seconds
    // setTimeout(() => {
    //   this.hideContextMenu();
    // }, 60000);
  }

  hideContextMenu() {
    const existingMenu = document.getElementById('hilidea-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }
  }

  async saveHighlightedText() {
    if (!this.selectedText) return;
    this.hideContextMenu();

    // Show loading indicator
    this.showLoadingIndicator();

    try {
      // Send message to background script to save text
      const response = await chrome.runtime.sendMessage({
        action: 'saveHighlightedText',
        text: this.selectedText,
        url: window.location.href,
        title: document.title
      });

      if (response.success) {
        this.showSuccessMessage(response.ideas);
      } else {
        this.showErrorMessage(response.error);
      }
    } catch (error) {
      this.showErrorMessage('Failed to save highlighted text');
    } finally {
      this.hideLoadingIndicator();
    }
  }

  showLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'hilidea-loading';
    indicator.innerHTML = `
      <div class="hilidea-loading-content">
        <div class="hilidea-spinner"></div>
        <span>Generating ideas...</span>
      </div>
    `;
    document.body.appendChild(indicator);
  }

  hideLoadingIndicator() {
    const indicator = document.getElementById('hilidea-loading');
    if (indicator) {
      indicator.remove();
    }
  }

  showSuccessMessage(ideas) {
    const message = document.createElement('div');
    message.id = 'hilidea-success';
    message.innerHTML = `
      <div class="hilidea-success-content">
        <h3>✨ Ideas Generated!</h3>
        <div class="hilidea-ideas-list">
          ${ideas.map(idea => `<div class="hilidea-idea">${idea}</div>`).join('')}
        </div>
        <button id="hilidea-close-success" class="hilidea-btn hilidea-close-btn">Close</button>
      </div>
    `;
    document.body.appendChild(message);

    document.getElementById('hilidea-close-success').addEventListener('click', () => {
      message.remove();
      clearSelection();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (document.getElementById('hilidea-success')) {
        message.remove();
      }
    }, 10000);
  }

  showErrorMessage(error) {
    const message = document.createElement('div');
    message.id = 'hilidea-error';
    message.innerHTML = `
      <div class="hilidea-error-content">
        <h3>❌ Error</h3>
        <p>${error}</p>
        <button id="hilidea-close-error" class="hilidea-btn hilidea-close-btn">Close</button>
      </div>
    `;
    document.body.appendChild(message);

    document.getElementById('hilidea-close-error').addEventListener('click', () => {
      message.remove();
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (document.getElementById('hilidea-error')) {
        message.remove();
      }
    }, 5000);
  }

  handleMessage(request, sender, sendResponse) {
    if (request.action === 'checkLoginStatus') {
      // This will be handled by background script
      return true;
    }
  }
}

// Initialize the highlighter when the page loads
new TextHighlighter();