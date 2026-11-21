/**
 * 部位精修的词汇表：脸上每个可以单独改的部位、每个部位的选项、一个「程度」档位，以及发给生图模型的英文说法。
 *
 * 继承自旧版 Lookbook（刘海、眉毛、发色、发型、眼妆、唇妆、胡子），新增腮红、耳饰、头饰、眼镜、表情。
 * 每个部位对应 core/face.js 里的一块遮罩：只改这一块，其余像素原样保留（服务器按遮罩把新图贴回原图）。
 * 纯数据 + 纯函数，界面和测试都从这里读。
 */

/** @typedef {{ id: string, label: string, words: string, hex?: string }} PartOption */
/** @typedef {{ label: string, words: string }} TuneStep */
/**
 * @typedef {{ id: string, label: string, en: string, hint: string, kind: 'pick' | 'swatch', options: PartOption[],
 *   tune?: { label: string, steps: TuneStep[], start: number } }} Part
 */
/** @typedef {{ part: string, option: string, tune?: number, say?: string }} Pick 选中的一处 */

/** @type {Part[]} */
export const PARTS = [
  {
    id: 'bangs', label: '刘海', en: 'Bangs', hint: '额前那一片，最影响脸型', kind: 'pick',
    options: [
      { id: 'air', label: '空气刘海', words: 'light, wispy see-through "air bangs"' },
      { id: 'curtain', label: '八字刘海', words: 'soft curtain bangs parted in the middle, sweeping to both sides and framing the face' },
      { id: 'blunt', label: '齐刘海', words: 'full blunt bangs cut straight across' },
      { id: 'side', label: '侧分刘海', words: 'long side-swept bangs' },
      { id: 'choppy', label: '碎刘海', words: 'short textured choppy bangs' },
      { id: 'none', label: '露额头', words: 'no bangs at all: the forehead clear, the hair swept back' },
    ],
    tune: { label: '长度', start: 1, steps: [{ label: '眉上', words: 'ending well above the brows' }, { label: '齐眉', words: 'ending right at the brows' }, { label: '遮眉', words: 'long enough to brush the eyelashes' }] },
  },
  {
    id: 'cut', label: '发型', en: 'Hairstyle', hint: '整个发型换掉，长短卷直都行', kind: 'pick',
    options: [
      { id: 'waves', label: '大波浪', words: 'long, voluminous glossy waves' },
      { id: 'straight', label: '黑长直', words: 'long sleek straight hair' },
      { id: 'bob', label: '波波头', words: 'a chic chin-length bob' },
      { id: 'lob', label: '锁骨发', words: 'a shoulder-length lob with softly flipped ends' },
      { id: 'wolf', label: '狼尾', words: 'a layered shaggy wolf cut' },
      { id: 'pixie', label: '精灵短发', words: 'a short pixie cut' },
      { id: 'bun', label: '丸子头', words: 'a cute high messy bun with loose face-framing strands' },
      { id: 'twin', label: '双马尾', words: 'playful twin tails' },
      { id: 'braid', label: '麻花辫', words: 'a long loose side braid' },
      { id: 'kpop', label: '韩系纹理', words: 'a textured Korean-style two-block cut with a soft fringe' },
      { id: 'slick', label: '背头', words: 'neatly slicked-back hair' },
      { id: 'buzz', label: '寸头', words: 'a clean buzz cut' },
    ],
  },
  {
    id: 'colour', label: '发色', en: 'Hair colour', hint: '染个色，换个心情', kind: 'swatch',
    options: [
      { id: 'black', label: '自然黑', hex: '#211c1b', words: 'natural glossy black' },
      { id: 'brown', label: '巧克力棕', hex: '#5d3b2a', words: 'rich chocolate brown' },
      { id: 'milktea', label: '奶茶色', hex: '#b5906f', words: 'milk-tea beige brown' },
      { id: 'honey', label: '蜂蜜金', hex: '#cca15b', words: 'honey blonde' },
      { id: 'ash', label: '雾霾灰', hex: '#8f949b', words: 'smoky ash grey' },
      { id: 'pink', label: '樱花粉', hex: '#eda3bd', words: 'pastel sakura pink' },
      { id: 'wine', label: '酒红', hex: '#7d2435', words: 'deep burgundy wine red' },
      { id: 'blue', label: '冰川蓝', hex: '#79acd9', words: 'icy pastel blue' },
      { id: 'taro', label: '香芋紫', hex: '#a88ed0', words: 'taro lavender purple' },
      { id: 'mint', label: '薄荷绿', hex: '#8fd4bd', words: 'soft mint green' },
      { id: 'peach', label: '蜜桃橘', hex: '#f0a273', words: 'peachy orange' },
      { id: 'silver', label: '银白', hex: '#e3e4ea', words: 'platinum silver' },
    ],
    tune: { label: '染法', start: 0, steps: [{ label: '全染', words: 'dyed all over' }, { label: '挑染', words: 'as face-framing highlights over their own colour' }, { label: '渐变', words: 'as an ombré fading down from their natural roots' }, { label: '内层', words: 'as a hidden underlayer colour peeking through' }] },
  },
  {
    id: 'brows', label: '眉毛', en: 'Brows', hint: '眉形一换，气质就变', kind: 'pick',
    options: [
      { id: 'natural', label: '自然眉', words: 'soft natural brows' },
      { id: 'straight', label: '一字眉', words: 'straight Korean-style brows' },
      { id: 'willow', label: '柳叶眉', words: 'gently arched willow-leaf brows' },
      { id: 'feather', label: '野生眉', words: 'fluffy, brushed-up feathery brows' },
      { id: 'arch', label: '挑眉', words: 'high, defined arched brows' },
      { id: 'sword', label: '剑眉', words: 'strong angled sword brows' },
    ],
    tune: { label: '浓淡', start: 1, steps: [{ label: '淡', words: 'soft and light' }, { label: '自然', words: 'of natural density' }, { label: '浓', words: 'bold and full' }] },
  },
  {
    id: 'eyes', label: '眼妆', en: 'Eye make-up', hint: '眼线、眼影、睫毛', kind: 'pick',
    options: [
      { id: 'bare', label: '素颜感', words: 'barely-there natural eye make-up' },
      { id: 'wing', label: '猫眼线', words: 'a sharp winged cat-eye liner' },
      { id: 'peach', label: '桃花妆', words: 'rosy peach-blossom eyeshadow' },
      { id: 'smoky', label: '小烟熏', words: 'soft smoky eyes' },
      { id: 'glitter', label: '卧蚕闪片', words: 'sparkly glitter along the lower lids' },
      { id: 'lashes', label: '浓密睫毛', words: 'long, fluttery lashes' },
      { id: 'graphic', label: '彩色眼线', words: 'a pop of colourful graphic eyeliner' },
    ],
    tune: { label: '浓淡', start: 1, steps: [{ label: '淡', words: 'subtle' }, { label: '日常', words: 'everyday intensity' }, { label: '浓', words: 'dramatic and bold' }] },
  },
  {
    id: 'lips', label: '唇妆', en: 'Lips', hint: '一支口红的事', kind: 'swatch',
    options: [
      { id: 'nude', label: '裸色', hex: '#c98d7f', words: 'a nude lip colour' },
      { id: 'rose', label: '豆沙', hex: '#b96d6e', words: 'a dusty-rose lip colour' },
      { id: 'peach', label: '蜜桃', hex: '#f08c7b', words: 'a peach-coral lip colour' },
      { id: 'berry', label: '莓果', hex: '#932d55', words: 'a berry lip colour' },
      { id: 'red', label: '正红', hex: '#c8152f', words: 'a classic red lip' },
      { id: 'brick', label: '枫叶棕', hex: '#8c3b2c', words: 'a brick-brown lip colour' },
      { id: 'pink', label: '粉嫩', hex: '#f3a5c0', words: 'a baby-pink lip colour' },
      { id: 'straw', label: '草莓', hex: '#e2435c', words: 'a strawberry-red lip colour' },
    ],
    tune: { label: '质地', start: 1, steps: [{ label: '哑光', words: 'with a soft matte finish' }, { label: '水光', words: 'with a juicy glossy finish' }, { label: '丝绒', words: 'with a velvety finish' }, { label: '咬唇', words: 'in a blurred, gradient "bitten lip" style' }] },
  },
  {
    id: 'blush', label: '腮红', en: 'Blush', hint: '好气色，一抹就有', kind: 'swatch',
    options: [
      { id: 'peach', label: '蜜桃', hex: '#f7a891', words: 'a soft peach blush' },
      { id: 'sakura', label: '樱花', hex: '#f4a4c1', words: 'a sakura-pink blush' },
      { id: 'coral', label: '珊瑚', hex: '#f2866d', words: 'a coral blush' },
      { id: 'sunkiss', label: '晒伤妆', hex: '#e6826d', words: 'a sun-kissed blush across the cheeks and the bridge of the nose' },
    ],
    tune: { label: '浓淡', start: 1, steps: [{ label: '若有若无', words: 'barely there' }, { label: '微醺', words: 'a gentle flush' }, { label: '元气', words: 'bright and playful' }] },
  },
  {
    id: 'beard', label: '胡子', en: 'Facial hair', hint: '留胡子还是刮干净', kind: 'pick',
    options: [
      { id: 'clean', label: '刮干净', words: 'clean-shaven' },
      { id: 'stubble', label: '胡茬', words: 'light designer stubble' },
      { id: 'goatee', label: '山羊胡', words: 'a neat goatee' },
      { id: 'full', label: '络腮胡', words: 'a full, well-groomed beard' },
      { id: 'tache', label: '小胡子', words: 'a neat moustache' },
    ],
  },
  {
    id: 'earrings', label: '耳饰', en: 'Earrings', hint: '耳边一点亮', kind: 'pick',
    options: [
      { id: 'pearl', label: '珍珠', words: 'elegant pearl drop earrings' },
      { id: 'hoops', label: '金圈圈', words: 'gold hoop earrings' },
      { id: 'tassel', label: '流苏', words: 'long, delicate tassel earrings' },
      { id: 'stars', label: '星月', words: 'tiny star-and-moon studs' },
      { id: 'none', label: '摘掉', words: 'no earrings' },
    ],
  },
  {
    id: 'headwear', label: '头饰', en: 'Headwear', hint: '皇冠、帽子、发箍…', kind: 'pick',
    options: [
      { id: 'tiara', label: '小皇冠', words: 'a delicate sparkling tiara' },
      { id: 'bow', label: '蝴蝶结', words: 'a big satin bow' },
      { id: 'band', label: '发箍', words: 'a padded headband' },
      { id: 'wreath', label: '花环', words: 'a crown of fresh flowers' },
      { id: 'cat', label: '猫耳', words: 'a cute cat-ear headband' },
      { id: 'cap', label: '鸭舌帽', words: 'a baseball cap' },
      { id: 'bucket', label: '渔夫帽', words: 'a bucket hat' },
      { id: 'clips', label: '彩色发夹', words: 'a few colourful hair clips' },
    ],
  },
  {
    id: 'glasses', label: '眼镜', en: 'Glasses', hint: '戴上还是摘掉', kind: 'pick',
    options: [
      { id: 'off', label: '摘掉', words: 'no glasses: take them off and show the eyes clearly' },
      { id: 'wire', label: '细框', words: 'thin gold wire-frame glasses' },
      { id: 'bold', label: '黑框', words: 'bold black-framed glasses' },
      { id: 'round', label: '圆框', words: 'round retro glasses' },
      { id: 'shades', label: '墨镜', words: 'stylish sunglasses' },
    ],
  },
  {
    id: 'expression', label: '表情', en: 'Expression', hint: '换个表情，还是你', kind: 'pick',
    options: [
      { id: 'smile', label: '甜笑', words: 'a sweet, gentle smile' },
      { id: 'laugh', label: '大笑', words: 'a big happy laugh' },
      { id: 'wink', label: '眨眼', words: 'a playful wink' },
      { id: 'cool', label: '酷酷的', words: 'a cool, confident look' },
      { id: 'pout', label: '嘟嘴', words: 'a cute pout' },
      { id: 'wow', label: '惊讶', words: 'a surprised "wow" face' },
    ],
  },
];

