const app = getApp();
const ex = require('../../utils/exercises.js');
const courseData = require('../../utils/courses.js');
const cal = require('../../utils/calories.js');

Page({
  data: {
    courses: courseData.courses,
    courseTypes: courseData.courseTypes,
    activeType: 'all',
    filteredCourses: courseData.courses,
    // 播放器状态
    playing: false,
    paused: false,
    currentCourse: null,
    currentExIdx: 0,
    currentPhase: 'prepare', // prepare | exercise | rest | done
    countdown: 5, // 准备倒计时
    totalTime: 0,
    elapsedTime: 0,
    // 示范
    demoUrl: '',
    demoType: '',
    tips: ''
  },

  // 分类筛选
  filterType(e) {
    const type = e.currentTarget.dataset.type;
    let list;
    if (type === 'all') {
      list = this.data.courses;
    } else {
      list = this.data.courses.filter(c => c.type === type);
    }
    this.setData({ activeType: type, filteredCourses: list });
  },

  // 看帕梅拉原版视频（跳转B站）
  watchOriginalVideo(e) {
    const bvid = e.currentTarget.dataset.bvid;
    const title = e.currentTarget.dataset.title || '帕梅拉跟练视频';
    if (!bvid) return;
    const url = 'https://www.bilibili.com/video/' + bvid;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '🎬 ' + title,
          content: 'B站视频链接已复制！\n\n打开方式：\n1. 打开B站App，点击搜索框，粘贴即可观看\n2. 或在微信聊天框粘贴链接，点击卡片直接打开\n\n跟着帕梅拉真人视频一起练吧！',
          confirmText: '我知道了',
          showCancel: false
        });
      }
    });
  },

  // 选择课程开始播放
  selectCourse(e) {
    const id = e.currentTarget.dataset.id;
    const course = this.data.courses.find(c => c.id === id);
    if (!course) return;

    // 计算总时长
    let total = 0;
    course.exercises.forEach(item => {
      total += item.time + (item.rest || 0);
    });

    this.setData({
      currentCourse: course,
      playing: true,
      paused: false,
      currentExIdx: 0,
      currentPhase: 'prepare',
      countdown: 5,
      totalTime: total,
      elapsedTime: 0,
      demoUrl: '',
      demoType: '',
      tips: ''
    });

    this.startPrepare();
  },

  // 准备阶段倒计时
  startPrepare() {
    this.setData({ currentPhase: 'prepare', countdown: 5 });
    this._timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this._timer);
        this.startExercise();
      } else {
        this.setData({ countdown: this.data.countdown - 1 });
      }
    }, 1000);
  },

  // 开始一个动作
  startExercise() {
    const course = this.data.currentCourse;
    const idx = this.data.currentExIdx;
    const item = course.exercises[idx];
    const demo = ex.getDemoUrl(item.name);
    const tips = ex.getTips(item.name);

    this.setData({
      currentPhase: 'exercise',
      countdown: item.time,
      demoUrl: demo.url,
      demoType: demo.type,
      tips: tips
    });

    this._timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this._timer);
        // 进入休息或下一个动作
        if (item.rest && item.rest > 0) {
          this.startRest();
        } else {
          this.nextExercise();
        }
      } else {
        this.setData({
          countdown: this.data.countdown - 1,
          elapsedTime: this.data.elapsedTime + 1
        });
      }
    }, 1000);
  },

  // 休息阶段
  startRest() {
    const course = this.data.currentCourse;
    const item = course.exercises[this.data.currentExIdx];
    this.setData({ currentPhase: 'rest', countdown: item.rest });

    this._timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this._timer);
        this.nextExercise();
      } else {
        this.setData({
          countdown: this.data.countdown - 1,
          elapsedTime: this.data.elapsedTime + 1
        });
      }
    }, 1000);
  },

  // 下一个动作
  nextExercise() {
    const course = this.data.currentCourse;
    const nextIdx = this.data.currentExIdx + 1;

    if (nextIdx >= course.exercises.length) {
      // 训练完成
      this.finishCourse();
    } else {
      this.setData({ currentExIdx: nextIdx });
      this.startExercise();
    }
  },

  // 跳过当前阶段
  skipPhase() {
    if (this._timer) clearInterval(this._timer);
    if (this.data.currentPhase === 'prepare') {
      this.startExercise();
    } else if (this.data.currentPhase === 'exercise') {
      const course = this.data.currentCourse;
      const item = course.exercises[this.data.currentExIdx];
      if (item.rest && item.rest > 0) {
        this.startRest();
      } else {
        this.nextExercise();
      }
    } else if (this.data.currentPhase === 'rest') {
      this.nextExercise();
    }
  },

  // 暂停/继续
  togglePause() {
    if (this.data.paused) {
      // 继续
      this.setData({ paused: false });
      // 重新启动当前阶段的计时器
      if (this.data.currentPhase === 'prepare') {
        this.startPrepare();
      } else if (this.data.currentPhase === 'exercise') {
        this.continueExercise();
      } else if (this.data.currentPhase === 'rest') {
        this.continueRest();
      }
    } else {
      // 暂停
      if (this._timer) clearInterval(this._timer);
      this.setData({ paused: true });
    }
  },

  continueExercise() {
    this._timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this._timer);
        const course = this.data.currentCourse;
        const item = course.exercises[this.data.currentExIdx];
        if (item.rest && item.rest > 0) {
          this.startRest();
        } else {
          this.nextExercise();
        }
      } else {
        this.setData({
          countdown: this.data.countdown - 1,
          elapsedTime: this.data.elapsedTime + 1
        });
      }
    }, 1000);
  },

  continueRest() {
    this._timer = setInterval(() => {
      if (this.data.countdown <= 1) {
        clearInterval(this._timer);
        this.nextExercise();
      } else {
        this.setData({
          countdown: this.data.countdown - 1,
          elapsedTime: this.data.elapsedTime + 1
        });
      }
    }, 1000);
  },

  // 退出播放
  quitPlay() {
    if (this._timer) clearInterval(this._timer);
    wx.showModal({
      title: '退出跟练',
      content: '确定要退出当前跟练吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ playing: false, currentCourse: null, paused: false });
        }
      }
    });
  },

  // 完成课程
  finishCourse() {
    const course = this.data.currentCourse;
    // 基于用户体重和时长重新精确计算卡路里
    const realCalories = cal.calcFollowCalories(course.name, course.duration);
    
    const records = wx.getStorageSync('followRecords') || [];
    records.unshift({
      courseId: course.id,
      courseName: course.name,
      date: app.getDateStr(),
      timestamp: Date.now(),
      calories: realCalories,
      duration: course.duration
    });
    wx.setStorageSync('followRecords', records);

    // 保存卡路里记录
    cal.saveCalorieRecord(app.getDateStr(), realCalories, 'follow', course.name);

    this.setData({ currentPhase: 'done' });
    wx.vibrateShort({ type: 'heavy' });
  },

  // 完成后关闭
  closeDone() {
    this.setData({ playing: false, currentCourse: null, currentPhase: 'prepare' });
  },

  // 格式化时间
  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  onHide() {
    if (this._timer) clearInterval(this._timer);
    if (this.data.playing) {
      this.setData({ paused: true });
    }
  },

  // 分享
  onShareAppMessage() {
    const course = this.data.currentCourse;
    return {
      title: course ? '我正在跟练「' + course.name + '」💪' : '辽哥健身房 - 跟练课程',
      path: '/pages/follow/follow'
    };
  },

  onShareTimeline() {
    return {
      title: '辽哥健身房 - 跟着视频一起练！💪',
      path: '/pages/follow/follow'
    };
  }
});
