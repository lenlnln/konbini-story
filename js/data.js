// 遊戲靜態資料：商品、設備、顧客類型、店面等級、任務
export const MIN_PER_SEC = 4; // ×1 速度下，每 1 秒現實時間 = 4 分鐘遊戲時間

// 商品目錄在 catalog.js（26 大類、近 800 項商品）
export { CATEGORIES, PRODUCTS, PRODUCT, CAT_PRODUCTS, CAT_AVG, LEGACY_IDS, LEGACY_CATS, findProduct } from './catalog.js';
import { CATEGORIES as _CATS } from './catalog.js';
const catsFor = type => Object.keys(_CATS).filter(c => _CATS[c].fix.includes(type));

// 設備：w×d 為旋轉 0 時佔用格數，面向 +z
export const FIXTURES = {
  shelf:   { name: '商品貨架', icon: '🗄️', w: 2, d: 1, price: 3000, cap: 24, cats: catsFor('shelf'), defCat: 'snack', desc: '常溫商品：零食、泡麵、麵包、日用品、文具、3C…' },
  fridge:  { name: '飲料冰箱', icon: '🧊', w: 2, d: 1, price: 6000, cap: 30, cats: catsFor('fridge'), desc: '冷藏飲料、乳品、酒類' },
  chiller: { name: '鮮食冷藏櫃', icon: '🍱', w: 2, d: 1, price: 7000, cap: 16, cats: catsFor('chiller'), desc: '飯糰、便當、麵食、輕食、甜點（會過期）' },
  freezer: { name: '冷凍櫃', icon: '🍦', w: 2, d: 1, price: 6500, cap: 20, cats: catsFor('freezer'), defCat: 'dessert', desc: '冰淇淋、冰品、冷凍食材' },
  hotcase: { name: '熱食保溫櫃', icon: '🍗', w: 1, d: 1, price: 5000, cap: 12, cats: catsFor('hotcase'), defCat: 'oden', desc: '炸物、烤物、關東煮、滷味、湯品（會過期）' },
  odenpot: { name: '關東煮鍋', icon: '🍢', w: 1, d: 1, price: 4500, cap: 16, cats: catsFor('odenpot'), desc: '關東煮、滷味、湯品（會過期）' },
  steamer: { name: '蒸包機', icon: '🥟', w: 1, d: 1, price: 4500, cap: 12, cats: catsFor('steamer'), desc: '包子、饅頭、蒸地瓜（會過期）' },
  coffee:  { name: '咖啡機', icon: '☕', w: 1, d: 1, price: 8000, cap: 20, cats: catsFor('coffee'), desc: '現煮咖啡與熱飲，上班族最愛' },
  tobacco: { name: '菸品櫃', icon: '🚬', w: 1, d: 1, price: 3500, cap: 18, cats: catsFor('tobacco'), desc: '菸品、打火機（未成年不販售）' },
  kiosk:   { name: '多功能事務機', icon: '🖨️', w: 1, d: 1, price: 12000, service: 'kiosk', cats: ['service'], desc: '影印、繳費、寄件、票券（不用進貨）' },
  atm:     { name: 'ATM 提款機', icon: '🏧', w: 1, d: 1, price: 15000, service: 'atm', cats: ['service'], desc: '提款、轉帳手續費收入' },
  counter: { name: '收銀台', icon: '🧾', w: 2, d: 1, price: 4000, checkout: true, desc: '顧客在前方排隊、店員在後方結帳' },
  plant:   { name: '盆栽', icon: '🪴', w: 1, d: 1, price: 600, decor: 2, desc: '讓店裡更舒服（滿意度＋）' },
  table:   { name: '用餐桌椅', icon: '🪑', w: 1, d: 1, price: 1500, decor: 3, desc: '內用區（滿意度＋）' },
};

