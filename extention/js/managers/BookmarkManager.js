// Bookmark Manager
// Handles bookmark loading, adding, removing, and searching

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
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      new URL(url);
      
      const bookmark = await chrome.bookmarks.create({
        parentId: parentId || '1',
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
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%236366f1"/></svg>';
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
            <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
          </div>
          <button class="bookmark-delete" data-id="${bookmark.id}" title="Delete">×</button>
        </div>
      `;
    }).join('');

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
}
