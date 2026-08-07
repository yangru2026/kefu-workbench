// 卡路里消耗计算工具
// MET (Metabolic Equivalent of Task) 代谢当量值
// 公式: 卡路里 = MET × 体重(kg) × 持续时间(小时) × 1.05

// 力量训练动作的MET值（按动作类型）
const EXERCISE_MET = {
  // 胸
  '杠铃卧推': 6.0, '哑铃卧推': 5.0, '上斜哑铃卧推': 5.0,
  '哑铃飞鸟': 4.5, '上斜哑铃飞鸟': 4.5, '下斜杠铃卧推': 6.0,
  '俯卧撑': 3.8, '下斜俯卧撑': 4.5, '宽距俯卧撑': 4.0,
  '窄距杠铃卧推': 6.0, '器械夹胸': 4.0,
  
  // 背
  '引体向上': 8.0, '高位下拉': 5.0, '坐姿划船': 4.5,
  '俯身杠铃划船': 6.0, '反握杠铃划船': 6.0, '哑铃单臂划船': 5.0,
  '上斜凳哑铃划船': 5.0, '面拉': 4.0, '绳索面拉': 4.0,
  '硬拉': 8.0, '哑铃硬拉': 6.0,
  
  // 腿
  '杠铃深蹲': 8.0, '哑铃深蹲': 6.0, '深蹲': 6.0,
  '前蹲': 7.0, '哈克深蹲': 5.0,
  '腿举': 6.0, '坐姿腿屈伸': 4.5, '俯卧腿弯举': 4.5,
  '直腿硬拉': 6.0, '哑铃箭步蹲': 5.5,
  '保加利亚分腿蹲': 6.0, '站姿提踵': 4.0,
  
  // 肩
  '站姿杠铃推举': 6.0, '坐姿哑铃推举': 5.0, '哑铃侧平举': 4.0,
  '哑铃前平举': 4.0, '俯身侧平举': 4.0,
  '杠铃前平举': 4.5, '阿诺德推举': 5.0,
  
  // 手臂
  '杠铃弯举': 5.0, '哑铃弯举': 4.5, '锤式弯举': 4.5,
  '集中弯举': 4.0, '绳索下压': 4.0, '哑铃颈后臂屈伸': 4.5,
  '仰卧臂屈伸': 4.5, '哑铃俯身臂屈伸': 4.0,
  
  // 腹
  '卷腹': 2.8, '凳上卷腹': 3.0, '仰卧抬腿': 3.0,
  '平板支撑': 2.0, '侧平板': 2.5, '仰卧起坐': 4.0,
  '仰卧交替抬腿': 3.5, '俄罗斯转体': 4.0,
  '登山跑': 8.0, '超人式': 3.0,
  
  // 有氧/自重
  '跑步': 8.0, '开合跳': 8.0, '波比跳': 12.0,
  '高抬腿': 9.0, '深蹲跳': 10.0, '臀桥': 3.0,
  '保加利亚深蹲': 6.0, '宽距深蹲': 5.0,
  '对握引体': 7.5, '双杠臂屈伸': 6.0,
  '站姿推举': 5.5, '窄距推举': 5.0,
  '器械推举': 4.5, '腿部推举': 6.0,
  '绳索三头肌下压': 4.0, '仰卧三头屈伸': 4.5,
  '俯身飞鸟': 4.0, '杠铃划船': 6.0,
};

// 默认MET值（未知动作）
const DEFAULT_MET = 5.0;

// 获取动作的MET值
function getExerciseMET(name) {
  if (EXERCISE_MET[name]) return EXERCISE_MET[name];
  
  // 模糊匹配
  for (const key in EXERCISE_MET) {
    if (name.includes(key) || key.includes(name)) {
      return EXERCISE_MET[key];
    }
  }
  
  return DEFAULT_MET;
}

// 获取用户体重(kg)，默认65kg
function getUserWeight() {
  const metrics = wx.getStorageSync('bodyMetrics') || [];
  if (metrics.length > 0 && metrics[0].weight) {
    return metrics[0].weight;
  }
  return 65; // 默认体重
}

// 计算单组力量训练的卡路里（动作时间30秒+组间休息60秒=90秒/组）
function calcSetCalories(exerciseName, weight) {
  const met = getExerciseMET(exerciseName);
  // 每组的估计时间: 动作30秒 + 休息60秒 = 90秒 = 0.025小时
  const setTimeHours = 90 / 3600;
  return met * weight * setTimeHours * 1.05;
}

// 计算完整训练的卡路里消耗
function calcWorkoutCalories(exercises) {
  const weight = getUserWeight();
  let total = 0;
  
  exercises.forEach(ex => {
    if (ex.setData && ex.setData.length > 0) {
      // 有组数据的，每组算一份
      total += calcSetCalories(ex.name, weight) * ex.setData.length;
    } else if (ex.sets) {
      // 只有组数的
      total += calcSetCalories(ex.name, weight) * ex.sets;
    }
  });
  
  return Math.round(total);
}

// 计算跟练课程的卡路里（基于MET和时长）
function calcFollowCalories(courseName, durationSeconds) {
  const weight = getUserWeight();
  // 跟练课程的MET范围：帕梅拉≈6.5, HIIT≈10, 核心≈4, 拉伸≈2.5
  let met = 6.0;
  if (courseName.includes('帕梅拉')) met = 6.5;
  else if (courseName.includes('HIIT') || courseName.includes('燃脂')) met = 10.0;
  else if (courseName.includes('核心')) met = 4.0;
  else if (courseName.includes('拉伸')) met = 2.5;
  else if (courseName.includes('有氧')) met = 7.5;
  
  const hours = durationSeconds / 3600;
  return Math.round(met * weight * hours * 1.05);
}

// 保存每日卡路里消耗记录
function saveCalorieRecord(date, kcal, type, detail) {
  const records = wx.getStorageSync('calorieRecords') || {};
  if (!records[date]) records[date] = [];
  
  records[date].push({
    kcal,
    type, // 'workout' | 'follow'
    detail,
    time: Date.now()
  });
  
  wx.setStorageSync('calorieRecords', records);
}

// 获取某天的总卡路里消耗
function getDailyCalories(date) {
  const records = wx.getStorageSync('calorieRecords') || {};
  const dayRecords = records[date] || [];
  return dayRecords.reduce((sum, r) => sum + r.kcal, 0);
}

// 获取最近N天的卡路里数据（用于趋势图）
function getCalorieTrend(days = 30) {
  const records = wx.getStorageSync('calorieRecords') || {};
  const trend = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    
    const dayRecords = records[dateStr] || [];
    const total = dayRecords.reduce((sum, r) => sum + r.kcal, 0);
    trend.push({ date: dateStr, kcal: total });
  }
  
  return trend;
}

module.exports = {
  EXERCISE_MET,
  getExerciseMET,
  getUserWeight,
  calcSetCalories,
  calcWorkoutCalories,
  calcFollowCalories,
  saveCalorieRecord,
  getDailyCalories,
  getCalorieTrend
};