export const CUSTOMER_TYPES = {
  student:  { name: '學生',   budget: 120, sens: 1.5, basket: [1, 2], speed: 1.9, peaks: [7, 12, 16, 17], shirt: [0xffffff, 0xe8f0ff], pants: [0x2a3a6a, 0x3a3a3a] },
  office:   { name: '上班族', budget: 320, sens: 0.8, basket: [1, 3], speed: 1.7, peaks: [7, 8, 12, 13, 18, 19], shirt: [0x2b2f3a, 0x3d4a5c, 0xf4f4f4], pants: [0x222222, 0x2d2d3d] },
  resident: { name: '居民',   budget: 420, sens: 1.1, basket: [2, 5], speed: 1.5, peaks: [10, 11, 15, 16, 20], shirt: [0xff9e80, 0x9be3a0, 0xffe08a, 0xb39ddb], pants: [0x5d4037, 0x37474f, 0x8d6e63] },
  elder:    { name: '長者',   budget: 160, sens: 1.3, basket: [1, 2], speed: 1.1, peaks: [6, 7, 8, 9, 10], shirt: [0x8d6e63, 0x90a4ae, 0xa1887f], pants: [0x424242, 0x5d4037] },
  night:    { name: '夜貓族', budget: 220, sens: 0.9, basket: [1, 3], speed: 1.6, peaks: [21, 22, 23, 0, 1, 2], shirt: [0x212121, 0x4a148c, 0x263238], pants: [0x111111, 0x1a237e] },
};

// 每小時人潮基準
export const HOUR_CURVE = [0.3, 0.2, 0.15, 0.1, 0.1, 0.2, 0.5, 1.0, 1.0, 0.6, 0.6, 0.8, 1.0, 0.8, 0.5, 0.6, 0.8, 1.0, 1.0, 0.8, 0.7, 0.6, 0.5, 0.4];

export const STORE_LEVELS = [
  { name: '街角小店', W: 8,  z0: 0,  cost: 0,      rent: 800,  traffic: 1.0 },
  { name: '社區門市', W: 11, z0: -1, cost: 60000,  rent: 1500, traffic: 1.35 },
  { name: '大型門市', W: 14, z0: -2, cost: 160000, rent: 2600, traffic: 1.75 },
  { name: '旗艦店',   W: 18, z0: -3, cost: 400000, rent: 4200, traffic: 2.3 },
];
export const STORE_FRONT_Z = 7; // 前牆位置（門所在）
export const DOOR_X = 1;

export const UPGRADES = {
  sign:  { name: '招牌', levels: [0, 8000, 25000, 60000], desc: ['手寫立牌', '燈箱招牌', 'LED 招牌', '大型霓虹招牌'], effect: '路人進店率提升' },
  light: { name: '燈光', levels: [0, 6000, 20000, 50000], desc: ['日光燈', '明亮燈管', '暖色崁燈', '設計師燈光'], effect: '顧客滿意度提升' },
  floor: { name: '地板裝潢', levels: [0, 5000, 18000, 45000], desc: ['水泥地', '米白磁磚', '木紋地板', '大理石'], effect: '滿意度小幅提升' },
};

export const DISTRICTS = {
  school:      { name: '學校區', base: 4200, desc: '學生多、平日強、假日弱' },
  residential: { name: '住宅區', base: 3800, desc: '穩定、假日較好' },
  business:    { name: '商業區', base: 5200, desc: '上班族多、平日很強、假日冷清' },
};
export const BRANCH_COST = 250000;

export const WEATHERS = {
  sunny:  { name: '晴天', icon: '☀️', traffic: 1.0,  demand: {} },
  cloudy: { name: '多雲', icon: '⛅', traffic: 1.0,  demand: {} },
  rain:   { name: '下雨', icon: '🌧️', traffic: 0.8,  demand: { living: 2.5, oden: 1.4, soup: 1.4, instant: 1.3 }, umbrella: true },
  hot:    { name: '炎熱', icon: '🔥', traffic: 1.1,  demand: { drink: 2.0, dessert: 2.0, alcohol: 1.4, brew: 0.8, oden: 0.5, soup: 0.5, steam: 0.6 } },
  cold:   { name: '寒流', icon: '❄️', traffic: 0.9,  demand: { oden: 2.0, soup: 2.0, steam: 1.8, braise: 1.4, brew: 1.5, instant: 1.5, drink: 0.6, dessert: 0.5 } },
};
export const SEASONS = [
  { name: '春', w: { sunny: 4, cloudy: 3, rain: 3 } },
  { name: '夏', w: { sunny: 3, hot: 4, rain: 2, cloudy: 1 } },
  { name: '秋', w: { sunny: 4, cloudy: 4, rain: 1, cold: 1 } },
  { name: '冬', w: { cloudy: 3, cold: 4, rain: 2, sunny: 1 } },
];

