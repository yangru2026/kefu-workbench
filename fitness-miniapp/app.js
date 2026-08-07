const ex = require('./utils/exercises.js');
const courses = require('./utils/courses.js');
const foods = require('./utils/foods.js');

App({
  globalData: {
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    
    // 从模块导入
    exercises: ex.weekPlan,
    homeTemplates: ex.homeTemplates,
    extraExercises: ex.getAllExerciseNames(),
    categories: ex.categories,
    allExercises: ex.allExercises,
    
    // GIF相关
    GIF_BASE: ex.GIF_BASE,
    videoUrls: Object.keys(ex.allExercises).reduce((acc, name) => {
      acc[name] = ex.allExercises[name].gif;
      return acc;
    }, {}),
    exerciseTips: ex.exerciseTips,
    
    // 跟练课程
    courses: courses.courses,
    courseTypes: courses.courseTypes,
    
    // 食物库
    foods: foods.foods,
    foodCategories: foods.foodCategories,
    
    // 计时器预设
    timerPresets: [60, 90, 120, 180],
    
    // 云开发
    cloudEnv: '',
    cloudReady: false
  },

  onLaunch() {
    // 初始化本地存储
    if (!wx.getStorageSync('fitnessRecords')) {
      wx.setStorageSync('fitnessRecords', []);
    }
    if (!wx.getStorageSync('fitnessWorkoutData')) {
      wx.setStorageSync('fitnessWorkoutData', {});
    }
    if (!wx.getStorageSync('dietRecords')) {
      wx.setStorageSync('dietRecords', {});
    }
    if (!wx.getStorageSync('bodyMetrics')) {
      wx.setStorageSync('bodyMetrics', []);
    }
    if (!wx.getStorageSync('followRecords')) {
      wx.setStorageSync('followRecords', []);
    }
    if (!wx.getStorageSync('calorieRecords')) {
      wx.setStorageSync('calorieRecords', {});
    }
    
    // 尝试初始化云开发（如果用户已开启）
    if (wx.cloud && this.globalData.cloudEnv) {
      wx.cloud.init({
        env: this.globalData.cloudEnv,
        traceUser: true
      });
      this.globalData.cloudReady = true;
    }
  },
  
  // 工具函数：获取今天日期字符串
  getDateStr(d) {
    const date = d || new Date();
    return date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
  },
  
  // 获取GIF完整URL
  getGifUrl(name) {
    return ex.getGifUrl(name);
  },
  
  // 获取示范媒体URL（优先级: 真人视频 > 3D视频 > GIF）
  getDemoUrl(name) {
    return ex.getDemoUrl(name);
  },
  
  // 获取动作要点
  getTips(name) {
    return ex.getTips(name);
  },
  
  // 真人视频管理
  getRealVideo(name) {
    return ex.getRealVideo(name);
  },
  setRealVideo(name, url) {
    return ex.setRealVideo(name, url);
  },
  getRealVideoList() {
    return ex.getRealVideoList();
  }
});