export const partById = (/** @type {string} */ id) => PARTS.find(p => p.id === id) || null;
export const optionOf = (/** @type {Pick} */ k) => partById(k.part)?.options.find(o => o.id === k.option) || null;

/** 一处精修，界面上怎么说：「刘海 · 八字刘海 · 齐眉」。 @param {Pick} k */
export function labelOf(k) {
  const p = partById(k.part), o = optionOf(k);
  if (!p || !o) return '';
  const t = p.tune && k.tune != null ? p.tune.steps[k.tune]?.label : '';
  return [p.label, o.label, t].filter(Boolean).join(' · ');
}

/** 一处精修，对生图模型怎么说（这一块遮罩的说明）。 @param {Pick} k */
export function noteOf(k) {
  const p = partById(k.part), o = optionOf(k);
  if (!p || !o) return '';
  const t = p.tune && k.tune != null ? p.tune.steps[k.tune]?.words : '';
  const said = String(k.say || '').trim().replace(/[.。\s]+$/, '');
  return `${p.en}: ${o.words}${t ? ', ' + t : ''}${said ? '. As they asked: ' + said : ''}`;
}

/** 选一处：同一个部位只留一个选择（再点同一个 = 取消）。 @param {Pick[]} picks @param {Pick} k @returns {Pick[]} */
export function togglePick(picks, k) {
  const same = picks.find(x => x.part === k.part);
  if (same && same.option === k.option) return picks.filter(x => x.part !== k.part);
  const p = partById(k.part);
  const tune = k.tune ?? same?.tune ?? p?.tune?.start;
  return [...picks.filter(x => x.part !== k.part), { ...k, ...(tune != null ? { tune } : {}) }];
}

/**
 * 整次精修的总说明（和每一块遮罩的说明一起发出去）：只改圈出来的地方，画风和光影跟原图完全一致。
 * @param {Pick[]} picks @param {{ styled?: boolean, words?: string }} [o]
 */
export function regionText(picks, o = {}) {
  const lines = [
    'Change only the marked parts of the face and hair, each as its note says.',
    'Keep everything else exactly as it is: the same person, face shape, skin, expression (unless asked), pose, clothes, light and background.',
    o.styled ? "Match the picture's existing art style, brushwork, palette and lighting exactly, so the change looks painted in." : 'Keep it a natural, photorealistic photo; the change must look real, with natural texture and light.',
    'Keep any head covering they wear.',
  ];
  const said = String(o.words || '').trim();
  if (said) lines.push('Also, as they asked: ' + said + '.');
  void picks;   // 每一处的说法跟着各自的遮罩走（服务器写成「In the marked region ①: …」）
  return lines.join(' ');
}

/** 圈选（手涂的一块）怎么说。 @param {string} words */
export function paintedNote(words) {
  const said = String(words || '').trim().replace(/[.。\s]+$/, '');
  return said ? 'In the painted area: ' + said : 'Improve the painted area so it looks better, keeping the style';
}