export const EVENTS = [
  { id: 'sports', name: '附近學校運動會', news: '附近學校舉辦運動會，學生會特別多！', traffic: 1.25, typeBoost: { student: 3 }, demand: { drink: 1.8, snack: 1.3, fried: 1.3, stationery: 1.5 } },
  { id: 'concert', name: '演唱會散場', news: '體育館有演唱會，晚上散場人潮湧現！', traffic: 1.15, typeBoost: { night: 3 }, demand: { drink: 1.4, alcohol: 1.8, fried: 1.3, oden: 1.3 }, hours: [20, 21, 22, 23] },
  { id: 'typhoon', name: '颱風來襲', news: '颱風警報！大家搶購泡麵和飲料。', traffic: 0.75, typeBoost: { resident: 2 }, demand: { instant: 3, drink: 1.8, daily: 1.5, living: 1.5, grocery: 1.8, condiment: 1.5 } },
  { id: 'market', name: '早市活動', news: '巷口早市開張，早上長輩人潮多。', traffic: 1.15, typeBoost: { elder: 3 }, demand: { steam: 1.5, oden: 1.3, grocery: 1.5 }, hours: [6, 7, 8, 9, 10] },
  { id: 'sale', name: '競爭店大特價', news: '對街超市今天全面八折，客人可能被吸走…', traffic: 0.8, typeBoost: {}, demand: {}, competitor: true },
];

export const MISSIONS = [
  { id: 'firstSale', text: '賣出第一件商品', reward: 1000, check: s => s.stats.totalItems >= 1 },
  { id: 'rev5k', text: '單日營收達到 $5,000', reward: 2000, check: s => s.today.revenue >= 5000 },
  { id: 'hire', text: '再雇用一位員工', reward: 2000, check: s => s.staff.length >= 2 },
  { id: 'place', text: '購買並擺放一台新設備', reward: 1500, check: s => s.stats.placed >= 1 },
  { id: 'newCat', text: '引進一個新的商品類別', reward: 2000, check: s => (s.unlocked?.length || 0) > 10 },
  { id: 'rating4', text: '門市評價達到 4.0 星', reward: 5000, check: s => s.rating >= 4.0 && s.stats.totalCustomers >= 40 },
  { id: 'cust150', text: '單日顧客達到 150 人', reward: 5000, check: s => s.today.customers >= 150 },
  { id: 'regular5', text: '擁有 5 位常客', reward: 4000, check: s => s.regulars.length >= 5 },
  { id: 'expand2', text: '擴建店面為「社區門市」', reward: 8000, check: s => s.level >= 1 },
  { id: 'rev20k', text: '單日營收達到 $20,000', reward: 10000, check: s => s.today.revenue >= 20000 },
  { id: 'manager', text: '雇用一位店長（自動叫貨）', reward: 5000, check: s => s.staff.some(x => x.role === 'manager') },
  { id: 'expand3', text: '擴建店面為「大型門市」', reward: 20000, check: s => s.level >= 2 },
  { id: 'branch1', text: '開設第一間分店', reward: 30000, check: s => s.branches.length >= 1 },
  { id: 'expand4', text: '打造「旗艦店」', reward: 50000, check: s => s.level >= 3 },
  { id: 'branch5', text: '成為連鎖企業：擁有 5 間分店', reward: 100000, check: s => s.branches.length >= 5 },
];

