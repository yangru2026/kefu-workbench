// 食物拍照识别 - 百度AI菜品识别 + 本地数据库兜底
// 百度AI免费额度: 500次/天
// 需要在「我的→设置→食物识别配置」填入API Key和Secret Key

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_DISH_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v2/dish';

// 内置食物热量对照表（百度API返回的中文菜名 → 每100g热量）
const DISH_CALORIE_MAP = {
  // 主食
  '米饭': { kcal: 116, cat: 'staple' },
  '面条': { kcal: 110, cat: 'staple' },
  '馒头': { kcal: 223, cat: 'staple' },
  '包子': { kcal: 227, cat: 'staple' },
  '饺子': { kcal: 240, cat: 'staple' },
  '面包': { kcal: 313, cat: 'staple' },
  '油条': { kcal: 386, cat: 'staple' },
  '炒饭': { kcal: 188, cat: 'staple' },
  '粥': { kcal: 46, cat: 'staple' },
  '红薯': { kcal: 86, cat: 'staple' },
  '玉米': { kcal: 112, cat: 'staple' },
  '土豆': { kcal: 77, cat: 'staple' },
  '意大利面': { kcal: 158, cat: 'staple' },
  '三明治': { kcal: 244, cat: 'staple' },
  '汉堡': { kcal: 295, cat: 'staple' },
  '披萨': { kcal: 266, cat: 'staple' },
  '寿司': { kcal: 127, cat: 'staple' },
  '紫薯': { kcal: 82, cat: 'staple' },
  
  // 肉类
  '鸡胸肉': { kcal: 133, cat: 'meat' },
  '鸡腿': { kcal: 181, cat: 'meat' },
  '鸡翅': { kcal: 194, cat: 'meat' },
  '鸡肉': { kcal: 167, cat: 'meat' },
  '烤鸭': { kcal: 336, cat: 'meat' },
  '牛肉': { kcal: 125, cat: 'meat' },
  '牛排': { kcal: 271, cat: 'meat' },
  '猪肉': { kcal: 143, cat: 'meat' },
  '红烧肉': { kcal: 350, cat: 'meat' },
  '排骨': { kcal: 278, cat: 'meat' },
  '羊肉': { kcal: 203, cat: 'meat' },
  '火腿': { kcal: 212, cat: 'meat' },
  '香肠': { kcal: 300, cat: 'meat' },
  '培根': { kcal: 541, cat: 'meat' },
  '烤串': { kcal: 200, cat: 'meat' },
  '红烧排骨': { kcal: 290, cat: 'meat' },
  
  // 鱼海鲜
  '三文鱼': { kcal: 208, cat: 'fish' },
  '鱼': { kcal: 105, cat: 'fish' },
  '虾': { kcal: 87, cat: 'fish' },
  '螃蟹': { kcal: 95, cat: 'fish' },
  '扇贝': { kcal: 60, cat: 'fish' },
  '鱼香肉丝': { kcal: 154, cat: 'meat' },
  '酸菜鱼': { kcal: 108, cat: 'fish' },
  '水煮鱼': { kcal: 150, cat: 'fish' },
  '烤鱼': { kcal: 162, cat: 'fish' },
  '清蒸鱼': { kcal: 90, cat: 'fish' },
  
  // 蛋类
  '鸡蛋': { kcal: 144, cat: 'egg' },
  '煎蛋': { kcal: 196, cat: 'egg' },
  '炒蛋': { kcal: 178, cat: 'egg' },
  '水煮蛋': { kcal: 144, cat: 'egg' },
  '蛋花汤': { kcal: 38, cat: 'egg' },
  '蛋挞': { kcal: 375, cat: 'nut' },
  
  // 蔬菜
  '西兰花': { kcal: 34, cat: 'veg' },
  '菠菜': { kcal: 24, cat: 'veg' },
  '生菜': { kcal: 15, cat: 'veg' },
  '西红柿': { kcal: 19, cat: 'veg' },
  '黄瓜': { kcal: 15, cat: 'veg' },
  '胡萝卜': { kcal: 39, cat: 'veg' },
  '白菜': { kcal: 17, cat: 'veg' },
  '花菜': { kcal: 24, cat: 'veg' },
  '青椒': { kcal: 22, cat: 'veg' },
  '蘑菇': { kcal: 22, cat: 'veg' },
  '洋葱': { kcal: 40, cat: 'veg' },
  '豆芽': { kcal: 16, cat: 'veg' },
  '茄子': { kcal: 21, cat: 'veg' },
  '玉米粒': { kcal: 112, cat: 'staple' },
  '芹菜': { kcal: 14, cat: 'veg' },
  '南瓜': { kcal: 22, cat: 'veg' },
  '豆腐': { kcal: 73, cat: 'egg' },
  '毛豆': { kcal: 131, cat: 'egg' },
  '藕': { kcal: 73, cat: 'veg' },
  '蒜苗': { kcal: 30, cat: 'veg' },
  
  // 水果
  '苹果': { kcal: 52, cat: 'fruit' },
  '香蕉': { kcal: 89, cat: 'fruit' },
  '橙子': { kcal: 47, cat: 'fruit' },
  '葡萄': { kcal: 67, cat: 'fruit' },
  '西瓜': { kcal: 30, cat: 'fruit' },
  '草莓': { kcal: 32, cat: 'fruit' },
  '猕猴桃': { kcal: 61, cat: 'fruit' },
  '芒果': { kcal: 60, cat: 'fruit' },
  
  // 饮品类
  '咖啡': { kcal: 2, cat: 'drink' },
  '可乐': { kcal: 42, cat: 'drink' },
  '果汁': { kcal: 55, cat: 'drink' },
  '奶茶': { kcal: 120, cat: 'drink' },
  '牛奶': { kcal: 54, cat: 'egg' },
  '酸奶': { kcal: 72, cat: 'egg' },
  '啤酒': { kcal: 43, cat: 'drink' },
  '豆浆': { kcal: 31, cat: 'egg' },
  '柠檬水': { kcal: 5, cat: 'drink' },
  
  // 汤类
  '番茄蛋汤': { kcal: 30, cat: 'veg' },
  '紫菜汤': { kcal: 20, cat: 'veg' },
  '鸡汤': { kcal: 45, cat: 'meat' },
  '排骨汤': { kcal: 80, cat: 'meat' },
  '酸辣汤': { kcal: 52, cat: 'veg' },
  
  // 甜点零食
  '蛋糕': { kcal: 347, cat: 'nut' },
  '冰淇淋': { kcal: 207, cat: 'nut' },
  '饼干': { kcal: 433, cat: 'nut' },
  '巧克力': { kcal: 535, cat: 'drink' },
  '坚果': { kcal: 567, cat: 'nut' },
  
  // 川菜常见
  '宫保鸡丁': { kcal: 185, cat: 'meat' },
  '麻婆豆腐': { kcal: 125, cat: 'egg' },
  '回锅肉': { kcal: 298, cat: 'meat' },
  '水煮肉片': { kcal: 210, cat: 'meat' },
  '辣子鸡': { kcal: 220, cat: 'meat' },
  '干煸四季豆': { kcal: 96, cat: 'veg' },
  '夫妻肺片': { kcal: 168, cat: 'meat' },
  
  // 火锅/烧烤
  '火锅': { kcal: 250, cat: 'meat' },
  '麻辣烫': { kcal: 180, cat: 'meat' },
  '烤肉': { kcal: 250, cat: 'meat' },
  
  // 其他常见中餐
  '番茄炒蛋': { kcal: 98, cat: 'egg' },
  '青椒肉丝': { kcal: 120, cat: 'meat' },
  '地三鲜': { kcal: 130, cat: 'veg' },
  '糖醋里脊': { kcal: 265, cat: 'meat' },
  '京酱肉丝': { kcal: 178, cat: 'meat' },
  '鱼香茄子': { kcal: 115, cat: 'veg' },
  '可乐鸡翅': { kcal: 210, cat: 'meat' },
  '炒青菜': { kcal: 35, cat: 'veg' },
  '凉拌黄瓜': { kcal: 30, cat: 'veg' },
  '沙拉': { kcal: 50, cat: 'veg' },
  '皮蛋豆腐': { kcal: 95, cat: 'egg' },
};

