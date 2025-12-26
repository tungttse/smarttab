// Chart Manager
// Handles daily activity chart rendering

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
      const todayKey = getTodayDateKey();
      const dailyTime = data.dailyDomainTime?.[todayKey] || {};
      
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

    data.forEach((item, i) => {
      const barHeight = (item.time / maxTime) * chartHeight;
      const x = padding.left + (i * (barWidth + barGap)) + barGap / 2;
      const y = padding.top + chartHeight - barHeight;

      const gradient = this.ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, this.colors[i % this.colors.length]);
      gradient.addColorStop(1, this.adjustColor(this.colors[i % this.colors.length], -30));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, 4);
      this.ctx.fill();

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.font = '11px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      const label = item.domain.length > 10 ? item.domain.slice(0, 8) + '...' : item.domain;
      this.ctx.fillText(label, x + barWidth / 2, height - 10);

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
