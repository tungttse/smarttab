// SmartTab New Tab Page Script

// ==================== Utility Functions ====================
function showToastMessage(text, type = 'info') {
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

// ==================== Background Image Manager ====================
class BackgroundImageManager {
  constructor() {
    this.container = document.getElementById('background-container');
    this.currentTimePeriod = null;
    this.cachedImageUrl = null;
    this.cachedTimestamp = null;
  }

  getTimePeriod() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 11) {
      return 'morning';
    } else if (hour >= 11 && hour < 15) {
      return 'noon';
    } else if (hour >= 15 && hour < 19) {
      return 'afternoon';
    } else {
      return 'night';
    }
  }

  getKeywordsForPeriod(period) {
    const keywords = {
      morning: ['morning', 'sunrise', 'nature', 'forest', 'dawn'],
      noon: ['daylight', 'city', 'urban', 'architecture', 'bright'],
      afternoon: ['sunset', 'landscape', 'mountains', 'ocean', 'golden-hour'],
      night: ['night', 'stars', 'city-lights', 'astronomy', 'dark']
    };
    
    return keywords[period] || keywords.morning;
  }

  getRandomKeyword(keywords) {
    return keywords[Math.floor(Math.random() * keywords.length)];
  }

  async getCachedImage() {
    try {
      const data = await chrome.storage.local.get(['backgroundImage', 'backgroundTimestamp', 'backgroundPeriod']);
      
      if (data.backgroundImage && data.backgroundTimestamp && data.backgroundPeriod) {
        const now = Date.now();
        const cachedTime = data.backgroundTimestamp;
        const timeDiff = now - cachedTime;
        const currentPeriod = this.getTimePeriod();
        
        // Use cached image if same period and less than 1 hour old
        if (data.backgroundPeriod === currentPeriod && timeDiff < 3600000) {
          return {
            url: data.backgroundImage,
            period: data.backgroundPeriod
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting cached image:', error);
      return null;
    }
  }

  async cacheImage(url, period) {
    try {
      await chrome.storage.local.set({
        backgroundImage: url,
        backgroundTimestamp: Date.now(),
        backgroundPeriod: period
      });
    } catch (error) {
      console.error('Error caching image:', error);
    }
  }

  getUnsplashImageUrl(keyword) {
    // Using Unsplash Source API (no API key needed)
    // Format: https://source.unsplash.com/{width}x{height}/?{keyword}
    const width = window.screen.width || 1920;
    const height = window.screen.height || 1080;
    
    // Use random to get different images
    const random = Math.floor(Math.random() * 1000);
    return `https://source.unsplash.com/${width}x${height}/?${keyword}&sig=${random}`;
  }

  preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  async loadBackgroundImage() {
    try {
      const currentPeriod = this.getTimePeriod();
      
      // Check if we need to change image (different time period)
      if (this.currentTimePeriod === currentPeriod && this.cachedImageUrl) {
        // Same period, use cached image
        this.setBackgroundImage(this.cachedImageUrl);
        return;
      }

      // Check storage cache first
      const cached = await this.getCachedImage();
      if (cached && cached.period === currentPeriod) {
        this.cachedImageUrl = cached.url;
        this.currentTimePeriod = cached.period;
        this.setBackgroundImage(cached.url);
        return;
      }

      // Load new image
      const keywords = this.getKeywordsForPeriod(currentPeriod);
      const keyword = this.getRandomKeyword(keywords);
      const imageUrl = this.getUnsplashImageUrl(keyword);

      // Show loading state
      if (this.container) {
        this.container.classList.add('loading');
      }

      // Preload image
      try {
        const loadedUrl = await this.preloadImage(imageUrl);
        
        // Cache and display
        await this.cacheImage(loadedUrl, currentPeriod);
        this.cachedImageUrl = loadedUrl;
        this.currentTimePeriod = currentPeriod;
        this.setBackgroundImage(loadedUrl);
      } catch (error) {
        console.error('Error loading image:', error);
        // Fallback to gradient
        this.setBackgroundImage(null);
      } finally {
        if (this.container) {
          this.container.classList.remove('loading');
        }
      }
    } catch (error) {
      console.error('Error in loadBackgroundImage:', error);
      this.setBackgroundImage(null);
    }
  }

  setBackgroundImage(url) {
    if (!this.container) return;

    if (url) {
      this.container.style.backgroundImage = `url(${url})`;
      this.container.style.opacity = '1';
    } else {
      // Fallback to gradient
      this.container.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      this.container.style.opacity = '1';
    }
  }

  async init() {
    await this.loadBackgroundImage();
    
    // Check periodically if time period changed (every 5 minutes)
    setInterval(() => {
      const newPeriod = this.getTimePeriod();
      if (newPeriod !== this.currentTimePeriod) {
        this.loadBackgroundImage();
      }
    }, 300000); // 5 minutes
  }
}

// ==================== Statistics Manager ====================
class StatisticsManager {
  constructor() {
    this.stats = null;
  }

  async loadStats() {
    try {
      this.showLoading('recent-visits');
      this.showLoading('top-domains');
      const response = await chrome.runtime.sendMessage({ action: 'getVisitStats' });
      if (response.success) {
        this.stats = response.data;
        return this.stats;
      } else {
        this.showError('Failed to load statistics');
        return null;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.showError('Error loading statistics. Please refresh the page.');
      return null;
    }
  }

  showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '<div class="loading">Loading...</div>';
    }
  }

  showError(message) {
    console.error(message);
    // Error is handled gracefully - stats will show empty state
  }

  displayVisitCount() {
    const element = document.getElementById('total-visits');
    if (element && this.stats) {
      element.textContent = this.stats.totalVisits.toLocaleString();
    }
  }

  displayTimeSpent() {
    const element = document.getElementById('total-time');
    if (element && this.stats) {
      const hours = Math.floor(this.stats.totalTime / (1000 * 60 * 60));
      const minutes = Math.floor((this.stats.totalTime % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        element.textContent = `${hours}h ${minutes}m`;
      } else {
        element.textContent = `${minutes}m`;
      }
    }
  }

  displayUniqueDomains() {
    const element = document.getElementById('unique-domains');
    if (element && this.stats) {
      element.textContent = this.stats.uniqueDomains.toLocaleString();
    }
  }

  displayDailyActiveTime() {
    const element = document.getElementById('daily-active-time');
    if (element && this.stats) {
      const dailyTime = this.stats.dailyActiveTime || 0;
      const hours = Math.floor(dailyTime / (1000 * 60 * 60));
      const minutes = Math.floor((dailyTime % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        element.textContent = `${hours}h ${minutes}m`;
      } else {
        element.textContent = `${minutes}m`;
      }
    }
  }

  displayRecentVisits() {
    const container = document.getElementById('recent-visits');
    if (!container || !this.stats) return;

    const visits = this.stats.recentVisits || [];
    
    if (visits.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent visits yet</div>';
      return;
    }

    container.innerHTML = visits.map(visit => {
      const domain = visit.domain || 'unknown';
      const icon = domain.charAt(0).toUpperCase();
      const timeAgo = this.formatTimeAgo(visit.timestamp);
      
      return `
        <div class="visit-item" data-url="${visit.url}">
          <div class="visit-item-icon">${icon}</div>
          <div class="visit-item-info">
            <div class="visit-item-title">${this.escapeHtml(visit.title || 'Untitled')}</div>
            <div class="visit-item-url">${this.escapeHtml(domain)} • ${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.visit-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });
  }

  async displayTopDomains(blockedDomainManager) {
    const container = document.getElementById('top-domains');
    if (!container || !this.stats) return;

    const domains = this.stats.topDomains || [];
    
    if (domains.length === 0) {
      container.innerHTML = '<div class="empty-state">No domain statistics yet</div>';
      return;
    }

    // Load blocked domains if manager provided
    let blockedDomains = new Set();
    if (blockedDomainManager) {
      await blockedDomainManager.loadBlockedDomains();
      blockedDomains = blockedDomainManager.blockedDomains;
    }

    container.innerHTML = domains.map(domain => {
      const icon = domain.domain.charAt(0).toUpperCase();
      const hours = Math.floor(domain.totalTime / (1000 * 60 * 60));
      const minutes = Math.floor((domain.totalTime % (1000 * 60 * 60)) / (1000 * 60));
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      const isBlocked = blockedDomains.has(domain.domain);
      
      return `
        <div class="domain-item ${isBlocked ? 'blocked' : ''}" data-domain="${this.escapeHtml(domain.domain)}">
          <div class="domain-item-icon">${icon}</div>
          <div class="domain-item-info">
            <div class="domain-item-name">${this.escapeHtml(domain.domain)}</div>
            <div class="domain-item-stats">
              <span>${domain.count} visits</span>
              <span>${timeStr}</span>
            </div>
          </div>
          <button class="domain-block-btn" data-domain="${this.escapeHtml(domain.domain)}" title="${isBlocked ? 'Unblock domain' : 'Block domain'}">
            ${isBlocked ? '🔓' : '🚫'}
          </button>
        </div>
      `;
    }).join('');

    // Add event listeners for block buttons
    if (blockedDomainManager) {
      container.querySelectorAll('.domain-block-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const domain = btn.dataset.domain;
          const isBlocked = blockedDomains.has(domain);
          
          if (isBlocked) {
            const success = await blockedDomainManager.unblockDomain(domain);
            if (success) {
              showToastMessage(`Domain ${domain} unblocked`, 'success');
              this.displayTopDomains(blockedDomainManager); // Refresh
            } else {
              showToastMessage('Failed to unblock domain', 'error');
            }
          } else {
            if (confirm(`Block domain "${domain}"? You won't be able to access this domain.`)) {
              const success = await blockedDomainManager.blockDomain(domain);
              if (success) {
                showToastMessage(`Domain ${domain} blocked`, 'success');
                this.displayTopDomains(blockedDomainManager); // Refresh
              } else {
                showToastMessage('Failed to block domain', 'error');
              }
            }
          }
        });
      });
    }
  }

  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refresh(blockedDomainManager) {
    await this.loadStats();
    if (this.stats) {
      this.displayVisitCount();
      this.displayTimeSpent();
      this.displayUniqueDomains();
      this.displayDailyActiveTime();
      this.displayRecentVisits();
      await this.displayTopDomains(blockedDomainManager);
    }
  }
}

