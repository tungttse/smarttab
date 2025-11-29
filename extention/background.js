// SmartTab Background Service Worker
// Tracks website visits, manages tabs, and handles storage

class SmartTabBackground {
  constructor() {
    this.activeTab = null;
    this.activeTabStartTime = null;
    this.tabTimers = new Map(); // Track time spent per tab
    this.autoSortEnabled = true;
    this.init();
  }

  async init() {
    // Initialize storage structure
    await this.initializeStorage();
    
    // Set up event listeners
    this.setupTabListeners();
    this.setupMessageListeners();
    
    // Load settings
    await this.loadSettings();
  }

  async initializeStorage() {
    const data = await chrome.storage.local.get(['visits', 'domains', 'settings', 'blockedDomains', 'dismissedReminders', 'dailyActiveTime']);
    
    if (!data.visits) {
      await chrome.storage.local.set({ visits: [] });
    }
    if (!data.domains) {
      await chrome.storage.local.set({ domains: {} });
    }
    if (!data.settings) {
      await chrome.storage.local.set({ 
        settings: { 
          autoSortEnabled: true,
          reminderTimeMinutes: 60
        } 
      });
    }
    if (!data.blockedDomains) {
      await chrome.storage.local.set({ blockedDomains: [] });
    }
    if (!data.dismissedReminders) {
      await chrome.storage.local.set({ dismissedReminders: [] });
    }
    
    // Initialize daily active time
    const todayKey = this.getTodayDateKey();
    if (!data.dailyActiveTime || data.dailyActiveTime.date !== todayKey) {
      await chrome.storage.local.set({ 
        dailyActiveTime: {
          date: todayKey,
          totalTime: 0
        }
      });
    }
    
    // Initialize blocking rules
    await this.updateBlockingRules();
  }

  getTodayDateKey() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  async loadSettings() {
    const data = await chrome.storage.local.get(['settings']);
    if (data.settings) {
      this.autoSortEnabled = data.settings.autoSortEnabled !== false;
    }
  }

