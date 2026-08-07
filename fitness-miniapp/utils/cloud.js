// 云同步工具 - 可选功能
// 使用前需在微信开发者工具中开启云开发，并将环境ID填入 app.js 的 cloudEnv
// 未开启云开发时，所有数据自动使用本地存储，不影响使用

const COLLECTIONS = {
  WORKOUT: 'workout_records',
  DIET: 'diet_records',
  BODY: 'body_metrics',
  FOLLOW: 'follow_records'
};

// 检查云是否可用
function isCloudReady() {
  const app = getApp();
  return app && app.globalData && app.globalData.cloudReady && wx.cloud;
}

// 同步训练记录到云端
function syncWorkoutRecord(record) {
  if (!isCloudReady()) return Promise.resolve();
  const db = wx.cloud.database();
  return db.collection(COLLECTIONS.WORKOUT).add({ data: record });
}

// 同步饮食记录
function syncDietRecord(date, mealId, items) {
  if (!isCloudReady()) return Promise.resolve();
  const db = wx.cloud.database();
  return db.collection(COLLECTIONS.DIET).add({
    data: { date, mealId, items, timestamp: Date.now() }
  });
}

// 同步体重记录
function syncBodyMetric(metric) {
  if (!isCloudReady()) return Promise.resolve();
  const db = wx.cloud.database();
  return db.collection(COLLECTIONS.BODY).add({ data: metric });
}

// 同步跟练记录
function syncFollowRecord(record) {
  if (!isCloudReady()) return Promise.resolve();
  const db = wx.cloud.database();
  return db.collection(COLLECTIONS.FOLLOW).add({ data: record });
}

// 从云端拉取所有数据（换手机时恢复）
function pullAllData() {
  if (!isCloudReady()) return Promise.resolve(null);
  const db = wx.cloud.database();
  const _ = db.command;
  const results = {};

  return Promise.all([
    db.collection(COLLECTIONS.WORKOUT).orderBy('timestamp', 'desc').limit(100).get(),
    db.collection(COLLECTIONS.DIET).orderBy('timestamp', 'desc').limit(100).get(),
    db.collection(COLLECTIONS.BODY).orderBy('timestamp', 'desc').limit(100).get(),
    db.collection(COLLECTIONS.FOLLOW).orderBy('timestamp', 'desc').limit(100).get()
  ]).then(([workout, diet, body, follow]) => {
    results.workout = workout.data;
    results.diet = diet.data;
    results.body = body.data;
    results.follow = follow.data;
    return results;
  });
}

module.exports = {
  isCloudReady,
  syncWorkoutRecord,
  syncDietRecord,
  syncBodyMetric,
  syncFollowRecord,
  pullAllData,
  COLLECTIONS
};
