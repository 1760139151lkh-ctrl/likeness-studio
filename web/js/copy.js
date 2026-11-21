/**
 * 界面文案（zh-SG）：新马年轻人日常聊天的口吻，短、直、有网感。按钮和标签尽量 2–4 个字。
 * 所有面向用户的字都在这里，改口吻只改这一个文件。
 */
export const T = {
  brand: '哈基秀',
  slogan: '一张自拍，秒变艺术头像',

  // 主模式
  live: '实时变身',
  studio: '上传精修',

  // 核心动作
  go: '一键变身',
  same: '拍同款',
  another: '换个风格',
  tweak: '微调细节',
  hold: '按住看原图',
  retake: '重新拍',
  save: '保存相册',
  tiktok: '去发 TikTok',
  again: '再来一张',
  retry: '重试',
  cancel: '取消',
  upload: '上传照片',
  change: '换张照片',
  sample: '用示例玩',
  back: '返回',
  close: '关闭',
  done: '好了',
  gallery: '作品库',
  me: '我的',
  fav: '收藏',
  faved: '已收藏',
  del: '删除',
  shoot: '拍照',
  undo: '撤回一步',
  redo: '恢复一步',
  undone: '已撤回',
  redone: '已恢复',
  fold: '收起',

  // 工具条
  flip: '翻转',
  strength: '强度',
  compare: '对比',
  toStudio: '精修',

  // 参数
  knobs: { strength: '风格强度', likeness: '保留像貌', richness: '细节丰富度', beauty: '美颜微调' },
  tabs: { style: '风格', tune: '微调', detail: '细节' },
  format: { avatar: '头像 1:1', portrait: '竖版 2:3' },
  pace: { quick: '极速', fine: '高清', deep: '超清' },
  paceLine: { quick: '最快出片，适合先试', fine: '速度画质刚刚好', deep: '最精致，多等一会儿' },
  words: '补一句',
  wordsHint: '比如：蝴蝶结换成红色、背景加点烟花…',

  // 状态与加载
  stages: ['识别人像特征', '注入风格光影', '精雕艺术细节'],
  waits: ['正在注入灵魂…', '风格光影渲染中，马上出片…', '细节一点点长出来了…', '再给它两秒，惊艳预定…'],
  sending: '照片上传中…',
  queued: '排队中，马上轮到你',
  doneSaved: '已自动存入你的专属作品库',
  replies: ['搞定啦，看看喜不喜欢 ✨', '改好咯，这张很可以哦', '出片啦，美到发光', '好了好了，快看看', '新鲜出炉，请过目'],
  seeIt: '去看看',
  stopped: '已取消，照片和设置都还在',
  failed: '这次没成功',
  tipLight: '换张光线均匀的正脸照，出片更炸裂哦',
  tipNoFace: '没找到清楚的正脸，换一张试试？',
  tipGood: '光线正脸都 OK，稳了',
  preview: '本地预览 · 连上工作室可生成高清艺术头像',
  example: '示例成片 · 连上工作室就能用你自己的照片',
  simulated: '模拟出片 · 仅用于测试流程',
  saved: '已保存到相册',
  savedDl: '已下载，打开相册就能看到',
  shareTip: '已保存，打开 TikTok 选这张发布就好',
  copied: '已复制',

  // 相机
  camAsk: '开个摄像头，对着自己就能变身',
  camOn: '打开摄像头',
  camDenied: '没开摄像头权限？用照片玩也一样爽',
  camNone: '这台设备没有可用的摄像头，换成上传照片吧',
  camStarting: '摄像头启动中…',
  faceLost: '把脸放进框里',
  faceOk: '已锁定',

  // 空状态
  emptyGallery: '作品库还空着',
  emptyGalleryLine: '选个风格，拍一张或传一张，作品会自动存在这里',
  emptyFavs: '还没收藏风格，看到喜欢的点个爱心',
  noPhoto: '先来一张照片',
  noPhotoLine: '正脸、光线均匀，出片最好看',

  // 账号
  guest: '访客',
  guestLine: '作品先存在这台设备上，登录后自动归到你的账号',
  memberLine: '作品已同步到你的私人空间，换手机也不丢',
  signIn: '登录',
  signUp: '注册',
  signOut: '退出登录',
  handle: '账号名',
  password: '密码',
  nickname: '昵称',
  handleHint: '3–20 位小写字母或数字',
  pwHint: '至少 6 位',
  welcomeBack: '欢迎回来',
  joined: '注册成功，作品都在',
  merged: (n) => `已把 ${n} 条访客记录归到你的账号`,
  offlineAccount: '演示版只存在本机；连上工作室就能注册登录、多设备同步',
};

/** 风格强度等滑块的档位说法。 */
export const level = (/** @type {number} */ v) => (v < 25 ? '轻' : v < 50 ? '中' : v < 75 ? '强' : '满');
