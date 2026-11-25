// 商品目錄：26 大類（依店長提供的清單），自動產生商品資料
// 每一行格式：'名稱=售價@外觀、名稱=售價…'，省略的欄位用該行預設值
// key 會成為商品 id 的前綴（例如 drink_3），之後請只在每行最後面新增，避免舊存檔對不上

const L = (names, price, opt = {}) => ({ names, price, ...opt });

// pop：整體受歡迎程度；aff：各客群偏好（學生、上班族、居民、長者、夜貓族）
// fix：可以擺在哪些設備；unlock：引進費用與需要的店面等級（start = 一開始就有）
export const CATALOG = {
  drink: {
    no: '01', name: '飲料', icon: '🥤', color: 0x3aa0ff, fix: ['fridge'], start: true, margin: 0.55, life: Infinity,
    pop: 3, aff: [3, 2, 2, 1, 3],
    lines: [
      L('礦泉水=20、純水=20、蒸餾水=22、鹼性水=29、氣泡水=35、風味氣泡水=39', 20, { shape: 'bottle', color: 0x9fd8ff }),
      L('無糖綠茶、微糖綠茶、茉莉綠茶、紅茶、奶茶=29、鮮奶茶=35@carton、烏龍茶、青茶、焙茶=29、麥茶、冬瓜茶、仙草茶', 25, { shape: 'bottle' }),
      L('美式咖啡=35、拿鐵=39、卡布奇諾=39、摩卡=39、焦糖瑪奇朵=45、黑咖啡=29、罐裝咖啡=25@can、瓶裝咖啡=35、即溶咖啡=15@smallbox、冷萃咖啡=49', 35, { shape: 'bottle' }),
      L('可樂、無糖可樂、檸檬汽水、沙士=25、萊姆汽水、蘋果汽水=25、葡萄汽水=25、橘子汽水=25、薑汁汽水=35', 29, { shape: 'can' }),
      L('柳橙汁、蘋果汁、葡萄汁、芭樂汁、番茄汁、蔓越莓汁=39、葡萄柚汁、檸檬汁、椰子水=45、綜合果汁', 35, { shape: 'bottle' }),
      L('鮮奶=45、保久乳=20、調味乳、巧克力牛奶、草莓牛奶、豆漿、黑豆漿=29、米漿、燕麥奶=39、杏仁奶=39', 25, { shape: 'carton' }),
      L('優酪乳=35、乳酸飲料=15、優格飲=39、運動飲料=30、電解質飲料=35、能量飲料=45@can、維他命飲料=35、機能飲料=45', 35, { shape: 'bottle' }),
    ],
  },
  brew: {
    no: '01', name: '現調飲品', icon: '☕', color: 0x8a5a3a, fix: ['coffee'], start: true, margin: 0.3, life: 4,
    pop: 2, aff: [0.6, 3, 1, 1, 1],
    lines: [
      L('熱可可=45、熱奶茶=40、熱紅茶=30、熱豆漿=30、熱薑茶=40、熱蜂蜜檸檬=45', 40, { shape: 'coffee' }),
      L('現調美式=45、現調拿鐵=55、現調卡布奇諾=55、現調冰沙=65、現調果汁=60', 50, { shape: 'coffee' }),
    ],
  },
  rice: {
    no: '02', name: '飯類米食', icon: '🍙', color: 0xf05a7a, fix: ['chiller'], start: true, margin: 0.55, life: 1,
    pop: 2.5, aff: [1.5, 3, 1.5, 1.5, 1],
    lines: [
      L('鮭魚飯糰=35、鮪魚飯糰=32、肉鬆飯糰=28、明太子飯糰=39、海苔飯糰=25、燒肉飯糰=35、雞肉飯糰=32、梅子飯糰=28、素食飯糰=28', 30, { shape: 'onigiri', life: 2 }),
      L('滷肉飯=69、雞肉飯=69、排骨飯=89、雞腿飯=99、控肉飯=99、炸雞飯=89、炸豬排飯=99、咖哩飯=79、牛肉燴飯=99、三杯雞飯=99', 89, { shape: 'bento' }),
      L('蛋炒飯=65、肉絲炒飯=75、蝦仁炒飯=85、泡菜炒飯=75、炒米粉=55、油飯=49、粽子=45@onigiri、米糕=45', 65, { shape: 'tray' }),
      L('親子丼、牛丼、豬排丼、日式咖哩丼、韓式拌飯、壽司便當=119@bento', 99, { shape: 'bowl' }),
      L('白飯=20、糙米飯、五穀飯、紫米飯', 25, { shape: 'bowl' }),
    ],
  },
  noodle: {
    no: '03', name: '麵食', icon: '🍝', color: 0xe8743b, fix: ['chiller'], unlock: [3000, 0], margin: 0.55, life: 1,
    pop: 1.3, aff: [1, 2, 1, 1, 1.5],
    lines: [
      L('紅燒牛肉麵、清燉牛肉麵、番茄牛肉麵、麻辣牛肉麵=125、豬肉麵=89、排骨麵=99', 119, { shape: 'bowl' }),
      L('肉燥麵=59、炸醬麵=65、麻醬麵=59、擔仔麵=65、乾拌麵=59', 59, { shape: 'bowl' }),
      L('義大利肉醬麵、奶油培根麵、青醬義大利麵、番茄義大利麵=85、焗烤義大利麵=99', 89, { shape: 'tray' }),
      L('烏龍麵=79、炒烏龍=79、蕎麥麵=69、鍋燒意麵=89、炒麵=59、涼麵=55', 69, { shape: 'tray' }),
      L('冬粉=55、酸辣粉=65、米粉湯=55、炒米粉=55@tray、粄條=65、河粉=69', 59, { shape: 'bowl' }),
      L('韓式炒麵=79@tray、韓式辣炒年糕=79@tray、日式拉麵=99、豚骨拉麵=109、醬油拉麵=99', 99, { shape: 'bowl' }),
    ],
  },
  sandwich: {
    no: '04', name: '輕食', icon: '🥪', color: 0x8bc34a, fix: ['chiller'], start: true, margin: 0.55, life: 2,
    pop: 1.5, aff: [1.5, 2.2, 1, 0.8, 1],
    lines: [
      L('火腿三明治=35、起司三明治=35、火腿蛋三明治=39、鮪魚三明治=39、雞蛋沙拉三明治=39', 39, { shape: 'sandwich' }),
      L('薯泥三明治=35、燒肉三明治=45、雞排三明治=49、培根三明治=45、可頌三明治=55', 45, { shape: 'sandwich' }),
      L('牛肉漢堡=69、雞肉漢堡=65、鮪魚堡=55、培根蛋堡=59、熱狗堡=45、起司熱狗堡=49', 59, { shape: 'burger' }),
      L('生菜沙拉=49、雞胸肉沙拉=79、雞肉沙拉=75、鮪魚沙拉=69、凱薩沙拉=75、馬鈴薯沙拉=45、蛋沙拉=45、水果沙拉=69', 59, { shape: 'bowl' }),
      L('雞胸肉=59、即食雞腿肉=69、即食蛋白質餐盒=109', 69, { shape: 'tray' }),
    ],
  },
  fried: {
    no: '05', name: '炸物', icon: '🍗', color: 0xd9902b, fix: ['hotcase'], unlock: [5000, 0], margin: 0.4, life: 1,
    pop: 1.6, aff: [2.5, 1, 1, 0.5, 2],
    lines: [
      L('炸雞腿=69、炸雞排=75、炸雞翅=35、炸雞塊=45、無骨鹽酥雞=55、雞米花=45', 49, { shape: 'fried' }),
      L('炸雞柳=45、炸雞軟骨=45、炸雞皮=39、炸雞胗=45', 45, { shape: 'fried' }),
      L('炸薯條=39@cup、薯餅=25、地瓜薯條=39@cup、洋蔥圈=39、炸馬鈴薯=35', 35, { shape: 'fried' }),
      L('炸甜不辣=30、炸黑輪=30、炸花枝丸=35、炸魚丸=30、炸蝦捲=45、炸春捲=35', 35, { shape: 'fried' }),
      L('炸起司球=39、炸可樂餅=35、炸芋頭丸=35、炸豆腐=30、炸豬排=69', 39, { shape: 'fried' }),
      L('炸熱狗=35@hotdog、炸香腸=35@hotdog、炸米血糕=30@stick、炸飯糰=35、炸麻糬=35', 35, { shape: 'fried' }),
    ],
  },
  grill: {
    no: '06', name: '烤物', icon: '🌭', color: 0xc0582b, fix: ['hotcase'], unlock: [4000, 0], margin: 0.4, life: 1,
    pop: 1.3, aff: [2, 1, 1, 0.6, 1.5],
    lines: [
      L('烤香腸=35、烤德國香腸=49、烤熱狗=35、烤糯米腸=39', 35, { shape: 'hotdog' }),
      L('烤雞腿=69@fried、烤雞翅=35@fried、烤雞排=75@fried、烤肉串=35、烤牛肉串=45、烤豬肉串=35', 45, { shape: 'stick' }),
      L('烤甜不辣=30@stick、烤米血糕=30@stick、烤玉米=45@corn、烤地瓜=39@fruit、烤馬鈴薯=39@fruit', 35),
      L('烤吐司=25、熱壓吐司=45@sandwich、烤可頌=35、烤披薩=59@tray、烤蒜香麵包=35', 35, { shape: 'bread' }),
      L('烤蛋塔=35@tart、烤菠蘿麵包=35@bun、烤起司麵包=39', 35, { shape: 'bread' }),
    ],
  },
  steam: {
    no: '07', name: '蒸食', icon: '🥟', color: 0xbca78a, fix: ['steamer'], unlock: [4000, 0], margin: 0.4, life: 1,
    pop: 1.3, aff: [1, 1.2, 1, 2.5, 0.8],
    lines: [
      L('原味肉包=30、香菇肉包=35、高麗菜包=28、菜包=25、蔥肉包=30', 30, { shape: 'bun' }),
      L('奶黃包、芝麻包、花生包、紅豆包、芋頭包、流沙包=30', 25, { shape: 'bun' }),
      L('小籠包=69@tray、燒賣=49@tray、水晶餃=49@tray、饅頭=15、黑糖饅頭=18', 25, { shape: 'bun' }),
      L('蒸地瓜、紫地瓜、蒸玉米=39@corn、糯玉米=39@corn、蒸馬鈴薯=30、蒸南瓜、蒸芋頭', 35, { shape: 'fruit' }),
      L('茶碗蒸=45、蒸蛋=35', 39, { shape: 'cup' }),
    ],
  },
  oden: {
    no: '08', name: '關東煮', icon: '🍢', color: 0xd9822b, fix: ['odenpot', 'hotcase'], start: true, margin: 0.35, life: 1,
    pop: 1.6, aff: [1.5, 1, 1, 2, 1.5],
    lines: [
      L('白蘿蔔、貢丸、香菇貢丸、花枝丸、魚丸=12、虱目魚丸、鱈魚丸、蝦丸=18', 15, { shape: 'skewer' }),
      L('魚豆腐、甜不辣、黑輪、米血糕、百頁豆腐、油豆腐=12、凍豆腐=12', 15, { shape: 'skewer' }),
      L('豆皮、魚板、蟹肉棒、竹輪、昆布=12、蒟蒻=12、蒟蒻絲=12', 15, { shape: 'skewer' }),
      L('玉米=25@corn、高麗菜捲=22、水晶餃=15、福袋=25、魚包蛋=22、鳥蛋=15', 20, { shape: 'skewer' }),
      L('茶葉蛋=13、滷蛋=15、溏心蛋=22', 15, { shape: 'egg', life: 2 }),
      L('烏龍麵=25、王子麵=15、冬粉=15', 15, { shape: 'cup' }),
    ],
  },
  braise: {
    no: '09', name: '滷味', icon: '🍖', color: 0x7a4a2a, fix: ['odenpot', 'hotcase'], unlock: [4000, 0], margin: 0.4, life: 2,
    pop: 1.1, aff: [0.6, 1, 1.2, 1.5, 2],
    lines: [
      L('滷雞腿=59、滷雞翅、滷雞爪、滷雞胗、滷雞心=30、滷雞肝=30', 35, { shape: 'braise' }),
      L('滷鴨翅=35、滷鴨舌=45、滷鴨胗=35', 35, { shape: 'braise' }),
      L('滷豬耳朵=45、滷豬腳=69、滷大腸=49', 49, { shape: 'braise' }),
      L('滷牛腱=69、滷牛肚=55、滷牛筋=59', 59, { shape: 'braise' }),
      L('滷蛋=15、茶葉蛋=13、滷鳥蛋=25', 15, { shape: 'egg' }),
      L('滷豆干=20、滷豆腐=20、滷百頁豆腐=25、滷海帶=15', 20, { shape: 'braise' }),
      L('滷蒟蒻=15、滷白蘿蔔=15、滷筍片=25、滷花生=30@cup、滷米血=20', 20, { shape: 'braise' }),
    ],
  },
  side: {
    no: '10', name: '小吃配菜', icon: '🥢', color: 0xa1887f, fix: ['hotcase', 'chiller'], unlock: [3000, 0], margin: 0.45, life: 2,
    pop: 1, aff: [0.8, 1, 1.5, 1.5, 1.2],
    lines: [
      L('茶葉蛋=13、滷蛋=15、溏心蛋=22、溫泉蛋=25', 15, { shape: 'egg' }),
      L('涼拌海帶、涼拌豆干、涼拌小黃瓜、涼拌木耳', 35, { shape: 'bowl' }),
      L('泡菜=45、韓式泡菜=59、毛豆=39、滷花生=35、滷筍絲=39', 45, { shape: 'bowl' }),
      L('馬鈴薯沙拉=45、蛋沙拉=45、涼拌豆腐=35', 45, { shape: 'bowl' }),
      L('蘿蔔糕=35、蛋餅=35、蔥油餅=30、蔥抓餅=35、鍋貼=59、水餃=59、煎餃=59', 45, { shape: 'tray' }),
      L('章魚燒=59@tray、雞蛋糕=45@tray、可樂餅=35@fried、咖哩魚蛋=49@cup、麻辣燙=79@bowl', 49),
    ],
  },
  soup: {
    no: '11', name: '湯品', icon: '🍲', color: 0xe0a050, fix: ['hotcase', 'odenpot'], unlock: [3000, 0], margin: 0.45, life: 1,
    pop: 1, aff: [0.8, 1, 1, 2, 1],
    lines: [
      L('玉米濃湯、南瓜濃湯、蘑菇濃湯', 39, { shape: 'cup' }),
      L('海帶湯=30、味噌湯=30、紫菜蛋花湯=30、酸辣湯=39', 30, { shape: 'cup' }),
      L('雞湯=69、香菇雞湯=79、排骨湯=69、蘿蔔湯=49', 69, { shape: 'cup' }),
      L('四神湯=55、肉骨茶=79、藥膳湯=79、麻油雞湯=89', 79, { shape: 'cup' }),
      L('八寶粥=35、皮蛋瘦肉粥=55、海鮮粥=65、雞蓉粥=55', 55, { shape: 'bowl' }),
    ],
  },
  instant: {
    no: '12', name: '泡麵沖泡', icon: '🍜', color: 0xff7a3a, fix: ['shelf'], start: true, margin: 0.6, life: Infinity,
    pop: 2, aff: [2, 0.8, 2, 1, 3],
    lines: [
      L('紅燒牛肉泡麵=45、麻辣牛肉泡麵=49、排骨雞泡麵=39、肉燥泡麵=29', 39, { shape: 'cup' }),
      L('海鮮泡麵、酸辣泡麵、韓式泡麵=45、日式豚骨泡麵=49', 39, { shape: 'cup' }),
      L('杯麵=35、碗麵=45、袋裝泡麵=25@bag、乾拌麵=49@tray', 35, { shape: 'cup' }),
      L('即溶咖啡=99、奶茶粉=89、可可粉=99、奶粉=199、麥片=89、燕麥片=99', 99, { shape: 'box' }),
      L('玉米濃湯粉=59、蘑菇濃湯粉=59、芝麻糊=79、薏仁粉=79、杏仁粉=89', 69, { shape: 'box' }),
    ],
  },
  bakery: {
    no: '13', name: '麵包烘焙', icon: '🍞', color: 0xd7a35a, fix: ['shelf'], start: true, margin: 0.55, life: 3,
    pop: 1.5, aff: [1.5, 1.5, 1.5, 1.5, 0.8],
    lines: [
      L('原味吐司=45、全麥吐司=55、厚片吐司=35、牛奶吐司=49、葡萄乾吐司=55', 45, { shape: 'loaf' }),
      L('菠蘿麵包、奶酥麵包、紅豆麵包、奶油麵包、巧克力麵包=35', 30, { shape: 'bun' }),
      L('芋頭麵包=35、克林姆麵包、肉鬆麵包=39、椰子麵包、花生麵包', 30, { shape: 'bun' }),
      L('火腿麵包、起司麵包=35、培根麵包、熱狗麵包、咖哩麵包', 39, { shape: 'bread' }),
      L('可頌=35@bread、貝果=39@donut、鬆餅=45@bread、甜甜圈=35@donut、蛋塔=35@tart、雞蛋糕=45@tray、肉桂捲=49@bun、瑪芬=39@tart', 39),
    ],
  },
  dessert: {
    no: '14', name: '甜點冰品', icon: '🍰', color: 0xf48fb1, fix: ['chiller', 'freezer'], unlock: [4000, 0], margin: 0.55, life: 3,
    pop: 1.3, aff: [2, 1.2, 1.2, 0.8, 1.2],
    lines: [
      L('起司蛋糕=69、巧克力蛋糕=69、草莓蛋糕=79、生乳蛋糕=79、瑞士捲=59@loaf、千層蛋糕=89', 69, { shape: 'cake' }),
      L('提拉米蘇=79@cake、布朗尼=49@cake、蜂蜜蛋糕=59@loaf、泡芙=45@bun、奶酪=39@cup、布丁=29@cup', 49),
      L('豆花=39、優格=35、希臘優格=49、果凍=25、蒟蒻凍=25、仙草凍=29', 35, { shape: 'cup' }),
      L('大福=35@bun、麻糬=39@bun、銅鑼燒=35@tart、紅豆湯=39@cup、芋圓甜品=49@cup', 39),
      L('香草冰淇淋=45、巧克力冰淇淋=45、草莓冰淇淋=45、抹茶冰淇淋=49', 45, { shape: 'cup', life: Infinity }),
      L('雪糕=35@bar、冰棒=25@icepop、甜筒=39@icecream、杯裝冰淇淋=45@cup、冰沙=39@cup', 35, { life: Infinity }),
    ],
  },
  snack: {
    no: '15', name: '零食糖果', icon: '🍪', color: 0xffc23a, fix: ['shelf'], start: true, margin: 0.6, life: Infinity,
    pop: 2.5, aff: [3, 1, 2, 0.8, 2],
    lines: [
      L('原味洋芋片、海苔洋芋片、起司洋芋片、BBQ 洋芋片', 39, { shape: 'bag' }),
      L('玉米棒=29、蝦味條=25、爆米花=39、米果=35、蘇打餅乾=29@box', 29, { shape: 'bag' }),
      L('巧克力餅乾=39、奶油餅乾=35、消化餅=39、夾心餅乾=29、威化餅乾=29', 35, { shape: 'box' }),
      L('牛奶巧克力、黑巧克力、白巧克力、杏仁巧克力=49、榛果巧克力=49', 45, { shape: 'bar' }),
      L('水果糖=25@bag、薄荷糖=35、喉糖=39、牛奶糖=25、軟糖=29@bag、QQ 糖=25@bag、棉花糖=35@bag', 29, { shape: 'smallbox' }),
      L('口香糖=29@smallbox、棒棒糖=10@stick、泡泡糖=15@smallbox', 20),
      L('豬肉乾=99、牛肉乾=129、肉鬆=99@jar、肉紙=89、魷魚絲=89、魷魚片=99、魚乾=79、魚酥=69', 89, { shape: 'bag' }),
      L('杏仁果=89、腰果=99、核桃=99、開心果=119、花生=49、南瓜子=69、綜合堅果=129、果乾=79', 89, { shape: 'bag' }),
    ],
  },
  dairy: {
    no: '16', name: '乳品冷藏', icon: '🧀', color: 0x90caf9, fix: ['fridge', 'chiller'], unlock: [3000, 0], margin: 0.65, life: 7,
    pop: 1, aff: [1, 0.8, 2, 1.5, 0.6],
    lines: [
      L('鮮乳=85@carton、保久乳=20@carton、調味乳=25@carton、優酪乳=35@bottle、優格=35@cup、起司片=79@box、起司條=59', 59, { shape: 'smallbox' }),
      L('奶油=89@smallbox、鮮奶油=99@carton、雞蛋=69@tray、豆腐=25@box、豆干=35@tray、豆皮=39@tray', 59),
      L('泡菜=59@jar、毛豆=45@bag、冷藏水餃=99@tray、冷藏包子=89@tray', 79),
      L('火腿片=59、培根=79、熱狗=69、香腸=79、即食雞胸肉=59', 69, { shape: 'tray' }),
    ],
  },
  grocery: {
    no: '17', name: '生鮮食材', icon: '🥬', color: 0x66bb6a, fix: ['chiller', 'freezer'], unlock: [8000, 1], margin: 0.7, life: 4,
    pop: 1, aff: [0.2, 0.5, 3, 2, 0.4],
    lines: [
      L('香蕉=35、蘋果=35、橘子=30、柳丁=30、芭樂=35、葡萄=99@tray、奇異果=39、火龍果=49', 35, { shape: 'fruit' }),
      L('小番茄=69、切片水果=59、綜合水果盒=79', 69, { shape: 'tray' }),
      L('生菜=39、高麗菜=59@fruit、青江菜=29、菠菜=35、玉米筍=39@tray、小黃瓜=29、胡蘿蔔=25、番茄=35@fruit', 35, { shape: 'veg', life: 3 }),
      L('雞胸肉=89、雞腿肉=99、雞翅=99、豬肉片=119、豬絞肉=99、牛肉片=159', 99, { shape: 'tray', life: 3 }),
      L('雞蛋=69@tray、豆腐=25@box、魚丸=79、貢丸=89、火鍋料=129、冷凍水餃=129、冷凍包子=119', 89, { shape: 'bag', life: 30 }),
      L('白米=199、糙米=219、冷凍蔬菜=79、冷凍肉品=159', 159, { shape: 'bag', life: Infinity }),
    ],
  },
  condiment: {
    no: '18', name: '調味罐頭', icon: '🧂', color: 0xbf8040, fix: ['shelf'], unlock: [2000, 0], margin: 0.65, life: Infinity,
    pop: 0.7, aff: [0.1, 0.3, 3, 1.5, 0.3],
    lines: [
      L('醬油=69、蠔油=79、醋=49、烏醋=55、沙茶醬=79、番茄醬=49、美乃滋=59', 59, { shape: 'jar' }),
      L('辣椒醬=59、豆瓣醬=59、蒜蓉醬=59、胡椒鹽=35、黑胡椒=45、白胡椒=45、食鹽=20@bag、砂糖=39@bag', 45, { shape: 'jar' }),
      L('食用油=149、橄欖油=249、麻油=129、香油=119、咖哩塊=79@box、高湯塊=49@box', 129, { shape: 'bottle' }),
      L('鮪魚罐頭=45、肉醬罐頭=39、玉米罐頭=35、鯖魚罐頭=45、沙丁魚罐頭=45', 45, { shape: 'tin' }),
      L('八寶粥=29@tin、花生麵筋=29@tin、義大利麵醬=99@jar、咖哩料理包=69@bag、牛肉料理包=79@bag', 59),
    ],
  },
  alcohol: {
    no: '19', name: '酒類', icon: '🍺', color: 0xf9a825, fix: ['fridge'], unlock: [8000, 1], margin: 0.7, life: Infinity, adult: true,
    pop: 1.2, aff: [0, 1.6, 1.5, 0.6, 3],
    lines: [
      L('啤酒=45、生啤酒=49、水果啤酒=45、小麥啤酒=59、黑啤酒=59', 49, { shape: 'can' }),
      L('沙瓦=49@can、水果調酒=49@can、氣泡調酒=49@can、葡萄酒=399、威士忌=899、白蘭地=799、清酒=399、梅酒=299', 399, { shape: 'wine' }),
    ],
  },
  tobacco: {
    no: '19', name: '菸品', icon: '🚬', color: 0x78909c, fix: ['tobacco'], unlock: [8000, 1], margin: 0.88, life: Infinity, adult: true,
    pop: 0.8, aff: [0, 1.2, 1, 1, 2],
    lines: [
      L('紙菸=125、打火機=25、火柴=10', 125, { shape: 'smallbox' }),
    ],
  },
  daily: {
    no: '20', name: '清潔日用', icon: '🧻', color: 0x7ad0a0, fix: ['shelf'], start: true, margin: 0.6, life: Infinity,
    pop: 1.5, aff: [0.6, 0.8, 3, 2, 1],
    lines: [
      L('衛生紙=129、面紙=49、抽取式衛生紙=79、廚房紙巾=69、濕紙巾=39@bag', 79, { shape: 'box' }),
      L('洗衣精=199@bottle、洗衣粉=149、洗衣膠囊=299、柔軟精=179@bottle、洗碗精=79@bottle、菜瓜布=35@smallbox、海綿=29@smallbox', 149, { shape: 'box' }),
      L('浴室清潔劑=129、馬桶清潔劑=99、玻璃清潔劑=99、地板清潔劑=129、垃圾袋=49@bag', 99, { shape: 'bottle' }),
      L('牙刷=39、牙膏=69、牙線=59@smallbox、牙線棒=49@smallbox、漱口水=119@bottle', 59, { shape: 'tallbox' }),
      L('洗髮精=199、潤髮乳=199、沐浴乳=179、肥皂=35@smallbox、洗面乳=149@tallbox、卸妝水=249', 199, { shape: 'bottle' }),
      L('化妝水=299@bottle、乳液=249@bottle、防曬乳=299、護手霜=129、護唇膏=99@stick、面膜=59@card', 199, { shape: 'tallbox' }),
      L('衛生棉=89@bag、護墊=79@bag、棉條=199、棉花棒=39@smallbox、刮鬍刀=99@tallbox、刮鬍泡=129@can', 99, { shape: 'box' }),
      L('口罩=49@box、OK 繃=39、紗布=35、酒精棉片=59、體溫計=199@tallbox、暖暖包=25@card', 49, { shape: 'smallbox' }),
    ],
  },
  tech: {
    no: '21', name: '3C配件', icon: '🔋', color: 0x546e7a, fix: ['shelf'], unlock: [5000, 0], margin: 0.55, life: Infinity,
    pop: 0.6, aff: [1.5, 1.5, 0.8, 0.3, 1.5],
    lines: [
      L('三號電池=79、四號電池=79、鈕扣電池=69、充電電池=299', 79, { shape: 'smallbox' }),
      L('行動電源=690@box、USB 充電器=390、快充充電器=590、車用充電器=390', 390, { shape: 'smallbox' }),
      L('Type-C 線=290、Lightning 線=390、Micro USB 線=250、USB 轉接頭=199', 290, { shape: 'tallbox' }),
      L('手機保護貼=299@card、手機殼=390@card、手機支架=199@tallbox、耳機=299、藍牙耳機=1290', 299, { shape: 'smallbox' }),
      L('藍牙喇叭=990@box、記憶卡=399@card、USB 隨身碟=299@card', 399),
    ],
  },
  stationery: {
    no: '22', name: '文具', icon: '✏️', color: 0x5c6bc0, fix: ['shelf'], unlock: [2000, 0], margin: 0.5, life: Infinity,
    pop: 0.6, aff: [3, 1, 0.6, 0.3, 0.3],
    lines: [
      L('原子筆=15@stick、鉛筆=10@stick、自動鉛筆=39@stick、鉛筆芯=29、橡皮擦=15', 20, { shape: 'smallbox' }),
      L('修正液=35@stick、修正帶=49、螢光筆=25@stick、奇異筆=29@stick、彩色筆=99@box', 35, { shape: 'smallbox' }),
      L('剪刀=59@tallbox、美工刀=35@tallbox、膠水=25@stick、膠帶=25、雙面膠=35', 35, { shape: 'smallbox' }),
      L('便利貼=39@smallbox、筆記本=45、記事本=35、信封=25、明信片=30', 35, { shape: 'card' }),
      L('資料夾=25@card、文件袋=15@card、迴紋針=25、長尾夾=35、訂書機=99、直尺=20@stick', 30, { shape: 'smallbox' }),
    ],
  },
  living: {
    no: '23', name: '生活旅行', icon: '☂️', color: 0x26a69a, fix: ['shelf'], start: true, margin: 0.55, life: Infinity,
    pop: 0.8, aff: [0.6, 1, 1.5, 1.2, 0.8],
    lines: [
      L('雨傘=129@umbrella、折疊傘=249@umbrella、雨衣=99、拖鞋=99、衣架=49@tallbox、塑膠袋=19', 99, { shape: 'bag' }),
      L('保鮮膜=59@tallbox、鋁箔紙=59@tallbox、保鮮盒=99@box、紙杯=39@cup、紙碗=49@cup、免洗筷=29@bag', 49),
      L('水壺=199@bottle、保溫瓶=499@bottle、餐盒=149@box、毛巾=99、浴巾=249、手帕=69@card', 149, { shape: 'bag' }),
      L('內褲=149、襪子=79、手套=99、帽子=199、圍巾=299', 149, { shape: 'bag' }),
      L('旅行盥洗組=149@box、行李束帶=129、行李吊牌=59@card、收納袋=79、耳塞=49@smallbox、眼罩=99@smallbox', 99, { shape: 'bag' }),
    ],
  },
  pet: {
    no: '24', name: '寵物用品', icon: '🐾', color: 0xff8a65, fix: ['shelf'], unlock: [5000, 1], margin: 0.6, life: Infinity,
    pop: 0.6, aff: [0.2, 0.6, 2, 1.5, 0.6],
    lines: [
      L('狗飼料=299@bag、貓飼料=299@bag、狗罐頭=45、貓罐頭=45', 45, { shape: 'tin' }),
      L('寵物肉泥=79@smallbox、寵物零食=99、潔牙骨=129', 99, { shape: 'bag' }),
      L('寵物尿布墊=249、寵物濕紙巾=79、拾便袋=59、貓砂=199', 149, { shape: 'bag' }),
      L('寵物玩具=149@box、寵物清潔用品=199@bottle', 149),
    ],
  },
  gift: {
    no: '25', name: '娛樂禮品', icon: '🎁', color: 0xab47bc, fix: ['shelf'], unlock: [6000, 1], margin: 0.6, life: Infinity,
    pop: 0.6, aff: [2, 0.8, 1, 0.5, 1.2],
    lines: [
      L('扭蛋=50@capsule、盲盒=299、公仔=399、玩具車=199、玩具模型=499', 299, { shape: 'box' }),
      L('集換式卡牌=150@card、貼紙包=49@card、角色周邊=299@box、拼圖=299@box、撲克牌=59@smallbox', 150),
      L('漫畫=120、小說=299、雜誌=120、兒童繪本=280、著色本=99', 150, { shape: 'book' }),
      L('玫瑰花=99、康乃馨=89、百合花=199', 99, { shape: 'flower', life: 4 }),
      L('盆栽=299、多肉植物=149', 199, { shape: 'pot' }),
      L('生日禮盒=599、巧克力禮盒=499、餅乾禮盒=399、茶葉禮盒=699', 499, { shape: 'box' }),
    ],
  },
  service: {
    no: '26', name: '服務票券', icon: '🎫', color: 0x29b6f6, fix: ['kiosk', 'atm'], unlock: [10000, 1], margin: 0.95, life: Infinity, service: true,
    pop: 1.4, aff: [1, 2, 2, 1.5, 1],
    lines: [
      L('遊戲點數卡=300、電信儲值卡=300、電子禮物卡=500、電影票=290、展覽票=350', 300, { at: 'kiosk' }),
      L('遊樂園票券=899、交通票券=199、演唱會票券=2800', 899, { at: 'kiosk' }),
      L('電費代收、水費代收、瓦斯費代收、電信費代收', 10, { at: 'kiosk', margin: 0.2 }),
      L('停車費代收、學費代收、稅款代收、信用卡帳單代收', 10, { at: 'kiosk', margin: 0.2 }),
      L('店到店寄件=60、包裹取貨=5、取貨付款=8、國內寄件=120', 60, { at: 'kiosk', margin: 0.7 }),
      L('影印=10、列印=15、傳真=30、掃描=10、證件照沖印=150', 15, { at: 'kiosk', margin: 0.3 }),
      L('ATM 提款=15、ATM 轉帳=15', 15, { at: 'atm', margin: 0.6 }),
      L('彩券投注=50、彩券兌獎=5', 50, { at: 'kiosk', margin: 0.92 }),
    ],
  },
};