// ==================== Todo Manager ====================
class TodoManager {
  constructor() {
    this.todos = [];
  }

  async loadTodos() {
    try {
      const data = await chrome.storage.local.get(['todos']);
      this.todos = data.todos || [];
      return this.todos;
    } catch (error) {
      console.error('Error loading todos:', error);
      return [];
    }
  }

  async saveTodos() {
    try {
      await chrome.storage.local.set({ todos: this.todos });
      // Structure designed for future cloud sync:
      // { id, text, completed, createdAt, syncId?, lastSynced? }
    } catch (error) {
      console.error('Error saving todos:', error);
    }
  }

  async addTodo(text) {
    if (!text.trim()) {
      showToastMessage('Please enter a task', 'error');
      return;
    }

    try {
      const todo = {
        id: Date.now().toString(),
        text: text.trim(),
        completed: false,
        createdAt: Date.now()
        // Future: syncId, lastSynced fields for cloud sync
      };

      this.todos.unshift(todo);
      await this.saveTodos();
      this.render();
      showToastMessage('Task added', 'success');
    } catch (error) {
      console.error('Error adding todo:', error);
      showToastMessage('Failed to add task', 'error');
    }
  }

  async removeTodo(id) {
    try {
      this.todos = this.todos.filter(todo => todo.id !== id);
      await this.saveTodos();
      this.render();
    } catch (error) {
      console.error('Error removing todo:', error);
      showToastMessage('Failed to remove task', 'error');
    }
  }

