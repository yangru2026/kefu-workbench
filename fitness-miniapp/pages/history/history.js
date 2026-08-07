Page({
  data: {
    records: [],
    stats: { totalWorkouts: 0, streak: 0, thisWeek: 0 }
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = wx.getStorageSync('fitnessRecords') || [];
    // 按时间倒序
    records.sort((a, b) => b.timestamp - a.timestamp);
    const recordsWithExpand = records.map(r => ({ ...r, expanded: false }));

    // 计算统计数据
    const stats = this.calcStats(records);

    this.setData({ records: recordsWithExpand, stats });
  },

  calcStats(records) {
    const totalWorkouts = records.length;

    // 计算连续天数
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateSet = new Set(records.map(r => r.date));
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const str = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      if (dateSet.has(str)) {
        streak++;
      } else {
        break;
      }
    }

    // 本周训练数
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    let thisWeek = 0;
    records.forEach(r => {
      const rd = new Date(r.date);
      if (rd >= monday && rd <= today) thisWeek++;
    });

    return { totalWorkouts, streak, thisWeek };
  },

  toggleExpand(e) {
    const idx = e.currentTarget.dataset.idx;
    const records = this.data.records;
    records[idx].expanded = !records[idx].expanded;
    this.setData({ records });
  },

  deleteRecord(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条训练记录吗？',
      success: (res) => {
        if (res.confirm) {
          const records = this.data.records;
          records.splice(idx, 1);
          wx.setStorageSync('fitnessRecords', records);
          this.setData({ records, stats: this.calcStats(records) });
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  }
});
