// 动作库 - 包含器械训练 + 居家哑铃 + 自重训练
// GIF来源: github.com/JahelCuadrado/ExerciseGymGifsDB (jsDelivr CDN)
// 3D视频来源: free-exercise-db-with-videos (Cloudflare R2 CDN, 1080p MP4)
// 真人视频: 用户可自行上传到微信云存储，通过 setRealVideo() 配置URL
// 优先级: 真人视频 > 3D视频 > GIF动图

const GIF_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0';
const VIDEO_BASE = 'https://pub-585d42eb1aa64a67aedf483ec328d3fe.r2.dev/exercise-videos/male';

// 真人视频本地存储key前缀
const REAL_VIDEO_KEY = 'real_video_';

// 动作分类
const categories = [
  { id: 'chest', name: '胸部', icon: '💪' },
  { id: 'back', name: '背部', icon: '🔙' },
  { id: 'shoulder', name: '肩部', icon: '🏋️' },
  { id: 'arm', name: '手臂', icon: '💪' },
  { id: 'leg', name: '腿部', icon: '🦵' },
  { id: 'core', name: '核心', icon: '🔥' },
  { id: 'cardio', name: '有氧', icon: '🏃' },
  { id: 'home', name: '居家哑铃', icon: '🏠' },
  { id: 'bodyweight', name: '自重训练', icon: '🤸' }
];