// 依名稱猜商品顏色
const COLOR_WORDS = [
  ['抹茶', 0x8bc34a], ['綠茶', 0x7ccf6a], ['青茶', 0x9ccc65], ['奶茶', 0xd8b48a], ['紅茶', 0xa0522d], ['烏龍', 0xc08a3e], ['焙茶', 0x8d5a2b],
  ['麥茶', 0xc8a165], ['冬瓜', 0x8d6e63], ['仙草', 0x3e2723], ['摩卡', 0x6d4c41], ['焦糖', 0xd2a05a], ['拿鐵', 0xc8a27a], ['卡布', 0xc8a27a],
  ['可可', 0x6d4c41], ['咖啡', 0x3b2314], ['美式', 0x3b2314], ['無糖可樂', 0x37474f], ['可樂', 0x8b1a10], ['沙士', 0x4e2a1e], ['檸檬', 0xfff176],
  ['萊姆', 0x9ccc65], ['薑', 0xe6b85c], ['柳', 0xffa726], ['橘', 0xff9800], ['葡萄柚', 0xff8a65], ['蘋果', 0xe53935], ['葡萄', 0x7b1fa2],
  ['芭樂', 0xc5e1a5], ['番茄', 0xe53935], ['蔓越莓', 0xc2185b], ['椰子', 0xf5f0dc], ['巧克力', 0x5d4037], ['草莓', 0xf48fb1], ['黑豆', 0x424242],
  ['豆漿', 0xfff3d6], ['米漿', 0xe8d5b0], ['燕麥', 0xe0cda0], ['杏仁', 0xf0e0c0], ['鮮奶', 0xfafafa], ['牛奶', 0xfafafa], ['乳', 0xf5f9ff],
  ['優格', 0xfafafa], ['運動', 0x4a7dff], ['電解質', 0x4fc3f7], ['能量', 0x212121], ['維他命', 0xffca28], ['機能', 0xff7043],
  ['鮭魚', 0xff8a65], ['明太子', 0xff7043], ['海苔', 0x1b3a1b], ['咖哩', 0xe0a020], ['泡菜', 0xe53935], ['麻辣', 0xc62828], ['辣', 0xd32f2f],
  ['牛', 0x8d4a2a], ['蝦', 0xff7043], ['滷', 0x6d3b1e], ['炸', 0xd9902b], ['烤', 0xa0522d], ['雞蛋', 0xfff0c0], ['蛋', 0xfff0c0],
  ['豆腐', 0xfaf6ea], ['蘿蔔', 0xf5f5f5], ['玉米', 0xffd54f], ['紫', 0x7e57c2], ['地瓜', 0xef8f3a], ['南瓜', 0xffa000], ['芋', 0xb39ddb],
  ['紅豆', 0x8d3a3a], ['芝麻', 0x424242], ['花生', 0xd7a86e], ['奶黃', 0xffe082], ['流沙', 0xffca28], ['香蕉', 0xffeb3b], ['奇異果', 0x8d6e3a],
  ['火龍果', 0xe91e63], ['菠菜', 0x388e3c], ['青江', 0x66bb6a], ['生菜', 0x9ccc65], ['小黃瓜', 0x43a047], ['胡蘿蔔', 0xff7043],
  ['高麗菜', 0xc5e1a5], ['海帶', 0x2e5d32], ['昆布', 0x2e5d32], ['蒟蒻', 0x8d8d8d], ['豬', 0xd09070], ['雞', 0xe8b25a], ['鴨', 0xb5651d],
  ['啤酒', 0xf9a825], ['黑啤', 0x3e2723], ['威士忌', 0xa0522d], ['白蘭地', 0x8d4a2a], ['清酒', 0xe3f2fd], ['梅酒', 0xd4a017], ['葡萄酒', 0x6a1b3a],
  ['薄荷', 0x80cbc4], ['喉糖', 0x4db6ac], ['軟糖', 0xff6fb5], ['QQ', 0xff6fb5], ['棉花糖', 0xf8bbd0], ['水果糖', 0xff8a80],
  ['BBQ', 0xc0392b], ['起司', 0xffc107], ['海苔洋', 0x2e7d32], ['原味洋', 0xffd23a], ['蝦味', 0xff8a65], ['魷魚', 0xd7ccc8],
  ['醬油', 0x3e2723], ['蠔油', 0x4e342e], ['烏醋', 0x212121], ['醋', 0x8d6e63], ['沙茶', 0x8d4a2a], ['番茄醬', 0xd32f2f], ['美乃滋', 0xfff9c4],
  ['橄欖', 0x9e9d24], ['麻油', 0x8d5a2b], ['鹽', 0xeceff1], ['糖', 0xfafafa], ['鮪魚', 0x1e88e5], ['鯖魚', 0x1565c0], ['沙丁', 0x0277bd],
  ['衛生紙', 0xf2f2f2], ['面紙', 0x90caf9], ['洗衣', 0x42a5f5], ['柔軟', 0xce93d8], ['洗碗', 0x9ccc65], ['牙', 0x46c3c3], ['洗髮', 0x7e57c2],
  ['沐浴', 0x4dd0e1], ['口罩', 0x90caf9], ['電池', 0x333333], ['Type-C', 0x37474f], ['Lightning', 0xeeeeee], ['雨傘', 0xcfe8ff], ['折疊傘', 0x1565c0],
  ['狗', 0xa1887f], ['貓', 0xffb74d], ['玫瑰', 0xd81b60], ['康乃馨', 0xf06292], ['百合', 0xfafafa], ['多肉', 0x66bb6a], ['盆栽', 0x43a047],
];
function guessColor(name, fallback) {
  for (const [w, c] of COLOR_WORDS) if (name.includes(w)) return c;
  return fallback;
}