// 获取百度AI access_token（带缓存）
let cachedToken = null;
let tokenExpireTime = 0;

function getStoredApiKey() {
  const key = wx.getStorageSync('baiduApiKey') || '';
  const secret = wx.getStorageSync('baiduApiSecret') || '';
  return { key, secret };
}

function saveApiKey(key, secret) {
  wx.setStorageSync('baiduApiKey', key);
  wx.setStorageSync('baiduApiSecret', secret);
  // 清除缓存的token，下次重新获取
  cachedToken = null;
  tokenExpireTime = 0;
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireTime) {
    return cachedToken;
  }
  
  const { key, secret } = getStoredApiKey();
  if (!key || !secret) {
    throw new Error('NO_API_KEY');
  }
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: BAIDU_TOKEN_URL,
      data: {
        grant_type: 'client_credentials',
        client_id: key,
        client_secret: secret
      },
      method: 'POST',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      success(res) {
        if (res.data && res.data.access_token) {
          cachedToken = res.data.access_token;
          tokenExpireTime = now + (res.data.expires_in - 3600) * 1000; // 提前1小时刷新
          resolve(cachedToken);
        } else {
          reject(new Error('INVALID_KEY'));
        }
      },
      fail(err) {
        reject(new Error('NETWORK_ERROR: ' + JSON.stringify(err)));
      }
    });
  });
}

