// Blocked Domain Manager
// Handles domain blocking functionality

class BlockedDomainManager {
  constructor() {
    this.blockedDomains = new Set();
  }

  async loadBlockedDomains() {
    try {
      const data = await chrome.storage.local.get(['blockedDomains']);
      if (data.blockedDomains && Array.isArray(data.blockedDomains)) {
        this.blockedDomains = new Set(data.blockedDomains);
      }
      return this.blockedDomains;
    } catch (error) {
      console.error('Error loading blocked domains:', error);
      return this.blockedDomains;
    }
  }

  async saveBlockedDomains() {
    try {
      await chrome.storage.local.set({
        blockedDomains: Array.from(this.blockedDomains)
      });
    } catch (error) {
      console.error('Error saving blocked domains:', error);
    }
  }

  async blockDomain(domain) {
    try {
      this.blockedDomains.add(domain);
      await this.saveBlockedDomains();
      
      await chrome.runtime.sendMessage({
        action: 'blockDomain',
        domain: domain
      });
      
      return true;
    } catch (error) {
      console.error('Error blocking domain:', error);
      return false;
    }
  }

  async unblockDomain(domain) {
    try {
      this.blockedDomains.delete(domain);
      await this.saveBlockedDomains();
      
      await chrome.runtime.sendMessage({
        action: 'unblockDomain',
        domain: domain
      });
      
      return true;
    } catch (error) {
      console.error('Error unblocking domain:', error);
      return false;
    }
  }

  isBlocked(domain) {
    return this.blockedDomains.has(domain);
  }

  async init() {
    await this.loadBlockedDomains();
  }
}
