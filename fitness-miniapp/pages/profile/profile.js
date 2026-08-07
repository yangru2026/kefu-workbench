const app = getApp();
const cal = require('../../utils/calories.js');

Page({
  data: {
    activeTab: 'workout',
    // 训练记录
    records: [],
    followRecords: [],
    totalWorkouts: 0,
    streakDays: 0,
    thisWeekCount: 0,
    expandedRecord: -1,
    // 卡路里
    todayCalories: 0,
    weekCalories: 0,
    // 体重
    bodyMetrics: [],
    latestWeight: 0,
    heightInput: '',
    bmiValue: 0,
    bmiLabel: '',
    // 体重记录弹窗（含维度）
    showWeightModal: false,
    weightInput: '',
    chestInput: '',
    waistInput: '',
    hipInput: '',
    thighInput: '',
    armInput: '',
    // 趋势图
    chartData: [],
    chartReady: false,
    chartType: 'weight' // weight | calories
  },

  onShow() {
    this.loadData();
    // Canvas绘图需要延迟一下
    setTimeout(() => {
      if (this.data.activeTab === 'body') this.drawChart();
    }, 500);
  },

  loadData() {
    const records = wx.getStorageSync('fitnessRecords') || [];
    const followRecords = wx.getStorageSync('followRecords') || [];
    const bodyMetrics = wx.getStorageSync('bodyMetrics') || [];
    const totalWorkouts = records.length + followRecords.length;
    const streakDays = this.calcStreak(records, followRecords);
    const thisWeekCount = this.calcThisWeek(records, followRecords);

    // 最新体重
    let latestWeight = 0;
    if (bodyMetrics.length > 0) {
      latestWeight = bodyMetrics[0].weight || 0;
    }

    // BMI
    const savedHeight = wx.getStorageSync('userHeight') || '';
    let bmiValue = 0, bmiLabel = '';
    if (latestWeight && savedHeight) {
      const h = savedHeight / 100;
      bmiValue = (latestWeight / (h * h)).toFixed(1);
      bmiLabel = this.getBmiLabel(parseFloat(bmiValue));
    }

    // 卡路里统计
    const today = app.getDateStr();
    const todayCalories = cal.getDailyCalories(today);
    let weekCalories = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekCalories += cal.getDailyCalories(app.getDateStr(d));
    }

    // 趋势图数据
    const chartData = bodyMetrics.slice(0, 30).reverse();

    this.setData({
      records, followRecords, totalWorkouts, streakDays, thisWeekCount,
      bodyMetrics, latestWeight, heightInput: savedHeight, bmiValue, bmiLabel,
      todayCalories, weekCalories, chartData
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'body') {
      setTimeout(() => this.drawChart(), 300);
    }
  },

  calcStreak(records, followRecords) {
    const allDates = new Set();
    records.forEach(r => allDates.add(r.date));
    followRecords.forEach(r => allDates.add(r.date));
    if (allDates.size === 0) return 0;
    let streak = 0, checkDate = new Date();
    while (true) {
      const dateStr = app.getDateStr(checkDate);
      if (allDates.has(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
      else break;
    }
    return streak;
  },

  calcThisWeek(records, followRecords) {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
    const allDates = new Set();
    records.forEach(r => allDates.add(r.date));
    followRecords.forEach(r => allDates.add(r.date));
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const checkDate = new Date(monday); checkDate.setDate(monday.getDate() + d);
      if (allDates.has(app.getDateStr(checkDate))) count++;
    }
    return count;
  },

  getBmiLabel(bmi) {
    if (bmi < 18.5) return '偏瘦';
    if (bmi < 24) return '正常';
    if (bmi < 28) return '偏胖';
    return '肥胖';
  },

  toggleRecord(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ expandedRecord: this.data.expandedRecord === idx ? -1 : idx });
  },

  deleteRecord(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条训练记录吗？',
      success: (res) => {
        if (res.confirm) {
          const records = this.data.records;
          records.splice(idx, 1);
          wx.setStorageSync('fitnessRecords', records);
          this.loadData();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  // ===== 体重+维度记录弹窗 =====
  showWeightInput() {
    const metrics = this.data.bodyMetrics;
    this.setData({
      showWeightModal: true,
      weightInput: this.data.latestWeight ? String(this.data.latestWeight) : '',
      chestInput: metrics.length > 0 && metrics[0].chest ? String(metrics[0].chest) : '',
      waistInput: metrics.length > 0 && metrics[0].waist ? String(metrics[0].waist) : '',
      hipInput: metrics.length > 0 && metrics[0].hip ? String(metrics[0].hip) : '',
      thighInput: metrics.length > 0 && metrics[0].thigh ? String(metrics[0].thigh) : '',
      armInput: metrics.length > 0 && metrics[0].arm ? String(metrics[0].arm) : ''
    });
  },

  hideWeightModal() {
    this.setData({ showWeightModal: false });
  },

  onWeightInput(e) { this.setData({ weightInput: e.detail.value }); },
  onChestInput(e) { this.setData({ chestInput: e.detail.value }); },
  onWaistInput(e) { this.setData({ waistInput: e.detail.value }); },
  onHipInput(e) { this.setData({ hipInput: e.detail.value }); },
  onThighInput(e) { this.setData({ thighInput: e.detail.value }); },
  onArmInput(e) { this.setData({ armInput: e.detail.value }); },

  saveWeight() {
    const weight = parseFloat(this.data.weightInput);
    if (!weight || weight < 20 || weight > 300) {
      wx.showToast({ title: '请输入合理体重(20-300kg)', icon: 'none' });
      return;
    }
    const metric = {
      weight,
      chest: parseFloat(this.data.chestInput) || 0,
      waist: parseFloat(this.data.waistInput) || 0,
      hip: parseFloat(this.data.hipInput) || 0,
      thigh: parseFloat(this.data.thighInput) || 0,
      arm: parseFloat(this.data.armInput) || 0,
      date: app.getDateStr(),
      timestamp: Date.now()
    };
    const metrics = this.data.bodyMetrics;
    // 同一天已有记录就替换
    const existIdx = metrics.findIndex(m => m.date === metric.date);
    if (existIdx >= 0) {
      metrics[existIdx] = metric;
    } else {
      metrics.unshift(metric);
    }
    wx.setStorageSync('bodyMetrics', metrics);
    this.setData({ showWeightModal: false });
    this.loadData();
    wx.showToast({ title: '已记录', icon: 'success' });
  },

  // 身高
  onHeightInput(e) { this.setData({ heightInput: e.detail.value }); },
  saveHeight() {
    const h = parseFloat(this.data.heightInput);
    if (!h || h < 50 || h > 250) {
      wx.showToast({ title: '请输入合理身高', icon: 'none' });
      return;
    }
    wx.setStorageSync('userHeight', h);
    this.loadData();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // ===== Canvas 趋势图 =====
  drawChart() {
    const data = this.data.chartData;
    if (data.length < 2) return;

    const query = wx.createSelectorQuery();
    query.select('#weightChart').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = res[0].width;
      const height = res[0].height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, width, height);

      const padding = { top: 24, right: 16, bottom: 32, left: 44 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;

      // 提取体重值
      const values = data.map(d => d.weight);
      const minVal = Math.min(...values) - 1;
      const maxVal = Math.max(...values) + 1;
      const range = maxVal - minVal || 1;

      // 网格线
      ctx.strokeStyle = '#2a2a4a';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Y轴标签
        const val = maxVal - (range / 4) * i;
        ctx.fillStyle = '#888';
        ctx.font = '20rpx sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(1) + 'kg', padding.left - 8, y + 5);
      }

      if (data.length < 2) return;

      // 折线
      const pointSpacing = chartW / (data.length - 1);
      ctx.beginPath();
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';

      data.forEach((d, i) => {
        const x = padding.left + pointSpacing * i;
        const y = padding.top + chartH - ((d.weight - minVal) / range) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 渐变填充
      const lastX = padding.left + pointSpacing * (data.length - 1);
      ctx.lineTo(lastX, padding.top + chartH);
      ctx.lineTo(padding.left, padding.top + chartH);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, 'rgba(255,107,53,0.3)');
      gradient.addColorStop(1, 'rgba(255,107,53,0.02)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // 数据点
      data.forEach((d, i) => {
        const x = padding.left + pointSpacing * i;
        const y = padding.top + chartH - ((d.weight - minVal) / range) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b35';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // 最新值标注
      if (data.length > 0) {
        const last = data[data.length - 1];
        const lx = padding.left + pointSpacing * (data.length - 1);
        const ly = padding.top + chartH - ((last.weight - minVal) / range) * chartH;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24rpx sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(last.weight + 'kg', lx, ly - 14);
      }

      this.setData({ chartReady: true });
    });
  },

  // 分享
  onShareAppMessage() {
    return { title: '辽哥健身房 - 你的私人健身教练 💪', path: '/pages/plan/plan', imageUrl: '' };
  },
  onShareTimeline() {
    return { title: '辽哥健身房 - 跟着辽哥一起练！💪', path: '/pages/plan/plan' };
  },
  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    wx.showToast({ title: '点击右上角分享', icon: 'none' });
  },
  goVideoManager() {
    wx.navigateTo({ url: '/pages/video-manager/video-manager' });
  },
  clearData() {
    wx.showModal({
      title: '清除数据',
      content: '将清除所有训练、饮食、体重和卡路里记录，不可恢复！',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('fitnessRecords');
          wx.removeStorageSync('fitnessWorkoutData');
          wx.removeStorageSync('dietRecords');
          wx.removeStorageSync('bodyMetrics');
          wx.removeStorageSync('followRecords');
          wx.removeStorageSync('calorieRecords');
          this.loadData();
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  }
});
