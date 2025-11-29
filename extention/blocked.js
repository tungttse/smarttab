// SmartTab Blocked Domain Page Script

class BlockedPage {
  constructor() {
    this.domain = null;
    this.init();
  }

  async init() {
    // Parse domain from URL
    this.parseDomainFromUrl();
    
    // Display domain
    this.displayDomain();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  parseDomainFromUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      this.domain = urlParams.get('domain');
      
      if (!this.domain) {
        // Try to get from referrer or current URL
        const referrer = document.referrer;
        if (referrer) {
          try {
            const url = new URL(referrer);
            this.domain = url.hostname.replace('www.', '');
          } catch (e) {
            console.error('Error parsing referrer:', e);
          }
        }
      }
      
      if (!this.domain) {
        this.domain = 'Unknown Domain';
      }
    } catch (error) {
      console.error('Error parsing domain:', error);
      this.domain = 'Unknown Domain';
    }
  }

  displayDomain() {
    const domainElement = document.getElementById('blocked-domain');
    if (domainElement && this.domain) {
      domainElement.textContent = this.domain;
    }
  }

  setupEventListeners() {
    // Unblock button
    const unblockBtn = document.getElementById('unblock-btn');
    if (unblockBtn) {
      unblockBtn.addEventListener('click', () => {
        this.handleUnblock();
      });
    }

    // New tab button
    const newtabBtn = document.getElementById('newtab-btn');
    if (newtabBtn) {
      newtabBtn.addEventListener('click', () => {
        this.goToNewTab();
      });
    }
  }

  async handleUnblock() {
    if (!this.domain || this.domain === 'Unknown Domain') {
      this.showMessage('Cannot unblock: Domain information not available', 'error');
      return;
    }

    try {
      // Disable button during operation
      const unblockBtn = document.getElementById('unblock-btn');
      if (unblockBtn) {
        unblockBtn.disabled = true;
        unblockBtn.textContent = 'Unblocking...';
      }

      // Send message to background to unblock
      const response = await chrome.runtime.sendMessage({
        action: 'unblockDomain',
        domain: this.domain
      });

      if (response && response.success) {
        this.showMessage('Domain unblocked successfully!', 'success');
        
        // Wait a bit then redirect to new tab
        setTimeout(() => {
          this.goToNewTab();
        }, 1000);
      } else {
        this.showMessage('Failed to unblock domain', 'error');
        if (unblockBtn) {
          unblockBtn.disabled = false;
          unblockBtn.innerHTML = '<span class="btn-icon">🔓</span> Unblock Domain';
        }
      }
    } catch (error) {
      console.error('Error unblocking domain:', error);
      this.showMessage('Error unblocking domain', 'error');
      const unblockBtn = document.getElementById('unblock-btn');
      if (unblockBtn) {
        unblockBtn.disabled = false;
        unblockBtn.innerHTML = '<span class="btn-icon">🔓</span> Unblock Domain';
      }
    }
  }

  goToNewTab() {
    // Open new tab page
    chrome.tabs.update({ url: 'chrome://newtab' });
  }

  showMessage(text, type = 'info') {
    // Simple toast notification
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#34a853' : '#ea4335'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    message.textContent = text;
    document.body.appendChild(message);

    setTimeout(() => {
      message.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => message.remove(), 300);
    }, 3000);
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize blocked page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BlockedPage();
});
