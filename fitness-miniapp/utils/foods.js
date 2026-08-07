// 食物热量数据库 - 每100g的卡路里/蛋白质/碳水/脂肪
// 数据来源: 中国食物成分表

const foods = [
  // 主食
  { name: '米饭', cat: 'staple', kcal: 116, p: 2.6, c: 25.9, f: 0.3, unit: '碗(约150g)' },
  { name: '面条(煮)', cat: 'staple', kcal: 110, p: 3.5, c: 22.5, f: 0.5, unit: '碗(约200g)' },
  { name: '馒头', cat: 'staple', kcal: 223, p: 7.0, c: 47.0, f: 1.1, unit: '个(约100g)' },
  { name: '面包', cat: 'staple', kcal: 313, p: 8.3, c: 58.6, f: 5.1, unit: '片(约30g)' },
  { name: '燕麦片', cat: 'staple', kcal: 367, p: 15.0, c: 61.0, f: 6.7, unit: '份(约40g)' },
  { name: '红薯', cat: 'staple', kcal: 86, p: 1.6, c: 20.0, f: 0.1, unit: '个(约200g)' },
  { name: '紫薯', cat: 'staple', kcal: 82, p: 1.4, c: 18.4, f: 0.2, unit: '个(约150g)' },
  { name: '玉米', cat: 'staple', kcal: 112, p: 4.0, c: 22.8, f: 1.2, unit: '根(约200g)' },
  { name: '土豆', cat: 'staple', kcal: 77, p: 2.0, c: 17.2, f: 0.2, unit: '个(约150g)' },
  { name: '小米粥', cat: 'staple', kcal: 46, p: 1.4, c: 8.4, f: 0.7, unit: '碗(约300g)' },
  { name: '意面(煮)', cat: 'staple', kcal: 158, p: 5.8, c: 30.9, f: 0.9, unit: '份(约200g)' },
  { name: '杂粮饭', cat: 'staple', kcal: 124, p: 3.8, c: 25.0, f: 0.6, unit: '碗(约150g)' },

  // 肉类
  { name: '鸡胸肉', cat: 'meat', kcal: 133, p: 31.0, c: 0, f: 1.2, unit: '块(约120g)' },
  { name: '鸡腿(去皮)', cat: 'meat', kcal: 181, p: 24.0, c: 0, f: 9.0, unit: '只(约200g)' },
  { name: '鸡翅', cat: 'meat', kcal: 194, p: 19.0, c: 0, f: 13.0, unit: '只(约60g)' },
  { name: '瘦牛肉', cat: 'meat', kcal: 125, p: 26.0, c: 0, f: 3.5, unit: '份(约100g)' },
  { name: '牛排', cat: 'meat', kcal: 271, p: 31.0, c: 0, f: 16.0, unit: '块(约200g)' },
  { name: '瘦猪肉', cat: 'meat', kcal: 143, p: 28.0, c: 0, f: 4.0, unit: '份(约100g)' },
  { name: '猪排骨', cat: 'meat', kcal: 278, p: 18.3, c: 0, f: 23.0, unit: '块(约80g)' },
  { name: '羊肉', cat: 'meat', kcal: 203, p: 19.0, c: 0, f: 14.1, unit: '份(约100g)' },
  { name: '火腿肠', cat: 'meat', kcal: 212, p: 14.0, c: 4.5, f: 15.0, unit: '根(约70g)' },

  // 鱼海鲜
  { name: '三文鱼', cat: 'fish', kcal: 208, p: 20.0, c: 0, f: 13.0, unit: '片(约100g)' },
  { name: '鲈鱼', cat: 'fish', kcal: 105, p: 18.6, c: 0, f: 3.4, unit: '条(约400g)' },
  { name: '虾', cat: 'fish', kcal: 87, p: 18.6, c: 0.3, f: 1.2, unit: '只(约20g)' },
  { name: '龙利鱼', cat: 'fish', kcal: 83, p: 17.7, c: 0, f: 1.0, unit: '片(约150g)' },
  { name: '金枪鱼(罐头)', cat: 'fish', kcal: 116, p: 25.0, c: 0, f: 1.0, unit: '罐(约100g)' },
  { name: '螃蟹', cat: 'fish', kcal: 95, p: 18.8, c: 2.3, f: 1.1, unit: '只(约200g)' },
  { name: '扇贝', cat: 'fish', kcal: 60, p: 11.1, c: 2.6, f: 0.6, unit: '个(约30g)' },

  // 蛋奶豆
  { name: '鸡蛋', cat: 'egg', kcal: 144, p: 13.3, c: 2.8, f: 8.8, unit: '个(约50g)' },
  { name: '蛋白', cat: 'egg', kcal: 48, p: 11.6, c: 0.6, f: 0.1, unit: '个(约30g)' },
  { name: '牛奶', cat: 'egg', kcal: 54, p: 3.0, c: 3.4, f: 3.2, unit: '杯(约250ml)' },
  { name: '脱脂牛奶', cat: 'egg', kcal: 35, p: 3.4, c: 5.0, f: 0.1, unit: '杯(约250ml)' },
  { name: '酸奶', cat: 'egg', kcal: 72, p: 2.5, c: 9.3, f: 2.7, unit: '盒(约200g)' },
  { name: '奶酪', cat: 'egg', kcal: 328, p: 25.7, c: 3.5, f: 23.5, unit: '片(约20g)' },
  { name: '豆腐', cat: 'egg', kcal: 73, p: 8.1, c: 1.9, f: 3.7, unit: '块(约150g)' },
  { name: '豆浆', cat: 'egg', kcal: 31, p: 3.0, c: 1.2, f: 1.6, unit: '杯(约300ml)' },
  { name: '毛豆', cat: 'egg', kcal: 131, p: 13.1, c: 10.5, f: 5.0, unit: '份(约100g)' },

  // 蔬菜
  { name: '西兰花', cat: 'veg', kcal: 34, p: 4.1, c: 4.3, f: 0.6, unit: '份(约100g)' },
  { name: '菠菜', cat: 'veg', kcal: 24, p: 2.6, c: 4.5, f: 0.3, unit: '份(约100g)' },
  { name: '生菜', cat: 'veg', kcal: 15, p: 1.4, c: 2.9, f: 0.4, unit: '份(约100g)' },
  { name: '西红柿', cat: 'veg', kcal: 19, p: 0.9, c: 4.0, f: 0.2, unit: '个(约150g)' },
  { name: '黄瓜', cat: 'veg', kcal: 15, p: 0.7, c: 2.9, f: 0.1, unit: '根(约200g)' },
  { name: '胡萝卜', cat: 'veg', kcal: 39, p: 1.0, c: 8.8, f: 0.2, unit: '根(约150g)' },
  { name: '白菜', cat: 'veg', kcal: 17, p: 1.5, c: 3.2, f: 0.1, unit: '份(约200g)' },
  { name: '花菜', cat: 'veg', kcal: 24, p: 2.1, c: 4.6, f: 0.2, unit: '份(约150g)' },
  { name: '青椒', cat: 'veg', kcal: 22, p: 1.0, c: 5.4, f: 0.2, unit: '个(约80g)' },
  { name: '蘑菇', cat: 'veg', kcal: 22, p: 3.1, c: 3.3, f: 0.3, unit: '份(约100g)' },
  { name: '洋葱', cat: 'veg', kcal: 40, p: 1.1, c: 9.3, f: 0.2, unit: '个(约150g)' },
  { name: '豆芽', cat: 'veg', kcal: 16, p: 2.1, c: 2.8, f: 0.1, unit: '份(约150g)' },

  // 水果
  { name: '苹果', cat: 'fruit', kcal: 52, p: 0.3, c: 13.8, f: 0.2, unit: '个(约200g)' },
  { name: '香蕉', cat: 'fruit', kcal: 89, p: 1.1, c: 22.8, f: 0.3, unit: '根(约120g)' },
  { name: '橙子', cat: 'fruit', kcal: 47, p: 0.9, c: 11.8, f: 0.1, unit: '个(约200g)' },
  { name: '葡萄', cat: 'fruit', kcal: 67, p: 0.6, c: 17.2, f: 0.2, unit: '份(约100g)' },
  { name: '西瓜', cat: 'fruit', kcal: 30, p: 0.6, c: 7.6, f: 0.2, unit: '份(约200g)' },
  { name: '草莓', cat: 'fruit', kcal: 32, p: 0.7, c: 7.7, f: 0.3, unit: '份(约150g)' },
  { name: '蓝莓', cat: 'fruit', kcal: 57, p: 0.7, c: 14.5, f: 0.3, unit: '份(约100g)' },
  { name: '猕猴桃', cat: 'fruit', kcal: 61, p: 1.1, c: 14.7, f: 0.5, unit: '个(约80g)' },
  { name: '芒果', cat: 'fruit', kcal: 60, p: 0.8, c: 15.0, f: 0.4, unit: '个(约200g)' },
  { name: '牛油果', cat: 'fruit', kcal: 160, p: 2.0, c: 8.5, f: 14.7, unit: '个(约150g)' },

  // 坚果零食
  { name: '杏仁', cat: 'nut', kcal: 578, p: 21.0, c: 22.0, f: 50.0, unit: '把(约30g)' },
  { name: '核桃', cat: 'nut', kcal: 654, p: 15.0, c: 14.0, f: 65.0, unit: '个(约10g)' },
  { name: '花生', cat: 'nut', kcal: 567, p: 26.0, c: 16.0, f: 49.0, unit: '把(约30g)' },
  { name: '腰果', cat: 'nut', kcal: 553, p: 18.0, c: 30.0, f: 44.0, unit: '把(约30g)' },
  { name: '蛋白粉', cat: 'nut', kcal: 400, p: 80.0, c: 5.0, f: 5.0, unit: '勺(约30g)' },
  { name: '能量棒', cat: 'nut', kcal: 350, p: 20.0, c: 50.0, f: 8.0, unit: '根(约60g)' },

  // 饮品其他
  { name: '黑咖啡', cat: 'drink', kcal: 2, p: 0.2, c: 0.3, f: 0, unit: '杯(约300ml)' },
  { name: '柠檬水', cat: 'drink', kcal: 5, p: 0.1, c: 1.2, f: 0, unit: '杯(约300ml)' },
  { name: '可乐', cat: 'drink', kcal: 42, p: 0, c: 10.6, f: 0, unit: '罐(约330ml)' },
  { name: '奶茶', cat: 'drink', kcal: 120, p: 2.0, c: 20.0, f: 3.0, unit: '杯(约500ml)' },
  { name: '果汁', cat: 'drink', kcal: 55, p: 0.5, c: 13.0, f: 0.1, unit: '杯(约300ml)' },
  { name: '巧克力', cat: 'drink', kcal: 535, p: 7.3, c: 59.0, f: 30.0, unit: '块(约40g)' },
];

const foodCategories = [
  { id: 'staple', name: '主食', icon: '🍚' },
  { id: 'meat', name: '肉类', icon: '🥩' },
  { id: 'fish', name: '鱼海鲜', icon: '🐟' },
  { id: 'egg', name: '蛋奶豆', icon: '🥚' },
  { id: 'veg', name: '蔬菜', icon: '🥦' },
  { id: 'fruit', name: '水果', icon: '🍎' },
  { id: 'nut', name: '坚果零食', icon: '🥜' },
  { id: 'drink', name: '饮品', icon: '🥤' }
];

// 按关键词搜索食物
function searchFoods(keyword) {
  if (!keyword) return foods;
  return foods.filter(f => f.name.includes(keyword));
}

// 按分类筛选
function getFoodsByCategory(catId) {
  if (catId === 'all') return foods;
  return foods.filter(f => f.cat === catId);
}

module.exports = { foods, foodCategories, searchFoods, getFoodsByCategory };
