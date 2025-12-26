// Reminder Manager
// Handles website visit reminders

class ReminderManager {
  constructor() {
    this.reminderTimeMinutes = 60;
    this.reminders = [];
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get(['settings']);
      if (data.settings && data.settings.reminderTimeMinutes) {
        this.reminderTimeMinutes = data.settings.reminderTimeMinutes;
      }
      return this.reminderTimeMinutes;
    } catch (error) {
      console.error('Error loading reminder settings:', error);
      return 60;
    }
  }

  async saveSettings() {
    try {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      settings.reminderTimeMinutes = this.reminderTimeMinutes;
      await chrome.storage.local.set({ settings });
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    }
  }

  async loadReminders() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getReminders',
        reminderTimeMinutes: this.reminderTimeMinutes
      });
      
      if (response.success) {
        this.reminders = response.reminders || [];
        return this.reminders;
      }
      return [];
    } catch (error) {
      console.error('Error loading reminders:', error);
      return [];
    }
  }

  async dismissReminder(domain) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'dismissReminder',
        domain: domain
      });
      
      if (response.success) {
        await this.loadReminders();
        this.render();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error dismissing reminder:', error);
      return false;
    }
  }

  formatTimeSince(timeSince) {
    const minutes = Math.floor(timeSince / (1000 * 60));
    const hours = Math.floor(timeSince / (1000 * 60 * 60));
    const days = Math.floor(timeSince / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  async render() {
    const container = document.getElementById('reminders-list');
    if (!container) return;

    await this.loadReminders();

    if (this.reminders.length === 0) {
      container.innerHTML = '<div class="empty-state">No reminders. All visited websites are recent!</div>';
      return;
    }

    container.innerHTML = this.reminders.map(reminder => {
      const icon = reminder.domain.charAt(0).toUpperCase();
      const timeAgo = this.formatTimeSince(reminder.timeSince);
      
      return `
        <div class="reminder-item" data-domain="${escapeHtml(reminder.domain)}">
          <div class="reminder-item-icon">${icon}</div>
          <div class="reminder-item-info">
            <div class="reminder-item-title">${escapeHtml(reminder.title || reminder.domain)}</div>
            <div class="reminder-item-meta">
              <span>${escapeHtml(reminder.domain)}</span>
              <span>•</span>
              <span>Last visited ${timeAgo}</span>
            </div>
          </div>
          <div class="reminder-item-actions">
            <button class="reminder-visit-btn" data-url="${escapeHtml(reminder.url)}" title="Visit">
              🔗
            </button>
            <button class="reminder-dismiss-btn" data-domain="${escapeHtml(reminder.domain)}" title="Dismiss">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.reminder-visit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
          this.dismissReminder(btn.closest('.reminder-item').dataset.domain);
        }
      });
    });

    container.querySelectorAll('.reminder-dismiss-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        await this.dismissReminder(domain);
        showToastMessage('Reminder dismissed', 'success');
      });
    });
  }

  async setReminderTime(minutes) {
    this.reminderTimeMinutes = minutes;
    await this.saveSettings();
    await this.loadReminders();
    this.render();
  }
}
