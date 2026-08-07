const app = getApp();

Page({
  data: {
    presets: app.globalData.timerPresets,
    selected: 60,
    remaining: 60,
    displayTime: '01:00',
    running: false,
    progress: 0,
    customTime: ''
  },

  timer: null,
  totalTime: 60,

  selectPreset(e) {
    const time = parseInt(e.currentTarget.dataset.time);
    this.reset(time);
  },

  toggleTimer() {
    if (this.data.running) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    if (this.data.remaining <= 0) return;
    this.setData({ running: true });
    const step = 100; // 每100ms更新一次
    this.timer = setInterval(() => {
      let remaining = this.data.remaining - step / 1000;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(this.timer);
        this.timer = null;
        this.setData({ running: false, remaining: 0, displayTime: '00:00' });
        // 震动提醒
        wx.vibrateLong();
      }
      this.setData({
        remaining,
        displayTime: this.formatTime(remaining),
        progress: this.totalTime > 0 ? ((this.totalTime - remaining) / this.totalTime).toFixed(2) : 0
      });
    }, step);
  },

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setData({ running: false });
  },

  resetTimer() {
    this.reset(this.data.selected);
  },

  reset(time) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const t = time || 60;
    this.totalTime = t;
    this.setData({
      selected: t,
      remaining: t,
      displayTime: this.formatTime(t),
      running: false,
      progress: 0
    });
  },

  setCustom() {
    const t = parseInt(this.data.customTime);
    if (t > 0 && t <= 3600) {
      this.reset(t);
      this.setData({ customTime: '' });
    } else {
      wx.showToast({ title: '请输入1-3600的秒数', icon: 'none' });
    }
  },

  onCustomInput(e) {
    this.setData({ customTime: e.detail.value });
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
});
