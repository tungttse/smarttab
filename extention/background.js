// Background script for Gmail authentication and API communication
class HilideaBackground {
  constructor() {
    this.apiUrl = 'https://mockapi.com/save';
    this.init();
  }

  init() {
    // Listen for messages from content script and popup
    // chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 🔑 giữ sendResponse mở cho async
    });
    
    // Check login status on startup
    this.checkLoginStatus();
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'saveHighlightedText':
          const result = await this.saveHighlightedText(request.text, request.url, request.title);
          sendResponse(result);
          break;
          
        case 'loginWithGmail':
          const loginResult = await this.loginWithGmail();
          sendResponse(loginResult);
          break;
          
        case 'logout':
          const logoutResult = await this.logout();
          sendResponse(logoutResult);
          break;
          
        case 'getLoginStatus':
          const status = await this.getLoginStatus();
          sendResponse(status);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  }

  async checkLoginStatus() {
    try {
      const token = await this.getStoredToken();
      if (token) {
        // Verify token is still valid
        const isValid = await this.verifyToken(token);
        if (!isValid) {
          await this.clearStoredToken();
        }
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  }

  async loginWithGmail() {
    try {
      // Get OAuth token from Chrome identity API
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });

      // Get user info
      const userInfo = await this.getUserInfo(token);
      
      // Store token and user info
      await this.storeToken(token);
      await this.storeUserInfo(userInfo);
      
      return {
        success: true,
        user: userInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logout() {
    try {
      const token = await this.getStoredToken();
      if (token) {
        // Revoke token
        await new Promise((resolve, reject) => {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
      
      // Clear stored data
      await this.clearStoredToken();
      await this.clearStoredUserInfo();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getLoginStatus() {
    try {
      const token = await this.getStoredToken();
      const userInfo = await this.getStoredUserInfo();
      
      if (token && userInfo) {
        // Verify token is still valid
        const isValid = await this.verifyToken(token);
        if (isValid) {
          return {
            success: true,
            loggedIn: true,
            user: userInfo
          };
        } else {
          await this.clearStoredToken();
          await this.clearStoredUserInfo();
        }
      }
      
      return {
        success: true,
        loggedIn: false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveHighlightedText(text, url, title) {
    try {
      // Check if user is logged in
      const loginStatus = await this.getLoginStatus();
      if (!loginStatus.loggedIn) {
        return {
          success: false,
          error: 'Please login with Gmail first'
        };
      }

      const token = await this.getStoredToken();
      const userInfo = await this.getStoredUserInfo();

      // Prepare data for API
      const data = {
        text: text,
        url: url,
        title: title,
        user: {
          email: userInfo.email,
          name: userInfo.name
        },
        timestamp: new Date().toISOString()
      };
      // TODO: Remove this mock response
      // Call the API
      // const response = await fetch(this.apiUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify(data)
      // });

      // if (!response.ok) {
      //   throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      // }

      // const result = await response.json();
      
      // Mock response if API doesn't return ideas
      // if (!result.ideas || !Array.isArray(result.ideas)) {
      //   result.ideas = this.generateMockIdeas(text);
      // }

      return {
        success: true,
        ideas: this.generateMockIdeas(text),
        savedData: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  //TODO: Remove this function
  generateMockIdeas(text) {
    // Generate some mock ideas based on the highlighted text
    const ideas = [
      `Research more about: ${text}`,
      `Create a project related to: ${text}`,
      `Write an article about: ${text}`,
      `Discuss with team: ${text}`,
      `Add to learning list: ${text}`,
      `Explore connections with: ${text}`,
      `Create a presentation on: ${text}`,
      `Develop a solution for: ${text}`
    ];
    
    // Return 3-5 random ideas
    const numIdeas = Math.floor(Math.random() * 3) + 3;
    return ideas.sort(() => 0.5 - Math.random()).slice(0, numIdeas);
  }

  async getUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  }

  async verifyToken(token) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Storage methods
  async storeToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ hilidea_token: token }, resolve);
    });
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['hilidea_token'], (result) => {
        resolve(result.hilidea_token);
      });
    });
  }

  async clearStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['hilidea_token'], resolve);
    });
  }

  async storeUserInfo(userInfo) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ hilidea_user: userInfo }, resolve);
    });
  }

  async getStoredUserInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['hilidea_user'], (result) => {
        resolve(result.hilidea_user);
      });
    });
  }

  async clearStoredUserInfo() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['hilidea_user'], resolve);
    });
  }
}

// Initialize the background script
new HilideaBackground();
