/**
 * 哈基秀 · 风格与角色预设矩阵（v3）
 *
 * 一个预设 = 一个世界：它的名字与一句话卖点、它贯穿全局的视觉主题（配色、装饰语言、画框）、它在实时镜头里的
 * 滤镜与贴纸、它的生图 Prompt，以及可以叠加的细节增强选项。
 *
 * 只放纯数据与纯函数：浏览器和 tools/make_assets.py（经由 node）都从这里读取同一份 Prompt，
 * 所以界面上展示的样张，就是用户点下去真正会发出去的那句话。
 *
 * 关于「角色变身」：特摄英雄、Q版机器人、憨憨小龙等是向经典特摄、童年动画和表情包致敬的原创设计，
 * Prompt 只描述题材与画风（银红流线战甲、蓝白圆润赛璐璐、圆滚滚小黄龙），不复刻任何现有角色的造型、名字或标志。
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
 *   prompt: string, details: Detail[], defaults: Params, hero: string, also: string[], emblem: string[], isNew?: boolean, custom?: boolean }} Preset
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
  { id: 'art', label: '艺术画风' },
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
/** 常用的画框细节。 */
const STICKER_EDGE = 'a thick white die-cut sticker outline around them, on a solid colour background';

/** @type {Preset[]} */
export const PRESETS = [
  // ───────────── 搞怪 ─────────────
  {
    id: 'dragon', name: '憨憨小龙', cat: 'fun', hot: 3,
    line: '圆滚滚小黄龙上身，又欠揍又可爱', hook: '嗷呜～我超凶的',
    theme: { dark: false, bg: '#fff6cc', bg2: '#ffe27a', surface: '#fffaea', ink: '#3d2a00', soft: '#8a6a1f', accent: '#ffb800', accent2: '#ff7a45', onAccent: '#3d2a00', glow: 'rgba(255,190,0,.45)', line: 'rgba(61,42,0,.14)', radius: '26px', display: 'bubble', deco: 'bubbles', frame: 'sticker' },
    live: live({ grade: [1.08, 1.04, .82], sat: 1.25, contrast: 1.05, warmth: .25, bulge: .22, smooth: .5, vignette: .1, overlay: 'bubbles', sticker: 'dragon-hood' }),
    prompt: 'Turn this person into a cute chubby baby-dragon mascot, an original character design: a round, squishy, custard-yellow baby-dragon onesie hood with two tiny rounded horns, soft little wings and a stubby tail, a big soft belly, their own face clearly showing in the hood opening with a cheeky, wide open-mouth grin. Glossy soft 3D cartoon rendering, saturated sunny colours, playful meme-sticker energy, made to be shared.',
    details: [
      d('acc', 'wings', '小翅膀', 'tiny flappy wings fluttering on its back'),
      d('acc', 'snack', '抱零食', 'hugging a big bag of snacks'),
      d('light', 'gloss', '糖果高光', 'glossy candy-like highlights'),
      d('light', 'spark', '闪光特效', 'comic sparkle bursts around it'),
      d('scene', 'plain', '表情包底', 'a solid, flat sunny-yellow background', 'scene'),
      d('scene', 'park', '游乐园', 'a colourful amusement park behind', 'scene'),
      d('frame', 'sticker', '贴纸白边', STICKER_EDGE, 'frame'),
      d('frame', 'panel', '漫画框', 'a bold black comic-panel border', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['gloss', 'plain', 'sticker'] },
    hero: 'jun', also: ['kai'], emblem: ['dragon-hood', 'heart'],
  },
  {
    id: 'bighead', name: '大头鬼畜', cat: 'fun', hot: 2,
    line: '三倍大头 + 漫画勾线，自带喜剧张力', hook: '头大，气场更大',
    theme: { dark: false, bg: '#fff1e2', bg2: '#ffd0a8', surface: '#fffaf4', ink: '#1d1d1f', soft: '#6b5b4f', accent: '#ff5a36', accent2: '#2b6cff', onAccent: '#ffffff', glow: 'rgba(255,90,54,.35)', line: '#1d1d1f', radius: '14px', display: 'comic', deco: 'halftone', frame: 'comic' },
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
      d('frame', 'sticker', '贴纸白边', STICKER_EDGE, 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['boom', 'flat'] },
    hero: 'aiman', also: ['priya'], emblem: ['heart', 'sparkle'],
  },
  {
    id: 'faceart', name: '颜艺暴走', cat: 'fun', hot: 1,
    line: '漫画冲击线 + 神情放大，表情包直出', hook: '情绪，直接拉满',
    theme: { dark: false, bg: '#ffffff', bg2: '#ffe3ea', surface: '#fff8fa', ink: '#111111', soft: '#555555', accent: '#ff2d55', accent2: '#111111', onAccent: '#ffffff', glow: 'rgba(255,45,85,.3)', line: '#111111', radius: '10px', display: 'comic', deco: 'speed', frame: 'jagged' },
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
    hero: 'kai', also: ['aiman'], emblem: ['bolt', 'sparkle'],
  },
  {
    id: 'clay', name: '黏土憨憨', cat: 'fun', hot: 2,
    line: '定格动画手作黏土，憨得刚刚好', hook: '捏一个你',
    theme: { dark: false, bg: '#ffe9dc', bg2: '#ffd2bf', surface: '#fff6ef', ink: '#4a2c22', soft: '#946a5a', accent: '#ff8a65', accent2: '#5cc6a0', onAccent: '#ffffff', glow: 'rgba(255,138,101,.4)', line: 'rgba(74,44,34,.12)', radius: '30px', display: 'round', deco: 'candy', frame: 'candy' },
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
      d('frame', 'sticker', '贴纸白边', STICKER_EDGE, 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 70, details: ['soft', 'candy'] },
    hero: 'priya', also: ['jun'], emblem: ['candy', 'candy'],
  },
  {
    id: 'pet', name: '萌宠附体', cat: 'fun', hot: 2,
    line: '猫猫狗狗跟你同款神态，萌到犯规', hook: '喵一个？',
    theme: { dark: false, bg: '#fff1ef', bg2: '#ffd9d2', surface: '#fff8f6', ink: '#4b2b2b', soft: '#9a6b66', accent: '#ff8fab', accent2: '#ffb86b', onAccent: '#ffffff', glow: 'rgba(255,143,171,.45)', line: 'rgba(75,43,43,.12)', radius: '28px', display: 'round', deco: 'paws', frame: 'paws' },
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
      d('frame', 'sticker', '贴纸白边', STICKER_EDGE, 'frame'),
    ],
    defaults: { ...base, strength: 70, likeness: 85, details: ['cat', 'glow', 'nest'] },
    hero: 'nur', also: ['kai'], emblem: ['paw', 'heart'],
  },

  // ───────────── 角色变身 ─────────────
  {
    id: 'hero', name: '特摄英雄', cat: 'role', hot: 3,
    line: '银红流线战甲、胸口能量核，变身登场', hook: '变身，出击！',
    theme: { dark: true, bg: '#0b1222', bg2: '#1f2a4d', surface: '#141c33', ink: '#eef3ff', soft: '#9fb0d6', accent: '#ff3b47', accent2: '#4fd7ff', onAccent: '#ffffff', glow: 'rgba(79,215,255,.55)', line: 'rgba(206,220,255,.18)', radius: '8px', display: 'hero', deco: 'energy', frame: 'energy' },
    live: live({ grade: [1.02, 1.02, 1.1], sat: 1.15, contrast: 1.18, bloom: .45, rim: [1, .25, .3, .3, .85, 1], vignette: .45, overlay: 'energy', sticker: 'hero-visor' }),
    prompt: 'Turn this person into the hero of a classic Japanese tokusatsu sci-fi TV show, an entirely original suit design: sleek armour of brushed silver with sharp angular crimson plates and glowing cyan circuit lines, a glowing hexagonal energy core in the centre of the chest, a visor-style open-face helmet with two swept-back angular side wings so their own face stays clearly recognisable, cinematic rim light and lens flares, a heroic low angle, an epic retro special-effects film still. Not any existing character.',
    details: [
      d('acc', 'visor', '能量护目', 'a glowing cyan visor lens across the brow of the helmet'),
      d('acc', 'beam', '光束手势', 'one arm raised, firing a brilliant beam of light'),
      d('light', 'core', '能量核', 'the chest energy core glowing bright cyan and lighting the face'),
      d('light', 'warn', '红光警报', 'the chest energy core flashing red, the hero at their limit'),
      d('scene', 'city', '黄昏城市', 'a city skyline at dusk with searchlights sweeping through drifting smoke', 'scene'),
      d('scene', 'nebula', '星云宇宙', 'a glowing nebula in deep space', 'scene'),
      d('frame', 'energy', '能量边框', 'a glowing energy frame of light streaks', 'frame'),
      d('frame', 'flare', '光之爆闪', 'a blinding burst of light rays from behind', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 80, details: ['core', 'city'] },
    hero: 'aiman', also: ['jun'], emblem: ['bolt', 'sparkle'],
  },
  {
    id: 'robot', name: 'Q版机器人', cat: 'role', hot: 3,
    line: '圆滚滚蓝白机器人，童年卡通味拉满', hook: '滴滴，开机！',
    theme: { dark: false, bg: '#e6f4ff', bg2: '#bfe3ff', surface: '#f7fbff', ink: '#0d3156', soft: '#4f7396', accent: '#1e88e5', accent2: '#ff7043', onAccent: '#ffffff', glow: 'rgba(30,136,229,.4)', line: 'rgba(13,49,86,.14)', radius: '999px', display: 'round', deco: 'dots', frame: 'tv' },
    live: live({ grade: [.94, 1.02, 1.12], sat: 1.25, contrast: 1.08, posterize: .6, edge: .45, smooth: .6, vignette: .1, overlay: 'robot', sticker: 'robot-antenna' }),
    prompt: 'Turn this person into a cute retro cartoon robot, an original design: a round, chubby robot suit in glossy sky-blue and white with simple rounded shapes and a few friendly bolts, a round robot helmet-hood with a tiny antenna and two glowing cheek lights, their own face clearly visible in the hood opening with a big happy grin. Bright 1980s TV-cartoon cel animation, thick soft outlines, flat cheerful colours, clean two-tone cel shading.',
    details: [
      d('acc', 'prop', '螺旋桨帽', 'a little spinning propeller on top of the robot hood'),
      d('acc', 'gadget', '神奇道具', 'happily holding up a glowing futuristic gadget'),
      d('light', 'cel', '赛璐璐感', 'crisp two-tone cel shading'),
      d('light', 'sun', '晴天阳光', 'bright sunny light'),
      d('scene', 'sky', '蓝天草地', 'a sky-blue sky with round puffy clouds over a grassy field', 'scene'),
      d('scene', 'lab', '发明实验室', 'a cosy cartoon inventor workshop full of gadgets', 'scene'),
      d('frame', 'tv', '复古电视', 'a rounded retro TV-screen frame', 'frame'),
      d('frame', 'sticker', '贴纸白边', STICKER_EDGE, 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 75, details: ['prop', 'cel', 'sky'] },
    hero: 'kai', also: ['nur'], emblem: ['robot-antenna', 'sparkle'],
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
    hero: 'jun', also: ['priya'], emblem: ['bolt', 'sparkle'],
  },
  {
    id: 'figure', name: '盲盒手办', cat: 'role', hot: 3,
    line: '哑光潮玩质感、透亮大眼，棚拍级布光', hook: '隐藏款就是你',
    theme: { dark: false, bg: '#f3f0ff', bg2: '#e2dbff', surface: '#faf8ff', ink: '#2a2154', soft: '#7468a8', accent: '#7b61ff', accent2: '#ff9cc8', onAccent: '#ffffff', glow: 'rgba(123,97,255,.4)', line: 'rgba(42,33,84,.12)', radius: '22px', display: 'round', deco: 'sparkle', frame: 'box' },
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
    hero: 'nur', also: ['aiman'], emblem: ['sparkle', 'heart'],
  },
  {
    id: 'arcade', name: '街机格斗家', cat: 'role', hot: 1,
    line: '90 年代高精像素 + 选人界面气场', hook: 'READY? FIGHT!',
    theme: { dark: true, bg: '#160b33', bg2: '#33104d', surface: '#1e1240', ink: '#fff6d6', soft: '#c3a8ff', accent: '#ffcc00', accent2: '#ff3d6e', onAccent: '#1a0d00', glow: 'rgba(255,204,0,.45)', line: 'rgba(255,246,214,.2)', radius: '0px', display: 'pixel', deco: 'pixels', frame: 'pixel' },
    live: live({ sat: 1.35, contrast: 1.2, pixel: .55, posterize: .55, scan: .5, vignette: .3, overlay: 'fight' }),
    prompt: 'Turn this person into a 1990s arcade fighting-game character: detailed 16-bit pixel art, a confident fighting stance with a blazing energy aura, a dramatic character-select portrait composition against a bold gradient backdrop, crisp limited palette, a soft CRT glow. Still clearly them. An original character. No text, no logos.',
    details: [
      d('acc', 'band', '战斗头带', 'a fighter\'s plain cloth headband'),
      d('acc', 'gloves', '格斗拳套', 'fingerless fighting gloves'),
      d('light', 'aura', '气场爆发', 'a blazing energy aura'),
      d('light', 'flash', '必杀闪光', 'a special-move flash'),
      d('scene', 'street', '街头擂台', 'a pixel street stage at sunset', 'scene'),
      d('scene', 'dojo', '道馆', 'a pixel-art dojo', 'scene'),
      d('frame', 'select', '选人框', 'a glowing character-select portrait border', 'frame'),
      d('frame', 'scan', '扫描线', 'visible CRT scanlines', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['aura', 'select'] },
    hero: 'priya', also: ['jun'], emblem: ['bolt', 'sparkle'],
  },
  {
    id: 'wuxia', name: '武侠侠客', cat: 'role', hot: 2, isNew: true,
    line: '衣袂翻飞、竹林剑影，一身江湖气', hook: '江湖再见',
    theme: { dark: true, bg: '#0f1712', bg2: '#22352b', surface: '#16211b', ink: '#eef3ea', soft: '#9fb3a2', accent: '#7fc8a0', accent2: '#e0b45a', onAccent: '#0b140f', glow: 'rgba(127,200,160,.45)', line: 'rgba(224,180,90,.22)', radius: '6px', display: 'serif', deco: 'mist', frame: 'scroll' },
    live: live({ grade: [.98, 1.03, .96], sat: .78, contrast: 1.15, edge: .2, smooth: .45, warmth: .05, vignette: .45, bloom: .12, overlay: 'bamboo', sticker: 'douli' }),
    prompt: 'Turn this person into a wuxia martial-arts hero from a cinematic Chinese fantasy epic: flowing layered robes inspired by traditional Chinese dress whipping in the wind, a sword hilt over the shoulder, wind-swept hair, a misty bamboo forest and distant mountain cliffs, drifting leaves, dynamic cinematic composition, painterly realism with a hint of ink wash. Still clearly them.',
    details: [
      d('acc', 'hat', '斗笠', 'a woven bamboo conical hat with a thin veil'),
      d('acc', 'sword', '长剑', 'holding a long sword in a graceful pose'),
      d('light', 'mist', '晨雾', 'soft morning mist and god rays'),
      d('light', 'moon', '月下', 'cold moonlight and fireflies'),
      d('scene', 'bamboo', '竹林', 'a towering misty bamboo forest', 'scene'),
      d('scene', 'cliff', '悬崖之巅', 'a cliff edge above a sea of clouds', 'scene'),
      d('frame', 'ink', '水墨晕边', 'edges dissolving into ink-wash brush strokes', 'frame'),
      d('frame', 'scroll', '卷轴', 'a hanging-scroll mount framing the portrait', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 80, details: ['mist', 'bamboo'] },
    hero: 'jun', also: ['priya'], emblem: ['bamboo', 'sparkle'],
  },

  // ───────────── 梦幻主题 ─────────────
  {
    id: 'princess', name: '梦幻公主', cat: 'dream', hot: 3,
    line: '粉金柔光、爱心丝带、拱形画框，童话高定', hook: '今天是公主本主',
    theme: { dark: false, bg: '#fff3f6', bg2: '#ffd9e5', surface: '#fff7f9', ink: '#5a2338', soft: '#a2687d', accent: '#ec6d9b', accent2: '#c9a25a', onAccent: '#ffffff', glow: 'rgba(236,109,155,.42)', line: 'rgba(201,162,90,.35)', radius: '999px 999px 24px 24px', display: 'serif', deco: 'hearts', frame: 'arch' },
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
    hero: 'nur', also: ['priya'], emblem: ['bow', 'heart'],
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
    hero: 'kai', also: ['priya'], emblem: ['gothic-crown', 'sparkle'],
  },
  {
    id: 'inkfairy', name: '丹青仙袂', cat: 'dream', hot: 3, isNew: true,
    line: '水墨云霞、朱漆金箔、宫灯暖光，仙气飘飘', hook: '一眼入画',
    theme: { dark: false, bg: '#f5efe2', bg2: '#e9dcc4', surface: '#fbf7ef', ink: '#2a2420', soft: '#7d6e5f', accent: '#c8372d', accent2: '#b8913a', onAccent: '#fff8ef', glow: 'rgba(200,55,45,.35)', line: 'rgba(42,36,32,.16)', radius: '4px', display: 'brush', deco: 'xiangyun', frame: 'scroll' },
    live: live({ grade: [1.03, .99, .93], sat: .58, contrast: 1.06, lift: .08, warmth: .1, posterize: .2, edge: .35, smooth: .8, grain: .15, bloom: .15, vignette: .25, overlay: 'ink', sticker: 'buyao' }),
    prompt: 'Repaint this person as an ethereal immortal in a classical Chinese gongbi and ink-wash painting with a refined modern finish: flowing silk robes and translucent gauze sleeves drifting on the wind, delicate gold hair ornaments, ink-wash mountains and rolling auspicious clouds, accents of vermilion lacquer and shimmering gold leaf, warm palace-lantern glow, fine elegant linework, poetic, serene and luminous.',
    details: [
      d('acc', 'buyao', '金步摇', 'an exquisite gold hairpin with dangling pearl tassels'),
      d('acc', 'fan', '团扇', 'holding a round silk fan painted with plum blossoms'),
      d('light', 'lantern', '宫灯暖光', 'the warm glow of red palace lanterns'),
      d('light', 'moon', '月华', 'soft silver moonlight and drifting light motes'),
      d('scene', 'mountains', '山水云海', 'ink-wash mountains above a sea of clouds', 'scene'),
      d('scene', 'peach', '桃花林', 'a dreamy peach-blossom forest with falling petals', 'scene'),
      d('frame', 'scroll', '卷轴画框', 'a classical hanging-scroll mount with brocade borders', 'frame'),
      d('frame', 'seal', '朱印题跋', 'a small red seal stamp and faint brush calligraphy-like marks in the corner, nothing legible', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 80, beauty: 45, details: ['buyao', 'lantern', 'mountains'] },
    hero: 'mei', also: ['nur'], emblem: ['lantern', 'sparkle'],
  },
  {
    id: 'tarot', name: '星运塔罗', cat: 'dream', hot: 2, isNew: true,
    line: '新艺术曲线、星月金箔，你就是那张命运牌', hook: '今日运势：超好看',
    theme: { dark: true, bg: '#120e26', bg2: '#2b1d4f', surface: '#1b1534', ink: '#f6edd8', soft: '#b9a9d6', accent: '#e8c46a', accent2: '#8f7cff', onAccent: '#1a1206', glow: 'rgba(232,196,106,.45)', line: 'rgba(232,196,106,.28)', radius: '18px', display: 'gothic', deco: 'stars', frame: 'tarot' },
    live: live({ grade: [1.04, .98, 1.08], sat: 1.1, contrast: 1.1, posterize: .2, edge: .2, bloom: .3, vignette: .35, overlay: 'tarot' }),
    prompt: 'Turn this person into the figure on an ornate art-nouveau tarot card: elegant flowing decorative linework, a halo of stars and moon phases behind their head, shimmering gold-foil ornaments, rich jewel tones of midnight blue, violet and gold, symbolic floral motifs curling around them, a mystical, luxurious illustration. No readable text.',
    details: [
      d('acc', 'circlet', '星月头冠', 'a delicate circlet with a crescent moon'),
      d('acc', 'crystal', '水晶球', 'cradling a glowing crystal ball'),
      d('light', 'halo', '星辰光环', 'a radiant halo of stars'),
      d('light', 'gold', '金箔闪光', 'shimmering gold-foil highlights'),
      d('scene', 'cosmos', '星空宇宙', 'a deep starry cosmos with moon phases', 'scene'),
      d('scene', 'garden', '神秘花园', 'a mystical night garden of lilies', 'scene'),
      d('frame', 'card', '塔罗牌框', 'an ornate tarot-card border with an empty title cartouche and a small roman-numeral-like ornament, nothing legible', 'frame'),
      d('frame', 'nouveau', '新艺术花框', 'an art-nouveau floral arch framing them', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 80, details: ['halo', 'cosmos', 'card'] },
    hero: 'priya', also: ['kai'], emblem: ['tarot-card', 'sparkle'],
  },

  // ───────────── 二次元 ─────────────
  {
    id: 'anime', name: '动漫主角', cat: 'acg', hot: 3,
    line: '剧场版级光影、通透发丝、会说话的眼神', hook: '主角光环已加载',
    theme: { dark: false, bg: '#e9f5ff', bg2: '#ffe3f1', surface: '#f7fbff', ink: '#1b2a4a', soft: '#5f7398', accent: '#3b82f6', accent2: '#ff6fa8', onAccent: '#ffffff', glow: 'rgba(59,130,246,.38)', line: 'rgba(27,42,74,.12)', radius: '20px', display: 'sans', deco: 'sparkle', frame: 'poster' },
    live: live({ grade: [1, 1.02, 1.06], sat: 1.25, contrast: 1.05, lift: .05, posterize: .35, edge: .3, smooth: .8, eyes: .25, bloom: .3, vignette: .08, overlay: 'sparkle' }),
    prompt: 'Redraw this person as the lead character of a theatrical 2D anime feature film with top-tier modern anime polish: a hand-drawn, cel-shaded anime illustration (not photorealistic), refined clean linework, large luminous eyes with layered expressive highlights, glossy light-catching hair strands, dazzling cinematic light with lens flare and a breathtaking painted sky, key-visual quality, still clearly them.',
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
    hero: 'priya', also: ['aiman'], emblem: ['sparkle', 'sparkle'],
  },
  {
    id: 'toon3d', name: '3D动画脸', cat: 'acg', hot: 2,
    line: '电影级 3D 动画渲染，皮肤通透有光泽', hook: '下一部大电影主角',
    theme: { dark: false, bg: '#fff5e6', bg2: '#ffe0bd', surface: '#fffaf2', ink: '#3a2412', soft: '#8b6a4c', accent: '#ff9f1c', accent2: '#2ec4b6', onAccent: '#2a1600', glow: 'rgba(255,159,28,.4)', line: 'rgba(58,36,18,.12)', radius: '28px', display: 'round', deco: 'orbs', frame: 'circle' },
    live: live({ grade: [1.04, 1.01, .98], sat: 1.15, contrast: 1.02, lift: .04, warmth: .12, smooth: 1, eyes: .3, bloom: .3, vignette: .15, overlay: 'orbs' }),
    prompt: 'Recreate this person as the star of a big-budget 3D animated feature film (clearly animated, not photorealistic): appealing cartoon proportions with a slightly larger head, big sparkling expressive eyes and a small simplified nose, smooth stylised skin with soft subsurface scattering, sculpted stylised hair, warm cinematic lighting with gentle bounce light, a high-end animation-studio render. Still clearly recognisable as them.',
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
    hero: 'jun', also: ['nur'], emblem: ['sparkle', 'heart'],
  },
  {
    id: 'magical', name: '魔法少女', cat: 'acg', hot: 3,
    line: '星星魔杖、蝴蝶结与变身光芒，闪亮登场', hook: '变身，魔法少女！',
    theme: { dark: false, bg: '#fbefff', bg2: '#ffd6f1', surface: '#fff8ff', ink: '#4a1f5c', soft: '#9a6cad', accent: '#e05cc4', accent2: '#7b8cff', onAccent: '#ffffff', glow: 'rgba(224,92,196,.45)', line: 'rgba(123,140,255,.3)', radius: '34px', display: 'round', deco: 'stars', frame: 'magic' },
    live: live({ grade: [1.04, .98, 1.06], sat: 1.2, contrast: 1, lift: .06, posterize: .4, edge: .25, smooth: .9, eyes: .3, bloom: .4, vignette: .1, overlay: 'magic', sticker: 'magic-tiara' }),
    prompt: 'Transform this person into a 90s-style magical-girl anime heroine caught mid-transformation, an original design: a frilly pastel magical costume with big ribbon bows and layered petticoats, a jewelled star tiara, a sparkling heart-and-star wand, glittering stars and ribbons of light swirling around them, huge luminous anime eyes, hair lifted by magic. Hand-drawn 2D cel-shaded anime (not photorealistic), still clearly them.',
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
    hero: 'priya', also: ['nur'], emblem: ['magic-tiara', 'sparkle'],
  },
  {
    id: 'shonen', name: '热血少年', cat: 'acg', hot: 3,
    line: '斗气爆发、速度线、决战分镜，燃到炸', hook: '全力以赴，燃起来！',
    theme: { dark: true, bg: '#120c1c', bg2: '#3a1410', surface: '#1c1420', ink: '#fff3e6', soft: '#d8b39a', accent: '#ff6a1a', accent2: '#ffd23f', onAccent: '#1a0a00', glow: 'rgba(255,106,26,.55)', line: 'rgba(255,210,63,.25)', radius: '6px', display: 'comic', deco: 'flames', frame: 'slash' },
    live: live({ grade: [1.08, 1, .92], sat: 1.25, contrast: 1.25, posterize: .45, edge: .5, smooth: .6, rim: [1, .42, .1, 1, .82, .25], vignette: .45, overlay: 'aura', sticker: 'fight-band' }),
    prompt: 'Redraw this person as the hero of a hot-blooded shonen battle anime, an original character: intense determined eyes, wind-swept hair, a blazing aura of energy flames erupting around them, dynamic speed lines, a dramatic low-angle final-battle key frame, bold ink lines and punchy cel shading. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'band', '热血头带', 'a red cloth headband tied around the forehead, its long tails fluttering'),
      d('acc', 'cape', '战斗披风', 'a battle-worn cape whipping in the wind'),
      d('light', 'aura', '斗气爆发', 'a blazing golden energy aura'),
      d('light', 'thunder', '雷光', 'crackling blue lightning'),
      d('scene', 'ruins', '决战废墟', 'a ruined battlefield with rising dust', 'scene'),
      d('scene', 'roof', '夕阳屋顶', 'a rooftop at a blood-red sunset', 'scene'),
      d('frame', 'slash', '斩击框', 'sharp sword-slash marks cutting across the frame edges', 'frame'),
      d('frame', 'panel', '漫画分镜', 'a dynamic manga panel layout border', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['band', 'aura', 'ruins'] },
    hero: 'aiman', also: ['jun'], emblem: ['fight-band', 'bolt'],
  },
  {
    id: 'handdrawn', name: '治愈手绘', cat: 'acg', hot: 3,
    line: '手绘动画里的夏天，风和云和你', hook: '风起了，出发吧',
    theme: { dark: false, bg: '#eef6e6', bg2: '#cfe8f5', surface: '#fbfcf4', ink: '#2c3b2a', soft: '#6f8466', accent: '#4f9a5a', accent2: '#e8a34a', onAccent: '#ffffff', glow: 'rgba(79,154,90,.35)', line: 'rgba(44,59,42,.14)', radius: '20px', display: 'serif', deco: 'clouds', frame: 'paper' },
    live: live({ grade: [1.02, 1.04, .98], sat: 1.12, contrast: .95, lift: .08, warmth: .12, posterize: .35, edge: .18, smooth: .85, bloom: .2, vignette: .12, overlay: 'breeze', sticker: 'straw-hat' }),
    prompt: 'Repaint this person as a character in a gentle hand-painted 2D animated film: soft gouache and watercolour backgrounds, a lush summer countryside, towering fluffy cumulus clouds, warm nostalgic light, simple expressive anime features with gentle cel shading, painterly and heart-warming. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'hat', '草帽', 'a straw hat with a red ribbon'),
      d('acc', 'dandelion', '蒲公英', 'blowing a dandelion, its seeds drifting in the breeze'),
      d('light', 'summer', '夏日阳光', 'dappled summer sunlight'),
      d('light', 'fireflies', '萤火', 'soft glowing fireflies at dusk'),
      d('scene', 'fields', '乡间田野', 'green rice fields and a little country bus stop', 'scene'),
      d('scene', 'seaside', '海边小镇', 'a sunny seaside town with red rooftops and a lighthouse', 'scene'),
      d('frame', 'paper', '手绘水彩边', 'a soft watercolour edge fading into paper', 'frame'),
      d('frame', 'cel', '胶片帧', 'a vintage animation-cel frame', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 70, details: ['summer', 'fields', 'paper'] },
    hero: 'nur', also: ['mei'], emblem: ['straw-hat', 'sparkle'],
  },
  {
    id: 'vtuber', name: '虚拟主播', cat: 'acg', hot: 2,
    line: '二次元立绘、双色挑染、猫耳耳机，今晚开播', hook: '晚上好，开播啦',
    theme: { dark: false, bg: '#eefbff', bg2: '#ffe0f4', surface: '#f8fdff', ink: '#1d2550', soft: '#6a73a8', accent: '#ff4fa3', accent2: '#29d3ff', onAccent: '#ffffff', glow: 'rgba(41,211,255,.45)', line: 'rgba(29,37,80,.12)', radius: '24px', display: 'tech', deco: 'sparkle', frame: 'stream' },
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
    hero: 'kai', also: ['priya'], emblem: ['cat-headset', 'heart'],
  },
  {
    id: 'shoujo', name: '少女漫画', cat: 'acg', hot: 3, isNew: true,
    line: '星星大眼、漫天花瓣、网点柔光，心动暴击', hook: '心动，就在这一格',
    theme: { dark: false, bg: '#fff0f6', bg2: '#f3e3ff', surface: '#fff8fb', ink: '#4d2346', soft: '#a1739a', accent: '#f472b6', accent2: '#a78bfa', onAccent: '#ffffff', glow: 'rgba(244,114,182,.42)', line: 'rgba(77,35,70,.12)', radius: '26px', display: 'serif', deco: 'blossom', frame: 'blossom' },
    live: live({ grade: [1.04, .98, 1.04], sat: 1.1, lift: .1, posterize: .3, edge: .25, smooth: 1, eyes: .35, bloom: .45, vignette: .05, overlay: 'flowers', sticker: 'flower-clip' }),
    prompt: 'Redraw this person as the lead of a classic shoujo manga: delicate fine linework, huge sparkling eyes with star-shaped highlights, flowing glossy hair, floating roses, bubbles and sparkles around them, soft screentone shading, a dreamy pastel pink and lilac palette, romantic and heart-fluttering. 2D manga illustration (not photorealistic), still clearly them.',
    details: [
      d('acc', 'ribbon', '发带', 'a satin ribbon in the hair'),
      d('acc', 'rose', '手捧玫瑰', 'holding a single pink rose'),
      d('light', 'stars', '星星眼', 'star-shaped sparkles in the eyes'),
      d('light', 'bubbles', '泡泡柔光', 'soft floating bubbles and a glowing haze'),
      d('scene', 'flowers', '花海', 'a cascade of roses and lilies', 'scene'),
      d('scene', 'school', '校园走廊', 'a sunlit school corridor with cherry trees outside', 'scene'),
      d('frame', 'tone', '网点花框', 'a manga panel border with screentone flowers', 'frame'),
      d('frame', 'lace', '蕾丝心框', 'a lacy heart-shaped vignette', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, beauty: 55, details: ['stars', 'bubbles', 'flowers'] },
    hero: 'nur', also: ['mei'], emblem: ['flower-clip', 'heart'],
  },
  {
    id: 'retro', name: '复古番剧', cat: 'acg', hot: 2, isNew: true,
    line: '90 年代电视动画胶片感，录像带的黄昏', hook: '下集更精彩',
    theme: { dark: true, bg: '#1b1230', bg2: '#4a1f3d', surface: '#231839', ink: '#fdeedd', soft: '#c6a6b8', accent: '#ff8a5b', accent2: '#7dd3c0', onAccent: '#1e0d06', glow: 'rgba(255,138,91,.45)', line: 'rgba(253,238,221,.16)', radius: '10px', display: 'mono', deco: 'vhs', frame: 'vhs' },
    live: live({ grade: [1.06, .98, .92], sat: 1.1, contrast: .95, warmth: .1, posterize: .4, edge: .3, smooth: .7, grain: .35, scan: .35, vignette: .35, overlay: 'vhs' }),
    prompt: 'Redraw this person as a character in a 1990s television anime: hand-painted cel animation with slightly faded nostalgic colours, retro character design with big glossy hair highlights and sharp angular eyes, a city skyline glowing at sunset behind them, soft analogue VHS blur, subtle film grain and colour bleed. 2D anime (not photorealistic), still clearly them.',
    details: [
      d('acc', 'jacket', '复古夹克', 'an oversized retro bomber jacket'),
      d('acc', 'walkman', '随身听', 'headphones from a cassette player'),
      d('light', 'sunset', '夕阳余晖', 'a warm orange sunset glow'),
      d('light', 'glow', '霓虹微光', 'soft neon city glow'),
      d('scene', 'city', '黄昏都市', 'a retro city skyline at dusk', 'scene'),
      d('scene', 'train', '电车站台', 'a quiet train platform at sunset', 'scene'),
      d('frame', 'vhs', '录像带', 'subtle VHS tracking lines along the edges, no readable text', 'frame'),
      d('frame', 'cel', '动画赛璐璐', 'a vintage animation-cel frame', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 70, details: ['sunset', 'city'] },
    hero: 'kai', also: ['aiman'], emblem: ['cassette', 'sparkle'],
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
    hero: 'kai', also: ['jun'], emblem: ['sparkle', 'sparkle'],
  },
  {
    id: 'film', name: '清新胶片', cat: 'mood', hot: 2,
    line: '空气感柔光、自然骨相、高级浅景深', hook: '随手一拍就是胶片',
    theme: { dark: false, bg: '#f6f2e9', bg2: '#e6eadb', surface: '#fcfaf3', ink: '#2f3527', soft: '#7a8069', accent: '#6f9a6a', accent2: '#d9a06b', onAccent: '#ffffff', glow: 'rgba(111,154,106,.35)', line: 'rgba(47,53,39,.12)', radius: '6px', display: 'serif', deco: 'leaves', frame: 'print' },
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
    hero: 'nur', also: ['aiman'], emblem: ['sparkle', 'sparkle'],
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
    hero: 'aiman', also: ['kai'], emblem: ['neon-heart', 'neon-heart'],
  },
  {
    id: 'hkfilm', name: '港风电影', cat: 'mood', hot: 3, isNew: true,
    line: '暖钨丝灯、红绿霓虹、抽帧胶片，九十年代的心动', hook: '这一秒，像电影',
    theme: { dark: true, bg: '#140b0b', bg2: '#2b1414', surface: '#1d1111', ink: '#fbeee2', soft: '#cfa894', accent: '#e8434f', accent2: '#3fd0a0', onAccent: '#ffffff', glow: 'rgba(232,67,79,.45)', line: 'rgba(251,238,226,.15)', radius: '4px', display: 'serif', deco: 'neon', frame: 'cinema' },
    live: live({ grade: [1.08, 1, .9], sat: 1.05, contrast: 1.15, warmth: .25, grain: .45, bloom: .35, vignette: .55, rim: [1, .2, .2, .2, .8, .6], overlay: 'hk' }),
    prompt: 'Make this a cinematic 1990s Hong Kong film still: warm tungsten light, red and green neon reflections on the skin, a slight step-printed motion blur, rich film grain and halation, a moody nostalgic romantic atmosphere, a crowded night street or a narrow neon-lit stairwell softly out of focus behind. Keep the real person exactly. No readable text.',
    details: [
      d('acc', 'shirt', '花衬衫', 'a loose vintage patterned shirt'),
      d('acc', 'specs', '复古墨镜', 'small vintage tinted sunglasses'),
      d('light', 'tungsten', '钨丝暖光', 'warm tungsten street light'),
      d('light', 'neon', '红绿霓虹', 'red and green neon glow'),
      d('scene', 'street', '霓虹街头', 'a dense neon-lit night street', 'scene'),
      d('scene', 'diner', '茶餐厅', 'a retro diner with green booths and tiled walls', 'scene'),
      d('frame', 'letterbox', '电影宽银幕', 'cinematic letterbox black bars top and bottom', 'frame'),
      d('frame', 'blur', '抽帧残影', 'a dreamy step-printed motion trail', 'frame'),
    ],
    defaults: { ...base, strength: 75, likeness: 92, richness: 55, beauty: 25, details: ['tungsten', 'street'] },
    hero: 'jun', also: ['mei'], emblem: ['film-reel', 'sparkle'],
  },

  // ───────────── 艺术画风 ─────────────
  {
    id: 'oil', name: '古典油画', cat: 'art', hot: 2, isNew: true,
    line: '大师级明暗、厚涂笔触、鎏金画框', hook: '挂进博物馆的那种',
    theme: { dark: true, bg: '#17110b', bg2: '#33231a', surface: '#21180f', ink: '#f6ead6', soft: '#c3a885', accent: '#d4a548', accent2: '#8c3b2e', onAccent: '#1b1205', glow: 'rgba(212,165,72,.45)', line: 'rgba(212,165,72,.25)', radius: '3px', display: 'serif', deco: 'canvas', frame: 'gilt' },
    live: live({ grade: [1.06, .98, .86], sat: .85, contrast: 1.2, warmth: .2, smooth: .5, grain: .2, vignette: .75, overlay: 'gilt' }),
    prompt: 'Repaint this person as an Old Master oil portrait: rich glazed oil paint with visible confident brushwork and fine craquelure, dramatic chiaroscuro light falling from a high window, deep warm earth tones, a dark atmospheric background, a sumptuous velvet garment with a delicate lace collar, museum-quality fine art. Still clearly them.',
    details: [
      d('acc', 'pearl', '珍珠耳环', 'a single luminous pearl earring'),
      d('acc', 'lace', '蕾丝领', 'a crisp white lace ruff collar'),
      d('light', 'window', '天窗光', 'soft light from a high window'),
      d('light', 'candle', '烛光', 'warm candlelight'),
      d('scene', 'dark', '深色背景', 'a deep dark atmospheric background', 'scene'),
      d('scene', 'landscape', '远山风景', 'a soft pastoral landscape seen through a window behind', 'scene'),
      d('frame', 'gilt', '鎏金画框', 'an ornate carved gilt picture frame', 'frame'),
      d('frame', 'museum', '博物馆墙', 'hanging on a museum wall in a gilt frame', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 85, details: ['window', 'dark', 'gilt'] },
    hero: 'aiman', also: ['priya'], emblem: ['paintbrush', 'sparkle'],
  },
  {
    id: 'storybook', name: '绘本水彩', cat: 'art', hot: 2, isNew: true,
    line: '水彩晕染、彩铅勾线，像童话绘本里走出来', hook: '从前有个可爱的你',
    theme: { dark: false, bg: '#fbf6ec', bg2: '#f0e6d4', surface: '#fffcf5', ink: '#3b3127', soft: '#8d7c69', accent: '#e07a5f', accent2: '#3d8eb9', onAccent: '#ffffff', glow: 'rgba(224,122,95,.35)', line: 'rgba(59,49,39,.14)', radius: '22px', display: 'serif', deco: 'doodle', frame: 'paper' },
    live: live({ grade: [1.03, 1.02, .96], sat: .95, contrast: .85, lift: .14, posterize: .25, edge: .25, smooth: .8, grain: .25, vignette: .12, overlay: 'doodle' }),
    prompt: 'Repaint this person as an illustration from a gentle children\'s picture book: loose watercolour washes blooming on textured cotton paper, soft coloured-pencil linework, whimsical warm little details, an airy pastel palette, cosy and heart-warming. Still clearly them.',
    details: [
      d('acc', 'scarf', '小围巾', 'a cosy hand-knitted scarf'),
      d('acc', 'balloon', '气球', 'holding a bunch of balloons'),
      d('light', 'warm', '暖暖午后', 'warm afternoon light'),
      d('light', 'stars', '小星星', 'tiny hand-drawn stars around them'),
      d('scene', 'forest', '童话森林', 'a whimsical storybook forest', 'scene'),
      d('scene', 'town', '彩色小镇', 'a colourful little storybook town', 'scene'),
      d('frame', 'paper', '水彩纸边', 'soft watercolour edges fading into paper', 'frame'),
      d('frame', 'doodle', '涂鸦边框', 'a border of cute hand-drawn doodles', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 75, details: ['warm', 'forest', 'paper'] },
    hero: 'nur', also: ['jun'], emblem: ['flower', 'sparkle'],
  },
  {
    id: 'pop', name: '波普艺术', cat: 'art', hot: 2, isNew: true,
    line: '撞色色块、粗黑描边、网点印刷，一眼潮', hook: 'POP！就是这么潮',
    theme: { dark: false, bg: '#fff35c', bg2: '#ff9ec7', surface: '#fffbe6', ink: '#111111', soft: '#4a4a4a', accent: '#ff2d6f', accent2: '#1f6bff', onAccent: '#ffffff', glow: 'rgba(255,45,111,.35)', line: '#111111', radius: '0px', display: 'comic', deco: 'bendays', frame: 'pop' },
    live: live({ sat: 1.6, contrast: 1.35, posterize: .7, edge: .55, halftone: .4, vignette: 0, overlay: 'pop' }),
    prompt: 'Turn this person into a bold 1960s pop-art screen print: flat saturated blocks of colour, thick black outlines, Ben-Day halftone dots, a punchy contrasting background, graphic and iconic. Still clearly them. No text.',
    details: [
      d('acc', 'shades', '撞色墨镜', 'colourful retro sunglasses'),
      d('acc', 'gum', '吹泡泡糖', 'blowing a pink bubble-gum bubble'),
      d('light', 'flat', '平涂色块', 'flat graphic colour blocks for light and shadow'),
      d('light', 'dots', '网点阴影', 'Ben-Day dot shading'),
      d('scene', 'solid', '撞色底', 'a single bold contrasting colour background', 'scene'),
      d('scene', 'burst', '爆炸背景', 'a comic explosion burst background', 'scene'),
      d('frame', 'grid', '四宫格', 'a 2 by 2 grid of the same portrait in four different colourways', 'frame'),
      d('frame', 'thick', '粗黑边框', 'a thick black graphic border', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 80, details: ['dots', 'solid'] },
    hero: 'kai', also: ['aiman'], emblem: ['heart', 'bolt'],
  },
  {
    id: 'woodblock', name: '浮世木刻', cat: 'art', hot: 1, isNew: true,
    line: '木刻版画的线条、靛蓝与朱红、浪花与云纹', hook: '一刀一刻都是你',
    theme: { dark: false, bg: '#f3ead6', bg2: '#e2d3b2', surface: '#faf4e6', ink: '#1f2a44', soft: '#6e6a5e', accent: '#2b4c7e', accent2: '#c8462c', onAccent: '#ffffff', glow: 'rgba(43,76,126,.35)', line: 'rgba(31,42,68,.18)', radius: '2px', display: 'brush', deco: 'waves', frame: 'print' },
    live: live({ grade: [1.04, 1, .88], sat: .7, contrast: 1.2, posterize: .65, edge: .5, grain: .25, warmth: .15, vignette: .2, overlay: 'wave' }),
    prompt: 'Repaint this person as a traditional Japanese ukiyo-e woodblock print: flat areas of colour, elegant carved outlines, subtle wood-grain texture and visible paper fibres, a limited palette of indigo, vermilion and ochre, stylised waves and clouds around them, beautiful and timeless. Still clearly them. No text.',
    details: [
      d('acc', 'kanzashi', '发簪', 'an elegant hairpin'),
      d('acc', 'umbrella', '油纸伞', 'holding an oil-paper umbrella'),
      d('light', 'sun', '朱红日轮', 'a large vermilion sun disc behind them'),
      d('light', 'snow', '飘雪', 'softly falling snow'),
      d('scene', 'waves', '浪花', 'stylised curling waves', 'scene'),
      d('scene', 'mountain', '远山', 'a distant snow-capped mountain', 'scene'),
      d('frame', 'cartouche', '题签', 'a decorative blank cartouche in the corner, nothing legible', 'frame'),
      d('frame', 'print', '版画留白', 'wide paper margins like a museum print', 'frame'),
    ],
    defaults: { ...base, strength: 85, likeness: 75, details: ['sun', 'waves'] },
    hero: 'jun', also: ['nur'], emblem: ['wave', 'sparkle'],
  },
  {
    id: 'calendar', name: '南洋月份牌', cat: 'art', hot: 2, isNew: true,
    line: '老上海与南洋的月份牌，柔光喷绘、复古摩登', hook: '一九三五，好时光',
    theme: { dark: false, bg: '#f7eedd', bg2: '#e8d2b0', surface: '#fdf8ee', ink: '#3b2a1e', soft: '#8b6e55', accent: '#b8463a', accent2: '#3e8a7e', onAccent: '#ffffff', glow: 'rgba(184,70,58,.35)', line: 'rgba(59,42,30,.16)', radius: '8px', display: 'serif', deco: 'deco', frame: 'deco' },
    live: live({ grade: [1.06, 1, .92], sat: .9, contrast: .9, lift: .1, warmth: .2, smooth: 1, bloom: .25, grain: .2, vignette: .3, overlay: 'deco' }),
    prompt: 'Repaint this person as a 1930s Shanghai and Nanyang calendar-poster painting: soft airbrushed gouache with luminous rosy skin, an elegant vintage outfit of the era (a qipao, a kebaya or a sharp suit, whichever suits them), art-deco ornaments, a gentle pastel garden or balcony backdrop with tropical plants, nostalgic and glamorous. Keep any glasses or head covering they wear. No text.',
    details: [
      d('acc', 'fan', '羽毛扇', 'holding a feather fan'),
      d('acc', 'pearls', '珍珠项链', 'a long strand of pearls'),
      d('light', 'soft', '喷绘柔光', 'soft airbrushed light'),
      d('light', 'golden', '黄昏暖色', 'a warm golden-hour glow'),
      d('scene', 'garden', '热带花园', 'a lush tropical garden with frangipani', 'scene'),
      d('scene', 'balcony', '洋楼阳台', 'a colonial shophouse balcony', 'scene'),
      d('frame', 'deco', '装饰艺术框', 'an art-deco poster border', 'frame'),
      d('frame', 'aged', '泛黄纸张', 'aged, slightly yellowed poster paper', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 85, beauty: 45, details: ['soft', 'garden', 'deco'] },
    hero: 'mei', also: ['priya'], emblem: ['flower', 'sparkle'],
  },
  {
    id: 'peranakan', name: '娘惹风华', cat: 'art', hot: 3, isNew: true,
    line: '娘惹花砖、刺绣可峇雅、金色胸针，南洋的浓烈与精致', hook: '花砖底下，有我',
    theme: { dark: false, bg: '#eef8f3', bg2: '#ffe0e6', surface: '#fbfffd', ink: '#22303a', soft: '#6b7f86', accent: '#e05a7a', accent2: '#2ea39b', onAccent: '#ffffff', glow: 'rgba(224,90,122,.38)', line: 'rgba(34,48,58,.14)', radius: '14px', display: 'serif', deco: 'tiles', frame: 'tiles' },
    live: live({ grade: [1.04, 1, 1.02], sat: 1.2, contrast: 1.05, lift: .05, smooth: .6, bloom: .15, vignette: .15, overlay: 'tiles' }),
    prompt: 'Repaint this person as a vibrant Peranakan heritage portrait: pastel Peranakan ceramic tiles with intricate floral motifs framing the scene, finely embroidered kebaya or a batik shirt, ornate gold brooches and beadwork, a colourful shophouse façade with wooden shutters behind, joyful, richly patterned and refined, a detailed illustration. Keep any glasses or head covering they wear.',
    details: [
      d('acc', 'brooch', '金色胸针', 'a set of ornate gold kerosang brooches'),
      d('acc', 'beads', '串珠细节', 'delicate beadwork details'),
      d('light', 'sun', '南洋日光', 'bright tropical daylight'),
      d('light', 'warm', '暖色灯笼', 'warm lantern light'),
      d('scene', 'shophouse', '店屋街', 'a row of pastel shophouses', 'scene'),
      d('scene', 'garden', '天井花园', 'an airwell courtyard with orchids', 'scene'),
      d('frame', 'tiles', '花砖边框', 'a border of pastel Peranakan tiles', 'frame'),
      d('frame', 'window', '木窗', 'a carved wooden window frame', 'frame'),
    ],
    defaults: { ...base, strength: 80, likeness: 85, details: ['brooch', 'sun', 'shophouse', 'tiles'] },
    hero: 'priya', also: ['mei'], emblem: ['tile', 'flower'],
  },
];

/** 旧版本里的风格 id（已改名或重做）：老作品打开时仍然认得。 */
const ALIASES = /** @type {Record<string, string>} */ ({ giant: 'hero', robocat: 'robot', ghibli: 'handdrawn' });

/** 虚构的示例人物（全部由生图模型生成，不是真人）。 */
export const PEOPLE = [
  { id: 'mei', name: 'Mei' }, { id: 'aiman', name: 'Aiman' }, { id: 'priya', name: 'Priya' },
  { id: 'jun', name: 'Jun' }, { id: 'nur', name: 'Nur' }, { id: 'kai', name: 'Kai' },
];

/** 用户自创的风格（由文字或参考图生成，存在自己的私人空间里）。 @type {Preset[]} */
let CUSTOM = [];
/** @param {Preset[]} list */
export function setCustom(list) { CUSTOM = list.filter(p => p && p.id && p.custom); }
export const customStyles = () => CUSTOM.slice();
export const allPresets = () => [...PRESETS, ...CUSTOM];

export const presetById = (/** @type {string} */ id) => {
  const key = ALIASES[id] || id;
  return PRESETS.find(p => p.id === key) || CUSTOM.find(p => p.id === key) || null;
};
/** 分类胶囊：有自创风格时多一个「自创」。 */
export const categories = () => (CUSTOM.length ? [...CATEGORIES, { id: 'mine', label: '自创' }] : CATEGORIES);
/** 「热门」：精选的混合，新风格和经典风格交错，第一眼就能看出这里有很多个世界。 */
const HOT = ['princess', 'inkfairy', 'anime', 'hero', 'dragon', 'shoujo', 'neon', 'peranakan', 'robot', 'magical', 'hkfilm', 'figure', 'ccd', 'handdrawn', 'shonen', 'clay'];
export const inCategory = (/** @type {string} */ cat) => cat === 'hot'
  ? /** @type {Preset[]} */ (HOT.map(id => PRESETS.find(p => p.id === id)).filter(Boolean))
  : cat === 'mine' ? CUSTOM.slice() : PRESETS.filter(p => p.cat === cat);
export const categoryOf = (/** @type {Preset} */ p) => categories().find(c => c.id === (p.custom ? 'mine' : p.cat)) || CATEGORIES[0];
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
  if (said) out.push('Also, as the person asked (in their own words): ' + said + '.');
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
