// Bookmark Manager
// Handles bookmark loading, adding, removing, and searching

class BookmarkManager {
  constructor() {
    this.bookmarkTree = [];
    this.flatBookmarks = [];
    this.searchQuery = '';
    this.collapsedFolders = new Set();
  }

  async loadBookmarks() {
    try {
      const container = document.getElementById('bookmarks-list');
      if (container) {
        container.innerHTML = '<div class="loading">Loading bookmarks...</div>';
      }
      const tree = await chrome.bookmarks.getTree();
      this.bookmarkTree = tree[0]?.children || [];
      this.flatBookmarks = this.flattenBookmarks(this.bookmarkTree);
      return this.bookmarkTree;
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

  toggleFolder(folderId) {
    if (this.collapsedFolders.has(folderId)) {
      this.collapsedFolders.delete(folderId);
    } else {
      this.collapsedFolders.add(folderId);
    }
    this.render();
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

  renderTreeNode(node, depth = 0) {
    const isFolder = !node.url && node.children;
    const isCollapsed = this.collapsedFolders.has(node.id);
    const indent = depth * 16;

    if (isFolder) {
      const hasChildren = node.children && node.children.length > 0;
      const folderIcon = isCollapsed ? '▶' : '▼';
      const childrenHtml = !isCollapsed && hasChildren 
        ? node.children.map(child => this.renderTreeNode(child, depth + 1)).join('')
        : '';
      
      return `
        <div class="bookmark-folder" style="padding-left: ${indent}px">
          <div class="folder-header" data-folder-id="${node.id}">
            <span class="folder-toggle">${folderIcon}</span>
            <span class="folder-icon">📁</span>
            <span class="folder-name">${escapeHtml(node.title || 'Untitled')}</span>
            <span class="folder-count">${node.children?.length || 0}</span>
          </div>
          <div class="folder-children ${isCollapsed ? 'collapsed' : ''}">
            ${childrenHtml}
          </div>
        </div>
      `;
    } else if (node.url) {
      // Check search filter
      if (this.searchQuery) {
        const matchesSearch = node.title.toLowerCase().includes(this.searchQuery) ||
                             node.url.toLowerCase().includes(this.searchQuery);
        if (!matchesSearch) return '';
      }
      
      const faviconUrl = this.getFaviconUrl(node.url);
      return `
        <div class="bookmark-item" style="padding-left: ${indent + 20}px" data-url="${escapeHtml(node.url)}">
          <img src="${faviconUrl}" class="bookmark-favicon" onerror="this.style.display='none'">
          <div class="bookmark-info">
            <div class="bookmark-title">${escapeHtml(node.title || node.url)}</div>
            <div class="bookmark-url">${escapeHtml(node.url)}</div>
          </div>
          <button class="bookmark-delete" data-id="${node.id}" title="Delete">×</button>
        </div>
      `;
    }
    return '';
  }

  async render() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;

    if (this.bookmarkTree.length === 0) {
      container.innerHTML = '<div class="empty-state">No bookmarks found</div>';
      return;
    }

    // Render tree view
    container.innerHTML = this.bookmarkTree.map(node => this.renderTreeNode(node, 0)).join('');

    // Add folder toggle listeners
    container.querySelectorAll('.folder-header').forEach(header => {
      header.addEventListener('click', () => {
        const folderId = header.dataset.folderId;
        this.toggleFolder(folderId);
      });
    });

    // Add bookmark click listeners
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

    // Add delete listeners
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
