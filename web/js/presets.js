/**
 * 哈基秀 · 风格与角色预设矩阵
 *
 * 一个预设 = 一个世界：它的名字与一句话卖点、它贯穿全局的视觉主题（配色、装饰语言、画框）、它在实时镜头里的
 * 滤镜与贴纸、它的生图 Prompt，以及可以叠加的细节增强选项。
 *
 * 只放纯数据与纯函数：浏览器和 tools/make_assets.py（经由 node）都从这里读取同一份 Prompt，
 * 所以界面上展示的样张，就是用户点下去真正会发出去的那句话。
 */

/** @typedef {'acc' | 'light' | 'scene' | 'frame'} DetailGroup */
/** @typedef {{ id: string, label: string, group: DetailGroup, words: string, solo?: string }} Detail */
/**
 * @typedef {{ dark: boolean, bg: string, bg2: string, surface: string, ink: string, soft: string, accent: string,
 *   accent2: string, onAccent: string, glow: string, line: string, radius: string, display: string, deco: string, frame: string }} Theme
 */
/**
 * @typedef {{ grade: number[], sat: number, contrast: number, lift: number, warmth: number, grain: number, vignette: number,
 *   bloom: number, posterize: number, edge: number, halftone: number, pixel: number, bulge: number, eyes: number,
 *   smooth: number, rim: number[], scan: number, overlay: string, sticker?: string }} Live
 */
/**
 * @typedef {{ id: string, name: string, cat: string, hot: number, line: string, hook: string, theme: Theme, live: Live,
 *   prompt: string, details: Detail[], defaults: Params, hero: string, also: string[], inspired?: string }} Preset
 */
/** @typedef {{ strength: number, likeness: number, richness: number, beauty: number, details: string[], words: string }} Params */

/** 顶部分类胶囊。「热门」是精选混合。 */
export const CATEGORIES = [
  { id: 'hot', label: '热门' },
  { id: 'fun', label: '搞怪' },
  { id: 'role', label: '角色变身' },
  { id: 'dream', label: '梦幻主题' },
  { id: 'acg', label: '二次元' },
  { id: 'mood', label: '氛围出片' },
];

/** 细节增强的四个分组（面向艺术头像）。 */
export const DETAIL_GROUPS = [
  { id: 'acc', label: '配饰' },
  { id: 'light', label: '光效' },
  { id: 'scene', label: '背景氛围' },
  { id: 'frame', label: '画框装饰' },
];

/** 四个参数控制项。 */
export const KNOBS = [
  { id: 'strength', label: '风格强度', low: '淡淡的', high: '拉满' },
  { id: 'likeness', label: '保留像貌', low: '放飞', high: '超像本人' },
  { id: 'richness', label: '细节丰富度', low: '简约', high: '满满细节' },
  { id: 'beauty', label: '美颜微调', low: '原生感', high: '精致' },
];