  async toggleTodo(id) {
    try {
      const todo = this.todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
        await this.saveTodos();
        this.render();
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
      showToastMessage('Failed to update task', 'error');
    }
  }


  async render() {
    const container = document.getElementById('todo-list');
    if (!container) return;

    await this.loadTodos();

    if (this.todos.length === 0) {
      container.innerHTML = '<div class="empty-state">No tasks yet. Add one to get started!</div>';
      return;
    }

    container.innerHTML = this.todos.map((todo, index) => `
      <div 
        class="todo-item ${todo.completed ? 'completed' : ''}" 
        draggable="true"
        data-id="${todo.id}"
        data-index="${index}"
      >
        <div class="todo-drag-handle" title="Drag to reorder">⋮⋮</div>
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''}
          data-id="${todo.id}"
        >
        <span class="todo-text">${this.escapeHtml(todo.text)}</span>
        <button class="todo-delete" data-id="${todo.id}" title="Delete">×</button>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.toggleTodo(e.target.dataset.id);
      });
    });

    container.querySelectorAll('.todo-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeTodo(e.target.dataset.id);
      });
    });

    // Add drag and drop event listeners
    this.setupDragAndDrop(container);
  }

  setupDragAndDrop(container) {
    let draggedElement = null;
    let draggedIndex = null;

    container.querySelectorAll('.todo-item').forEach((item, index) => {
      // Prevent dragging on checkbox and delete button
      const checkbox = item.querySelector('.todo-checkbox');
      const deleteBtn = item.querySelector('.todo-delete');
      
      [checkbox, deleteBtn].forEach(el => {
        if (el) {
          el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
          });
        }
      });

      item.addEventListener('dragstart', (e) => {
        draggedElement = item;
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
      });

      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
        container.querySelectorAll('.todo-item').forEach(el => {
          el.classList.remove('drag-over');
        });
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!draggedElement || draggedElement === item) return;
        
        const afterElement = this.getDragAfterElement(container, e.clientY);
        const currentItem = item;
        
        container.querySelectorAll('.todo-item').forEach(el => {
          el.classList.remove('drag-over');
        });
        
        if (afterElement == null) {
          currentItem.classList.add('drag-over');
        } else {
          afterElement.classList.add('drag-over');
        }
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        if (!draggedElement || draggedElement === item) {
          container.querySelectorAll('.todo-item').forEach(el => {
            el.classList.remove('drag-over');
          });
          return;
        }
        
        // Get all todo items in current DOM order (excluding dragging one)
        const allItems = Array.from(container.querySelectorAll('.todo-item:not(.dragging)'));
        const dropIndex = allItems.indexOf(item);
        
        // Reorder todos array
        const draggedTodo = this.todos[draggedIndex];
        this.todos.splice(draggedIndex, 1);
        
        // Calculate new index: if dragging down, adjust for removed item
        let newIndex = dropIndex;
        if (draggedIndex < dropIndex) {
          newIndex = dropIndex; // Already adjusted by splice
        } else {
          newIndex = dropIndex; // Insert at drop position
        }
        
        this.todos.splice(newIndex, 0, draggedTodo);
        
        // Save new order
        await this.saveTodos();
        
        // Re-render to update display
        this.render();
      });
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ==================== Bookmark Manager ====================
class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.filteredBookmarks = [];
    this.searchQuery = '';
  }

  async loadBookmarks() {
    try {
      const container = document.getElementById('bookmarks-list');
      if (container) {
        container.innerHTML = '<div class="loading">Loading bookmarks...</div>';
      }
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.bookmarks = this.flattenBookmarks(bookmarkTree);
      this.filteredBookmarks = this.bookmarks;
      return this.bookmarks;
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      const container = document.getElementById('bookmarks-list');
      if (container) {
        container.innerHTML = '<div class="empty-state">Error loading bookmarks</div>';
      }
      return [];
    }
  }

  flattenBookmarks(nodes, result = []) {
    for (const node of nodes) {
      if (node.url) {
        result.push({
          id: node.id,
          title: node.title,
          url: node.url,
          parentId: node.parentId
        });
      }
      if (node.children) {
        this.flattenBookmarks(node.children, result);
      }
    }
    return result;
  }

  async addBookmark(url, title, parentId = null) {
    try {
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      new URL(url); // Validate URL format
      
      const bookmark = await chrome.bookmarks.create({
        parentId: parentId || '1', // Bookmarks Bar
        title: title || url,
        url: url
      });
      await this.loadBookmarks();
      this.render();
      return bookmark;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      if (error.message.includes('Invalid URL')) {
        throw new Error('Please enter a valid URL');
      }
      throw error;
    }
  }

  async removeBookmark(id) {
    try {
      await chrome.bookmarks.remove(id);
      await this.loadBookmarks();
      this.render();
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }

  searchBookmarks(query) {
    this.searchQuery = query.toLowerCase().trim();
    if (!this.searchQuery) {
      this.filteredBookmarks = this.bookmarks;
    } else {
      this.filteredBookmarks = this.bookmarks.filter(bookmark =>
        bookmark.title.toLowerCase().includes(this.searchQuery) ||
        bookmark.url.toLowerCase().includes(this.searchQuery)
      );
    }
    this.render();
  }

  getFaviconUrl(url) {
    try {
      const domain = new URL(url).origin;
      return `${domain}/favicon.ico`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%234285f4"/></svg>';
    }
  }

  async render() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;

    if (this.filteredBookmarks.length === 0) {
      container.innerHTML = '<div class="empty-state">No bookmarks found</div>';
      return;
    }

    container.innerHTML = this.filteredBookmarks.slice(0, 50).map(bookmark => {
      const faviconUrl = this.getFaviconUrl(bookmark.url);
      return `
        <div class="bookmark-item" data-url="${bookmark.url}">
          <img src="${faviconUrl}" class="bookmark-favicon" onerror="this.style.display='none'">
          <div class="bookmark-info">
            <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
          </div>
          <button class="bookmark-delete" data-id="${bookmark.id}" title="Delete">×</button>
        </div>
      `;
    }).join('');

    // Add event listeners
    container.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('bookmark-delete')) {
          const url = item.dataset.url;
          if (url) {
            chrome.tabs.create({ url });
          }
        }
      });
    });

    container.querySelectorAll('.bookmark-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this bookmark?')) {
          try {
            await this.removeBookmark(btn.dataset.id);
            showToastMessage('Bookmark deleted', 'success');
          } catch (error) {
            showToastMessage('Failed to delete bookmark', 'error');
          }
        }
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ==================== Blocked Domain Manager ====================
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
      
      // Notify background to update blocking rules
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
      
      // Notify background to update blocking rules
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

// ==================== Reminder Manager ====================
class ReminderManager {
  constructor() {
    this.reminderTimeMinutes = 60; // Default 1 hour
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

  formatTimeAgo(timeSince) {
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
      const timeAgo = this.formatTimeAgo(reminder.timeSince);
      
      return `
        <div class="reminder-item" data-domain="${this.escapeHtml(reminder.domain)}">
          <div class="reminder-item-icon">${icon}</div>
          <div class="reminder-item-info">
            <div class="reminder-item-title">${this.escapeHtml(reminder.title || reminder.domain)}</div>
            <div class="reminder-item-meta">
              <span>${this.escapeHtml(reminder.domain)}</span>
              <span>•</span>
              <span>Last visited ${timeAgo}</span>
            </div>
          </div>
          <div class="reminder-item-actions">
            <button class="reminder-visit-btn" data-url="${this.escapeHtml(reminder.url)}" title="Visit">
              🔗
            </button>
            <button class="reminder-dismiss-btn" data-domain="${this.escapeHtml(reminder.domain)}" title="Dismiss">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    container.querySelectorAll('.reminder-visit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
          // Dismiss after visiting
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async setReminderTime(minutes) {
    this.reminderTimeMinutes = minutes;
    await this.saveSettings();
    await this.loadReminders();
    this.render();
  }
}

// ==================== Focus Mode Manager ====================
class FocusModeManager {
  constructor() {
    this.active = false;
    this.endTime = null;
    this.timerInterval = null;
  }

  async checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getFocusModeStatus' });
      if (response.success) {
        this.active = response.active;
        this.endTime = response.endTime;
        return response;
      }
      return { active: false };
    } catch (error) {
      console.error('Error checking focus mode status:', error);
      return { active: false };
    }
  }

  async start(durationMinutes) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'startFocusMode',
        duration: durationMinutes
      });
      
      if (response.success) {
        this.active = true;
        this.endTime = Date.now() + (durationMinutes * 60 * 1000);
        this.updateUI();
        this.startTimer();
        showToastMessage(`Focus mode started for ${durationMinutes} minutes`, 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error starting focus mode:', error);
      return false;
    }
  }

  async stop() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
      if (response.success) {
        this.active = false;
        this.endTime = null;
        this.stopTimer();
        this.updateUI();
        showToastMessage('Focus mode ended', 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error stopping focus mode:', error);
      return false;
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById('focus-timer');
    if (!timerEl || !this.endTime) return;

    const remaining = this.endTime - Date.now();
    if (remaining <= 0) {
      this.active = false;
      this.stopTimer();
      this.updateUI();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  updateUI() {
    const banner = document.getElementById('focus-mode-banner');
    const startBtn = document.getElementById('start-focus-btn');
    const durationSelect = document.getElementById('focus-duration');

    if (this.active) {
      banner?.classList.remove('hidden');
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="btn-icon">🎯</span> Focus Active';
      }
      if (durationSelect) durationSelect.disabled = true;
    } else {
      banner?.classList.add('hidden');
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="btn-icon">▶️</span> Start Focus';
      }
      if (durationSelect) durationSelect.disabled = false;
    }
  }

  async init() {
    const status = await this.checkStatus();
    if (status.active) {
      this.active = true;
      this.endTime = status.endTime;
      this.updateUI();
      this.startTimer();
    }
  }
}