// 完整动作库
// video: 视频slug（空字符串表示无视频，使用GIF备用）
const allExercises = {
  // ===== 胸部 =====
  '杠铃卧推': { cat: 'chest', gif: 'pectorals/barbell-bench-press.gif', video: 'barbell-bench-press', equip: '杠铃' },
  '上斜哑铃卧推': { cat: 'chest', gif: 'pectorals/dumbbell-incline-bench-press.gif', video: 'dumbbell-incline-bench-press', equip: '哑铃+健身凳' },
  '下斜卧推': { cat: 'chest', gif: 'pectorals/barbell-decline-bench-press.gif', video: 'barbell-decline-bench-press', equip: '杠铃' },
  '蝴蝶机夹胸': { cat: 'chest', gif: 'pectorals/cable-standing-up-straight-crossovers.gif', video: 'lever-pec-deck-fly', equip: '蝴蝶机' },
  '哑铃飞鸟': { cat: 'chest', gif: 'pectorals/dumbbell-fly.gif', video: 'dumbbell-fly', equip: '哑铃+健身凳' },
  '哑铃卧推': { cat: 'chest', gif: 'pectorals/dumbbell-bench-press.gif', video: '', equip: '哑铃+健身凳' },
  '上斜哑铃飞鸟': { cat: 'chest', gif: 'pectorals/dumbbell-incline-fly.gif', video: 'dumbbell-incline-fly', equip: '哑铃+健身凳' },
  '俯卧撑': { cat: 'chest', gif: 'pectorals/push-up.gif', video: 'push-ups', equip: '自重' },
  '宽距俯卧撑': { cat: 'chest', gif: 'pectorals/push-up-wide.gif', video: '', equip: '自重' },
  '下斜俯卧撑': { cat: 'chest', gif: 'pectorals/push-up-decline.gif', video: '', equip: '自重' },

  // ===== 背部 =====
  '引体向上': { cat: 'back', gif: 'lats/pull-up.gif', video: 'chin-ups-pull-ups', equip: '单杠' },
  '杠铃划船': { cat: 'back', gif: 'upper-back/barbell-bent-over-row.gif', video: 'barbell-underhand-bent-over-row', equip: '杠铃' },
  '坐姿划船': { cat: 'back', gif: 'upper-back/cable-rope-seated-row.gif', video: 'cable-straight-back-seated-row-v-grip', equip: '绳索' },
  '单臂哑铃划船': { cat: 'back', gif: 'upper-back/barbell-one-arm-bent-over-row.gif', video: 'dumbbell-incline-row', equip: '哑铃+健身凳' },
  '高位下拉': { cat: 'back', gif: 'lats/cable-pulldown.gif', video: 'cable-pulldown', equip: '绳索' },
  '面拉': { cat: 'back', gif: 'delts/cable-standing-rear-delt-row-with-rope.gif', video: 'cable-rear-delt-row-with-rope', equip: '绳索' },
  '哑铃俯身划船': { cat: 'back', gif: 'upper-back/dumbbell-bent-over-row.gif', video: 'dumbbell-bent-over-row', equip: '哑铃' },

  // ===== 肩部 =====
  '杠铃推举': { cat: 'shoulder', gif: 'delts/barbell-seated-overhead-press.gif', video: 'military-press', equip: '杠铃' },
  '哑铃推举': { cat: 'shoulder', gif: 'delts/dumbbell-seated-shoulder-press.gif', video: 'dumbbell-bench-seated-press', equip: '哑铃+健身凳' },
  '侧平举': { cat: 'shoulder', gif: 'delts/dumbbell-lateral-raise.gif', video: 'dumbbell-lateral-raise', equip: '哑铃' },
  '前平举': { cat: 'shoulder', gif: 'delts/dumbbell-front-raise.gif', video: 'dumbbell-front-raise', equip: '哑铃' },
  '俯身飞鸟': { cat: 'shoulder', gif: 'delts/dumbbell-rear-delt-raise.gif', video: 'dumbbell-incline-rear-lateral-raise', equip: '哑铃' },
  '阿诺德推举': { cat: 'shoulder', gif: 'delts/dumbbell-arnold-press.gif', video: 'dumbbell-arnold-press', equip: '哑铃' },

  // ===== 手臂 =====
  '杠铃弯举': { cat: 'arm', gif: 'biceps/barbell-curl.gif', video: 'barbell-curl', equip: '杠铃' },
  '哑铃弯举': { cat: 'arm', gif: 'biceps/dumbbell-biceps-curl.gif', video: 'dumbbell-biceps-curl', equip: '哑铃' },
  '锤式弯举': { cat: 'arm', gif: 'biceps/dumbbell-hammer-curl.gif', video: 'dumbbell-cross-body-hammer-curl', equip: '哑铃' },
  '集中弯举': { cat: 'arm', gif: 'biceps/dumbbell-concentration-curl.gif', video: 'dumbbell-concentration-curl', equip: '哑铃' },
  '绳索下压': { cat: 'arm', gif: 'triceps/cable-pushdown.gif', video: 'cable-triceps-pushdown', equip: '绳索' },
  '仰卧臂屈伸': { cat: 'arm', gif: 'triceps/barbell-lying-triceps-extension.gif', video: 'ez-barbell-lying-triceps-extension', equip: '杠铃' },
  '哑铃臂屈伸': { cat: 'arm', gif: 'triceps/dumbbell-kickback.gif', video: 'dumbbell-kickback', equip: '哑铃' },
  '颈后臂屈伸': { cat: 'arm', gif: 'triceps/dumbbell-overhead-triceps-extension.gif', video: 'dumbbell-seated-triceps-extension', equip: '哑铃' },
  '窄距卧推': { cat: 'arm', gif: 'triceps/barbell-close-grip-bench-press.gif', video: 'barbell-close-grip-bench-press', equip: '杠铃' },
  '钻石俯卧撑': { cat: 'arm', gif: 'triceps/push-up-diamond.gif', video: 'close-grip-push-ups', equip: '自重' },

  // ===== 腿部 =====
  '深蹲': { cat: 'leg', gif: 'quads/barbell-wide-squat.gif', video: 'classic-barbell-squat', equip: '杠铃' },
  '杠铃深蹲': { cat: 'leg', gif: 'quads/barbell-wide-squat.gif', video: 'classic-barbell-squat', equip: '杠铃' },
  '腿举': { cat: 'leg', gif: 'quads/lever-alternate-leg-press.gif', video: 'sled-45-degree-leg-wide-press', equip: '腿举机' },
  '腿弯举': { cat: 'leg', gif: 'hamstrings/lever-lying-leg-curl.gif', video: 'lever-lying-leg-curl', equip: '腿弯举机' },
  '腿屈伸': { cat: 'leg', gif: 'quads/lever-leg-extension.gif', video: 'lever-leg-extension', equip: '腿屈伸机' },
  '罗马尼亚硬拉': { cat: 'leg', gif: 'hamstrings/barbell-straight-leg-deadlift.gif', video: 'barbell-straight-leg-deadlift', equip: '杠铃' },
  '保加利亚分腿蹲': { cat: 'leg', gif: 'quads/dumbbell-single-leg-split-squat.gif', video: 'dumbbell-single-leg-squat', equip: '哑铃+健身凳' },
  '哑铃深蹲': { cat: 'leg', gif: 'quads/dumbbell-squat.gif', video: 'dumbbell-squat', equip: '哑铃' },
  '哑铃弓步蹲': { cat: 'leg', gif: 'quads/dumbbell-lunge.gif', video: 'dumbbell-lunge', equip: '哑铃' },
  '哑铃硬拉': { cat: 'leg', gif: 'hamstrings/dumbbell-deadlift.gif', video: 'dumbbell-deadlift', equip: '哑铃' },
  '臀桥': { cat: 'leg', gif: 'glutes/barbell-hip-thrust.gif', video: '', equip: '自重/杠铃' },
  '提踵': { cat: 'leg', gif: 'calves/standing-calf-raise.gif', video: 'dumbbell-standing-calf-raise', equip: '自重/哑铃' },

  // ===== 核心 =====
  '平板支撑': { cat: 'core', gif: 'abs/front-plank-with-twist.gif', video: '', equip: '自重' },
  '卷腹': { cat: 'core', gif: 'abs/crunch-floor.gif', video: 'crunch-on-bench', equip: '自重' },
  '俄罗斯转体': { cat: 'core', gif: 'abs/assisted-motion-russian-twist.gif', video: '', equip: '哑铃/自重' },
  '仰卧举腿': { cat: 'core', gif: 'abs/lying-leg-raise-flat-bench.gif', video: 'lying-straight-leg-raise', equip: '自重' },
  '侧支撑': { cat: 'core', gif: 'abs/side-plank.gif', video: 'side-bridge-side-plank', equip: '自重' },
  '登山跑': { cat: 'core', gif: 'abs/mountain-climber.gif', video: '', equip: '自重' },
  '超人式': { cat: 'core', gif: 'abs/superman.gif', video: '', equip: '自重' },
  '仰卧起坐': { cat: 'core', gif: 'abs/sit-up.gif', video: 'sit-ups', equip: '自重' },

  // ===== 有氧 =====
  '跑步': { cat: 'cardio', gif: 'cardio/run.gif', video: 'running', equip: '无' },
  '开合跳': { cat: 'cardio', gif: 'cardio/jumping-jack.gif', video: 'jumping-jack', equip: '自重' },
  '波比跳': { cat: 'cardio', gif: 'cardio/burpee.gif', video: 'burpee', equip: '自重' },
  '高抬腿': { cat: 'cardio', gif: 'cardio/high-knees.gif', video: '', equip: '自重' },
  '深蹲跳': { cat: 'cardio', gif: 'quads/squat-jump.gif', video: '', equip: '自重' },

  // ===== 全身 =====
  '硬拉': { cat: 'leg', gif: 'hamstrings/barbell-straight-leg-deadlift.gif', video: 'barbell-straight-leg-deadlift', equip: '杠铃' },
};

