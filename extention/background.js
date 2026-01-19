// SmartTab Background Service Worker
// Tracks website visits, manages tabs, and handles storage

class SmartTabBackground {
  constructor() {
    this.activeTab = null;
    this.activeTabStartTime = null;
    this.tabTimers = new Map(); // Track time spent per tab
    this.autoSortEnabled = true;
    this.periodicSaveInterval = null;
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
    
    // Start periodic time saving (every 30 seconds)
    this.startPeriodicTimeSave();
  }

  startPeriodicTimeSave() {
    // Save current tab time every 30 seconds to prevent data loss
    this.periodicSaveInterval = setInterval(async () => {
      if (this.activeTab && this.activeTabStartTime) {
        const now = Date.now();
        const timeSpent = now - this.activeTabStartTime;
        
        // Only save if meaningful time has passed (> 1 second)
        if (timeSpent > 1000) {
          const domain = this.extractDomain(this.activeTab.url || '');
          
          // Update domain stats
          await this.updateDomainStats(domain, timeSpent);
          
          // Update recent visit time
          await this.updateRecentVisit(this.activeTab.url, timeSpent);
          
          // Update daily active time
          await this.updateDailyActiveTime(timeSpent);
          
          // Update daily domain time for limits tracking
          await this.updateDomainTimeToday(domain, timeSpent);
          
          // Reset start time to now (so we don't double-count)
          this.activeTabStartTime = now;
        }
      }
    }, 30000); // 30 seconds
  }

