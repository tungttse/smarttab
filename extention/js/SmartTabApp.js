// SmartTab Main Application
// Orchestrates all managers and handles initialization

class SmartTabApp {
  constructor() {
    this.backgroundImageManager = new BackgroundImageManager();
    this.blockedDomainManager = new BlockedDomainManager();
    this.statsManager = new StatisticsManager();
    this.todoManager = new TodoManager();
    this.bookmarkManager = new BookmarkManager();
    this.reminderManager = new ReminderManager();
    this.tabManager = new TabManager();
    this.focusModeManager = new FocusModeManager();
    this.chartManager = new ChartManager();
    this.dataManager = new DataManager();
    this.domainLimitsManager = new DomainLimitsManager();
  }

  async init() {
    // Initialize background image first (non-blocking)
    this.backgroundImageManager.init();
    
    // Initialize all managers
    await this.blockedDomainManager.init();
    await this.statsManager.loadStats('today'); // Default to today's stats
    await this.todoManager.loadTodos();
    await this.bookmarkManager.loadBookmarks();
    await this.reminderManager.loadSettings();
    await this.tabManager.loadSettings();
    await this.focusModeManager.init();
    this.chartManager.init();
    await this.domainLimitsManager.loadLimits();

    // Render initial UI
    this.render();
    this.setupEventListeners();
    this.setupTabSwitching();
    this.setupNewFeatureListeners();

    // Refresh stats periodically (keeping current period)
    setInterval(() => {
      this.statsManager.refresh(this.blockedDomainManager, this.statsManager.period);
      this.reminderManager.render();
      this.tabManager.updateTabsInfo();
      this.chartManager.loadAndRender();
      this.domainLimitsManager.render();
    }, 30000);

    // Listen for storage changes for real-time updates
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.visits || changes.domains || changes.dailyDomainTime) {
          this.statsManager.refresh(this.blockedDomainManager);
          this.reminderManager.render();
          this.chartManager.loadAndRender();
          this.domainLimitsManager.render();
        }
        if (changes.todos) {
          this.todoManager.render();
        }
        if (changes.dismissedReminders) {
          this.reminderManager.render();
        }
        if (changes.focusMode) {
          this.focusModeManager.checkStatus().then(() => {
            this.focusModeManager.updateUI();
          });
        }
      }
    });

    // Listen for bookmark changes
    chrome.bookmarks.onCreated.addListener(() => {
      this.bookmarkManager.loadBookmarks().then(() => {
        this.bookmarkManager.render();
      });
    });

    chrome.bookmarks.onRemoved.addListener(() => {
      this.bookmarkManager.loadBookmarks().then(() => {
        this.bookmarkManager.render();
      });
    });

    chrome.bookmarks.onChanged.addListener(() => {
      this.bookmarkManager.loadBookmarks().then(() => {
        this.bookmarkManager.render();
      });
    });
  }

  async render() {
    this.statsManager.displayVisitCount();
    this.statsManager.displayTimeSpent();
    this.statsManager.displayUniqueDomains();
    this.statsManager.displayRecentVisits();
    await this.statsManager.displayTopDomains(this.blockedDomainManager);
    this.statsManager.displayPieChart();
    this.todoManager.render();
    this.bookmarkManager.render();
    await this.reminderManager.render();
    this.tabManager.updateTabsInfo();
    await this.chartManager.loadAndRender();
    await this.domainLimitsManager.render();
  }

  setupNewFeatureListeners() {
    // Focus Mode
    const startFocusBtn = document.getElementById('start-focus-btn');
    const stopFocusBtn = document.getElementById('stop-focus-btn');
    const focusDurationSelect = document.getElementById('focus-duration');

    console.log('Setting up focus mode listeners:', { startFocusBtn, stopFocusBtn, focusDurationSelect });

    if (startFocusBtn) {
      startFocusBtn.addEventListener('click', async () => {
        console.log('Start focus button clicked');
        const duration = parseInt(focusDurationSelect?.value || '25');
        console.log('Duration:', duration);
        await this.focusModeManager.start(duration);
      });
    } else {
      console.error('Start focus button not found!');
    }

    if (stopFocusBtn) {
      stopFocusBtn.addEventListener('click', async () => {
        await this.focusModeManager.stop();
      });
    }

    // Data Export/Import
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.dataManager.exportData();
      });
    }

    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', () => {
        importFileInput.click();
      });

      importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.dataManager.importData(file);
          importFileInput.value = '';
        }
      });
    }

    // Domain Time Limits
    const addLimitBtn = document.getElementById('add-limit-btn');
    const limitDomainInput = document.getElementById('limit-domain-input');
    const limitTimeSelect = document.getElementById('limit-time-select');

    if (addLimitBtn && limitDomainInput && limitTimeSelect) {
      const addLimit = async () => {
        const domain = limitDomainInput.value.trim().toLowerCase();
        const minutes = parseInt(limitTimeSelect.value);

        if (!domain) {
          showToastMessage('Please enter a domain', 'error');
          return;
        }

        let cleanDomain = domain
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .split('/')[0];

        await this.domainLimitsManager.setLimit(cleanDomain, minutes);
        limitDomainInput.value = '';
      };

      addLimitBtn.addEventListener('click', addLimit);
      limitDomainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addLimit();
      });
    }
  }

  setupEventListeners() {
    // Statistics tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });

    // Domain sort toggle (by visits vs time spent)
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const sortBy = e.target.dataset.sort;
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.statsManager.sortBy = sortBy;
        await this.statsManager.displayTopDomains(this.blockedDomainManager);
      });
    });

    // Period selector (today, week, month, year, all)
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const period = e.target.dataset.period;
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        await this.statsManager.changePeriod(period, this.blockedDomainManager);
      });
    });

    // Chart mode toggle (visits vs time)
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.chartMode;
        document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.statsManager.chartMode = mode;
        this.statsManager.displayPieChart();
      });
    });

    // Block domain input
    const blockInput = document.getElementById('block-domain-input');
    const addBlockBtn = document.getElementById('add-block-btn');
    
    const addBlockedDomain = async () => {
      const domain = blockInput.value.trim().toLowerCase();
      if (domain) {
        await this.blockedDomainManager.blockDomain(domain);
        this.blockedDomainManager.render();
        blockInput.value = '';
      }
    };

    if (addBlockBtn && blockInput) {
      addBlockBtn.addEventListener('click', addBlockedDomain);
      blockInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addBlockedDomain();
        }
      });
    }

    // Todo input
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo-btn');
    
    const addTodo = () => {
      const text = todoInput.value.trim();
      if (text) {
        this.todoManager.addTodo(text);
        todoInput.value = '';
      }
    };

    if (addTodoBtn && todoInput) {
      addTodoBtn.addEventListener('click', addTodo);
      todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addTodo();
        }
      });
    }

    // Bookmark search
    const bookmarkSearch = document.getElementById('bookmark-search');
    if (bookmarkSearch) {
      bookmarkSearch.addEventListener('input', (e) => {
        this.bookmarkManager.searchBookmarks(e.target.value);
      });
    }

    // Add bookmark button
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    if (addBookmarkBtn) {
      addBookmarkBtn.addEventListener('click', () => {
        this.showBookmarkModal();
      });
    }

    // Bookmark modal
    const bookmarkModal = document.getElementById('bookmark-modal');
    const closeBookmarkModal = document.getElementById('close-bookmark-modal');
    const cancelBookmarkBtn = document.getElementById('cancel-bookmark-btn');
    const saveBookmarkBtn = document.getElementById('save-bookmark-btn');

    const hideModal = () => {
      bookmarkModal.classList.remove('active');
      document.getElementById('bookmark-url').value = '';
      document.getElementById('bookmark-title').value = '';
    };

    if (closeBookmarkModal) closeBookmarkModal.addEventListener('click', hideModal);
    if (cancelBookmarkBtn) cancelBookmarkBtn.addEventListener('click', hideModal);
    
    if (saveBookmarkBtn) {
      saveBookmarkBtn.addEventListener('click', async () => {
        const url = document.getElementById('bookmark-url').value.trim();
        const title = document.getElementById('bookmark-title').value.trim();
        
        if (!url) {
          showToastMessage('Please enter a URL', 'error');
          return;
        }
        
        try {
          saveBookmarkBtn.disabled = true;
          saveBookmarkBtn.textContent = 'Saving...';
          await this.bookmarkManager.addBookmark(url, title || url);
          hideModal();
          showToastMessage('Bookmark added successfully', 'success');
        } catch (error) {
          showToastMessage('Failed to add bookmark: ' + error.message, 'error');
        } finally {
          saveBookmarkBtn.disabled = false;
          saveBookmarkBtn.textContent = 'Save';
        }
      });
    }

    // Tab sorting
    const sortTabsBtn = document.getElementById('sort-tabs-btn');
    if (sortTabsBtn) {
      sortTabsBtn.addEventListener('click', () => {
        this.tabManager.sortTabs();
      });
    }

    // Auto sort toggle
    const autoSortToggle = document.getElementById('auto-sort-toggle');
    if (autoSortToggle) {
      autoSortToggle.checked = this.tabManager.autoSortEnabled;
      autoSortToggle.addEventListener('change', (e) => {
        this.tabManager.toggleAutoSort(e.target.checked);
      });
    }

    // Reminder time select
    const reminderTimeSelect = document.getElementById('reminder-time-select');
    if (reminderTimeSelect) {
      setTimeout(() => {
        reminderTimeSelect.value = this.reminderManager.reminderTimeMinutes;
      }, 100);
      
      reminderTimeSelect.addEventListener('change', async (e) => {
        const minutes = parseInt(e.target.value);
        await this.reminderManager.setReminderTime(minutes);
        showToastMessage(`Reminder time set to ${e.target.options[e.target.selectedIndex].text}`, 'success');
      });
    }
  }

  setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.stats-tabs .tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });
  }

  showBookmarkModal() {
    const modal = document.getElementById('bookmark-modal');
    modal.classList.add('active');
    
    setTimeout(() => {
      document.getElementById('bookmark-url').focus();
    }, 100);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new SmartTabApp();
  app.init();
});