// 用名稱算出穩定的小變化（讓同一行商品看起來不完全一樣）
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

export const CATEGORIES = {};
export const PRODUCTS = [];
for (const [cat, C] of Object.entries(CATALOG)) {
  CATEGORIES[cat] = { name: C.name, icon: C.icon, color: C.color, no: C.no, fix: C.fix, start: !!C.start, unlock: C.unlock || [0, 0], adult: !!C.adult, service: !!C.service, pop: C.pop, aff: C.aff };
  let i = 0;
  const seen = new Set();
  for (const line of C.lines) {
    for (let item of line.names.split('、')) {
      item = item.trim(); if (!item) continue;
      const m = item.match(/^([^=@]+)(?:=(\d+))?(?:@(\w+))?$/);
      const name = m[1].trim();
      if (seen.has(name)) continue; // 同一類別內重複的商品只留一個
      seen.add(name);
      const ref = m[2] ? +m[2] : line.price;
      const shape = m[3] || line.shape || 'box';
      const margin = line.margin ?? C.margin;
      const life = line.life ?? C.life;
      const fallback = line.color ?? C.color;
      PRODUCTS.push({
        id: `${cat}_${i++}`, cat, name, ref,
        cost: Math.max(1, Math.round(ref * margin * (0.95 + hash(name) * 0.1))),
        life, shape, color: guessColor(name, fallback),
        ...(line.at ? { at: line.at } : {}),
        ...(/雨傘|折疊傘|雨衣/.test(name) ? { rain: true } : {}),
      });
    }
  }
}
export const PRODUCT = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export const CAT_PRODUCTS = {};
for (const p of PRODUCTS) (CAT_PRODUCTS[p.cat] = CAT_PRODUCTS[p.cat] || []).push(p);
// 各類平均售價（顧客預算用）
export const CAT_AVG = {};
for (const [c, ps] of Object.entries(CAT_PRODUCTS)) CAT_AVG[c] = ps.reduce((n, p) => n + p.ref, 0) / ps.length;

