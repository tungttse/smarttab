// Statistics Manager
// Handles visit statistics display and management

class StatisticsManager {
  constructor() {
    this.stats = null;
    this.sortBy = 'count'; // 'count' or 'time'
    this.period = 'today'; // 'today', 'week', 'month', 'year', 'all'
    this.chartMode = 'visits'; // 'visits' or 'time'
  }

  async loadStats(period = null) {
    try {
      if (period) {
        this.period = period;
      }
      this.showLoading('recent-visits');
      this.showLoading('top-domains');
      const response = await chrome.runtime.sendMessage({ 
        action: 'getVisitStats',
        period: this.period
      });
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
      element.textContent = formatTime(this.stats.totalTime);
    }
  }

  displayUniqueDomains() {
    const element = document.getElementById('unique-domains');
    if (element && this.stats) {
      element.textContent = this.stats.uniqueDomains.toLocaleString();
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
      const timeAgo = formatTimeAgo(visit.timestamp);
      
      return `
        <div class="visit-item" data-url="${visit.url}">
          <div class="visit-item-icon">${icon}</div>
          <div class="visit-item-info">
            <div class="visit-item-title">${escapeHtml(visit.title || 'Untitled')}</div>
            <div class="visit-item-url">${escapeHtml(domain)} • ${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');

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

    // Get domains and sort based on current sort mode
    let domains = [...(this.stats.topDomains || [])];
    if (this.sortBy === 'time') {
      domains.sort((a, b) => b.totalTime - a.totalTime);
    } else {
      domains.sort((a, b) => b.count - a.count);
    }
    
    if (domains.length === 0) {
      container.innerHTML = '<div class="empty-state">No domain statistics yet</div>';
      return;
    }

    let blockedDomains = new Set();
    if (blockedDomainManager) {
      await blockedDomainManager.loadBlockedDomains();
      blockedDomains = blockedDomainManager.blockedDomains;
    }

    container.innerHTML = domains.map(domain => {
      const icon = domain.domain.charAt(0).toUpperCase();
      const timeStr = formatTime(domain.totalTime);
      const isBlocked = blockedDomains.has(domain.domain);
      
      return `
        <div class="domain-item ${isBlocked ? 'blocked' : ''}" data-domain="${escapeHtml(domain.domain)}">
          <div class="domain-item-icon">${icon}</div>
          <div class="domain-item-info">
            <div class="domain-item-name">${escapeHtml(domain.domain)}</div>
            <div class="domain-item-stats">
              <span>${domain.count} visits</span>
              <span>${timeStr}</span>
            </div>
          </div>
          <button class="domain-block-btn" data-domain="${escapeHtml(domain.domain)}" title="${isBlocked ? 'Unblock domain' : 'Block domain'}">
            ${isBlocked ? '🔓' : '🚫'}
          </button>
        </div>
      `;
    }).join('');

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
              this.displayTopDomains(blockedDomainManager);
            } else {
              showToastMessage('Failed to unblock domain', 'error');
            }
          } else {
            if (confirm(`Block domain "${domain}"? You won't be able to access this domain.`)) {
              const success = await blockedDomainManager.blockDomain(domain);
              if (success) {
                showToastMessage(`Domain ${domain} blocked`, 'success');
                this.displayTopDomains(blockedDomainManager);
              } else {
                showToastMessage('Failed to block domain', 'error');
              }
            }
          }
        });
      });
    }
  }

  async refresh(blockedDomainManager, period = null) {
    await this.loadStats(period);
    if (this.stats) {
      this.displayVisitCount();
      this.displayTimeSpent();
      this.displayUniqueDomains();
      this.displayRecentVisits();
      await this.displayTopDomains(blockedDomainManager);
      this.displayPieChart();
    }
  }

  async changePeriod(period, blockedDomainManager) {
    this.period = period;
    await this.refresh(blockedDomainManager, period);
  }

  displayPieChart() {
    const canvas = document.getElementById('visits-pie-chart');
    const legendContainer = document.getElementById('pie-chart-legend');
    if (!canvas || !legendContainer || !this.stats) return;

    const ctx = canvas.getContext('2d');
    const topDomains = this.stats.topDomains || [];
    const isTimeMode = this.chartMode === 'time';
    
    if (topDomains.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', canvas.width / 2, canvas.height / 2);
      legendContainer.innerHTML = '';
      return;
    }

    // Sort by the selected mode and get top 5
    const sorted = [...topDomains].sort((a, b) => 
      isTimeMode ? (b.totalTime - a.totalTime) : (b.count - a.count)
    );
    const top5 = sorted.slice(0, 5);
    const otherValue = sorted.slice(5).reduce((sum, d) => 
      sum + (isTimeMode ? d.totalTime : d.count), 0
    );
    
    // Prepare data
    const data = top5.map(d => ({ 
      label: d.domain, 
      value: isTimeMode ? d.totalTime : d.count 
    }));
    if (otherValue > 0) {
      data.push({ label: 'Other', value: otherValue });
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      legendContainer.innerHTML = '';
      return;
    }

    // Colors for pie slices
    const colors = [
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#f43f5e', // rose
      '#f97316', // orange
      '#64748b'  // slate (for "Other")
    ];

    // Draw pie chart
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    let startAngle = -Math.PI / 2; // Start from top

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      startAngle += sliceAngle;
    });

    // Draw center circle for donut effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();

    // Draw total in center
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (isTimeMode) {
      ctx.fillText(formatTime(total), centerX, centerY - 8);
      ctx.font = '11px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('total', centerX, centerY + 10);
    } else {
      ctx.fillText(total.toLocaleString(), centerX, centerY - 8);
      ctx.font = '11px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('visits', centerX, centerY + 10);
    }

    // Generate legend
    legendContainer.innerHTML = data.map((item, index) => {
      const percentage = ((item.value / total) * 100).toFixed(1);
      const displayValue = isTimeMode ? formatTime(item.value) : item.value.toLocaleString();
      return `
        <div class="legend-item">
          <span class="legend-color" style="background: ${colors[index % colors.length]}"></span>
          <span class="legend-label">${item.label}</span>
          <span class="legend-value">${displayValue} (${percentage}%)</span>
        </div>
      `;
    }).join('');
  }
}