// 使用百度AI识别食物图片
async function recognizeFood(imagePath) {
  try {
    const token = await getAccessToken();
    
    return new Promise((resolve, reject) => {
      // 先获取图片base64
      wx.getFileSystemManager().readFile({
        filePath: imagePath,
        encoding: 'base64',
        success(res) {
          const base64 = res.data;
          
          wx.request({
            url: BAIDU_DISH_URL + '?access_token=' + token,
            data: {
              image: base64,
              top_num: 5,
              filter_threshold: 0.5,
              baike_num: 0
            },
            method: 'POST',
            header: { 'Content-Type': 'application/x-www-form-urlencoded' },
            success(apiRes) {
              if (apiRes.data && apiRes.data.result && apiRes.data.result.length > 0) {
                // 转换百度API结果
                const foods = apiRes.data.result.map(item => {
                  const dishName = item.name;
                  const calorieInfo = DISH_CALORIE_MAP[dishName] || 
                    // 模糊匹配
                    findBestMatch(dishName);
                  
                  return {
                    name: dishName,
                    confidence: item.calorie ? parseFloat((item.calorie * 100).toFixed(0)) : 0,
                    kcal: calorieInfo ? calorieInfo.kcal : 150, // 兜底150大卡/100g
                    cat: calorieInfo ? calorieInfo.cat : 'staple',
                    unit: '100g',
                    amount: 100
                  };
                });
                resolve({ success: true, foods });
              } else {
                resolve({ success: true, foods: [] }); // 没识别到，但不算失败
              }
            },
            fail(err) {
              reject(new Error('API_ERROR: ' + JSON.stringify(err)));
            }
          });
        },
        fail(err) {
          reject(new Error('READ_FILE_ERROR: ' + JSON.stringify(err)));
        }
      });
    });
  } catch (error) {
    // 如果没有配置API Key，返回提示
    if (error.message === 'NO_API_KEY') {
      return { success: false, error: 'NO_API_KEY', message: '尚未配置百度AI识别密钥' };
    }
    if (error.message === 'INVALID_KEY') {
      return { success: false, error: 'INVALID_KEY', message: 'API密钥无效，请检查配置' };
    }
    return { success: false, error: 'UNKNOWN', message: error.message };
  }
}

// 模糊匹配菜名
function findBestMatch(dishName) {
  // 先精确匹配
  if (DISH_CALORIE_MAP[dishName]) return DISH_CALORIE_MAP[dishName];
  
  // 模糊匹配：包含关系
  for (const key in DISH_CALORIE_MAP) {
    if (dishName.includes(key) || key.includes(dishName)) {
      return DISH_CALORIE_MAP[key];
    }
  }
  
  // 关键词匹配
  const keywords = {
    '鸡': '鸡肉', '猪': '猪肉', '牛': '牛肉', '羊': '羊肉',
    '鱼': '鱼', '虾': '虾', '蛋': '鸡蛋',
    '面': '面条', '饭': '米饭', '菜': '炒青菜',
    '汤': '番茄蛋汤', '奶': '牛奶', '果': '苹果',
  };
  
  for (const [key, val] of Object.entries(keywords)) {
    if (dishName.includes(key)) return DISH_CALORIE_MAP[val] || null;
  }
  
  return null;
}

module.exports = {
  recognizeFood,
  getStoredApiKey,
  saveApiKey,
  DISH_CALORIE_MAP,
  BAIDU_TOKEN_URL,
  BAIDU_DISH_URL
};