// 舊版（v0.3 以前）商品 id 對照
export const LEGACY_IDS = {
  water: ['drink', '礦泉水'], greentea: ['drink', '無糖綠茶'], soda: ['drink', '氣泡水'], milktea: ['drink', '鮮奶茶'], sports: ['drink', '運動飲料'],
  beefnd: ['instant', '紅燒牛肉泡麵'], ramen: ['instant', '日式豚骨泡麵'], yakisoba: ['instant', '乾拌麵'],
  chips: ['snack', '原味洋芋片'], choco: ['snack', '牛奶巧克力'], cookie: ['snack', '奶油餅乾'], gummy: ['snack', '軟糖'],
  tissue: ['daily', '抽取式衛生紙'], brush: ['daily', '牙刷'], battery: ['tech', '三號電池'], umbrella: ['living', '雨傘'],
  onigiri: ['rice', '鮪魚飯糰'], bento: ['rice', '排骨飯'], sandw: ['sandwich', '火腿三明治'],
  oden: ['oden', '白蘿蔔'], egg: ['oden', '茶葉蛋'], hotdog: ['grill', '烤熱狗'],
  americano: ['brew', '現調美式'], latte: ['brew', '現調拿鐵'],
};
export const LEGACY_CATS = { drink: 'drink', noodle: 'instant', snack: 'snack', daily: 'daily', fresh: 'rice', hot: 'oden', coffee: 'brew' };
export function findProduct(cat, name) { return PRODUCTS.find(p => p.cat === cat && p.name === name); }