// ==================== Chart Manager ====================
class ChartManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.colors = [
      '#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#f43f5e',
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
    ];
  }

  init() {
    this.canvas = document.getElementById('daily-chart');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.setupCanvas();
    }
  }

  setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  async loadAndRender() {
    try {
      const data = await chrome.storage.local.get(['dailyDomainTime', 'domains']);
      const todayKey = this.getTodayKey();
      const dailyTime = data.dailyDomainTime?.[todayKey] || {};
      
      // Get top domains by time today
      const sortedDomains = Object.entries(dailyTime)
        .map(([domain, time]) => ({ domain, time }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 6);

      if (sortedDomains.length === 0) {
        this.renderEmpty();
        return;
      }

      this.renderBarChart(sortedDomains);
      this.renderLegend(sortedDomains);
    } catch (error) {
      console.error('Error loading chart data:', error);
      this.renderEmpty();
    }
  }

  getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  renderEmpty() {
    if (!this.ctx) return;
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;
    
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.font = '14px Inter, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('No activity data for today yet', width / 2, height / 2);

    const legendEl = document.getElementById('chart-legend');
    if (legendEl) legendEl.innerHTML = '';
  }

  renderBarChart(data) {
    if (!this.ctx) return;
    
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    this.ctx.clearRect(0, 0, width, height);

    const maxTime = Math.max(...data.map(d => d.time));
    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    // Draw bars
    data.forEach((item, i) => {
      const barHeight = (item.time / maxTime) * chartHeight;
      const x = padding.left + (i * (barWidth + barGap)) + barGap / 2;
      const y = padding.top + chartHeight - barHeight;

      // Bar gradient
      const gradient = this.ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, this.colors[i % this.colors.length]);
      gradient.addColorStop(1, this.adjustColor(this.colors[i % this.colors.length], -30));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, 4);
      this.ctx.fill();

      // Domain label
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.font = '11px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      const label = item.domain.length > 10 ? item.domain.slice(0, 8) + '...' : item.domain;
      this.ctx.fillText(label, x + barWidth / 2, height - 10);

      // Time label on bar
      const minutes = Math.floor(item.time / 60000);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.font = '12px Inter, sans-serif';
      this.ctx.fillText(`${minutes}m`, x + barWidth / 2, y - 8);
    });
  }

  renderLegend(data) {
    const legendEl = document.getElementById('chart-legend');
    if (!legendEl) return;

    legendEl.innerHTML = data.map((item, i) => {
      const minutes = Math.floor(item.time / 60000);
      return `
        <div class="legend-item">
          <div class="legend-color" style="background: ${this.colors[i % this.colors.length]}"></div>
          <span>${item.domain} (${minutes}m)</span>
        </div>
      `;
    }).join('');
  }

  adjustColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}

