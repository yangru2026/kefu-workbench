const app = getApp();
const foodData = require('../../utils/foods.js');
const foodAI = require('../../utils/food-ai.js');

Page({
  data: {
    // 日期
    selectedDate: '',
    dateDisplay: '',
    // 三餐+加餐
    meals: [
      { id: 'breakfast', name: '早餐', icon: '🌅', items: [] },
      { id: 'lunch', name: '午餐', icon: '☀️', items: [] },
      { id: 'dinner', name: '晚餐', icon: '🌙', items: [] },
      { id: 'snack', name: '加餐', icon: '🍎', items: [] }
    ],
    // 统计
    totalKcal: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    // 目标
    kcalGoal: 2000,
    proteinGoal: 120,
    // 弹窗
    showAddFood: false,
    activeMeal: '',
    foodCategories: foodData.foodCategories,
    activeCat: 'all',
    filteredFoods: foodData.foods,
    searchKeyword: '',
    selectedFood: null,
    foodAmount: 100,
    // 自定义食物
    customName: '',
    customKcal: '',
    customP: '',
    customC: '',
    customF: '',
    // 拍照识别
    showPhotoModal: false,
    photoActiveMeal: '',
    photoLoading: false,
    photoNoApi: false,
    photoPath: '',
    photoResults: [],
    photoSelectedIndex: -1,
    photoAmount: 100,
    apiKeyInput: '',
    apiSecretInput: ''
  },

  onShow() {
    const today = app.getDateStr();
    this.setData({ selectedDate: today, dateDisplay: this.formatDateDisplay(today) });
    this.loadDietData(today);
  },

  formatDateDisplay(dateStr) {
    const parts = dateStr.split('-');
    return parts[1] + '月' + parts[2] + '日';
  },

  // 前一天/后一天
  changeDate(e) {
    const dir = parseInt(e.currentTarget.dataset.dir);
    const parts = this.data.selectedDate.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + dir);
    const newDate = app.getDateStr(d);
    const today = app.getDateStr();
    // 不能选未来日期
    if (newDate > today) return;
    this.setData({ selectedDate: newDate, dateDisplay: this.formatDateDisplay(newDate) });
    this.loadDietData(newDate);
  },

  // 加载饮食数据
  loadDietData(date) {
    const allRecords = wx.getStorageSync('dietRecords') || {};
    const dayData = allRecords[date] || {};
    
    const meals = this.data.meals.map(m => {
      m.items = dayData[m.id] || [];
      return m;
    });

    this.setData({ meals });
    this.calcStats();
  },

  // 计算统计
  calcStats() {
    let kcal = 0, p = 0, c = 0, f = 0;
    this.data.meals.forEach(m => {
      m.items.forEach(item => {
        const ratio = item.amount / 100;
        kcal += item.kcal * ratio;
        p += item.p * ratio;
        c += item.c * ratio;
        f += item.f * ratio;
      });
    });
    this.setData({
      totalKcal: Math.round(kcal),
      totalProtein: Math.round(p),
      totalCarbs: Math.round(c),
      totalFat: Math.round(f)
    });
  },

  // 打开添加食物弹窗
  showAddFoodModal(e) {
    const mealId = e.currentTarget.dataset.meal;
    this.setData({
      showAddFood: true,
      activeMeal: mealId,
      activeCat: 'all',
      searchKeyword: '',
      filteredFoods: foodData.foods,
      selectedFood: null,
      foodAmount: 100,
      customName: '',
      customKcal: '',
      customP: '',
      customC: '',
      customF: ''
    });
  },

  hideModal() {
    this.setData({ showAddFood: false });
  },

  // 分类筛选
  filterCat(e) {
    const catId = e.currentTarget.dataset.cat;
    let list;
    if (catId === 'all') {
      list = foodData.foods;
    } else {
      list = foodData.getFoodsByCategory(catId);
    }
    this.setData({ activeCat: catId, filteredFoods: list, selectedFood: null });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    let list = foodData.searchFoods(keyword);
    this.setData({ searchKeyword: keyword, filteredFoods: list, selectedFood: null });
  },

  selectFood(e) {
    const name = e.currentTarget.dataset.name;
    const food = foodData.foods.find(f => f.name === name);
    this.setData({ selectedFood: food });
  },

  onAmountInput(e) {
    this.setData({ foodAmount: parseInt(e.detail.value) || 100 });
  },

  // 确认添加食物
  confirmAddFood() {
    let foodItem;
    if (this.data.selectedFood) {
      const f = this.data.selectedFood;
      foodItem = {
        name: f.name,
        kcal: f.kcal,
        p: f.p,
        c: f.c,
        f: f.f,
        amount: this.data.foodAmount,
        unit: f.unit
      };
    } else if (this.data.customName.trim()) {
      foodItem = {
        name: this.data.customName.trim(),
        kcal: parseFloat(this.data.customKcal) || 0,
        p: parseFloat(this.data.customP) || 0,
        c: parseFloat(this.data.customC) || 0,
        f: parseFloat(this.data.customF) || 0,
        amount: this.data.foodAmount,
        unit: '份'
      };
    } else {
      wx.showToast({ title: '请选择或输入食物', icon: 'none' });
      return;
    }

    const meals = this.data.meals;
    const meal = meals.find(m => m.id === this.data.activeMeal);
    if (meal) {
      meal.items.push(foodItem);
    }

    // 保存
    const allRecords = wx.getStorageSync('dietRecords') || {};
    if (!allRecords[this.data.selectedDate]) allRecords[this.data.selectedDate] = {};
    allRecords[this.data.selectedDate][this.data.activeMeal] = meal.items;
    wx.setStorageSync('dietRecords', allRecords);

    this.setData({ meals, showAddFood: false });
    this.calcStats();
    wx.showToast({ title: '已添加', icon: 'success' });
  },

  // 删除食物
  removeFood(e) {
    const { meal, idx } = e.currentTarget.dataset;
    const meals = this.data.meals;
    const m = meals.find(mm => mm.id === meal);
    if (m) {
      m.items.splice(idx, 1);
    }
    // 保存
    const allRecords = wx.getStorageSync('dietRecords') || {};
    if (!allRecords[this.data.selectedDate]) allRecords[this.data.selectedDate] = {};
    allRecords[this.data.selectedDate][meal] = m.items;
    wx.setStorageSync('dietRecords', allRecords);

    this.setData({ meals });
    this.calcStats();
  },

  // 自定义输入
  onCustomName(e) { this.setData({ customName: e.detail.value }); },
  onCustomKcal(e) { this.setData({ customKcal: e.detail.value }); },
  onCustomP(e) { this.setData({ customP: e.detail.value }); },
  onCustomC(e) { this.setData({ customC: e.detail.value }); },
  onCustomF(e) { this.setData({ customF: e.detail.value }); },

  // ===== 拍照识别食物 =====
  takeFoodPhoto(e) {
    const mealId = e.currentTarget.dataset.meal;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.setData({
          showPhotoModal: true,
          photoActiveMeal: mealId,
          photoPath: tempPath,
          photoLoading: true,
          photoNoApi: false,
          photoResults: [],
          photoSelectedIndex: -1,
          photoAmount: 100
        });
        this.doRecognize(tempPath);
      }
    });
  },

  async doRecognize(imagePath) {
    try {
      const result = await foodAI.recognizeFood(imagePath);
      
      if (result.error === 'NO_API_KEY') {
        const { key, secret } = foodAI.getStoredApiKey();
        this.setData({
          photoLoading: false,
          photoNoApi: true,
          apiKeyInput: key,
          apiSecretInput: secret
        });
      } else if (result.success && result.foods.length > 0) {
        // 给每个食物加上分类名称
        const foods = result.foods.map(f => ({
          ...f,
          catName: this.getCatName(f.cat)
        }));
        this.setData({
          photoLoading: false,
          photoResults: foods,
          photoSelectedIndex: 0
        });
      } else {
        this.setData({
          photoLoading: false,
          photoResults: []
        });
      }
    } catch (err) {
      console.error('识别失败:', err);
      this.setData({
        photoLoading: false,
        photoResults: []
      });
      wx.showToast({ title: '识别失败，请重试', icon: 'none' });
    }
  },

  getCatName(cat) {
    const map = { staple: '主食', meat: '肉类', fish: '海鲜', egg: '蛋奶', veg: '蔬菜', fruit: '水果', nut: '零食', drink: '饮品' };
    return map[cat] || '其他';
  },

  hidePhotoModal() {
    this.setData({ showPhotoModal: false });
  },

  selectPhotoFood(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ photoSelectedIndex: idx, photoAmount: 100 });
  },

  onPhotoAmountInput(e) {
    this.setData({ photoAmount: parseInt(e.detail.value) || 100 });
  },

  confirmPhotoFood() {
    if (this.data.photoSelectedIndex < 0) return;
    
    const food = this.data.photoResults[this.data.photoSelectedIndex];
    const amount = this.data.photoAmount;
    
    const foodItem = {
      name: food.name,
      kcal: food.kcal,
      p: Math.round(food.kcal * 0.15 / 4),  // 估算蛋白质：热量×15%÷4
      c: Math.round(food.kcal * 0.55 / 4),   // 估算碳水：热量×55%÷4
      f: Math.round(food.kcal * 0.30 / 9),   // 估算脂肪：热量×30%÷9
      amount: amount,
      unit: 'g'
    };

    const meals = this.data.meals;
    const meal = meals.find(m => m.id === this.data.photoActiveMeal);
    if (meal) {
      meal.items.push(foodItem);
    }

    const allRecords = wx.getStorageSync('dietRecords') || {};
    if (!allRecords[this.data.selectedDate]) allRecords[this.data.selectedDate] = {};
    allRecords[this.data.selectedDate][this.data.photoActiveMeal] = meal.items;
    wx.setStorageSync('dietRecords', allRecords);

    this.setData({ meals, showPhotoModal: false });
    this.calcStats();
    wx.showToast({ title: '已添加「' + food.name + '」', icon: 'success' });
  },

  // API配置
  onApiKeyInput(e) { this.setData({ apiKeyInput: e.detail.value }); },
  onApiSecretInput(e) { this.setData({ apiSecretInput: e.detail.value }); },

  saveApiConfig() {
    const key = this.data.apiKeyInput.trim();
    const secret = this.data.apiSecretInput.trim();
    if (!key || !secret) {
      wx.showToast({ title: '请完整填写', icon: 'none' });
      return;
    }
    foodAI.saveApiKey(key, secret);
    wx.showToast({ title: '配置已保存，正在识别...', icon: 'success' });
    // 重新识别
    this.setData({ photoNoApi: false, photoLoading: true });
    this.doRecognize(this.data.photoPath);
  }
});
