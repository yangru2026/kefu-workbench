const app = getApp();
const ex = require('../../utils/exercises.js');
const cal = require('../../utils/calories.js');

Page({
  data: {
    weekDays: app.globalData.weekDays,
    // 模式：template=模板计划, free=自由训练, home=居家模板
    mode: 'template',
    activeDay: '',
    currentExercises: [],
    completed: {},
    showToast: false,
    toastMsg: '',
    // 添加动作
    showModal: false,
    selectedEx: '',
    customName: '',
    customSets: '',
    customReps: '',
    // 动作库分类筛选
    exCategories: ex.categories,
    activeCat: 'all',
    filteredExercises: [],
    searchKeyword: '',
    // 居家模板
    homeTemplates: Object.keys(ex.homeTemplates),
    // 示范弹窗
    showVideo: false,
    videoUrl: '',
    videoType: '',
    videoTitle: '',
    videoTips: '',
    videoEquip: ''
  },

  onShow() {
    this.initPage();
  },

  initPage() {
    const now = new Date();
    const dayMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
    const today = dayMap[now.getDay()];
    if (!this.data.activeDay) {
      this.setData({ activeDay: today });
    }
    this.loadDay(this.data.activeDay);
  },

  // 模式切换
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode, currentExercises: [] });
    if (mode === 'template') {
      this.loadDay(this.data.activeDay);
    } else if (mode === 'home') {
      // 居家模板列表，不加载具体动作
    }
  },

  // 选择居家模板
  selectHomeTemplate(e) {
    const name = e.currentTarget.dataset.name;
    const template = ex.homeTemplates[name];
    const exercises = template.map(t => ({
      name: t.name,
      sets: t.sets,
      reps: t.reps,
      done: false,
      setData: Array.from({ length: t.sets }, () => ({ weight: '', reps: '', done: false }))
    }));
    this.setData({ mode: 'free', currentExercises: exercises });
    this.toast('已加载「' + name + '」模板');
  },

  switchDay(e) {
    const day = e.currentTarget.dataset.day;
    this.loadDay(day);
  },

  loadDay(day) {
    const workoutData = wx.getStorageSync('fitnessWorkoutData') || {};
    let exercises = workoutData[day];
    if (!exercises || exercises.length === 0) {
      const defaults = app.globalData.exercises[day] || [];
      if (defaults.length > 0) {
        exercises = defaults.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          done: false,
          setData: Array.from({ length: ex.sets }, () => ({ weight: '', reps: '', done: false }))
        }));
      } else {
        exercises = [];
      }
    }
    const records = wx.getStorageSync('fitnessRecords') || [];
    const todayStr = this.getDateStr();
    const dayKey = day + '_' + todayStr;
    const isCompleted = records.some(r => r.dayKey === dayKey);
    const completed = { ...this.data.completed, [day]: isCompleted };
    this.setData({ activeDay: day, currentExercises: exercises, completed });
  },

  isToday(day) {
    const dayMap = { 0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
    return dayMap[new Date().getDay()] === day;
  },

  getDateForDay(day) {
    const now = new Date();
    const dayMap = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };
    const targetDay = dayMap[day];
    const today = now.getDay();
    let diff = targetDay - today;
    if (diff > 0) diff -= 7;
    const d = new Date(now);
    d.setDate(d.getDate() + diff);
    return (d.getMonth() + 1) + '/' + d.getDate();
  },

  getDateStr() {
    return app.getDateStr();
  },

  // ===== 组数据操作 =====
  onWeightInput(e) {
    const { exi, si } = e.currentTarget.dataset;
    const exercises = this.data.currentExercises;
    exercises[exi].setData[si].weight = e.detail.value;
    this.setData({ currentExercises: exercises });
    this.saveData();
  },

  onRepsInput(e) {
    const { exi, si } = e.currentTarget.dataset;
    const exercises = this.data.currentExercises;
    exercises[exi].setData[si].reps = e.detail.value;
    this.setData({ currentExercises: exercises });
    this.saveData();
  },

  toggleSetDone(e) {
    const { exi, si } = e.currentTarget.dataset;
    const exercises = this.data.currentExercises;
    exercises[exi].setData[si].done = !exercises[exi].setData[si].done;
    exercises[exi].done = exercises[exi].setData.every(s => s.done);
    this.setData({ currentExercises: exercises });
    this.saveData();
  },

  addSet(e) {
    const idx = e.currentTarget.dataset.exi;
    const exercises = this.data.currentExercises;
    exercises[idx].setData.push({ weight: '', reps: '', done: false });
    exercises[idx].sets = exercises[idx].setData.length;
    this.setData({ currentExercises: exercises });
    this.saveData();
  },

  removeSet(e) {
    const idx = e.currentTarget.dataset.exi;
    const exercises = this.data.currentExercises;
    if (exercises[idx].setData.length > 1) {
      exercises[idx].setData.pop();
      exercises[idx].sets = exercises[idx].setData.length;
      exercises[idx].done = exercises[idx].setData.every(s => s.done);
      this.setData({ currentExercises: exercises });
      this.saveData();
    }
  },

  removeExercise(e) {
    const idx = e.currentTarget.dataset.idx;
    const exercises = this.data.currentExercises;
    exercises.splice(idx, 1);
    this.setData({ currentExercises: exercises });
    this.saveData();
  },

  // ===== 添加动作弹窗 =====
  showAddExercise() {
    this.setData({
      showModal: true,
      selectedEx: '',
      customName: '',
      customSets: '',
      customReps: '',
      activeCat: 'all',
      searchKeyword: '',
      filteredExercises: ex.getAllExerciseNames()
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  // 分类筛选
  filterByCat(e) {
    const catId = e.currentTarget.dataset.cat;
    let list;
    if (catId === 'all') {
      list = ex.getAllExerciseNames();
    } else {
      list = ex.getExercisesByCategory(catId);
    }
    this.setData({ activeCat: catId, filteredExercises: list, selectedEx: '' });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    let list;
    if (!keyword) {
      list = this.data.activeCat === 'all' ? ex.getAllExerciseNames() : ex.getExercisesByCategory(this.data.activeCat);
    } else {
      list = ex.getAllExerciseNames().filter(name => name.includes(keyword));
    }
    this.setData({ searchKeyword: keyword, filteredExercises: list });
  },

  selectEx(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ selectedEx: this.data.selectedEx === name ? '' : name });
  },

  onCustomInput(e) { this.setData({ customName: e.detail.value }); },
  onCustomSets(e) { this.setData({ customSets: e.detail.value }); },
  onCustomReps(e) { this.setData({ customReps: e.detail.value }); },

  confirmAdd() {
    const name = this.data.selectedEx || this.data.customName.trim();
    if (!name) {
      this.toast('请选择或输入动作名');
      return;
    }
    const sets = parseInt(this.data.customSets) || 3;
    const reps = this.data.customReps || '10-12';
    const exercises = this.data.currentExercises;
    exercises.push({
      name, sets, reps, done: false,
      setData: Array.from({ length: sets }, () => ({ weight: '', reps: '', done: false }))
    });
    this.setData({ currentExercises: exercises, showModal: false });
    this.saveData();
    this.toast('已添加「' + name + '」');
  },

  // ===== 完成训练 =====
  finishWorkout() {
    const exercises = this.data.currentExercises;
    if (exercises.length === 0) {
      this.toast('没有训练动作');
      return;
    }
    const allDone = exercises.every(e => e.setData.every(s => s.done));
    if (!allDone) {
      wx.showModal({
        title: '提示',
        content: '还有未完成的组，确定要保存吗？',
        success: (res) => { if (res.confirm) this.doFinish(); }
      });
    } else {
      this.doFinish();
    }
  },

  doFinish() {
    const records = wx.getStorageSync('fitnessRecords') || [];
    const todayStr = this.getDateStr();
    const dayKey = this.data.activeDay + '_' + todayStr + '_' + Date.now();
    
    // 计算卡路里消耗
    const calories = cal.calcWorkoutCalories(this.data.currentExercises);
    
    const record = {
      dayKey,
      day: this.data.activeDay || '自由训练',
      date: todayStr,
      timestamp: Date.now(),
      mode: this.data.mode,
      calories: calories,
      exercises: JSON.parse(JSON.stringify(this.data.currentExercises))
    };
    records.unshift(record);
    wx.setStorageSync('fitnessRecords', records);

    // 保存卡路里记录
    cal.saveCalorieRecord(todayStr, calories, 'workout', this.data.activeDay || '自由训练');

    // 清空自由训练数据
    if (this.data.mode === 'free') {
      this.setData({ currentExercises: [] });
    }

    wx.vibrateShort({ type: 'heavy' });
    wx.showToast({ title: '训练完成！消耗 ' + calories + ' 大卡 🔥', icon: 'none', duration: 2000 });
  },

  // ===== 示范弹窗 =====
  playVideo(e) {
    const name = e.currentTarget.dataset.name;
    const demo = ex.getDemoUrl(name);
    const tips = ex.getTips(name);
    const info = ex.allExercises[name];
    const equip = info ? info.equip : '';
    if (!demo.url) {
      wx.showToast({ title: '暂无该动作的示范', icon: 'none' });
      return;
    }
    this.setData({ showVideo: true, videoUrl: demo.url, videoType: demo.type, videoTitle: name, videoTips: tips, videoEquip: equip });
  },

  closeVideo() {
    this.setData({ showVideo: false, videoUrl: '', videoType: '', videoTitle: '', videoTips: '', videoEquip: '' });
  },

  // ===== 保存 =====
  saveData() {
    if (this.data.mode === 'template') {
      const workoutData = wx.getStorageSync('fitnessWorkoutData') || {};
      workoutData[this.data.activeDay] = this.data.currentExercises;
      wx.setStorageSync('fitnessWorkoutData', workoutData);
    }
    // 自由训练模式数据不持久化到workoutData，只通过finishWorkout保存到records
  },

  toast(msg) {
    this.setData({ showToast: true, toastMsg: msg });
    setTimeout(() => this.setData({ showToast: false }), 1500);
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '辽哥健身房 - 跟着辽哥一起练！💪',
      path: '/pages/plan/plan'
    };
  },

  onShareTimeline() {
    return {
      title: '辽哥健身房 - 你的私人健身教练 💪',
      path: '/pages/plan/plan'
    };
  }
});