  async initializeStorage() {
    const data = await chrome.storage.local.get(['visits', 'domains', 'settings', 'blockedDomains', 'dismissedReminders', 'dailyActiveTime', 'blockedAttempts']);
    
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
    if (!data.blockedAttempts) {
      await chrome.storage.local.set({ blockedAttempts: {} });
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

  // Get timestamp ranges for different periods
  getPeriodRange(period) {
    const now = new Date();
    let start;
    
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        start = new Date(0); // Beginning of time
        break;
    }
    
    return { start: start.getTime(), end: now.getTime() };
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
          const stats = await this.getVisitStats(request.period || 'all');
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
          await this.updateSettings({ autoSortEnabled: this.autoSortEnabled });
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

        case 'recordBlockedAttempt':
          await this.recordBlockedAttempt(request.domain);
          sendResponse({ success: true });
          break;

        case 'getBlockedAttempts':
          const attempts = await this.getBlockedAttempts(request.domain);
          sendResponse({ success: true, attempts });
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

        case 'exportData':
          const exportData = await this.exportAllData();
          sendResponse({ success: true, data: exportData });
          break;

        case 'importData':
          const importResult = await this.importAllData(request.data);
          sendResponse({ success: importResult });
          break;

        case 'setDomainLimit':
          const limitResult = await this.setDomainTimeLimit(request.domain, request.limitMinutes);
          sendResponse({ success: limitResult });
          break;

        case 'getDomainLimits':
          const limits = await this.getDomainLimits();
          sendResponse({ success: true, limits });
          break;

        case 'startFocusMode':
          const focusResult = await this.startFocusMode(request.duration, request.blockedDomains);
          sendResponse({ success: focusResult });
          break;

        case 'stopFocusMode':
          const stopResult = await this.stopFocusMode();
          sendResponse({ success: stopResult });
          break;

        case 'getFocusModeStatus':
          const focusStatus = await this.getFocusModeStatus();
          sendResponse({ success: true, ...focusStatus });
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
    
    // Update daily active time
    await this.updateDailyActiveTime(timeSpent);
    
    // Update daily domain time for limits tracking
    await this.updateDomainTimeToday(domain, timeSpent);

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

  async getVisitStats(period = 'all') {
    const data = await chrome.storage.local.get(['visits', 'domains']);
    const visits = data.visits || [];
    const domains = data.domains || {};
    
    // Get period range
    const range = this.getPeriodRange(period);
    
    console.log('getVisitStats called with period:', period);
    console.log('Range:', new Date(range.start).toISOString(), 'to', new Date(range.end).toISOString());
    console.log('Total visits in storage:', visits.length);
    
    // Filter visits by period
    const periodVisits = visits.filter(v => v.timestamp >= range.start && v.timestamp <= range.end);
    
    console.log('Filtered visits for period:', periodVisits.length);
    
    // Calculate period-based domain stats from visits
    const periodDomainStats = {};
    periodVisits.forEach(visit => {
      const domain = visit.domain;
      if (!periodDomainStats[domain]) {
        periodDomainStats[domain] = { count: 0, totalTime: 0 };
      }
      periodDomainStats[domain].count += 1;
      periodDomainStats[domain].totalTime += (visit.timeSpent || 0);
    });

    // Calculate totals for the period
    const totalVisits = periodVisits.length;
    const totalTime = Object.values(periodDomainStats).reduce((sum, d) => sum + (d.totalTime || 0), 0);
    const uniqueDomains = Object.keys(periodDomainStats).length;
    
    // For 'all' period, use the accumulated domain stats instead
    let finalTotalVisits = totalVisits;
    let finalTotalTime = totalTime;
    let finalUniqueDomains = uniqueDomains;
    
    if (period === 'all') {
      finalTotalVisits = Object.values(domains).reduce((sum, d) => sum + (d.count || 0), 0);
      finalTotalTime = Object.values(domains).reduce((sum, d) => sum + (d.totalTime || 0), 0);
      finalUniqueDomains = Object.keys(domains).length;
    }

    // Get recent visits for this period (last 20)
    const recentVisits = periodVisits.slice(0, 20);

    // Get top domains for this period
    const topDomains = Object.entries(period === 'all' ? domains : periodDomainStats)
      .map(([domain, stats]) => ({
        domain,
        count: stats.count || 0,
        totalTime: stats.totalTime || 0,
        lastVisit: stats.lastVisit || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period,
      totalVisits: finalTotalVisits,
      totalTime: finalTotalTime,
      uniqueDomains: finalUniqueDomains,
      recentVisits,
      topDomains,
      domains: period === 'all' ? domains : periodDomainStats
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
        // Only group domains with 2 or more tabs
        if (domainTabs.length < 2) continue;

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
        const rules = [];
        let ruleId = 1;
        
        for (const domain of blockedDomains) {
          // Block main domain
          rules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: {
                extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}`
              }
            },
            condition: {
              urlFilter: `||${domain}`,
              resourceTypes: ['main_frame']
            }
          });
        }

        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        });
        
        console.log('Blocking rules updated:', rules.length, 'rules for', blockedDomains);
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

  async recordBlockedAttempt(domain) {
    try {
      const data = await chrome.storage.local.get(['blockedAttempts']);
      const blockedAttempts = data.blockedAttempts || {};
      
      if (!blockedAttempts[domain]) {
        blockedAttempts[domain] = {
          count: 0,
          attempts: []
        };
      }
      
      blockedAttempts[domain].count++;
      blockedAttempts[domain].attempts.push({
        timestamp: Date.now()
      });
      
      // Keep only last 50 attempts per domain
      if (blockedAttempts[domain].attempts.length > 50) {
        blockedAttempts[domain].attempts = blockedAttempts[domain].attempts.slice(-50);
      }
      
      await chrome.storage.local.set({ blockedAttempts });
      return true;
    } catch (error) {
      console.error('Error recording blocked attempt:', error);
      return false;
    }
  }

  async getBlockedAttempts(domain) {
    try {
      const data = await chrome.storage.local.get(['blockedAttempts']);
      const blockedAttempts = data.blockedAttempts || {};
      
      if (domain) {
        return blockedAttempts[domain] || { count: 0, attempts: [] };
      }
      return blockedAttempts;
    } catch (error) {
      console.error('Error getting blocked attempts:', error);
      return domain ? { count: 0, attempts: [] } : {};
    }
  }

  // ==================== Settings Management ====================
  async updateSettings(newSettings) {
    try {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      Object.assign(settings, newSettings);
      await chrome.storage.local.set({ settings });
      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  // ==================== Data Export/Import ====================
  async exportAllData() {
    try {
      const data = await chrome.storage.local.get(null);
      return {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: data
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  async importAllData(importData) {
    try {
      if (!importData || !importData.data) {
        throw new Error('Invalid import data format');
      }
      
      // Clear existing data and import new
      await chrome.storage.local.clear();
      await chrome.storage.local.set(importData.data);
      
      // Reinitialize
      await this.initializeStorage();
      await this.loadSettings();
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // ==================== Domain Time Limits ====================
  async setDomainTimeLimit(domain, limitMinutes) {
    try {
      const data = await chrome.storage.local.get(['domainLimits']);
      const domainLimits = data.domainLimits || {};
      
      if (limitMinutes === null || limitMinutes === 0) {
        delete domainLimits[domain];
      } else {
        domainLimits[domain] = {
          limitMinutes: limitMinutes,
          limitMs: limitMinutes * 60 * 1000
        };
      }
      
      await chrome.storage.local.set({ domainLimits });
      return true;
    } catch (error) {
      console.error('Error setting domain limit:', error);
      return false;
    }
  }

  async getDomainLimits() {
    try {
      const data = await chrome.storage.local.get(['domainLimits']);
      return data.domainLimits || {};
    } catch (error) {
      console.error('Error getting domain limits:', error);
      return {};
    }
  }

  async checkDomainLimit(domain) {
    try {
      const data = await chrome.storage.local.get(['domainLimits', 'domains']);
      const domainLimits = data.domainLimits || {};
      const domains = data.domains || {};
      
      if (!domainLimits[domain]) return { exceeded: false };
      
      const limit = domainLimits[domain];
      const domainStats = domains[domain] || { totalTime: 0 };
      
      // Get today's time for this domain
      const todayTime = await this.getDomainTimeToday(domain);
      
      if (todayTime >= limit.limitMs) {
        return { 
          exceeded: true, 
          timeSpent: todayTime,
          limit: limit.limitMs,
          domain: domain
        };
      }
      
      // Warning at 80%
      if (todayTime >= limit.limitMs * 0.8) {
        return {
          exceeded: false,
          warning: true,
          timeSpent: todayTime,
          limit: limit.limitMs,
          remaining: limit.limitMs - todayTime,
          domain: domain
        };
      }
      
      return { exceeded: false, timeSpent: todayTime, limit: limit.limitMs };
    } catch (error) {
      console.error('Error checking domain limit:', error);
      return { exceeded: false };
    }
  }

  async getDomainTimeToday(domain) {
    try {
      const data = await chrome.storage.local.get(['dailyDomainTime']);
      const dailyDomainTime = data.dailyDomainTime || {};
      const todayKey = this.getTodayDateKey();
      
      if (!dailyDomainTime[todayKey]) return 0;
      return dailyDomainTime[todayKey][domain] || 0;
    } catch (error) {
      return 0;
    }
  }

  async updateDomainTimeToday(domain, timeSpent) {
    try {
      const todayKey = this.getTodayDateKey();
      const data = await chrome.storage.local.get(['dailyDomainTime']);
      const dailyDomainTime = data.dailyDomainTime || {};
      
      // Reset if new day
      if (!dailyDomainTime[todayKey]) {
        // Keep only today's data to save space
        Object.keys(dailyDomainTime).forEach(key => {
          if (key !== todayKey) delete dailyDomainTime[key];
        });
        dailyDomainTime[todayKey] = {};
      }
      
      dailyDomainTime[todayKey][domain] = (dailyDomainTime[todayKey][domain] || 0) + timeSpent;
      await chrome.storage.local.set({ dailyDomainTime });
      
      // Check if limit exceeded
      const limitCheck = await this.checkDomainLimit(domain);
      if (limitCheck.warning || limitCheck.exceeded) {
        this.notifyDomainLimit(limitCheck);
      }
    } catch (error) {
      console.error('Error updating domain time today:', error);
    }
  }

  notifyDomainLimit(limitCheck) {
    const minutes = Math.floor(limitCheck.timeSpent / 60000);
    const limitMinutes = Math.floor(limitCheck.limit / 60000);
    
    if (limitCheck.exceeded) {
      chrome.notifications.create(`limit-${limitCheck.domain}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Time Limit Exceeded',
        message: `You've spent ${minutes}m on ${limitCheck.domain} today (limit: ${limitMinutes}m)`,
        priority: 2
      });
    } else if (limitCheck.warning) {
      const remaining = Math.floor(limitCheck.remaining / 60000);
      chrome.notifications.create(`warning-${limitCheck.domain}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Time Limit Warning',
        message: `Only ${remaining}m left for ${limitCheck.domain} today`,
        priority: 1
      });
    }
  }

  // ==================== Focus Mode ====================
  async startFocusMode(durationMinutes, blockedCategories = ['social', 'entertainment']) {
    try {
      const endTime = Date.now() + (durationMinutes * 60 * 1000);
      
      // Default focus mode blocked domains
      const focusBlockedDomains = [
        'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 
        'tiktok.com', 'reddit.com', 'youtube.com', 'netflix.com',
        'twitch.tv', 'discord.com', 'snapchat.com', 'pinterest.com'
      ];
      
      const focusMode = {
        active: true,
        startTime: Date.now(),
        endTime: endTime,
        durationMinutes: durationMinutes,
        blockedDomains: focusBlockedDomains,
        originalBlockedDomains: []
      };
      
      // Save original blocked domains
      const data = await chrome.storage.local.get(['blockedDomains']);
      focusMode.originalBlockedDomains = data.blockedDomains || [];
      
      // Merge focus blocked domains with existing
      const allBlocked = [...new Set([...focusMode.originalBlockedDomains, ...focusBlockedDomains])];
      await chrome.storage.local.set({ 
        focusMode,
        blockedDomains: allBlocked
      });
      
      // Update blocking rules
      await this.updateBlockingRules();
      
      // Set alarm to end focus mode
      chrome.alarms.create('focusModeEnd', { when: endTime });
      
      // Close tabs from blocked domains
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url) {
          const tabDomain = this.extractDomain(tab.url);
          if (focusBlockedDomains.includes(tabDomain)) {
            await chrome.tabs.remove(tab.id);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error starting focus mode:', error);
      return false;
    }
  }

  async stopFocusMode() {
    try {
      const data = await chrome.storage.local.get(['focusMode']);
      const focusMode = data.focusMode;
      
      if (!focusMode) return true;
      
      // Restore original blocked domains
      await chrome.storage.local.set({
        blockedDomains: focusMode.originalBlockedDomains || [],
        focusMode: { active: false }
      });
      
      // Update blocking rules
      await this.updateBlockingRules();
      
      // Cancel alarm
      chrome.alarms.clear('focusModeEnd');
      
      return true;
    } catch (error) {
      console.error('Error stopping focus mode:', error);
      return false;
    }
  }

  async getFocusModeStatus() {
    try {
      const data = await chrome.storage.local.get(['focusMode']);
      const focusMode = data.focusMode || { active: false };
      
      if (!focusMode.active) {
        return { active: false };
      }
      
      const now = Date.now();
      if (now >= focusMode.endTime) {
        await this.stopFocusMode();
        return { active: false };
      }
      
      return {
        active: true,
        remaining: focusMode.endTime - now,
        endTime: focusMode.endTime,
        durationMinutes: focusMode.durationMinutes,
        blockedDomains: focusMode.blockedDomains
      };
    } catch (error) {
      console.error('Error getting focus mode status:', error);
      return { active: false };
    }
  }

  setupAlarmListeners() {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === 'focusModeEnd') {
        await this.stopFocusMode();
        chrome.notifications.create('focusModeEnded', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Focus Mode Ended',
          message: 'Great job staying focused! Take a break.',
          priority: 2
        });
      }
    });
  }

  // ==================== Idle Detection ====================
  setupIdleDetection() {
    // Set idle detection threshold to 60 seconds
    chrome.idle.setDetectionInterval(60);
    
    chrome.idle.onStateChanged.addListener((state) => {
      if (state === 'idle' || state === 'locked') {
        this.pauseCurrentTab();
      } else if (state === 'active') {
        this.resumeCurrentTab();
      }
    });
  }
}

// Initialize background service
const smartTab = new SmartTabBackground();

// Setup alarm listeners after initialization
smartTab.setupAlarmListeners();
smartTab.setupIdleDetection();