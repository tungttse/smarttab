// Popup script for managing login state and UI
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.checkLoginStatus();
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });
  }

  async checkLoginStatus() {
    // this.showLoading();
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getLoginStatus'
      });

      console.log('ttt response', response);

      if (response.success) {
        if (response.loggedIn) {
          this.showUserSection(response.user);
        } else {
          this.showLoginSection();
        }
      } else {
        this.showError('Failed to check login status');
      }
    } catch (error) {
      this.showError('Error checking login status');
    }
  }

  async handleLogin() {
    // this.showLoading();
    console.log('ttt handleLogin');
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'loginWithGmail'
      });
      console.log('ttt response', response);
      
      if (response.success) {
        this.showUserSection(response.user);
      } else {
        this.showLoginSection();
        this.showError(response.error || 'Login failed');
      }
    } catch (error) {
      this.showLoginSection();
      this.showError('Login failed');
    }
  }

  async handleLogout() {
    this.showLoading();
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'logout'
      });

      if (response.success) {
        this.showLoginSection();
      } else {
        this.showError(response.error || 'Logout failed');
      }
    } catch (error) {
      this.showError('Logout failed');
    }
  }

  showLoading() {
    this.hideAllSections();
    document.getElementById('loading-section').classList.remove('hidden');
  }

  showLoginSection() {
    this.hideAllSections();
    document.getElementById('login-section').classList.remove('hidden');
  }

  showUserSection(user) {
    this.hideAllSections();
    
    // Update user info
    document.getElementById('user-name').textContent = user.name || 'User';
    document.getElementById('user-email').textContent = user.email || '';
    
    // Update avatar if available
    const avatarImg = document.getElementById('user-avatar');
    if (user.picture) {
      avatarImg.src = user.picture;
      avatarImg.alt = user.name || 'User Avatar';
    } else {
      avatarImg.style.display = 'none';
    }
    
    document.getElementById('user-section').classList.remove('hidden');
  }

  hideAllSections() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('user-section').classList.add('hidden');
    document.getElementById('loading-section').classList.add('hidden');
  }

  showError(message) {
    // Simple error display - you could enhance this with a proper error UI
    console.error('Popup Error:', message);
    
    // Show a temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #ea4335;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