  setupTabListeners() {
    // Track when tab is updated (URL changes, page loads)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tab);
      }
    });

    // Track when tab becomes active
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.handleTabActivated(activeInfo.tabId);
    });

    // Track when tab is closed (save time spent)
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // Track when window focus changes
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Window lost focus, save current tab time
        this.pauseCurrentTab();
      } else {
        // Window gained focus, resume tracking
        this.resumeCurrentTab();
      }
    });
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getVisitStats':
          const stats = await this.getVisitStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'sortTabs':
          const result = await this.sortTabsByDomain();
          sendResponse({ success: true, result });
          break;

        case 'getTabs':
          const tabs = await this.getAllTabs();
          sendResponse({ success: true, tabs });
          break;

        case 'toggleAutoSort':
          this.autoSortEnabled = request.enabled;
          await chrome.storage.local.set({ 
            settings: { autoSortEnabled: this.autoSortEnabled } 
          });
          sendResponse({ success: true });
          break;

        case 'blockDomain':
          const blockResult = await this.blockDomain(request.domain);
          sendResponse({ success: blockResult });
          break;

        case 'unblockDomain':
          const unblockResult = await this.unblockDomain(request.domain);
          sendResponse({ success: unblockResult });
          break;

        case 'groupTabs':
          const groupResult = await this.groupTabsByDomain();
          sendResponse({ success: true, result: groupResult });
          break;

        case 'getReminders':
          const reminders = await this.getReminders(request.reminderTimeMinutes);
          sendResponse({ success: true, reminders });
          break;

        case 'dismissReminder':
          const dismissResult = await this.dismissReminder(request.domain);
          sendResponse({ success: dismissResult });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleTabUpdate(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    const domain = this.extractDomain(tab.url);
    const timestamp = Date.now();

    // Save previous tab time if switching
    if (this.activeTab && this.activeTab.id !== tab.id) {
      await this.saveTabTime(this.activeTab.id);
    }

    // Start tracking new tab
    this.activeTab = tab;
    this.activeTabStartTime = timestamp;

    // Record visit
    await this.recordVisit({
      url: tab.url,
      domain: domain,
      title: tab.title || 'Untitled',
      timestamp: timestamp
    });

    // Auto sort if enabled
    if (this.autoSortEnabled) {
      setTimeout(() => this.autoSortOnNewTab(tab), 1000); // Delay to avoid sorting too frequently
    }
  }

  async handleTabActivated(tabId) {
    // Save previous active tab time
    if (this.activeTab) {
      await this.saveTabTime(this.activeTab.id);
    }

    // Get new active tab
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      this.activeTab = tab;
      this.activeTabStartTime = Date.now();
    }
  }

  handleTabRemoved(tabId) {
    // Save time when tab is closed
    if (this.activeTab && this.activeTab.id === tabId) {
      this.saveTabTime(tabId);
      this.activeTab = null;
      this.activeTabStartTime = null;
    }
    this.tabTimers.delete(tabId);
  }

  pauseCurrentTab() {
    if (this.activeTab && this.activeTabStartTime) {
      this.saveTabTime(this.activeTab.id);
      this.activeTabStartTime = null;
    }
  }

  async resumeCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      this.activeTab = tab;
      this.activeTabStartTime = Date.now();
    }
  }

  async saveTabTime(tabId) {
    if (!this.activeTab || this.activeTab.id !== tabId || !this.activeTabStartTime) {
      return;
    }

    const timeSpent = Date.now() - this.activeTabStartTime;
    if (timeSpent < 1000) return; // Ignore very short visits (< 1 second)

    const domain = this.extractDomain(this.activeTab.url);
    
    // Update domain statistics
    await this.updateDomainStats(domain, timeSpent);
    
    // Update visit record if recent
    await this.updateRecentVisit(this.activeTab.url, timeSpent);
    
    // Update daily active time (không quan tâm domain)
    await this.updateDailyActiveTime(timeSpent);

    // Reset timer
    this.activeTabStartTime = null;
  }

  async updateDailyActiveTime(timeSpent) {
    try {
      const todayKey = this.getTodayDateKey();
      const data = await chrome.storage.local.get(['dailyActiveTime']);
      let dailyActiveTime = data.dailyActiveTime || {};
      
      // Reset nếu không phải ngày hôm nay
      if (dailyActiveTime.date !== todayKey) {
        dailyActiveTime.date = todayKey;
        dailyActiveTime.totalTime = 0;
      }
      
      dailyActiveTime.totalTime = (dailyActiveTime.totalTime || 0) + timeSpent;
      
      await chrome.storage.local.set({ dailyActiveTime });
    } catch (error) {
      console.error('Error updating daily active time:', error);
    }
  }

  async getDailyActiveTime() {
    try {
      const todayKey = this.getTodayDateKey();
      const data = await chrome.storage.local.get(['dailyActiveTime']);
      const dailyActiveTime = data.dailyActiveTime || {};
      
      // Return 0 if not today
      if (dailyActiveTime.date !== todayKey) {
        return 0;
      }
      
      return dailyActiveTime.totalTime || 0;
    } catch (error) {
      console.error('Error getting daily active time:', error);
      return 0;
    }
  }

  async recordVisit(visit) {
    const data = await chrome.storage.local.get(['visits', 'domains', 'dismissedReminders']);
    const visits = data.visits || [];
    const domains = data.domains || {};
    const dismissedReminders = data.dismissedReminders || [];

    // Add new visit
    visits.unshift({
      ...visit,
      visitCount: 1,
      timeSpent: 0
    });

    // Keep only last 1000 visits
    if (visits.length > 1000) {
      visits.splice(1000);
    }

    // Update domain count
    if (!domains[visit.domain]) {
      domains[visit.domain] = {
        count: 0,
        totalTime: 0,
        lastVisit: visit.timestamp
      };
    }
    domains[visit.domain].count += 1;
    domains[visit.domain].lastVisit = visit.timestamp;

    // Remove from dismissed reminders if domain was visited again
    const updatedDismissed = dismissedReminders.filter(d => d !== visit.domain);

    await chrome.storage.local.set({ 
      visits, 
      domains,
      dismissedReminders: updatedDismissed
    });
  }

  async updateDomainStats(domain, timeSpent) {
    const data = await chrome.storage.local.get(['domains']);
    const domains = data.domains || {};

    if (!domains[domain]) {
      domains[domain] = {
        count: 0,
        totalTime: 0,
        lastVisit: Date.now()
      };
    }

    domains[domain].totalTime = (domains[domain].totalTime || 0) + timeSpent;
    await chrome.storage.local.set({ domains });
  }

  async updateRecentVisit(url, timeSpent) {
    const data = await chrome.storage.local.get(['visits']);
    const visits = data.visits || [];

    // Find and update the most recent visit to this URL
    const recentVisit = visits.find(v => v.url === url);
    if (recentVisit) {
      recentVisit.timeSpent = (recentVisit.timeSpent || 0) + timeSpent;
    }

    await chrome.storage.local.set({ visits });
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return 'unknown';
    }
  }

  async getVisitStats() {
    const data = await chrome.storage.local.get(['visits', 'domains']);
    const visits = data.visits || [];
    const domains = data.domains || {};

    // Calculate totals
    const totalVisits = visits.length;
    const totalTime = Object.values(domains).reduce((sum, d) => sum + (d.totalTime || 0), 0);
    const uniqueDomains = Object.keys(domains).length;
    
    // Get daily active time (today only)
    const dailyActiveTime = await this.getDailyActiveTime();

    // Get recent visits (last 20)
    const recentVisits = visits.slice(0, 20);

    // Get top domains (sorted by count or time)
    const topDomains = Object.entries(domains)
      .map(([domain, stats]) => ({
        domain,
        count: stats.count || 0,
        totalTime: stats.totalTime || 0,
        lastVisit: stats.lastVisit || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalVisits,
      totalTime,
      dailyActiveTime,
      uniqueDomains,
      recentVisits,
      topDomains,
      domains
    };
  }

  async getAllTabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      domain: this.extractDomain(tab.url || ''),
      active: tab.active,
      windowId: tab.windowId
    }));
  }

  async getReminders(reminderTimeMinutes = 60) {
    try {
      const data = await chrome.storage.local.get(['domains', 'visits', 'dismissedReminders']);
      const domains = data.domains || {};
      const visits = data.visits || [];
      const dismissedReminders = data.dismissedReminders || [];
      
      const now = Date.now();
      const reminderTimeMs = reminderTimeMinutes * 60 * 1000;
      const reminders = [];

      // Check each domain
      for (const [domain, stats] of Object.entries(domains)) {
        if (!stats.lastVisit) continue;
        
        const timeSinceLastVisit = now - stats.lastVisit;
        
        // If last visit was more than reminderTimeMinutes ago
        if (timeSinceLastVisit >= reminderTimeMs) {
          // Check if not dismissed
          if (!dismissedReminders.includes(domain)) {
            // Find most recent visit for this domain to get title
            const recentVisit = visits.find(v => v.domain === domain);
            
            reminders.push({
              domain: domain,
              title: recentVisit?.title || domain,
              url: recentVisit?.url || `https://${domain}`,
              lastVisit: stats.lastVisit,
              timeSince: timeSinceLastVisit,
              visitCount: stats.count || 0
            });
          }
        }
      }

      // Sort by time since last visit (oldest first)
      reminders.sort((a, b) => b.timeSince - a.timeSince);

      return reminders;
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }

  async dismissReminder(domain) {
    try {
      const data = await chrome.storage.local.get(['dismissedReminders']);
      const dismissedReminders = data.dismissedReminders || [];
      
      if (!dismissedReminders.includes(domain)) {
        dismissedReminders.push(domain);
        await chrome.storage.local.set({ dismissedReminders });
      }
      return true;
    } catch (error) {
      console.error('Error dismissing reminder:', error);
      return false;
    }
  }

  async sortTabsByDomain() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      // Filter out chrome:// and extension pages
      const webTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://')
      );

      if (webTabs.length <= 1) {
        return { sorted: false, reason: 'Not enough tabs to sort' };
      }

      // Group tabs by domain
      const domainGroups = {};
      webTabs.forEach(tab => {
        const domain = this.extractDomain(tab.url);
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      });

      // Sort domains alphabetically
      const sortedDomains = Object.keys(domainGroups).sort();

      // Move tabs to new positions
      let newIndex = 0;
      for (const domain of sortedDomains) {
        const groupTabs = domainGroups[domain];
        for (const tab of groupTabs) {
          if (tab.index !== newIndex) {
            await chrome.tabs.move(tab.id, { index: newIndex });
          }
          newIndex++;
        }
      }

      return { sorted: true, groups: sortedDomains.length };
    } catch (error) {
      console.error('Error sorting tabs:', error);
      return { sorted: false, error: error.message };
    }
  }

  async autoSortOnNewTab(newTab) {
    // Only auto-sort if enabled and tab is a web page
    if (!this.autoSortEnabled || !newTab.url || 
        newTab.url.startsWith('chrome://') || 
        newTab.url.startsWith('chrome-extension://')) {
      return;
    }

    // Debounce: only sort if no other tab was created recently
    clearTimeout(this.autoSortTimeout);
    this.autoSortTimeout = setTimeout(async () => {
      await this.sortTabsByDomain();
    }, 2000); // Wait 2 seconds after last tab creation
  }

  async groupTabsByDomain() {
    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      // Filter out chrome:// and extension pages
      const webTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://')
      );

      if (webTabs.length <= 1) {
        return { grouped: false, reason: 'Not enough tabs to group' };
      }

      // First, sort tabs by domain to group them together
      await this.sortTabsByDomain();

      // Get tabs again after sorting
      const sortedTabs = await chrome.tabs.query({ currentWindow: true });
      const sortedWebTabs = sortedTabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://')
      );

      // Group tabs by domain
      const domainGroups = {};
      sortedWebTabs.forEach(tab => {
        const domain = this.extractDomain(tab.url);
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      });

      // Get existing groups
      const windowId = sortedTabs[0]?.windowId || chrome.windows.WINDOW_ID_CURRENT;
      const existingGroups = await chrome.tabGroups.query({ windowId });
      const domainToGroupId = new Map();
      
      // Map existing groups to domains
      for (const group of existingGroups) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          const firstTabDomain = this.extractDomain(groupTabs[0].url);
          domainToGroupId.set(firstTabDomain, group.id);
        }
      }

      // Create or update groups for each domain
      let groupCount = 0;
      const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
      let colorIndex = 0;

      for (const [domain, domainTabs] of Object.entries(domainGroups)) {
        if (domainTabs.length < 1) continue;

        const tabIds = domainTabs.map(tab => tab.id);
        
        // Check if domain already has a group
        if (domainToGroupId.has(domain)) {
          // Update existing group
          const existingGroupId = domainToGroupId.get(domain);
          const existingGroupTabs = await chrome.tabs.query({ groupId: existingGroupId });
          const existingTabIds = existingGroupTabs.map(t => t.id);
          
          // Add any new tabs to the group
          const newTabIds = tabIds.filter(id => !existingTabIds.includes(id));
          if (newTabIds.length > 0) {
            await chrome.tabs.group({ groupId: existingGroupId, tabIds: newTabIds });
          }
          
          // Update group title and color
          await chrome.tabGroups.update(existingGroupId, {
            title: domain,
            color: colors[colorIndex % colors.length],
            collapsed: false
          });
        } else {
          // Create new group
          try {
            // Ungroup tabs first if they're in other groups
            const tabsToGroup = [];
            for (const tabId of tabIds) {
              const tab = await chrome.tabs.get(tabId);
              if (tab.groupId !== chrome.tabs.TAB_GROUP_ID_NONE) {
                await chrome.tabs.ungroup(tabId);
              }
              tabsToGroup.push(tabId);
            }
            
            if (tabsToGroup.length > 0) {
              const groupId = await chrome.tabs.group({ tabIds: tabsToGroup });
              await chrome.tabGroups.update(groupId, {
                title: domain,
                color: colors[colorIndex % colors.length],
                collapsed: false
              });
              groupCount++;
            }
          } catch (error) {
            console.error(`Error grouping tabs for domain ${domain}:`, error);
          }
        }
        colorIndex++;
      }

      return { grouped: true, groups: groupCount || Object.keys(domainGroups).length };
    } catch (error) {
      console.error('Error grouping tabs:', error);
      return { grouped: false, error: error.message };
    }
  }

  async updateBlockingRules() {
    try {
      const data = await chrome.storage.local.get(['blockedDomains']);
      const blockedDomains = data.blockedDomains || [];

      // Remove all existing rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      if (existingRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRules.map(rule => rule.id)
        });
      }

      // Add new blocking rules with redirect to blocked.html
      if (blockedDomains.length > 0) {
        const extensionId = chrome.runtime.id;
        const rules = blockedDomains.map((domain, index) => ({
          id: index + 1,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}`
            }
          },
          condition: {
            requestDomains: [domain],
            resourceTypes: ['main_frame']
          }
        }));

        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        });
      }
    } catch (error) {
      console.error('Error updating blocking rules:', error);
    }
  }

  async blockDomain(domain) {
    try {
      const data = await chrome.storage.local.get(['blockedDomains']);
      const blockedDomains = data.blockedDomains || [];
      
      if (!blockedDomains.includes(domain)) {
        blockedDomains.push(domain);
        await chrome.storage.local.set({ blockedDomains });
        await this.updateBlockingRules();
        
        // Close any open tabs from this domain
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.url) {
            try {
              const tabDomain = this.extractDomain(tab.url);
              if (tabDomain === domain) {
                await chrome.tabs.remove(tab.id);
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error blocking domain:', error);
      return false;
    }
  }

  async unblockDomain(domain) {
    try {
      const data = await chrome.storage.local.get(['blockedDomains']);
      const blockedDomains = data.blockedDomains || [];
      
      const filtered = blockedDomains.filter(d => d !== domain);
      await chrome.storage.local.set({ blockedDomains: filtered });
      await this.updateBlockingRules();
      return true;
    } catch (error) {
      console.error('Error unblocking domain:', error);
      return false;
    }
  }
}

// Initialize background service
new SmartTabBackground();