const base = { strength: 70, likeness: 75, richness: 60, beauty: 35, words: '' };
const d = (/** @type {DetailGroup} */ group, /** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ words, solo = '') => ({ id, label, group, words, ...(solo ? { solo } : {}) });
/** 一个滤镜参数集，没写到的都是 0 / 中性。 @param {Partial<Live>} o @returns {Live} */
const live = o => ({ grade: [1, 1, 1], sat: 1, contrast: 1, lift: 0, warmth: 0, grain: 0, vignette: .25, bloom: 0, posterize: 0, edge: 0, halftone: 0, pixel: 0, bulge: 0, eyes: 0, smooth: 0, rim: [0, 0, 0, 0, 0, 0], scan: 0, overlay: '', ...o });

/** @type {Preset[]} */
export const PRESETS = [
  // ───────────── 搞怪 ─────────────
  {
    id: 'dragon', name: '奶龙恶搞', cat: 'fun', hot: 3,
    line: '奶龙上身，圆滚滚又欠揍的表情包', hook: '我是奶龙！',
    theme: { dark: false, bg: '#fff6cc', bg2: '#ffe27a', surface: '#fffdf2', ink: '#3d2a00', soft: '#8a6a1f', accent: '#ffb800', accent2: '#ff7a45', onAccent: '#3d2a00', glow: 'rgba(255,190,0,.45)', line: 'rgba(61,42,0,.14)', radius: '26px', display: 'bubble', deco: 'bubbles', frame: 'sticker' },
    live: live({ grade: [1.08, 1.04, .82], sat: 1.25, contrast: 1.05, warmth: .25, bulge: .22, smooth: .5, vignette: .1, overlay: 'bubbles', sticker: 'nailong-hood' }),
    prompt: 'Turn this person into Nailong (奶龙), the viral chubby milky-yellow baby dragon from the Chinese cartoon: a round squishy custard-yellow dragon body with a big soft belly, stubby little arms and legs, tiny orange nub horns and a short tail, wearing it like a cute costume with their own face clearly recognisable, pulling Nailong\'s iconic huge, wide, cheeky open-mouth grin. Glossy soft 3D cartoon rendering, saturated sunny yellow, meme-sticker energy, made to be shared.',
    details: [
      d('acc', 'wings', '小翅膀', 'tiny flappy wings on its back'),
      d('acc', 'snack', '抱零食', 'hugging a big bag of snacks'),
      d('light', 'gloss', '糖果高光', 'glossy candy-like highlights'),
      d('light', 'spark', '闪光特效', 'comic sparkle bursts around it'),
      d('scene', 'plain', '表情包底', 'a solid, flat sunny-yellow background', 'scene'),
      d('scene', 'park', '游乐园', 'a colourful amusement park behind', 'scene'),
      d('frame', 'sticker', '贴纸白边', 'a thick white die-cut sticker outline around the character, on a solid colour background', 'frame'),
      d('frame', 'panel', '漫画框', 'a bold black comic-panel border', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['gloss', 'plain', 'sticker'] },
    hero: 'jun', also: ['kai'],
  },
  {
    id: 'bighead', name: '大头鬼畜', cat: 'fun', hot: 2,
    line: '三倍大头 + 漫画勾线，自带喜剧张力', hook: '头大，气场更大',
    theme: { dark: false, bg: '#fff1e2', bg2: '#ffd0a8', surface: '#ffffff', ink: '#1d1d1f', soft: '#6b5b4f', accent: '#ff5a36', accent2: '#2b6cff', onAccent: '#ffffff', glow: 'rgba(255,90,54,.35)', line: '#1d1d1f', radius: '14px', display: 'comic', deco: 'halftone', frame: 'comic' },
    live: live({ sat: 1.2, contrast: 1.12, bulge: .62, edge: .35, posterize: .25, vignette: .05, overlay: 'burst' }),
    prompt: 'Turn this person into a comedic big-head caricature: the head enlarged to about three times normal proportion on a tiny body, crisp confident comic ink outlines, flat bright colours, exaggerated but affectionate features that still look exactly like them, a funny expressive pose, slapstick comedy energy.',
    details: [
      d('acc', 'shades', '墨镜', 'oversized novelty sunglasses'),
      d('acc', 'crown', '小皇冠', 'a tiny lopsided crown'),
      d('light', 'spot', '舞台聚光', 'a single stage spotlight'),
      d('light', 'boom', '爆炸背光', 'an explosive radial burst behind the head'),
      d('scene', 'flat', '纯色底', 'a flat bright colour background', 'scene'),
      d('scene', 'street', '热闹街头', 'a busy cartoon street', 'scene'),
      d('frame', 'panel', '漫画框', 'a bold black comic-panel border', 'frame'),
      d('frame', 'sticker', '贴纸白边', 'a thick white die-cut sticker outline, on a solid colour background', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['boom', 'flat'] },
    hero: 'aiman', also: ['priya'],
  },
  {
    id: 'faceart', name: '颜艺暴走', cat: 'fun', hot: 1,
    line: '漫画冲击线 + 神情放大，表情包直出', hook: '情绪，直接拉满',
    theme: { dark: false, bg: '#ffffff', bg2: '#ffe3ea', surface: '#ffffff', ink: '#111111', soft: '#555555', accent: '#ff2d55', accent2: '#111111', onAccent: '#ffffff', glow: 'rgba(255,45,85,.3)', line: '#111111', radius: '10px', display: 'comic', deco: 'speed', frame: 'jagged' },
    live: live({ sat: .2, contrast: 1.45, halftone: .55, edge: .55, eyes: .35, vignette: 0, overlay: 'speed' }),
    prompt: 'Turn this person into an over-the-top manga reaction panel: a hyper-exaggerated dramatic facial expression (huge shocked eyes, jaw dropped, or a triumphant villain grin) that is still clearly them, intense speed lines and impact bursts radiating behind, bold black ink hatching and screentone shading, high-energy comedy manga, a meme-ready reaction image.',
    details: [
      d('acc', 'sweat', '大汗珠', 'giant comic sweat drops'),
      d('acc', 'vein', '暴走青筋', 'a comic anger-vein mark on the forehead'),
      d('light', 'lines', '冲击线', 'radiating speed and impact lines'),
      d('light', 'bolt', '闪电', 'jagged lightning cracks behind'),
      d('scene', 'tone', '网点底', 'a dotted screentone background', 'scene'),
      d('scene', 'fire', '燃烧火焰', 'roaring manga flames behind', 'scene'),
      d('frame', 'panel', '漫画框', 'a slanted manga-panel border', 'frame'),
      d('frame', 'torn', '撕纸边', 'a torn paper edge', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['lines', 'tone'] },
    hero: 'kai', also: ['aiman'],
  },
  {
    id: 'clay', name: '黏土憨憨', cat: 'fun', hot: 2,
    line: '定格动画手作黏土，憨得刚刚好', hook: '捏一个你',
    theme: { dark: false, bg: '#ffe9dc', bg2: '#ffd2bf', surface: '#fff8f2', ink: '#4a2c22', soft: '#946a5a', accent: '#ff8a65', accent2: '#5cc6a0', onAccent: '#ffffff', glow: 'rgba(255,138,101,.4)', line: 'rgba(74,44,34,.12)', radius: '30px', display: 'round', deco: 'candy', frame: 'candy' },
    live: live({ grade: [1.06, 1, .94], sat: 1.15, contrast: .92, lift: .06, warmth: .2, posterize: .45, smooth: .9, vignette: .2, overlay: 'candy', sticker: 'beanie' }),
    prompt: 'Recreate this person as a charming handmade stop-motion clay figure: soft plasticine with faint fingerprints and tool marks, slightly lopsided rounded features, big glossy bead eyes, hair sculpted in chunky clay strands, a goofy lovable expression, still clearly recognisable as them, warm miniature-set lighting with a tiny depth of field.',
    details: [
      d('acc', 'beanie', '毛线帽', 'a knitted clay beanie'),
      d('acc', 'scarf', '小围巾', 'a chunky striped clay scarf'),
      d('light', 'lamp', '暖黄台灯', 'warm desk-lamp light'),
      d('light', 'soft', '柔光棚', 'soft even studio light'),
      d('scene', 'town', '玩具小镇', 'a tiny handmade toy town', 'scene'),
      d('scene', 'candy', '糖果色底', 'a candy-pastel seamless backdrop', 'scene'),
      d('frame', 'blobs', '糖果框', 'a frame of colourful clay blobs and candy shapes', 'frame'),
      d('frame', 'sticker', '贴纸白边', 'a thick white die-cut sticker outline, on a solid colour background', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 70, details: ['soft', 'candy'] },
    hero: 'priya', also: ['jun'],
  },
  {
    id: 'pet', name: '萌宠附体', cat: 'fun', hot: 2,
    line: '猫猫狗狗跟你同款神态，萌到犯规', hook: '喵一个？',
    theme: { dark: false, bg: '#fff1ef', bg2: '#ffd9d2', surface: '#fffaf8', ink: '#4b2b2b', soft: '#9a6b66', accent: '#ff8fab', accent2: '#ffb86b', onAccent: '#ffffff', glow: 'rgba(255,143,171,.45)', line: 'rgba(75,43,43,.12)', radius: '28px', display: 'round', deco: 'paws', frame: 'paws' },
    live: live({ grade: [1.05, 1, 1], sat: 1.1, lift: .05, warmth: .12, smooth: .7, bloom: .25, eyes: .2, vignette: .15, overlay: 'paws', sticker: 'cat-ears' }),
    prompt: 'Blend this person playfully with a cute pet: soft fluffy animal ears, faint whisker marks and a tiny pink nose tip on their own face, keeping their features and expression clearly them, with a matching fluffy pet beside their face mirroring their exact expression. Soft, bright, cosy and adorable photo-illustration.',
    details: [
      d('acc', 'cat', '猫猫款', 'cat ears and a kitten', 'acc'),
      d('acc', 'dog', '狗狗款', 'floppy puppy ears and a puppy instead of a cat', 'acc'),
      d('light', 'glow', '软萌柔光', 'a soft fluffy glow'),
      d('light', 'stars', '星星眼', 'sparkly star highlights in the eyes'),
      d('scene', 'nest', '暖暖小窝', 'a cosy blanket nest', 'scene'),
      d('scene', 'lawn', '阳光草地', 'a sunny lawn', 'scene'),
      d('frame', 'paws', '爪印框', 'a border of tiny paw prints', 'frame'),
      d('frame', 'sticker', '贴纸白边', 'a thick white die-cut sticker outline, on a solid colour background', 'frame'),
    ],
    defaults: { ...base, strength: 70, likeness: 85, details: ['cat', 'glow', 'nest'] },
    hero: 'nur', also: ['kai'],
  },

  // ───────────── 角色变身 ─────────────
  {
    id: 'giant', name: '光之巨人', cat: 'role', hot: 3,
    line: '银红战甲、彩色计时器，奥特曼本曼登场', hook: '相信光！',
    theme: { dark: true, bg: '#0b1222', bg2: '#1f2a4d', surface: '#141c33', ink: '#eef3ff', soft: '#9fb0d6', accent: '#ff3b47', accent2: '#4fd7ff', onAccent: '#ffffff', glow: 'rgba(79,215,255,.55)', line: 'rgba(206,220,255,.18)', radius: '8px', display: 'hero', deco: 'energy', frame: 'energy' },
    live: live({ grade: [1.02, 1.02, 1.1], sat: 1.15, contrast: 1.18, bloom: .45, rim: [1, .25, .3, .3, .85, 1], vignette: .45, overlay: 'energy', sticker: 'ultra-crest' }),
    prompt: 'Turn this person into an Ultraman: the classic Ultraman suit in gleaming silver and red with its flowing curved stripes, the round glowing blue color timer in the centre of the chest, the iconic silver Ultraman crest-fin helmet with the face open so their own face stays clearly recognisable, cinematic rim light, heroic low angle, an epic Showa-era tokusatsu film still.',
    details: [
      d('acc', 'crest', '头冠鳍', 'the silver Ultraman crest fin shining on the helmet'),
      d('acc', 'beam', '光线手势', 'arms crossed in the iconic Specium Ray pose, firing a brilliant beam of light'),
      d('light', 'timer', '计时器', 'the color timer glowing bright blue and lighting the face'),
      d('light', 'warn', '红灯警报', 'the color timer flashing red, the hero at their limit'),
      d('scene', 'kaiju', '怪兽城市', 'a city at dusk with a giant kaiju silhouette in the smoke behind', 'scene'),
      d('scene', 'm78', 'M78星云', 'the glowing M78 nebula in deep space', 'scene'),
      d('frame', 'energy', '能量边框', 'a glowing energy frame of light streaks', 'frame'),
      d('frame', 'flare', '光之爆闪', 'a blinding burst of light rays from behind', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 80, details: ['crest', 'timer', 'kaiju'] },
    hero: 'aiman', also: ['jun'],
  },
  {
    id: 'robocat', name: '蓝胖子', cat: 'role', hot: 3,
    line: '哆啦A梦头套、红鼻子小铃铛，童年回来了', hook: '我是蓝胖子！',
    theme: { dark: false, bg: '#e6f4ff', bg2: '#bfe3ff', surface: '#ffffff', ink: '#0d3156', soft: '#4f7396', accent: '#1e88e5', accent2: '#e53935', onAccent: '#ffffff', glow: 'rgba(30,136,229,.4)', line: 'rgba(13,49,86,.14)', radius: '999px', display: 'round', deco: 'dots', frame: 'tv' },
    live: live({ grade: [.94, 1.02, 1.12], sat: 1.25, contrast: 1.08, posterize: .6, edge: .45, smooth: .6, vignette: .1, overlay: 'dora', sticker: 'take-copter' }),
    prompt: 'Turn this person into a Doraemon cosplay drawn in the classic Doraemon anime style: the round blue-and-white robot-cat hood with Doraemon\'s face on top (big round eyes, red nose, whiskers), the red collar with the golden bell and the white 4D pocket on the belly, their own face clearly visible in the hood opening with a big happy grin. Bright retro 1980s cel animation, thick soft outlines, flat cheerful colours, clean transparent cel shading.',
    details: [
      d('acc', 'copter', '竹蜻蜓', 'a little yellow Take-copter (bamboo-copter) spinning on top of the head'),
      d('acc', 'dorayaki', '铜锣烧', 'happily holding a fluffy dorayaki'),
      d('light', 'cel', '赛璐璐感', 'crisp two-tone cel shading'),
      d('light', 'sun', '晴天阳光', 'bright sunny light'),
      d('scene', 'door', '任意门', 'the pink Anywhere Door standing open on a grassy field behind', 'scene'),
      d('scene', 'room', '大雄房间', 'a cosy 1980s Japanese tatami bedroom', 'scene'),
      d('frame', 'tv', '复古电视', 'a rounded retro TV-screen frame', 'frame'),
      d('frame', 'sticker', '贴纸白边', 'a thick white die-cut sticker outline, on a solid colour background', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 75, details: ['copter', 'cel', 'door'] },
    hero: 'kai', also: ['nur'],
  },
  {
    id: 'pilot', name: '机甲驾驶员', cat: 'role', hot: 2,
    line: '驾驶舱 HUD 投影打在脸上，科技感拉满', hook: '同步率 100%',
    theme: { dark: true, bg: '#061017', bg2: '#0d2635', surface: '#0c1c26', ink: '#dff8ff', soft: '#7fb3c4', accent: '#34e1ff', accent2: '#ff8a2a', onAccent: '#04131a', glow: 'rgba(52,225,255,.5)', line: 'rgba(52,225,255,.22)', radius: '6px', display: 'tech', deco: 'grid', frame: 'brackets' },
    live: live({ grade: [.9, 1.04, 1.12], sat: .9, contrast: 1.15, rim: [.2, .9, 1, 1, .55, .15], scan: .25, vignette: .4, overlay: 'hud' }),
    prompt: 'Turn this person into a futuristic mecha pilot seated in a cockpit: a sleek high-collared pilot suit, a transparent visor with glowing holographic HUD reticles and data projected across the face, cyan and orange instrument glow reflecting on their cheeks, still clearly recognisable, a cinematic sci-fi film still with shallow depth of field.',
    details: [
      d('acc', 'helmet', '驾驶头盔', 'an open-visor pilot helmet'),
      d('acc', 'headset', '通讯耳麦', 'a slim comms headset'),
      d('light', 'hud', 'HUD 投影', 'holographic HUD light projected across the face'),
      d('light', 'alert', '警报红光', 'red alert lights pulsing'),
      d('scene', 'cockpit', '驾驶舱', 'a dim mecha cockpit full of screens', 'scene'),
      d('scene', 'hangar', '机库', 'a vast mecha hangar', 'scene'),
      d('frame', 'brackets', '瞄准框', 'targeting brackets framing the face', 'frame'),
      d('frame', 'data', '数据流', 'streams of glowing data along the edges', 'frame'),
    ],
    defaults: { ...base, strength: 75, likeness: 85, details: ['hud', 'cockpit'] },
    hero: 'jun', also: ['priya'],
  },
  {
    id: 'figure', name: '盲盒手办', cat: 'role', hot: 3,
    line: '哑光潮玩质感、透亮大眼，棚拍级布光', hook: '隐藏款就是你',
    theme: { dark: false, bg: '#f3f0ff', bg2: '#e2dbff', surface: '#ffffff', ink: '#2a2154', soft: '#7468a8', accent: '#7b61ff', accent2: '#ff9cc8', onAccent: '#ffffff', glow: 'rgba(123,97,255,.4)', line: 'rgba(42,33,84,.12)', radius: '22px', display: 'round', deco: 'sparkle', frame: 'box' },
    live: live({ grade: [1.02, 1, 1.05], sat: 1.12, contrast: 1.02, lift: .05, smooth: 1, eyes: .35, bloom: .2, vignette: .12, overlay: 'box' }),
    prompt: 'Recreate this person as a premium designer art-toy blind-box figure: smooth matte vinyl, chibi proportions with a big head, large glossy expressive eyes, simplified cute features that still read clearly as them, standing on a small round base, soft studio softbox lighting, a clean pastel backdrop, high-end product photography.',
    details: [
      d('acc', 'prop', '小道具', 'holding a tiny matching accessory prop'),
      d('acc', 'outfit', '潮服', 'a trendy streetwear outfit'),
      d('light', 'box', '柔光棚拍', 'soft softbox studio light'),
      d('light', 'rim', '轮廓光', 'a crisp rim light'),
      d('scene', 'pastel', '马卡龙底', 'a macaron-pastel backdrop', 'scene'),
      d('scene', 'shelf', '展示柜', 'a glass collector display shelf', 'scene'),
      d('frame', 'box', '盲盒包装', 'inside a cute blind-box packaging window', 'frame'),
      d('frame', 'dome', '透明罩', 'under a clear acrylic display dome', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 70, details: ['box', 'pastel'] },
    hero: 'nur', also: ['aiman'],
  },
  {
    id: 'arcade', name: '街机格斗家', cat: 'role', hot: 1,
    line: '90 年代高精像素 + 选人界面气场', hook: 'READY? FIGHT!',
    theme: { dark: true, bg: '#160b33', bg2: '#33104d', surface: '#1e1240', ink: '#fff6d6', soft: '#c3a8ff', accent: '#ffcc00', accent2: '#ff3d6e', onAccent: '#1a0d00', glow: 'rgba(255,204,0,.45)', line: 'rgba(255,246,214,.2)', radius: '0px', display: 'pixel', deco: 'pixels', frame: 'pixel' },
    live: live({ sat: 1.35, contrast: 1.2, pixel: .55, posterize: .55, scan: .5, vignette: .3, overlay: 'fight' }),
    prompt: 'Turn this person into a 1990s arcade fighting-game character: detailed 16-bit pixel art, a confident fighting stance with a blazing energy aura, a dramatic character-select portrait composition against a bold gradient backdrop, crisp limited palette, a soft CRT glow. Still clearly them. No text, no logos.',
    details: [
      d('acc', 'band', '战斗头带', 'a fighter\'s headband'),
      d('acc', 'gloves', '格斗拳套', 'fingerless fighting gloves'),
      d('light', 'aura', '气场爆发', 'a blazing energy aura'),
      d('light', 'flash', '必杀闪光', 'a special-move flash'),
      d('scene', 'street', '街头擂台', 'a pixel street stage at sunset', 'scene'),
      d('scene', 'dojo', '道馆', 'a pixel-art dojo', 'scene'),
      d('frame', 'select', '选人框', 'a glowing character-select portrait border', 'frame'),
      d('frame', 'scan', '扫描线', 'visible CRT scanlines', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['aura', 'select'] },
    hero: 'priya', also: ['jun'],
  },

  // ───────────── 梦幻主题 ─────────────
  {
    id: 'princess', name: '梦幻公主', cat: 'dream', hot: 3,
    line: '粉金柔光、爱心丝带、拱形画框，童话高定', hook: '今天是公主本主',
    theme: { dark: false, bg: '#fff3f6', bg2: '#ffd9e5', surface: '#fffafb', ink: '#5a2338', soft: '#a2687d', accent: '#ec6d9b', accent2: '#c9a25a', onAccent: '#ffffff', glow: 'rgba(236,109,155,.42)', line: 'rgba(201,162,90,.35)', radius: '999px 999px 24px 24px', display: 'serif', deco: 'hearts', frame: 'arch' },
    live: live({ grade: [1.05, .97, 1.01], sat: 1.06, contrast: .98, lift: .04, warmth: .08, smooth: .7, bloom: .22, vignette: .14, overlay: 'hearts', sticker: 'tiara' }),
    prompt: 'Repaint this person as a fairy-tale princess couture portrait: a soft blush-pink and champagne-gold palette, a dreamy pastel painterly finish with luminous skin and delicate brushwork, romantic, sweet and refined.',
    details: [
      d('acc', 'tiara', '珍珠皇冠', 'a delicate pearl and rose-gold tiara'),
      d('acc', 'bows', '丝带蝴蝶结', 'satin ribbon bows'),
      d('light', 'glow', '粉金柔光', 'a soft pink-gold glow'),
      d('light', 'hearts', '爱心闪光', 'tiny floating hearts and sparkles'),
      d('scene', 'roses', '玫瑰花园', 'a blooming rose garden', 'scene'),
      d('scene', 'ballroom', '水晶舞厅', 'a candlelit crystal ballroom', 'scene'),
      d('frame', 'arch', '拱形画框', 'an elegant rose-gold arched frame with climbing roses around the portrait', 'frame'),
      d('frame', 'lace', '蕾丝花边', 'a delicate lace border', 'frame'),
    ],
    defaults: { ...base, strength: 75, likeness: 85, beauty: 50, details: ['tiara', 'bows', 'hearts', 'roses', 'arch'] },
    hero: 'nur', also: ['priya'],
  },
  {
    id: 'gothic', name: '暗黑哥特', cat: 'dream', hot: 2,
    line: '丝绒暗紫、银饰与花窗光影，冷艳反差', hook: '今晚不营业',
    theme: { dark: true, bg: '#110a16', bg2: '#2a1534', surface: '#1b1121', ink: '#efe6f5', soft: '#a993b8', accent: '#a46bff', accent2: '#cfd2df', onAccent: '#ffffff', glow: 'rgba(164,107,255,.45)', line: 'rgba(207,210,223,.2)', radius: '60% 60% 14px 14px / 30% 30% 14px 14px', display: 'gothic', deco: 'thorns', frame: 'gothic' },
    live: live({ grade: [.98, .9, 1.08], sat: .75, contrast: 1.25, smooth: .5, vignette: .65, bloom: .15, overlay: 'gothic', sticker: 'gothic-crown' }),
    prompt: 'Repaint this person as a dark gothic portrait: deep velvet plum and black, ornate antique silver jewellery, dramatic candlelight, moody painterly chiaroscuro, elegant, mysterious and cool.',
    details: [
      d('acc', 'choker', '银饰颈链', 'an ornate silver filigree choker'),
      d('acc', 'veil', '黑纱头饰', 'a black lace veil headpiece'),
      d('light', 'candle', '烛光', 'flickering candlelight'),
      d('light', 'moon', '冷月光', 'cold blue moonlight'),
      d('scene', 'window', '哥特花窗', 'a gothic stained-glass rose window', 'scene'),
      d('scene', 'hall', '古堡长廊', 'a shadowy castle corridor', 'scene'),
      d('frame', 'silver', '银饰雕花框', 'an ornate antique silver carved frame', 'frame'),
      d('frame', 'roses', '黑玫瑰', 'black roses around the edges', 'frame'),
    ],
    defaults: { ...base, strength: 75, likeness: 85, beauty: 45, details: ['choker', 'candle', 'window'] },
    hero: 'kai', also: ['priya'],
  },

  // ───────────── 二次元 ─────────────
  {
    id: 'anime', name: '动漫主角', cat: 'acg', hot: 3,
    line: '剧场版级光影、通透发丝、会说话的眼神', hook: '主角光环已加载',
    theme: { dark: false, bg: '#e9f5ff', bg2: '#ffe3f1', surface: '#ffffff', ink: '#1b2a4a', soft: '#5f7398', accent: '#3b82f6', accent2: '#ff6fa8', onAccent: '#ffffff', glow: 'rgba(59,130,246,.38)', line: 'rgba(27,42,74,.12)', radius: '20px', display: 'sans', deco: 'sparkle', frame: 'poster' },
    live: live({ grade: [1, 1.02, 1.06], sat: 1.25, contrast: 1.05, lift: .05, posterize: .35, edge: .3, smooth: .8, eyes: .25, bloom: .3, vignette: .08, overlay: 'sparkle' }),
    prompt: 'Redraw this person as the lead character of a theatrical 2D anime feature film with the polish of a top-tier modern anime film studio: a hand-drawn, cel-shaded anime illustration (not photorealistic), refined clean linework, large luminous eyes with layered expressive highlights, glossy light-catching hair strands, dazzling cinematic light with lens flare and a breathtaking painted sky, key-visual quality, still clearly them.',
    details: [
      d('acc', 'clips', '发夹', 'cute hair clips'),
      d('acc', 'phones', '耳机', 'headphones around the neck'),
      d('light', 'backlit', '逆光发丝', 'backlight glowing through the hair'),
      d('light', 'sparkle', '闪闪光点', 'light sparkles in the air'),
      d('scene', 'summer', '夏日晴空', 'a towering summer sky with big clouds', 'scene'),
      d('scene', 'sakura', '樱花大道', 'an avenue of falling cherry blossoms', 'scene'),
      d('frame', 'poster', '海报构图', 'a cinematic key-visual poster composition', 'frame'),
      d('frame', 'petals', '花瓣边', 'drifting petals framing the edges', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 68, details: ['backlit', 'summer'] },
    hero: 'priya', also: ['aiman'],
  },
  {
    id: 'toon3d', name: '3D动画脸', cat: 'acg', hot: 2,
    line: '电影级 3D 动画渲染，皮肤通透有光泽', hook: '下一部大电影主角',
    theme: { dark: false, bg: '#fff5e6', bg2: '#ffe0bd', surface: '#ffffff', ink: '#3a2412', soft: '#8b6a4c', accent: '#ff9f1c', accent2: '#2ec4b6', onAccent: '#2a1600', glow: 'rgba(255,159,28,.4)', line: 'rgba(58,36,18,.12)', radius: '28px', display: 'round', deco: 'orbs', frame: 'circle' },
    live: live({ grade: [1.04, 1.01, .98], sat: 1.15, contrast: 1.02, lift: .04, warmth: .12, smooth: 1, eyes: .3, bloom: .3, vignette: .15, overlay: 'orbs' }),
    prompt: 'Recreate this person as a Pixar / Disney-style 3D animated film character (clearly animated, not photorealistic): appealing cartoon proportions with a slightly larger head, big sparkling expressive eyes and a small simplified nose, smooth stylised skin with soft subsurface scattering, sculpted stylised hair, warm cinematic lighting with gentle bounce light, a high-end animation-studio render. Still clearly recognisable as them.',
    details: [
      d('acc', 'hoodie', '卫衣', 'a cosy hoodie'),
      d('acc', 'glasses', '圆框眼镜', 'round glasses'),
      d('light', 'golden', '暖阳', 'warm golden-hour light'),
      d('light', 'cine', '电影布光', 'cinematic three-point lighting'),
      d('scene', 'town', '奇幻小镇', 'a whimsical storybook town', 'scene'),
      d('scene', 'room', '温馨卧室', 'a cosy bedroom', 'scene'),
      d('frame', 'circle', '圆形头像框', 'a clean circular avatar badge', 'frame'),
      d('frame', 'poster', '海报构图', 'a movie-poster composition', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 62, details: ['golden', 'town'] },
    hero: 'jun', also: ['nur'],
  },

  {
    id: 'magical', name: '魔法少女', cat: 'acg', hot: 3,
    line: '星星魔杖、蝴蝶结与变身光芒，代表月亮出片', hook: '变身，魔法少女！',
    theme: { dark: false, bg: '#fbefff', bg2: '#ffd6f1', surface: '#fffbff', ink: '#4a1f5c', soft: '#9a6cad', accent: '#e05cc4', accent2: '#7b8cff', onAccent: '#ffffff', glow: 'rgba(224,92,196,.45)', line: 'rgba(123,140,255,.3)', radius: '34px', display: 'round', deco: 'stars', frame: 'magic' },
    live: live({ grade: [1.04, .98, 1.06], sat: 1.2, contrast: 1, lift: .06, posterize: .4, edge: .25, smooth: .9, eyes: .3, bloom: .4, vignette: .1, overlay: 'magic', sticker: 'magic-tiara' }),
    prompt: 'Transform this person into a 90s-style magical girl anime heroine caught mid-transformation, in the spirit of Sailor Moon and Cardcaptor Sakura: a frilly pastel sailor-style costume with big ribbon bows, a jewelled moon-and-star tiara, a sparkling star wand, glittering stars and ribbons of light swirling around them, huge luminous anime eyes, hair lifted by magic. Hand-drawn 2D cel-shaded anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'wand', '星星魔杖', 'holding a jewelled star wand'),
      d('acc', 'bow', '大蝴蝶结', 'a giant ribbon bow on the chest'),
      d('light', 'transform', '变身光芒', 'a dazzling transformation light swirling around them'),
      d('light', 'stardust', '星光闪片', 'glittering stardust and tiny hearts'),
      d('scene', 'moon', '星空月亮', 'a starry night sky with a huge glowing crescent moon', 'scene'),
      d('scene', 'clouds', '粉色云海', 'a sea of pink pastel clouds at sunset', 'scene'),
      d('frame', 'moonframe', '星月框', 'an ornate frame of crescent moons and stars', 'frame'),
      d('frame', 'hearts', '爱心闪片', 'a border of sparkling hearts and sequins', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, beauty: 50, details: ['wand', 'transform', 'moon'] },
    hero: 'priya', also: ['nur'],
  },
  {
    id: 'shonen', name: '热血少年', cat: 'acg', hot: 3,
    line: '斗气爆发、速度线、决战分镜，燃到炸', hook: '这就是我的忍道！',
    theme: { dark: true, bg: '#120c1c', bg2: '#3a1410', surface: '#1c1420', ink: '#fff3e6', soft: '#d8b39a', accent: '#ff6a1a', accent2: '#ffd23f', onAccent: '#1a0a00', glow: 'rgba(255,106,26,.55)', line: 'rgba(255,210,63,.25)', radius: '6px', display: 'comic', deco: 'flames', frame: 'slash' },
    live: live({ grade: [1.08, 1, .92], sat: 1.25, contrast: 1.25, posterize: .45, edge: .5, smooth: .6, rim: [1, .42, .1, 1, .82, .25], vignette: .45, overlay: 'aura', sticker: 'ninja-band' }),
    prompt: 'Redraw this person as the hero of a hot-blooded shonen battle anime, in the spirit of Naruto, Dragon Ball and Demon Slayer: intense determined eyes, wind-swept hair, a blazing aura of energy flames erupting around them, dynamic speed lines, a dramatic low-angle final-battle key frame, bold ink lines and punchy cel shading. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'band', '护额头带', 'a ninja forehead-protector headband with a metal plate'),
      d('acc', 'cape', '战斗披风', 'a battle-worn cape whipping in the wind'),
      d('light', 'aura', '斗气爆发', 'a blazing golden energy aura'),
      d('light', 'thunder', '雷光', 'crackling blue lightning'),
      d('scene', 'ruins', '决战废墟', 'a ruined battlefield with rising dust', 'scene'),
      d('scene', 'roof', '夕阳屋顶', 'a rooftop at a blood-red sunset', 'scene'),
      d('frame', 'slash', '斩击框', 'sharp sword-slash marks cutting across the frame edges', 'frame'),
      d('frame', 'panel', '漫画分镜', 'a dynamic manga panel layout border', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['band', 'aura', 'ruins'] },
    hero: 'aiman', also: ['jun'],
  },
  {
    id: 'ghibli', name: '治愈手绘', cat: 'acg', hot: 3,
    line: '吉卜力式手绘夏天、风和云和你', hook: '风起了，出发吧',
    theme: { dark: false, bg: '#eef6e6', bg2: '#cfe8f5', surface: '#fffdf6', ink: '#2c3b2a', soft: '#6f8466', accent: '#4f9a5a', accent2: '#e8a34a', onAccent: '#ffffff', glow: 'rgba(79,154,90,.35)', line: 'rgba(44,59,42,.14)', radius: '20px', display: 'serif', deco: 'clouds', frame: 'paper' },
    live: live({ grade: [1.02, 1.04, .98], sat: 1.12, contrast: .95, lift: .08, warmth: .12, posterize: .35, edge: .18, smooth: .85, bloom: .2, vignette: .12, overlay: 'breeze', sticker: 'leaf-umbrella' }),
    prompt: 'Repaint this person as a character in a gentle hand-painted Studio Ghibli film, in the spirit of My Neighbor Totoro and Kiki\'s Delivery Service: soft gouache and watercolour backgrounds, a lush summer countryside, towering fluffy cumulus clouds, warm nostalgic light, simple expressive anime features with gentle cel shading, painterly and heart-warming. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'hat', '草帽', 'a straw hat with a red ribbon'),
      d('acc', 'soot', '小煤球', 'a few tiny fuzzy black soot sprites peeking around them'),
      d('light', 'summer', '夏日阳光', 'dappled summer sunlight'),
      d('light', 'fireflies', '萤火', 'soft glowing fireflies at dusk'),
      d('scene', 'fields', '乡间田野', 'green rice fields and a country bus stop', 'scene'),
      d('scene', 'castle', '天空之城', 'a floating castle island among the clouds', 'scene'),
      d('frame', 'paper', '手绘水彩边', 'a soft watercolour edge fading into paper', 'frame'),
      d('frame', 'cel', '胶片帧', 'a vintage animation-cel frame', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 70, details: ['summer', 'fields', 'paper'] },
    hero: 'nur', also: ['mei'],
  },
  {
    id: 'vtuber', name: '虚拟主播', cat: 'acg', hot: 2,
    line: '二次元立绘、双色挑染、猫耳耳机，今晚开播', hook: '晚上好，开播啦',
    theme: { dark: false, bg: '#eefbff', bg2: '#ffe0f4', surface: '#ffffff', ink: '#1d2550', soft: '#6a73a8', accent: '#ff4fa3', accent2: '#29d3ff', onAccent: '#ffffff', glow: 'rgba(41,211,255,.45)', line: 'rgba(29,37,80,.12)', radius: '24px', display: 'tech', deco: 'sparkle', frame: 'stream' },
    live: live({ grade: [1, 1.02, 1.06], sat: 1.25, contrast: 1.04, lift: .06, posterize: .4, edge: .28, smooth: 1, eyes: .4, bloom: .3, vignette: .06, overlay: 'stream', sticker: 'cat-headset' }),
    prompt: 'Turn this person into a VTuber anime avatar: a polished Live2D-style anime character illustration with big sparkling eyes, colourful two-tone hair with bright streaks, a cute cat-ear gaming headset with a microphone, a cyber-pop idol outfit, a glowing livestream vibe with soft neon light, clean cel shading. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'headset', '猫耳耳机', 'a glowing cat-ear gaming headset'),
      d('acc', 'streak', '双色挑染', 'two-tone hair with vivid colour streaks'),
      d('light', 'ring', '直播打光', 'a soft ring-light glow in the eyes'),
      d('light', 'sparkle', '闪亮星光', 'little star and heart sparkles'),
      d('scene', 'room', '直播间', 'a cosy streamer room with LED lights', 'scene'),
      d('scene', 'stage', '赛博舞台', 'a holographic idol stage', 'scene'),
      d('frame', 'stream', '直播框', 'a cute livestream overlay border with floating hearts, no readable text', 'frame'),
      d('frame', 'card', '立绘卡', 'a character-card frame with a pastel gradient', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, beauty: 50, details: ['headset', 'streak', 'room'] },
    hero: 'kai', also: ['priya'],
  },

  // ───────────── 氛围出片 ─────────────
  {
    id: 'ccd', name: '复古CCD', cat: 'mood', hot: 3,
    line: '千禧直闪、颗粒噪点、冷调高光溢散', hook: '2005 年的夜晚',
    theme: { dark: true, bg: '#0b0d12', bg2: '#1a1f2b', surface: '#141821', ink: '#eef2f8', soft: '#9aa6b8', accent: '#ff9a2f', accent2: '#9ec9ff', onAccent: '#1a0d00', glow: 'rgba(255,154,47,.45)', line: 'rgba(238,242,248,.14)', radius: '4px', display: 'mono', deco: 'stamp', frame: 'ccd' },
    live: live({ grade: [.96, 1, 1.1], sat: .9, contrast: 1.15, lift: .02, warmth: -.15, grain: .5, bloom: .55, vignette: .55, overlay: 'ccd' }),
    prompt: 'Make this look like a candid photo from an early-2000s compact CCD digital camera at night: harsh direct on-camera flash, the face slightly overexposed, cool bluish shadows, fine digital noise, soft blooming highlights, low dynamic range, a candid Y2K snapshot feel. Keep the real person exactly.',
    details: [
      d('acc', 'glitter', '闪粉', 'glitter on the cheeks'),
      d('acc', 'clips', '千禧发夹', 'Y2K butterfly hair clips'),
      d('light', 'flash', '直闪', 'harsh direct flash'),
      d('light', 'bloom', '高光溢散', 'blooming, smeared highlights'),
      d('scene', 'street', '夜晚街头', 'a night street', 'scene'),
      d('scene', 'party', '派对现场', 'a house party', 'scene'),
      d('frame', 'stamp', '时间戳', 'an orange digital camera date stamp in the lower right corner reading \'05 11 20', 'frame'),
      d('frame', 'vignette', '暗角', 'heavy dark corners', 'frame'),
    ],
    defaults: { ...base, strength: 75, likeness: 95, richness: 45, beauty: 20, details: ['flash', 'street', 'stamp'] },
    hero: 'kai', also: ['jun'],
  },
  {
    id: 'film', name: '清新胶片', cat: 'mood', hot: 2,
    line: '空气感柔光、自然骨相、高级浅景深', hook: '随手一拍就是胶片',
    theme: { dark: false, bg: '#f6f2e9', bg2: '#e6eadb', surface: '#fffdf8', ink: '#2f3527', soft: '#7a8069', accent: '#6f9a6a', accent2: '#d9a06b', onAccent: '#ffffff', glow: 'rgba(111,154,106,.35)', line: 'rgba(47,53,39,.12)', radius: '6px', display: 'serif', deco: 'leaves', frame: 'print' },
    live: live({ grade: [1.03, 1.03, .96], sat: .88, contrast: .88, lift: .12, warmth: .12, grain: .25, bloom: .2, vignette: .15, overlay: 'film' }),
    prompt: 'Make this a fresh, airy film photograph: shot on 35mm colour-negative film, soft natural daylight, gentle low contrast, creamy lifted shadows, delicate fine grain, a shallow depth of field with a dreamy background blur, natural bone structure and real skin texture kept. Light, clean and effortless.',
    details: [
      d('acc', 'hat', '草帽', 'a straw sun hat'),
      d('acc', 'knit', '针织衫', 'a soft knit cardigan'),
      d('light', 'sun', '午后阳光', 'warm afternoon sunlight'),
      d('light', 'haze', '逆光光晕', 'backlit lens haze'),
      d('scene', 'sea', '海边', 'a quiet seaside', 'scene'),
      d('scene', 'lane', '树荫小路', 'a tree-shaded lane', 'scene'),
      d('frame', 'sprocket', '胶片边框', 'a 35mm film border with sprocket holes', 'frame'),
      d('frame', 'print', '白边相纸', 'a white-border photo print', 'frame'),
    ],
    defaults: { ...base, strength: 65, likeness: 95, richness: 45, beauty: 25, details: ['sun', 'lane'] },
    hero: 'nur', also: ['aiman'],
  },
  {
    id: 'neon', name: '赛博霓虹', cat: 'mood', hot: 3,
    line: '品红青蓝轮廓光、雨夜都市霓虹虚化', hook: '夜之城欢迎你',
    theme: { dark: true, bg: '#07060f', bg2: '#1d0b2e', surface: '#120d1f', ink: '#f4f0ff', soft: '#a99cc8', accent: '#ff2bd6', accent2: '#22e6ff', onAccent: '#ffffff', glow: 'rgba(255,43,214,.5)', line: 'rgba(34,230,255,.25)', radius: '12px', display: 'tech', deco: 'neon', frame: 'neon' },
    live: live({ grade: [.95, .9, 1.12], sat: 1.2, contrast: 1.25, rim: [1, .17, .84, .13, .9, 1], scan: .15, grain: .2, bloom: .35, vignette: .5, overlay: 'rain' }),
    prompt: 'Restyle this person as a cyberpunk neon portrait: hard magenta and cyan rim lights carving the face, glittering rain droplets, a rain-soaked night city with glowing signs dissolved into bokeh behind, subtle holographic accents, cinematic contrast and film grain. Keep them clearly recognisable. No readable text.',
    details: [
      d('acc', 'chrome', '科技耳饰', 'chrome tech earrings'),
      d('acc', 'tattoo', '发光纹身', 'faint glowing circuit tattoos'),
      d('light', 'rim', '品红青蓝', 'hard magenta and cyan rim light'),
      d('light', 'rain', '雨滴反光', 'rain droplets catching the neon'),
      d('scene', 'street', '雨夜街头', 'a rainy neon street', 'scene'),
      d('scene', 'roof', '天台', 'a rooftop above a glowing megacity', 'scene'),
      d('frame', 'tube', '霓虹灯框', 'a glowing neon-tube frame', 'frame'),
      d('frame', 'glitch', '故障风', 'glitch scanlines and RGB split', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 85, details: ['rim', 'rain', 'street'] },
    hero: 'aiman', also: ['kai'],
  },
];

/** 虚构的示例人物（全部由生图模型生成，不是真人）。 */
export const PEOPLE = [
  { id: 'mei', name: 'Mei' }, { id: 'aiman', name: 'Aiman' }, { id: 'priya', name: 'Priya' },
  { id: 'jun', name: 'Jun' }, { id: 'nur', name: 'Nur' }, { id: 'kai', name: 'Kai' },
];

export const presetById = (/** @type {string} */ id) => PRESETS.find(p => p.id === id) || null;
export const inCategory = (/** @type {string} */ cat) => cat === 'hot'
  ? PRESETS.filter(p => p.hot >= 3).concat(PRESETS.filter(p => p.hot === 2)).slice(0, 12)
  : PRESETS.filter(p => p.cat === cat);
export const categoryOf = (/** @type {Preset} */ p) => CATEGORIES.find(c => c.id === p.cat) || CATEGORIES[0];
/** @param {Preset} p @returns {Params} */
export const defaultsOf = p => ({ ...p.defaults, details: [...p.defaults.details] });

/** 选一个细节：同组里标了 solo 的互斥（比如背景只能选一个）。 @param {Preset} p @param {string[]} picked @param {string} id */
export function toggleDetail(p, picked, id) {
  const it = p.details.find(x => x.id === id);
  if (!it) return picked;
  if (picked.includes(id)) return picked.filter(x => x !== id);
  const out = it.solo ? picked.filter(x => p.details.find(y => y.id === x)?.solo !== it.solo || p.details.find(y => y.id === x)?.group !== it.group) : [...picked];
  return [...out, id];
}

const band = (/** @type {number} */ v, /** @type {string[]} */ words) => words[Math.min(words.length - 1, Math.floor(v / (100 / words.length)))];

/**
 * 发给生图模型的那句话：风格本体 → 像貌 → 强度 → 细节丰富度 → 美颜 → 已选细节 → 用户补充 → 构图。
 * 与 tools/make_assets.py 生成样张时用的是同一个函数。
 * @param {Preset} p @param {Params} params @param {{ format?: 'avatar' | 'portrait' }} [o]
 */
export function promptFor(p, params, o = {}) {
  const out = [p.prompt];
  out.push(band(params.likeness, [
    'Treat the photo as loose inspiration: a free, stylised take on this person.',
    'Keep them recognisable, but let the style reshape the features freely.',
    'Keep their face, features, skin tone and expression clearly recognisable as them, plus any glasses or head covering they wear.',
    'Stay very faithful to the photo: the exact same face, proportions, skin tone, expression, and any glasses or head covering they wear; only the style changes.',
  ]));
  out.push(band(params.strength, [
    'Apply the style gently, still close to a real photo.',
    'Apply the style clearly but with restraint.',
    'Apply the style fully and confidently.',
    'Push the style all the way: bold, unmistakable and dramatic.',
  ]));
  out.push(band(params.richness, [
    'Keep it clean and minimal, with a simple uncluttered background.',
    'A moderate amount of detail.',
    'Rich, carefully crafted details and textures.',
    'Intricate, lavish detail everywhere: ornaments, textures, light and background.',
  ]));
  out.push(band(params.beauty, [
    'Keep the skin natural with real texture, no retouching.',
    'A subtle, natural retouch.',
    'Polished, glowing skin and bright eyes, still natural.',
    'Flawless glowing skin, bright clear eyes and refined features, while still unmistakably them.',
  ]));
  const picked = (params.details || []).map(id => p.details.find(x => x.id === id)).filter(Boolean);
  if (picked.length) out.push('Include: ' + picked.map(x => /** @type {Detail} */ (x).words).join('; ') + '.');
  const said = String(params.words || '').trim().replace(/[.。\s]+$/, '');
  if (said) out.push('Also, as the person asked: ' + said + '.');
  out.push(o.format === 'portrait'
    ? 'Head and shoulders, centred, looking at the viewer, a tall portrait.'
    : 'A striking square profile-picture composition: head and shoulders, face large and centred, reads well as a small circular avatar.');
  const framed = picked.some(x => x?.group === 'frame');
  out.push(framed ? 'No watermark, no signature, no logos.' : 'No text, no lettering, no watermark, no border.');
  out.push('A fully painted, opaque image: never a transparency checkerboard.');
  return out.join(' ');
}

/** 一句话说清当前选择：用于作品卡片与创作轨迹。 @param {Preset} p @param {Params} params */
export function captionOf(p, params) {
  const picked = (params.details || []).map(id => p.details.find(x => x.id === id)?.label).filter(Boolean);
  return [p.name, ...picked.slice(0, 3)].join(' · ');
}