// 动作要点
const exerciseTips = {
  '杠铃卧推': '1. 肩胛骨收紧下沉，背部反弓留一掌空间\n2. 杠铃下放至下胸位置，触胸轻碰\n3. 推起时肘关节不要锁死\n4. 全程臀部不离开卧推凳',
  '上斜哑铃卧推': '1. 凳子调至30-45度角\n2. 哑铃下放至锁骨上方\n3. 推起时感受上胸收缩\n4. 肘部与身体呈45度',
  '下斜卧推': '1. 脚部固定，身体不滑动\n2. 杠铃下放至下胸位置\n3. 推起时专注下胸发力',
  '蝴蝶机夹胸': '1. 坐姿调至握把与胸齐平\n2. 肘关节微弯保持角度不变\n3. 想象抱住一棵大树向内挤压\n4. 还原时感受胸肌拉伸',
  '哑铃飞鸟': '1. 肘关节微弯且角度固定不变\n2. 下放时感受胸肌充分拉伸\n3. 上来像抱大树向内挤压\n4. 全程肩胛骨收紧贴凳',
  '哑铃卧推': '1. 仰卧健身凳，哑铃在胸部两侧\n2. 哑铃走弧线向上推举\n3. 顶点哑铃不互碰\n4. 下放至胸部高度，感受拉伸',
  '上斜哑铃飞鸟': '1. 凳子30-45度角\n2. 肘微弯，角度固定\n3. 下放感受上胸拉伸\n4. 上夹像抱大树',
  '俯卧撑': '1. 双手与肩同宽，掌心撑地\n2. 身体从头到脚一条直线\n3. 下放至胸部接近地面\n4. 推起时核心收紧不塌腰',
  '宽距俯卧撑': '1. 双手比肩宽1.5倍\n2. 下放时肘部外展\n3. 更多刺激胸外侧\n4. 核心收紧身体不晃',
  '下斜俯卧撑': '1. 脚放在凳子或床上\n2. 手撑地与肩同宽\n3. 下放至胸部接近地面\n4. 更多刺激上胸',
  '引体向上': '1. 握距略宽于肩，掌心朝前\n2. 肩胛骨先下沉收缩再拉\n3. 下拉时挺胸，下巴过杆\n4. 缓慢下放身体',
  '杠铃划船': '1. 俯身至身体与地面45度角\n2. 腰背挺直，核心收紧\n3. 沿大腿方向向上拉至腹部\n4. 顶峰收缩1秒，挤压背部',
  '坐姿划船': '1. 膝盖微弯，腰背挺直\n2. 先收肩胛骨再拉手臂\n3. 拉至腹部，顶峰收缩\n4. 慢放时不要含胸驼背',
  '单臂哑铃划船': '1. 一手撑凳，一只膝盖跪凳\n2. 背部与地面平行\n3. 肘部贴近身体向上拉到最高\n4. 顶峰收缩挤压背阔肌',
  '高位下拉': '1. 握距约1.5倍肩宽\n2. 先下沉肩胛再下拉\n3. 下拉时身体微微后仰\n4. 慢放还原，感受背部拉伸',
  '面拉': '1. 绳索调至面部高度\n2. 双手抓住绳索，肘部抬高\n3. 向面部拉动，手掌朝下\n4. 感受后束和上背收缩',
  '哑铃俯身划船': '1. 双脚与肩同宽，俯身45度\n2. 背挺直，核心紧\n3. 哑铃沿大腿拉至腹部\n4. 顶峰挤压1秒',
  '杠铃推举': '1. 坐姿靠背，杠铃从锁骨高度起始\n2. 垂直向上推举，头微后仰让路\n3. 推至顶点肘不锁死\n4. 下放时控制速度',
  '哑铃推举': '1. 坐姿靠背，哑铃位于耳朵两侧\n2. 哑铃走弧线向上推举\n3. 顶点哑铃不互碰\n4. 下放至耳朵高度',
  '侧平举': '1. 微俯身，手肘微弯固定角度\n2. 以肘部带动哑铃上抬\n3. 抬至肩部高度即可\n4. 像倒水一样手腕微内旋',
  '前平举': '1. 站姿挺胸收腹\n2. 哑铃交替或同时前举\n3. 举至肩部高度即可\n4. 慢放还原',
  '俯身飞鸟': '1. 俯身至上半身与地面平行\n2. 双手持哑铃垂于身体下方\n3. 微弯肘，向两侧展开手臂\n4. 顶峰挤压后束',
  '阿诺德推举': '1. 起始掌心朝向自己，哑铃在胸前\n2. 推举同时旋转手腕\n3. 顶点掌心朝前\n4. 还原时反向旋转',
  '杠铃弯举': '1. 站姿与肩同宽，掌心朝前\n2. 肘部固定于身体两侧不移动\n3. 弯举至二头肌完全收缩\n4. 不要借力摆动身体',
  '哑铃弯举': '1. 双手持哑铃放在身体两侧\n2. 肘部贴近身体，固定不动\n3. 弯举至二头完全收缩\n4. 慢放感受二头拉伸',
  '锤式弯举': '1. 掌心相对的握法\n2. 肘部固定，交替或同时弯举\n3. 感受肱肌和肱桡肌发力\n4. 严格控制，不摆动',
  '集中弯举': '1. 坐在凳上，一脚踩地\n2. 肘部抵在大腿内侧\n3. 弯举至二头完全收缩\n4. 顶峰挤压2秒',
  '绳索下压': '1. 双手抓住绳索，肘部贴近身体\n2. 肘部固定，只动前臂\n3. 下压至手臂完全伸直\n4. 顶峰收缩三头肌',
  '仰卧臂屈伸': '1. 仰卧，杠铃举直至胸部上方\n2. 肘部固定不动，只弯前臂\n3. 下放至额头后方\n4. 用三头力量伸直手臂',
  '哑铃臂屈伸': '1. 一手一脚撑在健身凳上\n2. 另一手持哑铃，上臂贴身\n3. 只动前臂，向后伸直\n4. 顶峰收缩1秒',
  '颈后臂屈伸': '1. 双手持一个哑铃举过头顶\n2. 肘部贴近耳朵，固定不动\n3. 下放至后脑勺\n4. 用三头力量推回',
  '窄距卧推': '1. 双手握距与肩同宽或略窄\n2. 肘部贴近身体两侧\n3. 下放至下胸位置\n4. 推起时感受三头肌发力',
  '钻石俯卧撑': '1. 双手拇指食指相对成菱形\n2. 手放在胸部正下方\n3. 下放时肘部贴近身体\n4. 推起时三头发力',
  '深蹲': '1. 双脚与肩同宽，脚尖微外八\n2. 下蹲时髋关节先启动\n3. 膝盖方向与脚尖一致\n4. 大腿至少与地面平行\n5. 核心收紧，腰背挺直',
  '杠铃深蹲': '1. 杠铃置于斜方肌上\n2. 双脚与肩同宽，脚尖微外八\n3. 下蹲时先屈髋再屈膝\n4. 大腿至少与地面平行',
  '腿举': '1. 双脚与肩同宽置于踏板\n2. 下放至膝盖呈90度角\n3. 推起时膝盖不锁死\n4. 臀部不离开靠垫',
  '腿弯举': '1. 俯卧于器械，滚轴置于脚踝上方\n2. 缓慢弯举至90度\n3. 顶峰收缩1秒\n4. 慢速还原',
  '腿屈伸': '1. 坐姿调好靠背\n2. 慢慢抬起至膝盖伸直\n3. 顶峰收缩1-2秒\n4. 缓慢还原',
  '罗马尼亚硬拉': '1. 膝盖微弯保持角度不变\n2. 以髋关节为轴心折叠\n3. 杠铃贴腿下放至小腿中段\n4. 臀部向前顶回起始位',
  '保加利亚分腿蹲': '1. 后脚搭在凳子上\n2. 前脚膝盖不超脚尖\n3. 后腿膝盖向地面接近但不触地\n4. 躯干直立不前倾',
  '哑铃深蹲': '1. 双手持哑铃于身体两侧\n2. 双脚与肩同宽\n3. 下蹲至大腿与地面平行\n4. 膝盖不内扣',
  '哑铃弓步蹲': '1. 一脚向前迈一大步\n2. 后腿膝盖接近地面\n3. 前腿膝盖不超脚尖\n4. 交替进行',
  '哑铃硬拉': '1. 双手持哑铃于身前\n2. 膝盖微弯，髋关节折叠\n3. 哑铃沿腿下放\n4. 臀部发力站起',
  '臀桥': '1. 仰卧，双脚踩地\n2. 臀部发力向上顶\n3. 顶点膝盖-髋-肩一条线\n4. 顶峰挤压臀部2秒',
  '提踵': '1. 站姿，前脚掌踩地\n2. 缓慢踮起脚尖到最高\n3. 顶峰收缩1秒\n4. 慢放还原',
  '平板支撑': '1. 肘部在肩的正下方\n2. 身体从头到脚一条直线\n3. 腹部臀部收紧\n4. 保持均匀呼吸',
  '卷腹': '1. 仰卧，膝盖弯曲\n2. 双手放于头侧\n3. 用腹部力量卷起上背\n4. 下背始终贴地',
  '俄罗斯转体': '1. 坐姿，脚离地身体微后仰\n2. 双手握住哑铃或空手\n3. 旋转躯干，手臂左右移动\n4. 保持核心紧绷',
  '仰卧举腿': '1. 仰卧，双腿伸直并拢\n2. 缓慢抬起双腿至垂直\n3. 控制下放，不触地面\n4. 下背贴地',
  '侧支撑': '1. 侧卧，前臂撑地\n2. 身体侧面一条直线\n3. 髋部不下沉\n4. 保持呼吸均匀',
  '登山跑': '1. 俯卧撑起始姿势\n2. 交替快速提膝至胸前\n3. 核心收紧不塌腰\n4. 保持匀速',
  '超人式': '1. 俯卧，双手向前伸直\n2. 同时抬起手脚\n3. 顶峰收缩下背\n4. 慢放还原',
  '仰卧起坐': '1. 仰卧，屈膝脚踩地\n2. 双手交叉于胸前\n3. 用腹力坐起\n4. 慢放还原',
  '跑步': '1. 身体微微前倾\n2. 步频适中，呼吸有节奏\n3. 前后摆臂\n4. 脚掌先着地',
  '开合跳': '1. 站姿，双脚并拢\n2. 跳起时双脚分开双手上举\n3. 再跳回起始位置\n4. 保持匀速',
  '波比跳': '1. 站姿开始\n2. 下蹲双手撑地\n3. 双脚后跳成俯卧撑\n4. 收腿跳起双手上举',
  '高抬腿': '1. 原地跑动\n2. 膝盖抬至腰部高度\n3. 手臂自然摆动\n4. 保持高频率',
  '深蹲跳': '1. 深蹲姿势起始\n2. 爆发力跳起\n3. 落地时缓冲回深蹲\n4. 连续进行',
  '硬拉': '1. 双脚与髋同宽\n2. 屈髋屈膝下蹲握杠\n3. 挺胸收腹同时伸髋伸膝\n4. 全程腰背挺直'
};

