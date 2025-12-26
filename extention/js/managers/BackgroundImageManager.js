// Background Image Manager
// Handles dynamic background images based on time of day

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
    const width = window.screen.width || 1920;
    const height = window.screen.height || 1080;
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
      
      if (this.currentTimePeriod === currentPeriod && this.cachedImageUrl) {
        this.setBackgroundImage(this.cachedImageUrl);
        return;
      }

      const cached = await this.getCachedImage();
      if (cached && cached.period === currentPeriod) {
        this.cachedImageUrl = cached.url;
        this.currentTimePeriod = cached.period;
        this.setBackgroundImage(cached.url);
        return;
      }

      const keywords = this.getKeywordsForPeriod(currentPeriod);
      const keyword = this.getRandomKeyword(keywords);
      const imageUrl = this.getUnsplashImageUrl(keyword);

      if (this.container) {
        this.container.classList.add('loading');
      }

      try {
        const loadedUrl = await this.preloadImage(imageUrl);
        await this.cacheImage(loadedUrl, currentPeriod);
        this.cachedImageUrl = loadedUrl;
        this.currentTimePeriod = currentPeriod;
        this.setBackgroundImage(loadedUrl);
      } catch (error) {
        console.error('Error loading image:', error);
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
    }, 300000);
  }
}