export const SURNAMES = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高'.split('');
export const GIVEN = ['小明', '美玲', '志豪', '雅婷', '家豪', '怡君', '俊傑', '淑芬', '建宏', '佩珊', '宗翰', '欣怡', '冠宇', '詩涵', '承恩', '子晴', '阿伯', '阿姨', '柏翰', '思妤'];

export const THOUGHTS = {
  noStock: ['沒貨了…', '架上空空的', '想買的賣完了'],
  expensive: ['好貴喔…', '這價格不划算', '算了，不買了'],
  happy: ['買到了！', '這家店真方便', '今天也很順利', '店員好親切'],
  queue: ['排好久…', '快一點啦', '怎麼沒人結帳？'],
  dirty: ['地板好髒…'],
  regularHi: ['老闆早安！', '又來報到了～', '老樣子！', '今天天氣不錯呢'],
  eat: ['😋 好吃！', '開動了～', '🍙 先吃再走', '這個好香', '吃飽飽～'],
  rest: ['休息一下～', '腳好痠…', '在這裡吹冷氣真舒服', '等等再出門'],
  sneak: ['（偷偷放進口袋…）', '（四處張望…）', '（趁沒人注意…）'],
  sorry: ['對、對不起！', '我只是忘了結帳…', '嚇死我了…', '別報警拜託…'],
};
// 客人之間的閒聊（一問一答）
export const CHATS = [
  ['今天好熱喔～', '對啊，來買冰的！'], ['你也來買午餐？', '這家便當很好吃！'], ['下班了嗎？', '終於下班了…'],
  ['明天要考試…', '一起加油！'], ['這個新口味吃過嗎？', '還沒，買來試試！'], ['外面下好大的雨', '幸好這裡有賣傘'],
  ['最近好忙喔', '先喝杯咖啡吧'], ['好久不見！', '你最近好嗎？'], ['這家店好乾淨', '店員也很親切'],
  ['晚餐吃什麼？', '關東煮好了！'], ['要不要一起吃？', '好啊，坐那邊！'], ['你的貓還好嗎？', '胖了好多哈哈'],
];

export const ASSISTANT_TIPS = [
  '點兩下地板之外的空白處拖曳可以移動鏡頭，兩指可以旋轉和縮放喔！',
  '貨架空了顧客會失望，記得進貨，店員會自動補貨。',
  '排隊太久會降低滿意度，人多的時候多請一位店員吧！',
  '鮮食和熱食會過期，進貨量要抓剛好。按「一鍵補足」會依銷量分配。',
  '價格比市價低一點能讓顧客開心，但利潤會變少。',
  '滿意度高的客人可能變成常客，常客會一直回來光顧！',
  '下雨天雨傘和關東煮賣得特別好，炎熱天冰品和飲料大賣。',
  '在「商品」裡可以引進新的商品類別，像炸物、甜點、3C 配件，客群會更廣。',
  '客人說「沒有賣…嗎？」代表有需求，看看日報裡的「顧客想買」吧！',
  '雇用店長後，每天晚上會自動幫你叫貨。',
];

// AI 繪製的角色立繪（art/chars/<id>.webp），h = 遊戲中的高度
export const SPRITES = {
  staff_f: { h: 1.55 }, staff_m: { h: 1.6 }, manager: { h: 1.62 },
  student_f: { h: 1.45 }, student_m: { h: 1.5 },
  office_f: { h: 1.55 }, office_m: { h: 1.62 },
  resident_f: { h: 1.52 }, resident_m: { h: 1.58 },
  elder_f: { h: 1.4 }, elder_m: { h: 1.45 },
  night_f: { h: 1.52 }, night_m: { h: 1.6 },
};
export const TYPE_SPRITES = {
  student: ['student_f', 'student_m'], office: ['office_f', 'office_m'], resident: ['resident_f', 'resident_m'],
  elder: ['elder_f', 'elder_m'], night: ['night_f', 'night_m'],
};
