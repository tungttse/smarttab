// Domain Limits Manager
// Handles daily time limits per domain

class DomainLimitsManager {
  constructor() {
    this.limits = {};
  }

  async loadLimits() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDomainLimits' });
      if (response.success) {
        this.limits = response.limits || {};
      }
      return this.limits;
    } catch (error) {
      console.error('Error loading domain limits:', error);
      return {};
    }
  }

  async setLimit(domain, minutes) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setDomainLimit',
        domain: domain,
        limitMinutes: minutes
      });
      
      if (response.success) {
        await this.loadLimits();
        this.render();
        showToastMessage(`Time limit set for ${domain}`, 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error setting domain limit:', error);
      return false;
    }
  }

  async removeLimit(domain) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setDomainLimit',
        domain: domain,
        limitMinutes: 0
      });
      
      if (response.success) {
        await this.loadLimits();
        this.render();
        showToastMessage(`Time limit removed for ${domain}`, 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing domain limit:', error);
      return false;
    }
  }

  async render() {
    const container = document.getElementById('limits-list');
    if (!container) return;

    await this.loadLimits();
    const dailyTime = await this.getDailyDomainTime();

    const entries = Object.entries(this.limits);
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">No time limits set</div>';
      return;
    }

    container.innerHTML = entries.map(([domain, limit]) => {
      const timeSpent = dailyTime[domain] || 0;
      const limitMs = limit.limitMs || limit.limitMinutes * 60000;
      const percentage = Math.min(100, (timeSpent / limitMs) * 100);
      const spentMinutes = Math.floor(timeSpent / 60000);
      const limitMinutes = limit.limitMinutes;
      
      let progressClass = '';
      if (percentage >= 100) progressClass = 'exceeded';
      else if (percentage >= 80) progressClass = 'warning';

      return `
        <div class="limit-item" data-domain="${domain}">
          <div class="limit-info">
            <span class="limit-domain">${domain}</span>
            <span class="limit-time">${spentMinutes}m / ${limitMinutes}m today</span>
          </div>
          <div class="limit-progress">
            <div class="limit-progress-bar">
              <div class="limit-progress-fill ${progressClass}" style="width: ${percentage}%"></div>
            </div>
            <button class="limit-remove-btn" data-domain="${domain}" title="Remove limit">×</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.limit-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeLimit(btn.dataset.domain);
      });
    });
  }

  async getDailyDomainTime() {
    try {
      const data = await chrome.storage.local.get(['dailyDomainTime']);
      const todayKey = getTodayDateKey();
      return data.dailyDomainTime?.[todayKey] || {};
    } catch (error) {
      return {};
    }
  }
}