// 获取GIF完整URL
function getGifUrl(name) {
  const ex = allExercises[name];
  if (!ex || !ex.gif) return '';
  return GIF_BASE + '/' + ex.gif;
}

// 获取3D视频完整URL（无3D视频时返回空）
function getVideoUrl(name) {
  const ex = allExercises[name];
  if (!ex || !ex.video) return '';
  return VIDEO_BASE + '/' + ex.video + '.mp4';
}

// 获取真人视频URL（从本地存储读取用户配置的）
function getRealVideo(name) {
  try {
    return wx.getStorageSync(REAL_VIDEO_KEY + name) || '';
  } catch (e) {
    return '';
  }
}

// 设置真人视频URL（用户上传到云存储后填入）
function setRealVideo(name, url) {
  try {
    if (url) {
      wx.setStorageSync(REAL_VIDEO_KEY + name, url);
    } else {
      wx.removeStorageSync(REAL_VIDEO_KEY + name);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 获取所有已配置真人视频的动作列表
function getRealVideoList() {
  const list = [];
  try {
    const info = wx.getStorageInfoSync();
    info.keys.forEach(key => {
      if (key.startsWith(REAL_VIDEO_KEY)) {
        const name = key.replace(REAL_VIDEO_KEY, '');
        const url = wx.getStorageSync(key);
        list.push({ name, url });
      }
    });
  } catch (e) {}
  return list;
}

// 获取示范媒体URL（优先级: 真人视频 > 3D视频 > GIF动图）
function getDemoUrl(name) {
  // 1. 优先使用真人视频
  const realVideo = getRealVideo(name);
  if (realVideo) return { url: realVideo, type: 'real' };
  // 2. 其次使用3D视频
  const video = getVideoUrl(name);
  if (video) return { url: video, type: '3d' };
  // 3. 最后用GIF动图
  const gif = getGifUrl(name);
  if (gif) return { url: gif, type: 'gif' };
  return { url: '', type: '' };
}

// 获取动作要点
function getTips(name) {
  return exerciseTips[name] || '';
}

// 获取分类下所有动作
function getExercisesByCategory(catId) {
  return Object.keys(allExercises).filter(name => allExercises[name].cat === catId);
}

// 获取所有动作名（数组）
function getAllExerciseNames() {
  return Object.keys(allExercises);
}

// 周计划模板
const weekPlan = {
  周一: [
    { name: '杠铃卧推', sets: 4, reps: '8-12' },
    { name: '上斜哑铃卧推', sets: 3, reps: '10-12' },
    { name: '哑铃飞鸟', sets: 3, reps: '12-15' },
    { name: '绳索下压', sets: 3, reps: '12-15' },
    { name: '仰卧臂屈伸', sets: 3, reps: '10-12' }
  ],
  周二: [
    { name: '引体向上', sets: 4, reps: '力竭' },
    { name: '杠铃划船', sets: 4, reps: '8-12' },
    { name: '坐姿划船', sets: 3, reps: '10-12' },
    { name: '哑铃弯举', sets: 3, reps: '10-12' },
    { name: '锤式弯举', sets: 3, reps: '12-15' }
  ],
  周三: [],
  周四: [
    { name: '深蹲', sets: 5, reps: '8-12' },
    { name: '腿举', sets: 4, reps: '10-12' },
    { name: '腿弯举', sets: 3, reps: '12-15' },
    { name: '哑铃推举', sets: 4, reps: '8-12' },
    { name: '侧平举', sets: 3, reps: '15-20' }
  ],
  周五: [
    { name: '硬拉', sets: 4, reps: '6-10' },
    { name: '杠铃深蹲', sets: 4, reps: '8-12' },
    { name: '杠铃推举', sets: 4, reps: '8-12' },
    { name: '引体向上', sets: 3, reps: '力竭' },
    { name: '杠铃弯举', sets: 3, reps: '10-12' }
  ],
  周六: [
    { name: '跑步', sets: 1, reps: '30分钟' },
    { name: '平板支撑', sets: 3, reps: '60秒' },
    { name: '卷腹', sets: 3, reps: '20' },
    { name: '俄罗斯转体', sets: 3, reps: '20' },
    { name: '仰卧举腿', sets: 3, reps: '15' }
  ],
  周日: []
};

// 居家训练模板（哑铃+健身凳+自重）
const homeTemplates = {
  '居家胸+三头': [
    { name: '哑铃卧推', sets: 4, reps: '10-12' },
    { name: '上斜哑铃卧推', sets: 3, reps: '10-12' },
    { name: '哑铃飞鸟', sets: 3, reps: '12-15' },
    { name: '俯卧撑', sets: 3, reps: '15-20' },
    { name: '哑铃臂屈伸', sets: 3, reps: '12-15' },
    { name: '颈后臂屈伸', sets: 3, reps: '12-15' }
  ],
  '居家背+二头': [
    { name: '单臂哑铃划船', sets: 4, reps: '10-12' },
    { name: '哑铃俯身划船', sets: 4, reps: '10-12' },
    { name: '面拉', sets: 3, reps: '15-20' },
    { name: '哑铃弯举', sets: 3, reps: '10-12' },
    { name: '锤式弯举', sets: 3, reps: '12-15' },
    { name: '集中弯举', sets: 3, reps: '12-15' }
  ],
  '居家腿+肩': [
    { name: '哑铃深蹲', sets: 4, reps: '10-12' },
    { name: '哑铃弓步蹲', sets: 3, reps: '12/腿' },
    { name: '哑铃硬拉', sets: 3, reps: '10-12' },
    { name: '臀桥', sets: 3, reps: '15-20' },
    { name: '哑铃推举', sets: 4, reps: '10-12' },
    { name: '侧平举', sets: 3, reps: '15-20' }
  ],
  '居家核心+有氧': [
    { name: '开合跳', sets: 3, reps: '30秒' },
    { name: '平板支撑', sets: 3, reps: '45秒' },
    { name: '卷腹', sets: 3, reps: '20' },
    { name: '登山跑', sets: 3, reps: '30秒' },
    { name: '俄罗斯转体', sets: 3, reps: '20' },
    { name: '仰卧举腿', sets: 3, reps: '15' },
    { name: '波比跳', sets: 3, reps: '10' }
  ],
  '居家全身燃脂': [
    { name: '开合跳', sets: 4, reps: '40秒' },
    { name: '深蹲跳', sets: 4, reps: '15' },
    { name: '俯卧撑', sets: 4, reps: '15' },
    { name: '波比跳', sets: 4, reps: '10' },
    { name: '高抬腿', sets: 4, reps: '30秒' },
    { name: '登山跑', sets: 4, reps: '30秒' }
  ]
};

module.exports = {
  GIF_BASE,
  VIDEO_BASE,
  REAL_VIDEO_KEY,
  categories,
  allExercises,
  exerciseTips,
  weekPlan,
  homeTemplates,
  getGifUrl,
  getVideoUrl,
  getRealVideo,
  setRealVideo,
  getRealVideoList,
  getDemoUrl,
  getTips,
  getExercisesByCategory,
  getAllExerciseNames
};
