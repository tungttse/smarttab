// Tab Manager
// Handles tab sorting and grouping functionality

class TabManager {
  constructor() {
    this.autoSortEnabled = true;
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get(['settings']);
      if (data.settings) {
        this.autoSortEnabled = data.settings.autoSortEnabled !== false;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async sortTabs() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'sortTabs' });
      if (response.success) {
        showToastMessage('Tabs sorted successfully!', 'success');
        this.updateTabsInfo();
      } else {
        showToastMessage('Failed to sort tabs', 'error');
      }
    } catch (error) {
      console.error('Error sorting tabs:', error);
      showToastMessage('Error sorting tabs', 'error');
    }
  }

  async groupTabs() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'groupTabs' });
      if (response.success && response.result) {
        if (response.result.grouped) {
          showToastMessage(`Tabs grouped into ${response.result.groups} groups!`, 'success');
          this.updateTabsInfo();
        } else {
          showToastMessage(response.result.reason || 'Failed to group tabs', 'error');
        }
      } else {
        showToastMessage('Failed to group tabs', 'error');
      }
    } catch (error) {
      console.error('Error grouping tabs:', error);
      showToastMessage('Error grouping tabs', 'error');
    }
  }

  async toggleAutoSort(enabled) {
    try {
      await chrome.runtime.sendMessage({ 
        action: 'toggleAutoSort', 
        enabled 
      });
      this.autoSortEnabled = enabled;
    } catch (error) {
      console.error('Error toggling auto sort:', error);
    }
  }

  async updateTabsInfo() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTabs' });
      if (response.success && response.tabs) {
        const webTabs = response.tabs.filter(tab => 
          tab.url && 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://')
        );
        
        const container = document.getElementById('tabs-info');
        if (container) {
          container.textContent = `${webTabs.length} tab${webTabs.length !== 1 ? 's' : ''} open`;
        }
      }
    } catch (error) {
      console.error('Error updating tabs info:', error);
    }
  }
}