// ==================== Data Manager ====================
class DataManager {
  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportData' });
      if (response.success && response.data) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smarttab-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastMessage('Data exported successfully', 'success');
        return true;
      }
      throw new Error('Export failed');
    } catch (error) {
      console.error('Error exporting data:', error);
      showToastMessage('Failed to export data', 'error');
      return false;
    }
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (!data.version || !data.data) {
            throw new Error('Invalid backup file format');
          }

          if (!confirm('This will replace all your current data. Are you sure?')) {
            resolve(false);
            return;
          }

          const response = await chrome.runtime.sendMessage({
            action: 'importData',
            data: data
          });

          if (response.success) {
            showToastMessage('Data imported successfully! Refreshing...', 'success');
            setTimeout(() => window.location.reload(), 1500);
            resolve(true);
          } else {
            throw new Error('Import failed');
          }
        } catch (error) {
          console.error('Error importing data:', error);
          showToastMessage('Failed to import data: ' + error.message, 'error');
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// ==================== Domain Limits Manager ====================
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

    // Add remove button handlers
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
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return data.dailyDomainTime?.[todayKey] || {};
    } catch (error) {
      return {};
    }
  }
}

// ==================== Tab Manager ====================
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

// ==================== Main App ====================
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
    await this.statsManager.loadStats();
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

    // Refresh stats periodically
    setInterval(() => {
      this.statsManager.refresh(this.blockedDomainManager);
      this.reminderManager.render();
      this.tabManager.updateTabsInfo();
      this.chartManager.loadAndRender();
      this.domainLimitsManager.render();
    }, 30000); // Every 30 seconds

    // Listen for storage changes for real-time updates
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.visits || changes.domains || changes.dailyDomainTime) {
          // Stats changed, refresh
          this.statsManager.refresh(this.blockedDomainManager);
          this.reminderManager.render();
          this.chartManager.loadAndRender();
          this.domainLimitsManager.render();
        }
        if (changes.todos) {
          // Todos changed, refresh
          this.todoManager.render();
        }
        if (changes.dismissedReminders) {
          // Reminders dismissed, refresh
          this.reminderManager.render();
        }
        if (changes.focusMode) {
          // Focus mode changed
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
    this.statsManager.displayDailyActiveTime();
    this.statsManager.displayRecentVisits();
    await this.statsManager.displayTopDomains(this.blockedDomainManager);
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

    if (startFocusBtn) {
      startFocusBtn.addEventListener('click', async () => {
        const duration = parseInt(focusDurationSelect?.value || '25');
        await this.focusModeManager.start(duration);
      });
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

        // Clean domain (remove protocol, www, paths)
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

    addTodoBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTodo();
      }
    });

    // Bookmark search
    const bookmarkSearch = document.getElementById('bookmark-search');
    bookmarkSearch.addEventListener('input', (e) => {
      this.bookmarkManager.searchBookmarks(e.target.value);
    });

    // Add bookmark button
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    addBookmarkBtn.addEventListener('click', () => {
      this.showBookmarkModal();
    });

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

    closeBookmarkModal.addEventListener('click', hideModal);
    cancelBookmarkBtn.addEventListener('click', hideModal);
    
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

    // Tab sorting
    const sortTabsBtn = document.getElementById('sort-tabs-btn');
    sortTabsBtn.addEventListener('click', () => {
      this.tabManager.sortTabs();
    });

    // Tab grouping
    const groupTabsBtn = document.getElementById('group-tabs-btn');
    groupTabsBtn.addEventListener('click', () => {
      this.tabManager.groupTabs();
    });

    // Auto sort toggle
    const autoSortToggle = document.getElementById('auto-sort-toggle');
    autoSortToggle.checked = this.tabManager.autoSortEnabled;
    autoSortToggle.addEventListener('change', (e) => {
      this.tabManager.toggleAutoSort(e.target.checked);
    });

    // Reminder time select
    const reminderTimeSelect = document.getElementById('reminder-time-select');
    if (reminderTimeSelect) {
      // Set initial value after loading settings
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
    // Switch between Recent and Top tabs
    const tabButtons = document.querySelectorAll('.stats-tabs .tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active states
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
    
    // Focus on URL input
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
