// Focus Mode Manager
// Handles Pomodoro-style focus mode with site blocking

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
      console.log('Starting focus mode for', durationMinutes, 'minutes');
      const response = await chrome.runtime.sendMessage({
        action: 'startFocusMode',
        duration: durationMinutes
      });
      
      console.log('Focus mode response:', response);
      
      if (response && response.success) {
        this.active = true;
        this.endTime = Date.now() + (durationMinutes * 60 * 1000);
        this.updateUI();
        this.startTimer();
        showToastMessage(`Focus mode started for ${durationMinutes} minutes`, 'success');
        return true;
      } else {
        showToastMessage('Failed to start focus mode', 'error');
        console.error('Focus mode failed:', response);
        return false;
      }
    } catch (error) {
      console.error('Error starting focus mode:', error);
      showToastMessage('Error: ' + error.message, 'error');
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
