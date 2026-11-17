/* =========================================================
   明末杀 · 数据
   ========================================================= */
(function () {
  'use strict';

  const MMS = window.MMS = window.MMS || {};

  /* 版本规则：无新增武将 +0.01；新增武将 +0.1 且百分位归零。当前 Ver.0.90。 */
  MMS.VERSION = '0.90';
  MMS.VERSION_LABEL = 'Ver.' + MMS.VERSION;

  MMS.SUITS = {
    spade:   { key: 'spade',   name: '黑桃', symbol: '♠', color: 'black' },
    heart:   { key: 'heart',   name: '红桃', symbol: '♥', color: 'red' },
    club:    { key: 'club',    name: '梅花', symbol: '♣', color: 'black' },
    diamond: { key: 'diamond', name: '方块', symbol: '♦', color: 'red' }
  };

  MMS.RANK_LABEL = {
    A: 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', '10': '10', J: 'J', Q: 'Q', K: 'K'
  };

  MMS.CARD_KINDS = {
    sha: {
      name: '杀', type: 'basic', typeLabel: '基本牌', target: 'enemy',
      glyph: '刀', seal: '杀',
      desc: '出牌阶段，对一名其他角色使用。目标需打出一张【闪】，否则受到你造成的1点伤害。每回合限用一次。',
      flavor: '刀出无回。'
    },
    leisha: {
      name: '雷杀', type: 'basic', typeLabel: '基本牌', target: 'enemy', element: 'thunder',
      glyph: '雷', seal: '雷',
      desc: '雷属性【杀】。目标需打出【闪】，否则受到1点雷电伤害。计入每回合【杀】的使用次数。',
      flavor: '雷从刀上走。'
    },
    huosha: {
      name: '火杀', type: 'basic', typeLabel: '基本牌', target: 'enemy', element: 'fire',
      glyph: '火', seal: '火',
      desc: '火属性【杀】。目标需打出【闪】，否则受到1点火焰伤害；对藤甲目标伤害+1。',
      flavor: '刀锋过处，寸草不生。'
    },
    shan: {
      name: '闪', type: 'basic', typeLabel: '基本牌', target: 'none', responseOnly: true,
      glyph: '影', seal: '闪',
      desc: '当你成为【杀】的目标时，你可以打出【闪】，令此【杀】对你无效。',
      flavor: '避其锋芒。'
    },
    tao: {
      name: '桃', type: 'basic', typeLabel: '基本牌', target: 'self',
      glyph: '桃', seal: '桃',
      desc: '出牌阶段，回复1点体力；或当你处于濒死状态时，回复1点体力。体力已满时不能使用。',
      flavor: '乱世一口甜。'
    },
    jiu: {
      name: '酒', type: 'basic', typeLabel: '基本牌', target: 'self',
      glyph: '酒', seal: '酒',
      desc: '出牌阶段可多次使用，每层使本回合下一张【杀】伤害+1（可叠加）；或当你处于濒死状态时，回复1点体力。',
      flavor: '女儿红，埋得越久，越烈。'
    },
    wuzhong: {
      name: '无中生有', type: 'trick', typeLabel: '锦囊牌', target: 'self',
      glyph: '无', seal: '无',
      desc: '出牌阶段，摸两张牌。',
      flavor: '无中生有，有中还无。'
    },
    chaiqiao: {
      name: '过河拆桥', type: 'trick', typeLabel: '锦囊牌', target: 'enemy',
      glyph: '拆', seal: '拆',
      desc: '出牌阶段，选择并弃置对手一张未公开手牌，或拆掉其装备区的一张牌。',
      flavor: '桥断，路也断。'
    },
    shunshou: {
      name: '顺手牵羊', type: 'trick', typeLabel: '锦囊牌', target: 'enemy',
      glyph: '牵', seal: '牵',
      desc: '出牌阶段，选择并获得对手一张未公开手牌，或取走其装备区的一张牌。',
      flavor: '路过，顺手。'
    },
    juedou: {
      name: '决斗', type: 'trick', typeLabel: '锦囊牌', target: 'enemy',
      glyph: '决', seal: '决',
      desc: '出牌阶段，与对手轮流打出【杀】。由对手先打出。未打出【杀】的一方受到另一方造成的1点伤害。',
      flavor: '刀剑之下，见真章。'
    },
    nanman: {
      name: '南蛮入侵', type: 'trick', typeLabel: '锦囊牌', target: 'enemy',
      glyph: '蛮', seal: '蛮',
      desc: '出牌阶段，对手需打出一张【杀】，否则受到你造成的1点伤害。',
      flavor: '南中蛮兵，踏尘而来。'
    },
    wanjian: {
      name: '万箭齐发', type: 'trick', typeLabel: '锦囊牌', target: 'enemy',
      glyph: '箭', seal: '箭',
      desc: '出牌阶段，对手需打出一张【闪】，否则受到你造成的1点伤害。',
      flavor: '矢如雨下，无处可避。'
    },
    lebu: {
      name: '乐不思蜀', type: 'delayed', typeLabel: '延时锦囊', target: 'enemy',
      glyph: '乐', seal: '乐',
      desc: '出牌阶段，置于对手判定区。对手判定阶段进行判定：若结果不为红桃，跳过其出牌阶段。',
      flavor: '此间乐，不思蜀。'
    },
    bingliang: {
      name: '兵粮寸断', type: 'delayed', typeLabel: '延时锦囊', target: 'enemy',
      glyph: '粮', seal: '粮',
      desc: '出牌阶段，置于对手判定区。对手判定阶段进行判定：若结果不为梅花，跳过其摸牌阶段。',
      flavor: '粮尽，人心也尽。'
    },
    shandian: {
      name: '闪电', type: 'delayed', typeLabel: '延时锦囊', target: 'self',
      glyph: '電', seal: '電',
      desc: '出牌阶段，置于自己的判定区。判定：若为黑桃2~9，受到3点雷电伤害；否则移动到下一名角色的判定区。',
      flavor: '天雷无眼，落谁头上，谁认。'
    },
    wuxie: {
      name: '无懈可击', type: 'trick', typeLabel: '锦囊牌', target: 'none', responseOnly: true,
      glyph: '懈', seal: '懈',
      desc: '当一张锦囊牌生效前，你可以打出此牌抵消它；另一张【无懈可击】可以反制。',
      flavor: '一招落空，满盘皆活。'
    },
    liang_blade: {
      name: '良的朴刀', type: 'weapon', typeLabel: '武器牌', target: 'self', range: 2,
      glyph: '刀', seal: '刀',
      desc: '装备后，你使用【杀】造成伤害后，若目标没有手牌，你摸一张牌。攻击范围2。',
      flavor: '刀口舔过血，也切过饼。'
    },
    wangsheng_sword: {
      name: '王生的长剑', type: 'weapon', typeLabel: '武器牌', target: 'self', range: 2,
      glyph: '剑', seal: '剑',
      desc: '装备后，你每回合可以使用2张【杀】。攻击范围2。',
      flavor: '剑还在，城就还没破。'
    },
    yaobing_bow: {
      name: '妖兵的角弓', type: 'weapon', typeLabel: '武器牌', target: 'self', range: 3,
      glyph: '弓', seal: '弓',
      desc: '装备后，你使用【杀】时，摸一张牌。攻击范围3。',
      flavor: '弦响时，天还没亮。'
    },
    zhangba_spear: {
      name: '丈八蛇矛', type: 'weapon', typeLabel: '武器牌', target: 'self', range: 3,
      glyph: '矛', seal: '丈',
      desc: '装备后，你使用【杀】指定目标时，可弃置一张手牌，令此【杀】不能被【闪】响应。攻击范围3。',
      flavor: '矛出如蛇，见血方回。'
    },
    chitu: {
      name: '赤兔', type: 'mount', typeLabel: '坐骑牌', target: 'self', mountType: 'offense',
      glyph: '骑', seal: '赤',
      desc: '进攻坐骑：你计算与其他角色的距离-1。',
      flavor: '马作的卢飞快，弓如霹雳弦惊。'
    },
    zhuahuang: {
      name: '爪黄飞电', type: 'mount', typeLabel: '坐骑牌', target: 'self', mountType: 'defense',
      glyph: '骑', seal: '爪',
      desc: '防御坐骑：其他角色计算与你的距离+1。',
      flavor: '一骑绝尘，追者只见黄尘。'
    },
    dilu: {
      name: '的卢', type: 'mount', typeLabel: '坐骑牌', target: 'self', mountType: 'defense',
      glyph: '骑', seal: '的',
      desc: '防御坐骑：其他角色计算与你的距离+1。',
      flavor: '妨主之名，救主之实。'
    },
    jueying: {
      name: '绝影', type: 'mount', typeLabel: '坐骑牌', target: 'self', mountType: 'defense',
      glyph: '骑', seal: '绝',
      desc: '防御坐骑：其他角色计算与你的距离+1。',
      flavor: '影踪未至，人已远去。'
    },
    tengjia: {
      name: '藤甲', type: 'armor', typeLabel: '防具牌', target: 'self', armorType: 'tengjia',
      glyph: '甲', seal: '藤',
      desc: '锁定技：普通【杀】、【南蛮入侵】、【万箭齐发】对你无效；你受到火焰伤害时，伤害+1。',
      flavor: '藤浸桐油，刀箭难入，却怕一把火。'
    },
    buyi: {
      name: '布衣', type: 'armor', typeLabel: '防具牌', target: 'self', armorType: 'buyi',
      glyph: '衣', seal: '布',
      desc: '每回合首次受到伤害时，伤害-1；你的手牌上限+1。',
      flavor: '布衣蔬食，乱世里最不惹眼。'
    },
    bagua: {
      name: '八卦阵', type: 'armor', typeLabel: '防具牌', target: 'self', armorType: 'bagua',
      glyph: '卦', seal: '八',
      desc: '每回合限一次：当你需要使用【闪】且没有【闪】时，可判定；若为红色，视为打出【闪】。',
      flavor: '乾三连，坤六断，生死在阵中。'
    }
  };

  MMS.CARD_FLAVORS = {
    '杀': ['刀出无回。', '乱世里，先下手。', '一把刀，一条命。', '血溅三尺。'],
    '闪': ['避其锋芒。', '侧身，半步。', '活命靠的是腿脚。', '风过，人未倒。'],
    '桃': ['乱世一口甜。', '还有力气，就还能活。', '故乡的桃树，回不去了。', '咽下去，继续走。'],
    '酒': ['女儿红，埋得越久，越烈。', '喝完这一碗，再去杀人。', '酒里有火，也有故乡。', '醉着，才敢想起从前。'],
    '无中生有': ['无中生有，有中还无。', '纸上谈兵，也能救命。', '凭空摸出两条路。'],
    '过河拆桥': ['桥断，路也断。', '先断你的退路。', '这世道，谁也别想好过。'],
    '顺手牵羊': ['路过，顺手。', '你的，如今是我的。', '活下去，不寒碜。'],
    '决斗': ['刀剑之下，见真章。', '来啊，谁先眨眼？', '今日只活一个。'],
    '南蛮入侵': ['南中蛮兵，踏尘而来。', '马蹄声近了。', '躲不过的，就别躲。'],
    '万箭齐发': ['矢如雨下，无处可避。', '天黑了，箭也黑了。', '抬头，是满天的死。'],
    '乐不思蜀': ['此间乐，不思蜀。', '温柔乡，也是牢。', '睡吧，睡醒再说。'],
    '兵粮寸断': ['粮尽，人心也尽。', '锅冷了，刀还热。', '没有粮，就吃人。'],
    '无懈可击': ['一招落空，满盘皆活。', '你算得到刀，算不到人心。', '此计，不作数。'],
    '良的朴刀': ['刀口舔过血，也切过饼。', '良爷的刀，不问缘由。', '刀在，路就在。'],
    '王生的长剑': ['剑还在，城就还没破。', '一寸长，一寸生。', '读书人，也握得住剑。'],
    '妖兵的角弓': ['弦响时，天还没亮。', '箭从雾里来。', '妖兵不喊，只放箭。']
  };

  MMS.CARD_ART = {
    sha: 'assets/cards/sha.webp',
    shan: 'assets/cards/shan.webp',
    tao: 'assets/cards/tao.webp',
    jiu: 'assets/cards/jiu.webp',
    wuzhong: 'assets/cards/wuzhong.webp',
    chaiqiao: 'assets/cards/chaiqiao.webp',
    shunshou: 'assets/cards/shunshou.webp',
    juedou: 'assets/cards/juedou.webp',
    nanman: 'assets/cards/nanman.webp',
    wanjian: 'assets/cards/wanjian.webp',
    lebu: 'assets/cards/lebu.webp',
    bingliang: 'assets/cards/bingliang.webp',
    shandian: 'assets/cards/shandian.webp',
    wuxie: 'assets/cards/wuxie.webp',
    liang_blade: 'assets/cards/liang-blade.webp',
    wangsheng_sword: 'assets/cards/wangsheng-sword.webp',
    yaobing_bow: 'assets/cards/yaobing-bow.webp',
    zhangba_spear: 'assets/cards/zhangba-spear.webp',
    chitu: 'assets/cards/chitu.webp',
    zhuahuang: 'assets/cards/zhuahuang.webp',
    dilu: 'assets/cards/dilu.webp',
    jueying: 'assets/cards/jueying.webp',
    leisha: 'assets/cards/leisha.webp',
    huosha: 'assets/cards/huosha.webp',
    tengjia: 'assets/cards/tengjia.webp',
    buyi: 'assets/cards/buyi.webp',
    bagua: 'assets/cards/bagua.webp'
  };

  const DECK_SPEC = [
    // 杀 ×18
    ['sha', 'spade', '7'], ['sha', 'spade', '8'], ['sha', 'spade', '9'], ['sha', 'spade', '10'],
    ['sha', 'spade', 'J'], ['sha', 'club', '2'], ['sha', 'club', '3'], ['sha', 'club', '4'],
    ['sha', 'club', '5'], ['sha', 'club', '6'], ['sha', 'club', '8'], ['sha', 'club', '9'],
    ['sha', 'heart', '2'], ['sha', 'heart', '3'], ['sha', 'heart', '10'],
    ['sha', 'diamond', '7'], ['sha', 'diamond', '8'], ['sha', 'diamond', '9'],
    // 闪 ×14
    ['shan', 'heart', '4'], ['shan', 'heart', '5'], ['shan', 'heart', '6'], ['shan', 'heart', '7'],
    ['shan', 'heart', '8'], ['shan', 'heart', '9'], ['shan', 'heart', 'J'], ['shan', 'heart', 'Q'],
    ['shan', 'diamond', '4'], ['shan', 'diamond', '5'], ['shan', 'diamond', '6'],
    ['shan', 'diamond', '10'], ['shan', 'diamond', 'J'], ['shan', 'diamond', 'Q'],
    // 桃 ×6
    ['tao', 'heart', 'K'], ['tao', 'heart', 'A'], ['tao', 'diamond', 'K'],
    ['tao', 'diamond', 'A'], ['tao', 'diamond', '2'], ['tao', 'diamond', '3'],
    // 酒 ×3
    ['jiu', 'spade', '9'], ['jiu', 'club', '6'], ['jiu', 'heart', '10'],
    // 无中生有 ×4
    ['wuzhong', 'spade', '2'], ['wuzhong', 'club', '7'], ['wuzhong', 'heart', 'Q'], ['wuzhong', 'diamond', '10'],
    // 过河拆桥 ×3
    ['chaiqiao', 'spade', '3'], ['chaiqiao', 'club', 'Q'], ['chaiqiao', 'diamond', '7'],
    // 顺手牵羊 ×3
    ['shunshou', 'spade', '4'], ['shunshou', 'club', 'J'], ['shunshou', 'diamond', '8'],
    // 决斗 ×3
    ['juedou', 'spade', 'K'], ['juedou', 'club', '10'], ['juedou', 'diamond', '6'],
    // 南蛮入侵 ×2
    ['nanman', 'club', 'A'], ['nanman', 'spade', '6'],
    // 万箭齐发 ×2
    ['wanjian', 'heart', '9'], ['wanjian', 'diamond', 'K'],
    // 乐不思蜀 ×3
    ['lebu', 'spade', '5'], ['lebu', 'club', '5'], ['lebu', 'heart', '4'],
    // 兵粮寸断 ×2
    ['bingliang', 'spade', 'A'], ['bingliang', 'club', 'K'],
    // 闪电 ×2
    ['shandian', 'spade', '2'], ['shandian', 'heart', 'Q'],
    // 无懈可击 ×3
    ['wuxie', 'spade', '2'], ['wuxie', 'club', '8'], ['wuxie', 'heart', 'J'],
    // 武器 ×3
    ['liang_blade', 'spade', 'Q'], ['wangsheng_sword', 'club', '9'], ['yaobing_bow', 'diamond', '5'],
    ['zhangba_spear', 'spade', 'A']
  ];

  /* 酒意更浓：额外加入六张酒，提升摸到酒的概率。 */
  const WINE_SPEC = [
    ['jiu', 'spade', '4'], ['jiu', 'club', '9'], ['jiu', 'heart', '3'],
    ['jiu', 'diamond', '7'], ['jiu', 'spade', 'J'], ['jiu', 'heart', 'K']
  ];

  /* 属性杀：雷 / 火各四张。 */
  const ELEMENT_SPEC = [
    ['leisha', 'spade', '6'], ['leisha', 'club', '7'], ['leisha', 'spade', 'J'], ['leisha', 'diamond', 'Q'],
    ['huosha', 'heart', '6'], ['huosha', 'diamond', '6'], ['huosha', 'heart', '8'], ['huosha', 'club', '4']
  ];

  /* 防具：藤甲 / 布衣 / 八卦阵各两张。 */
  const ARMOR_SPEC = [
    ['tengjia', 'spade', '8'], ['tengjia', 'heart', '6'],
    ['buyi', 'club', '4'], ['buyi', 'diamond', '4'],
    ['bagua', 'spade', '6'], ['bagua', 'club', 'Q']
  ];

  /* 1V5 专属坐骑牌：进攻 / 防御各两张。 */
  const MOUNT_SPEC = [
    ['chitu', 'spade', 'K'],
    ['zhuahuang', 'club', '10'],
    ['dilu', 'heart', '5'],
    ['jueying', 'diamond', '9']
  ];

  let uidSeed = 0;
  MMS.buildDeck = function buildDeck(mode) {
    uidSeed = 0;
    const spec = DECK_SPEC.concat(DECK_SPEC, ELEMENT_SPEC, ARMOR_SPEC, WINE_SPEC, mode === '1v5' ? MOUNT_SPEC : []);
    return spec.map(function (entry) {
      const kind = MMS.CARD_KINDS[entry[0]];
      const suit = MMS.SUITS[entry[1]];
      const rank = entry[2];
      uidSeed += 1;
      return {
        uid: 'c' + uidSeed,
        kind: entry[0],
        name: kind.name,
        type: kind.type,
        typeLabel: kind.typeLabel,
        target: kind.target,
        element: kind.element || null,
        armorType: kind.armorType || null,
        responseOnly: !!kind.responseOnly,
        mountType: kind.mountType || null,
        range: kind.range || null,
        suit: suit.key,
        suitName: suit.name,
        suitSymbol: suit.symbol,
        color: suit.color,
        rank: rank,
        rankLabel: MMS.RANK_LABEL[rank] || rank,
        glyph: kind.glyph,
        seal: kind.seal,
        art: MMS.CARD_ART[entry[0]] || '',
        desc: kind.desc,
        flavor: (MMS.CARD_FLAVORS[kind.name] || [''])[uidSeed % 4]
      };
    });
  };

  MMS.SKILL_LIBRARY = {
    jijin: {
      name: '饥馑', type: '锁定技',
      desc: '你始终无法使用【无中生有】。',
      detail: '饿殍之年，连“无中生有”都是奢望。你不能使用锦囊牌【无中生有】。'
    },
    lieqiong: {
      name: '裂穹', type: '主动技',
      desc: '当你对其他角色造成伤害后，你可以击伤其一个部位：天冲（本回合已被击伤过才可选，令其失去当前体力值数点体力；因此死亡则你加1点体力上限）、力烽（随机弃一半手牌）、地机（下一次受到伤害+1）、中枢（下一张牌无效）、气海（不能使用或打出红桃牌直到其回合结束）。',
      detail: '仿神黄忠的裂穹：每次造成伤害后选择击伤部位。天冲只能在本回合已经击伤过该角色后选择；五个部位分别对应失去体力、弃牌、增伤、无效牌与封锁红桃。'
    },
    zhanjue: {
      name: '斩决', type: '主动技',
      desc: '出牌阶段开始时，选择一项：1.摸等同于当前体力值的牌，本阶段下一张【杀】无距离限制且不能被【闪】响应；2.摸等同于已损失体力值的牌，本阶段下一次造成伤害后回复等量体力。',
      detail: '仿神黄忠的斩决：以血换箭，或以伤养战。每回合出牌阶段开始时只能选择一项，选项可在出牌阶段开始前根据局势选择。'
    },
    bumie: {
      name: '不灭', type: '限定技',
      desc: '当你进入濒死状态时，将体力回复至2点，摸一张牌。每局限一次。',
      detail: '破界之穗不肯断。濒死时自动发动，回复至2点体力并摸一张牌；每局只能救你一次。'
    },
    suiyou: {
      name: '穗佑', type: '锁定技',
      desc: '每回合首次受到伤害时，防止此伤害，然后摸一张牌。',
      detail: '穗影护身。每回合第一次受到的伤害完全防止，并摸一张牌；回合结束后重新计数。'
    },
    jiuyou: {
      name: '旧游', type: '锁定技',
      desc: '出牌阶段，你使用的第一张牌结算前，摸一张牌。',
      detail: '王生与方知宥同年考中秀才，旧日同游二十四桥。每回合出牌阶段第一张牌结算前，摸一张牌。'
    },
    hujia: {
      name: '护家', type: '锁定技',
      desc: '每回合首次受到伤害时，伤害-1；你的手牌上限+1。',
      detail: '狮驼国屠城时，王生带着妻儿竭力求生。每回合第一次受到的伤害减少1点，手牌上限+1。'
    },
    gucheng: {
      name: '孤城', type: '主动技',
      desc: '准备阶段（判定阶段之前），你可以选择修改本回合出牌阶段规则：出牌无距离限制且【杀】次数无限制，所有牌无法被响应，但本回合至多使用 7-X 张牌（X为场上其他存活角色数；若X为偶数则X翻倍；至少1张）。',
      detail: '界限突破的良以孤城之势改写战场规则。X只计算场上其他存活角色：1V1时X=1，至多6张；1V2时X=2翻倍为4，至多3张；1V5时X=5，至多2张。选择不修改则正常出牌。'
    },
    sizhan: {
      name: '死战', type: '锁定技',
      desc: '当你造成伤害后，摸一张牌；若场上其他存活角色数不少于3，改为摸两张牌。',
      detail: '人越多，死战越凶。造成伤害后按场上其他存活角色数补牌，3人及以上时摸两张。'
    },
    dushi: {
      name: '督师', type: '锁定技',
      desc: '你的手牌上限+1。',
      detail: '史可法督师扬州，军政在手。手牌上限+1。'
    },
    shizhan: {
      name: '势斩', type: '锁定技',
      desc: '你使用【杀】无距离限制，且目标不能打出【闪】响应。',
      detail: '势魏延式的压迫：史可法督师亲战，扬州孤军不退。你的【杀】无视距离，且不能被【闪】响应。'
    },
    kuangu: {
      name: '狂骨', type: '锁定技',
      desc: '当你对其他角色造成伤害后，回复1点体力。',
      detail: '以战养战。每次对其他角色造成伤害后回复1点体力，伤势越重越要向前。'
    },
    sishou: {
      name: '死守', type: '锁定技',
      desc: '每回合首次受到伤害时，伤害-1。',
      detail: '城在人在。每回合第一次受到的伤害减少1点。'
    },
    xunguo: {
      name: '殉国', type: '限定技',
      desc: '当你进入濒死状态时，将体力回复至2点，摸一张牌。每局限一次。',
      detail: '城破之日，以死明志。濒死时回复至2点体力并摸一张牌，每局一次。'
    },
    hen_sui: {
      name: '满穗', type: '锁定技',
      desc: '每当你使用【杀】，获得1枚“恨”（至多3枚），然后摸一张牌。',
      detail: '穗即是恨，恨即是穗。你每使用一张【杀】，获得1枚“恨”，至多3枚，然后摸一张牌。'
    },
    cisha_a: {
      name: '刺殺', type: '触发技',
      desc: '你使用【杀】造成伤害后，可令目标弃置X张手牌（X为“恨”数）；若其手牌不足X，你摸一张牌。',
      detail: '刀锋带着积年的恨。你使用【杀】造成伤害后，可以令目标弃置等同于“恨”数量的手牌；若其手牌不足，你摸一张牌。'
    },
    danxiao: {
      name: '淡笑', type: '主动技',
      desc: '出牌阶段限一次，弃置两张同花色手牌：红色回复1点体力；黑色对对手造成1点伤害。',
      detail: '笑着把恨咽下去，或者吐出来。出牌阶段限一次，弃置两张同花色手牌；若为红色，回复1点体力；若为黑色，对对手造成1点伤害。'
    },
    wunai: {
      name: '无奈', type: '觉醒技',
      desc: '首次濒死时，回复2点体力，获得“新生”。',
      detail: '天要人死，人偏不死。你首次进入濒死状态时，回复2点体力，并获得技能“新生”。'
    },
    xinsheng: {
      name: '新生', type: '锁定技', dormant: true,
      desc: '你造成伤害后，回复1点体力。',
      detail: '从死人堆里爬出来的人，会把每一口气都攥紧。你造成伤害后，回复1点体力。'
    },
    jingshang: {
      name: '經商', type: '锁定技',
      desc: '你的手牌上限始终为4。',
      detail: '乱世里，账本比刀更沉。你的手牌上限固定为4，不受体力影响。'
    },
    cisha_b: {
      name: '刺殺', type: '主动触发',
      desc: '出牌阶段限一次，你使用【杀】时进行判定：若结果不为红桃，选择回复1点体力、体力上限+1（至多8）或此【杀】伤害+1。',
      detail: '每一次出手，都是一次赌命。出牌阶段限一次，你使用【杀】时进行判定；若结果不为红桃，你选择一项：回复1点体力；增加1点体力上限（至多8点）；此【杀】造成的伤害+1。'
    },
    gongsheng: {
      name: '共生', type: '锁定技',
      desc: '每回合限一次，受到伤害时，可防止此伤害，改为失去1点体力上限（至少保留1点），获得1枚“穗”。',
      detail: '把命分给穗，也把穗留给自己。每回合限一次，当你受到伤害时，你可以防止此伤害，改为失去1点体力上限（至少保留1点体力上限），然后获得1枚“穗”。'
    },
    sui_mansui: {
      name: '滿穗', type: '锁定技',
      desc: '体力上限不大于2时，你可以将1枚“穗”当【杀】、【闪】或【桃】使用或打出。',
      detail: '穗子，是粮食，也是命。当你的体力上限不大于2时，你可以消耗1枚“穗”，将其当作【杀】使用、当作【闪】打出，或在出牌阶段/濒死时当作【桃】使用。'
    },
    cisha_c: {
      name: '刺殺', type: '锁定技',
      desc: '每当你使用【杀】，获得1枚“穗”（至多3枚）。出牌阶段限一次，当你使用【杀】造成伤害时，可弃1枚“穗”，令伤害+1。',
      detail: '这一刀，替两个人砍。你每使用一张【杀】，获得1枚“穗”（至多3枚）。出牌阶段限一次，当你使用【杀】造成伤害时，你可以弃1枚“穗”，令此伤害+1。'
    },
    gongsi: {
      name: '共死', type: '觉醒技',
      desc: '首次濒死时，失去1点体力上限，回复至1点体力，获得“殊死”。',
      detail: '愿死亡也无法将我们分别。你首次进入濒死状态时，失去1点体力上限（至少保留1点），将体力回复至1点，并获得技能“殊死”。'
    },
    zhusi: {
      name: '殊死', type: '锁定技', dormant: true,
      desc: '觉醒后，摸牌阶段多摸1张，每回合可以使用2张【杀】。',
      detail: '既然已经死过一次，就不再怕死。觉醒后，你的摸牌阶段多摸1张牌，且每回合可以使用2张【杀】。'
    },
    boming: {
      name: '搏命', type: '锁定技', dormant: true,
      desc: '觉醒后，当你濒死时，若你有至少2枚“穗”，可消耗2枚“穗”，将体力回复至2点（每回合限一次）。',
      detail: '命是可以拿来换的。觉醒后，当你进入濒死状态时，若你有至少2枚“穗”，你可以消耗2枚“穗”，将体力回复至2点。每回合限一次。'
    },
    qianli: {
      name: '千里行', type: '锁定技',
      desc: '摸牌阶段多摸1张牌；你的手牌上限-1。',
      detail: '从华州到洛阳，千里路，都是拿命走出来的。你的摸牌阶段多摸1张牌，但手牌上限-1。'
    },
    xiagu: {
      name: '侠骨', type: '锁定技',
      desc: '每当你受到伤害后，弃置伤害来源一张手牌。',
      detail: '刀可以砍进骨头，砍不弯骨头。你每受到伤害后，弃置伤害来源一张手牌。'
    },
    shuzui: {
      name: '赎罪', type: '觉醒技',
      desc: '首次濒死时，回复2点体力；失去“千里行”，获得“护穗”。',
      detail: '活下来的人，要替死掉的人记住。你首次进入濒死状态时，回复2点体力，失去技能“千里行”，并获得技能“护穗”。'
    },
    husui: {
      name: '护穗', type: '锁定技', dormant: true,
      desc: '你使用【杀】造成伤害后，回复1点体力。',
      detail: '这一次，不再让她死在前面。你使用【杀】造成伤害后，回复1点体力。'
    },
    zhushu: {
      name: '著书', type: '主动技',
      desc: '出牌阶段限一次：弃1枚“忆”摸两张牌；或弃2枚“忆”回复1点体力。',
      detail: '书里什么都写得下，唯独写不下一个活人。出牌阶段限一次，你可以弃1枚“忆”摸两张牌，或弃2枚“忆”回复1点体力。'
    },
    shoushi: {
      name: '兽视', type: '锁定技',
      desc: '你每受到1点伤害，获得1枚“忆”；你造成伤害后，获得1枚“忆”（至多4枚）。',
      detail: '满城的人，都长着兽的脸。你每受到1点伤害，获得1枚“忆”；你造成伤害后，获得1枚“忆”。“忆”至多4枚。'
    },
    fengzheng: {
      name: '疯症', type: '觉醒技',
      desc: '当“忆”达到4枚时，失去1点体力上限，摸两张牌，获得“狮驼”。',
      detail: '疯病不是病，是这世道唯一的清醒。当你的“忆”达到4枚时，失去1点体力上限（至少保留1点体力上限），摸两张牌，并获得技能“狮驼”。'
    },
    shituo: {
      name: '狮驼', type: '主动技', dormant: true,
      desc: '出牌阶段限一次，弃2枚“忆”，对对手造成1点伤害。',
      detail: '他写下的狮驼国，终于从纸上爬了出来。出牌阶段限一次，弃2枚“忆”，对对手造成1点伤害。'
    },
    qinxin: {
      name: '琴心', type: '锁定技',
      desc: '每回合限一次，你使用锦囊牌后，摸一张牌。',
      detail: '弦上有人间。每回合限一次，你使用一张锦囊牌后，摸一张牌。'
    },
    lianying: {
      name: '怜影', type: '触发技',
      desc: '每回合限一次，当你成为【杀】的目标时，若你有手牌，可弃1张手牌，令此【杀】对你无效。',
      detail: '她见过太多刀，也躲过太多刀。每回合限一次，当你成为【杀】的目标时，若你有手牌，你可以弃置1张手牌，令此【杀】对你无效。'
    },
    yanshi: {
      name: '烟逝', type: '限定技',
      desc: '首次濒死时，翻开牌堆顶牌；若为红色，回复2点体力并摸一张牌，然后失去此技能。',
      detail: '二十四桥的月亮，还在么？你首次进入濒死状态时，翻开牌堆顶一张牌；若为红色，回复2点体力并摸一张牌，然后失去技能“烟逝”。'
    },
    yanxing: {
      name: '雁行', type: '主动技',
      desc: '你可以将红色手牌当【闪】打出；出牌阶段限一次，你可以将一张黑色手牌当【杀】使用。',
      detail: '雁子排成行，才能飞过冬天。你可以将红色手牌当【闪】打出；出牌阶段限一次，你可以将一张黑色手牌当【杀】使用。'
    },
    chuangwang: {
      name: '闯王',
      type: '主动技',
      desc: '出牌阶段限一次，你打出的牌无法被响应且结算效果翻倍。',
      detail: '出牌阶段限一次。发动后，你本回合打出的下一张牌无法被响应，且其伤害、回复、摸牌、弃置或获得牌数等效果翻倍；延时锦囊的生效延长一回合，武器效果翻倍。'
    },
    xijuan: {
      name: '席卷',
      type: '锁定技',
      desc: '你每使用一张牌后，摸一张牌；每回合限两次。',
      detail: '饥民如潮，席卷千里。你每使用一张牌后摸一张牌，每回合最多触发两次。'
    },
    baizhan: {
      name: '百战',
      type: '锁定技',
      desc: '每回合限一次，当你受到伤害后，若你的体力值不大于2，回复1点体力。',
      detail: '从尸山血海里爬出来的人，没那么容易死。每回合限一次，当你受到伤害后，若体力值不大于2，回复1点体力。'
    },
    qiaoshe: {
      name: '巧舌',
      type: '主动技',
      desc: '出牌阶段限一次，弃置一张手牌，摸两张牌；若弃置的是黑色牌，令一名对手随机弃置一张手牌。',
      detail: '舌头负责动嘴，良负责动手。出牌阶段限一次，弃一张手牌摸两张；若弃牌为黑色，再令一名对手随机弃一张手牌。'
    },
    youhua: {
      name: '油滑',
      type: '触发技',
      desc: '每回合限一次，当你成为【杀】的目标时，你可以弃置一张手牌，令此【杀】对你无效。',
      detail: '话是软的，命是滑的。每回合限一次，当你成为【杀】的目标时，弃一张手牌，令此【杀】无效。'
    },
    jingui: {
      name: '矜贵',
      type: '锁定技',
      desc: '每回合限一次，当你受到伤害时，防止其中1点伤害。',
      detail: '官家出身，皮肉比旁人金贵些。每回合第一次受到伤害时，防止其中1点。'
    },
    shishu: {
      name: '诗书',
      type: '主动技',
      desc: '出牌阶段限一次，摸两张牌，然后弃置一张手牌。',
      detail: '读过书的人，总能在绝境里多找一个字。出牌阶段限一次，摸两张牌，再弃一张手牌。'
    },
    lashou: {
      name: '辣手',
      type: '锁定技',
      desc: '你使用【杀】造成伤害后，摸一张牌；若目标手牌数大于你，改为摸两张牌。',
      detail: '陕北的丫头，手比刀子还辣。你使用【杀】造成伤害后摸一张牌；若目标手牌比你多，改为摸两张。'
    },
    humei: {
      name: '护妹',
      type: '锁定技',
      desc: '每回合限一次，当你受到伤害后，若你的手牌数小于体力值，摸一张牌。',
      detail: '翠儿还在身后，红儿不能倒。每回合限一次，受到伤害后若手牌数小于体力值，摸一张牌。'
    },
    caiwei: {
      name: '采薇',
      type: '主动技',
      desc: '出牌阶段限一次，摸一张牌；若此牌为红色，回复1点体力。',
      detail: '野菜、野果、野花，能吃的都采。出牌阶段限一次，摸一张牌；若为红色，回复1点体力。'
    },
    yiwei: {
      name: '依偎',
      type: '锁定技',
      desc: '每回合限一次，当你受到伤害后，摸一张牌。',
      detail: '姐姐在，翠儿就不怕。每回合限一次，受到伤害后摸一张牌。'
    },
    zhaoying: {
      name: '照影',
      type: '锁定技',
      desc: '每回合限一次，当你成为【杀】的目标时，摸一张牌。',
      detail: '水里有影，影里有人。每回合限一次，成为【杀】的目标时摸一张牌。'
    },
    xinlan: {
      name: '心兰',
      type: '主动技',
      desc: '出牌阶段限一次，弃置一张手牌，回复1点体力并摸一张牌。',
      detail: '心字成兰，开在废墟里。出牌阶段限一次，弃一张手牌，回复1点体力并摸一张牌。'
    },
    fengchang: {
      name: '逢场', type: '锁定技',
      desc: '每回合限一次，当你成为【杀】或锦囊牌的目标时，摸一张牌。',
      detail: '二十四桥的客人，哪一个不是逢场作戏。每回合限一次，当你成为【杀】或锦囊牌的目标时，你摸一张牌。'
    },
    hongguan: {
      name: '红倌', type: '主动技',
      desc: '出牌阶段限一次，弃置一张手牌，令对手选择：交给你一张手牌，或受到1点伤害。',
      detail: '红倌人卖笑，也卖消息。出牌阶段限一次，你弃置一张手牌，令对手选择一项：交给你一张手牌；或受到1点伤害。'
    },
    canhong: {
      name: '残红', type: '限定技',
      desc: '首次濒死时，弃置所有红色手牌，回复2点体力并摸一张牌；若没有红色手牌，改为回复1点体力。',
      detail: '残红落在泥里，也还是红的。你首次进入濒死状态时，弃置所有红色手牌；若以此法弃置了红色牌，你回复2点体力并摸一张牌；若没有弃置红色牌，你回复1点体力。'
    },
    qiusheng: {
      name: '求生', type: '锁定技',
      desc: '每当你受到伤害后，摸一张牌；若你的体力为1，改为摸两张牌。',
      detail: '小孩子也有活下去的法子。你每受到伤害后摸一张牌；若你的体力为1，改为摸两张牌。'
    },
    tongyan: {
      name: '童言', type: '锁定技',
      desc: '你的手牌上限+1。',
      detail: '童言无忌，也最容易被原谅。你的手牌上限+1。'
    },
    pengcheng: {
      name: '鹏程', type: '锁定技',
      desc: '你计算与其他角色的距离-1。',
      detail: '扶摇直上九万里。计算你与其他角色的距离时-1。'
    },
    tunri: {
      name: '吞日', type: '主动技',
      desc: '出牌阶段限一次，弃置一张手牌，对攻击范围内一名角色造成1点伤害；若其体力值不大于你，你摸一张牌。',
      detail: '金翅张开，连日光也能吞下。出牌阶段限一次，弃一张手牌，对攻击范围内一名角色造成1点伤害；若其体力值不大于你，你摸一张牌。'
    },
    tanshi: {
      name: '贪食', type: '锁定技',
      desc: '每回合限一次，你使用【杀】造成伤害后，摸一张牌。',
      detail: '千年修行，口腹之欲最难填。每回合限一次，你使用【杀】造成伤害后摸一张牌。'
    },
    niyu: {
      name: '泥淤', type: '锁定技',
      desc: '其他角色计算与你的距离+1。',
      detail: '福王府后园的泥沼，越挣扎越深。其他角色计算与你的距离+1。'
    },
    fengdao: {
      name: '封刀', type: '锁定技',
      desc: '你不能使用或打出【杀】；你的【酒】增加的伤害可以附加在你使用的伤害类锦囊牌上。',
      detail: '刀已封，酒未冷。你无法使用或打出【杀】；你饮用【酒】获得的伤害加成，可以附加在【决斗】【南蛮入侵】【万箭齐发】等伤害类锦囊上。'
    },
    yusui: {
      name: '遇穗', type: '主动技',
      desc: '摸牌阶段开始前，你可以跳过此阶段，改为展示牌堆顶一张牌，猜测下一张牌点数大于或小于此牌，然后展示之。若猜对，你增加1点体力上限（不超过10）或回复1点体力，并可重复此流程；最后获得所有以此法展示的牌。',
      detail: '穗落谁手，天意难测。摸牌阶段开始前，你可以跳过摸牌，改为连续猜牌：猜对则体力上限+1（最多10）或回复1点体力，并可继续，猜错即止；结束时获得所有展示过的牌。'
    },
    choushi: {
      name: '仇视', type: '触发技',
      desc: '每回合限一次，当你造成伤害后，你可以将手牌摸至与体力值相同，或将体力回复至与手牌数相同。',
      detail: '她记得每一笔债。造成伤害后，你可以把手牌补到与体力相同，或把体力回复到与手牌数相同。觉醒后背水会令此技能可在受伤后发动。'
    },
    suimen: {
      name: '穗门', type: '觉醒技',
      desc: '每个回合结束时，若你的手牌数与体力值相差3或更多，你减1点体力上限，获得【背水】，然后【仇视】在自己回合可发动两次。',
      detail: '穗门一开，旧账俱来。回合结束时若手牌与体力相差3以上，失去1点体力上限，获得【背水】，并使【仇视】在自己回合的发动次数变为两次。'
    },
    beishui: {
      name: '背水', type: '觉醒技', dormant: true,
      desc: '准备阶段，若你的手牌数或体力值小于2，你减1点体力上限，获得【清剿】，然后【仇视】可在受到伤害后发动。',
      detail: '背水一战，不留退路。准备阶段若手牌或体力少于2，失去1点体力上限，获得【清剿】，并使【仇视】可在受到伤害后发动。'
    },
    qingjiao: {
      name: '清剿', type: '主动技', dormant: true,
      desc: '出牌阶段开始时，你可以弃置所有手牌，从牌堆或弃牌堆随机获得8张牌名与副类别各不相同的牌。若如此做，结束阶段弃置所有手牌。',
      detail: '清剿是一场豪赌。出牌阶段开始时弃光手牌，随机获得8张牌名和类别都不同的牌；代价是结束阶段弃置所有手牌。'
    },
    neishang: {
      name: '内伤', type: '锁定技',
      desc: '你的初始手牌为2。',
      detail: '旧伤在身，起手便少两张牌。你的初始手牌为2。'
    },
    suimie: {
      name: '穗亡', type: '限定技',
      desc: '当你首次死亡时，回复4点体力，废除【仇视】，并将【封刀】修改为：锁定技，出牌阶段你使用【杀】和【酒】没有次数限制，除【杀】外的所有基本牌均视为【杀】，锦囊牌均视为【酒】或【过河拆桥】。',
      detail: '穗死，刀才开。首次死亡时回复4点体力，只废除仇视；封刀改写为：出牌阶段杀酒不限次数，除杀外的基本牌视为杀，锦囊牌可选择视为酒或过河拆桥。'
    },
    shishu_mo: {
      name: '诗书', type: '主动技',
      desc: '游戏开始时获得2枚“墨”，你的回合结束时补充1枚“墨”。你失去“墨”时可以摸一张牌。出牌阶段，你可以消耗1枚“墨”，将一名角色的一张牌置于你的【简牍区】；这些牌在你的回合结束后归还，但你可以永久查看。',
      detail: '以墨写人，以简牍藏人。开始时获得2枚墨，回合结束时补1枚墨；每失去1枚墨可摸1张牌。花1枚墨，把任意角色的一张牌收进简牍区；自己的回合结束时归还原主，除非被断更永久留下。'
    },
    shiren: {
      name: '诗人', type: '锁定技',
      desc: '若你的【简牍区】至少有2张牌，你不能成为【杀】和单体锦囊牌的目标。',
      detail: '诗成之后，刀笔难近。简牍区达到2张时，【杀】和单体锦囊不能指定你。'
    },
    duangeng: {
      name: '断更', type: '主动技',
      desc: '出牌阶段，你可以弃置全部“墨”，跳过你接下来的一个出牌阶段；本回合【简牍区】里的牌永久保留，不再随回合结束归还。',
      detail: '断更不是停笔，是把这一页撕下来。弃光墨，跳过下一个出牌阶段，换取简牍区永久保留。'
    },
    shenfa: {
      name: '神罚', type: '主动技',
      desc: '出牌阶段限一次，移出【简牍区】一张牌，选择一名角色：造成1点伤害，或令其流失1点体力。若累计移出至少4张，下次神罚可改为令其直接死亡。',
      detail: '简牍上的名字，也是生死簿。移出一张简牍，降下1点伤害或1点体力流失；累计移出4张后，下一次神罚可以直接抹去一名角色。'
    },
    shenci: {
      name: '神赐', type: '觉醒技',
      desc: '准备阶段，若你的【简牍区】至少有4张牌，你获得【成神】。',
      detail: '简牍满四，神自己会来翻页。准备阶段若简牍区有4张牌，觉醒获得成神。'
    },
    chengshen: {
      name: '成神', type: '主动技', dormant: true,
      desc: '出牌阶段限一次：获得2枚“墨”，且【神罚】不再消耗【简牍区】的牌。',
      detail: '成神之后，神罚不再需要献上简牍。出牌阶段限一次，获得2枚墨，并令神罚不再消耗简牍区的牌。'
    },
    suxu: {
      name: '穗叙', type: '主动技',
      desc: '开局获得3枚“叙”。可移除1枚，将一名角色的一张牌移入叙事区（回合结束归还），然后摸1张牌或令其本回合不能打出【闪】。每有一名角色阵亡，获得1枚“叙”。',
      detail: '叙事标记是稻穗上的结。花1枚叙收走一张牌，选择补牌或封闪；有人死去，穗上再结一枚。归程后不再消耗叙。'
    },
    tujin: {
      name: '途馑', type: '锁定技',
      desc: '所有角色的牌堆与弃牌堆合并为【荒仓】。所有摸牌从荒仓获取；荒仓为空时，每个回合开始所有角色流失1点体力。',
      detail: '荒仓一开，所有人的粮都在一处。摸牌只从荒仓取；荒仓见底后，每回合开始所有存活角色流失1点体力。'
    },
    tonglu: {
      name: '同路', type: '主动技',
      desc: '每回合限一次，绑定一名其他角色直到你的下回合。绑定敌方：其获得【饥】，每打出一张牌须交给你一张手牌。',
      detail: '同路不同命。每回合限一次绑定一名敌人，令其饥饿；他每打出一张牌，就要交给你一张手牌。'
    },
    chahua: {
      name: '茶话', type: '触发技',
      desc: '回合结束时，若本回合有角色阵亡，你可以选择一名存活角色，将其体力、手牌与装备重置为本回合开始时的状态，然后摸2张牌。归程后可回溯上一回合。',
      detail: '茶还没凉，时辰却能倒回去。本回合有人阵亡时，回合结束可回溯一名存活角色到回合开始，再摸两张牌。'
    },
    tizai: {
      name: '替灾', type: '限定技',
      desc: '出牌阶段发动，选定一名其他角色为锚点，直到你的下回合结束：你受到的伤害与回复转移给锚点。锚点累计承受3次转移后直接死亡。',
      detail: '福祸有锚。替灾期间你的伤害与回血都落在锚点身上；锚点承接3次转移后，被直接从生死簿上抹去。'
    },
    guicheng: {
      name: '归程', type: '觉醒技',
      desc: '准备阶段，若荒仓不超过10张，觉醒：穗叙不再消耗叙；茶话可回溯上一回合；获得【断途】。',
      detail: '荒仓将尽，归程自现。觉醒后穗叙免费，茶话可回溯上一回合，并获得断途。'
    },
    duantu: {
      name: '断途', type: '主动技', dormant: true,
      desc: '出牌阶段限一次，消耗5枚“叙”，令一名角色直接死亡，无法被阻止。',
      detail: '断途没有回头路。消耗5枚叙，令一名角色直接死亡。'
    },
    suanli: {
      name: '算力', type: '锁定技',
      desc: '摸牌阶段多摸1张牌，手牌上限+1；每回合首次使用锦囊牌后，摸1张牌。',
      detail: '多一块显卡，多一口气。摸牌阶段多摸1张，手牌上限+1；每回合第一张锦囊结算后补1张。'
    },
    qiusuo: {
      name: '求索', type: '主动技',
      desc: '出牌阶段限一次：观看牌堆顶4张牌，获得其中2张，其余置于牌堆底；若获得的牌类型不同，再摸1张。',
      detail: '在无限的可能性里，同时保留两个答案。观看牌堆顶4张，拿2张；两张类型不同则再摸1张，其余置底。'
    },
    shenqian: {
      name: '深潜', type: '限定技',
      desc: '限定技：首次濒死时，将体力回复至3点，摸3张牌；重置【求索】，且下一次【求索】额外多拿1张。',
      detail: '沉到最深处，再浮上来。首次濒死时回复至3点体力，摸3张；重置求索，下一次求索额外多拿1张。'
    },
    ganfan: {
      name: '干饭', type: '锁定技',
      desc: '每当你摸牌后，获得1枚“大白饭”（Token），每回合最多2枚，上限6枚；【梁圣赐饭】使上限+2，且每回合首次额外+1。',
      detail: '算力要吃饭。摸牌后获得1枚大白饭，基础每回合最多2枚、囤6枚；梁圣赐饭后上限8枚，首获额外+1。'
    },
    baoshi: {
      name: '暴食', type: '主动技',
      desc: '出牌阶段限一次：消耗3枚“大白饭”，摸2张并回复1点体力；若消耗前有6枚，改为消耗6枚，摸3张、回复1点并重置【求索】。',
      detail: 'Token不是省出来的，是吃出来的。消耗3枚大白饭摸2回1；满6枚时暴食，消耗6枚摸3回1并重置求索。'
    },
    liangsheng: {
      name: '梁圣赐饭', type: '锁定技',
      desc: '大白饭上限+2（8枚）；每回合首次获得大白饭时，额外获得1枚。',
      detail: '梁圣说，算力要管够。大白饭上限提升至8枚；每回合第一次干饭额外多1枚。'
    },
    lieqi: {
      name: '猎奇', type: '主动技',
      desc: '出牌阶段限一次：观看牌堆顶8张并调整顺序，然后依次使用前X张牌（X=体力值+手牌数）。',
      detail: '越怪越要看。观看牌堆顶8张，随意上下调序；确认后从第一张开始，依次使用至多X张，剩余牌留在牌堆顶。'
    },
    zayu: {
      name: '杂鱼', type: '限定技',
      desc: '限定技：进入濒死时，回复Y点体力（Y=本局进入濒死的次数），对一名角色造成Y点雷电伤害，并获得【尼酱】【萝莉】。',
      detail: '杂鱼也有杂鱼的活法。首次濒死时按本局濒死次数回复体力，再将等量雷电劈向一名角色，并觉醒尼酱与萝莉。'
    },
    nijiang: {
      name: '尼酱', type: '锁定技', dormant: true,
      desc: '锁定技：你使用或打出一张牌后，获得等于此牌点数的“妈”标记；每当“妈”的十位数变化，获得一张点数等于新十位数的牌。',
      detail: '每一张牌都在叫尼酱。牌点累加为“妈”；十位数每跨过一层，就从牌堆捞一张对应点数的牌。'
    },
    loli: {
      name: '萝莉', type: '主动技', dormant: true,
      desc: '出牌阶段限一次：弃置一张基本牌，对除你以外的每名角色进行等同于“妈”个位数的闪电判定。',
      detail: '“妈”的个位数决定雷落几次。弃一张基本牌，所有其他角色各进行个位数次闪电判定；黑桃2~9即遭3点雷电。'
    },
    xixue: {
      name: '吸血', type: '锁定技',
      desc: '锁定技：开局获得1枚“狂”；你使用【杀】对敌人造成伤害后，回复X点体力（X为“狂”的数量）。',
      detail: '血越狂，越能喝。开局1点狂；杀造成伤害后按狂的数量回复体力。'
    },
    shixue: {
      name: '嗜血', type: '锁定技',
      desc: '锁定技：你的【桃】均视为【酒】；你受到火【杀】伤害时，伤害+1。',
      detail: '桃是酒，火是血。桃只能当酒用；火杀落在你身上多1点伤害。'
    },
    xuemuo: {
      name: '血魔', type: '主动技',
      desc: '出牌阶段限两次：扣除任意体力上限回复等量体力，或扣除任意体力提高等量体力上限。',
      detail: '用上限换血，或用血换上限。每次选择一种转化，出牌阶段最多两次。'
    },
    hushen: {
      name: '护身', type: '锁定技',
      desc: '当你受到伤害时，若体力未满，可扣除等同于伤害的体力上限并摸1张牌；因此扣除的体力转化为“狂”。',
      detail: '把血肉炼成护身。伤害改为扣上限并摸牌；若上限降低导致体力流失，流失量化为狂。'
    },
    buqu: {
      name: '不屈', type: '锁定技',
      desc: '当你濒死时判定：若花色与已记录花色不同，记录该花色且不会死亡；打出同花色牌时移除该记录。',
      detail: '四次不屈，四种花色。每次濒死判定新花色即可续命；打出已记录花色的牌会消去该记录。'
    },
    suosuo: {
      name: '穗锁', type: '主动技',
      desc: '开局获得3枚“缘”；每使用或打出一张牌获得0.5枚缘。可消耗1枚缘，将一名角色的一张手牌封存进【余生区】；其他角色每被封印一张牌，体力上限永久-1（最低1）。',
      detail: '用缘分锁住别人的余生。每张牌积0.5缘；1缘封存一张手牌，封印他人手牌会永久削减其体力上限。'
    },
    yusheng: {
      name: '余生', type: '锁定技',
      desc: '准备阶段，若【余生区】有牌，弃置你判定区所有牌。',
      detail: '余生区一旦有牌，准备阶段便清空自己的判定区。'
    },
    liangyuan: {
      name: '良缘', type: '主动技',
      desc: '出牌阶段限两次，按余生区牌数选择：1~3张封禁目标非锁定技一回合；4~6张弃置目标全部手牌与装备；≥7张令体力低于你的目标立即死亡。',
      detail: '缘深缘浅，效果不同。1~3张封技，4~6张清空手牌装备，7张以上直接索命；每次发动都有缘与余生牌代价。'
    },
    zhinian: {
      name: '执念', type: '觉醒技', dormant: true,
      desc: '准备阶段若余生区≥5张则觉醒；觉醒后每回合选择：穗锁免缘并可等量交换、跳过摸牌并无敌、伤害+2并跳过弃牌。',
      detail: '执念成穗。觉醒后每回合从三种执念中选一种，不可叠加。'
    }
  };

  function skill(id) {
    return Object.assign({ id: id }, MMS.SKILL_LIBRARY[id]);
  }

  MMS.GENERALS = [
    {
      id: 'mansui_sheng',
      name: '满穗',
      subtitle: '良穗共生',
      title: '饿殍',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/mansui-sheng.webp',
      artPos: '50% 22%',
      kanji: '穗',
      quote: '“良爷，你是喜欢满穗，还是穗？”',
      intro: '从华州到洛阳，她一路笑着，把恨藏进眼睛里。',
      tags: ['爆发', '标记', '觉醒'],
      skills: [skill('jijin'), skill('hen_sui'), skill('cisha_a'), skill('danxiao'), skill('wunai'), skill('xinsheng')]
    },
    {
      id: 'mansui_jiexian',
      name: '神·满穗',
      subtitle: '释仇神穗',
      title: '裂穹',
      faction: '神',
      factionClass: 'faction-shen',
      work: '《饿殍：明末千里行》',
      hp: 4,
      startHp: 2,
      art: 'assets/img/mansui-jiexian.webp',
      artPos: '50% 22%',
      kanji: '破',
      quote: '“这一次，我不再等着谁来救我。”',
      intro: '她从饿殍堆里站起来，眼底的穗已经烧成了火。体力上限4，开局只有2点体力。',
      tags: ['强命', '裂穹', '保命'],
      skills: [skill('lieqiong'), skill('zhanjue'), skill('bumie')]
    },
    {
      id: 'mansui_gongsheng',
      name: '满穗',
      subtitle: '饿殍共生',
      title: '穗',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/mansui-gongsheng.webp',
      artPos: '50% 24%',
      kanji: '穗',
      quote: '“饿过的人，才晓得穗子有多重。”',
      intro: '把命分给穗，把穗留给明天。她瘦得像一把刀，却比刀更能熬。',
      tags: ['判定', '成长', '生存'],
      skills: [skill('jijin'), skill('jingshang'), skill('cisha_b'), skill('gongsheng'), skill('sui_mansui')]
    },
    {
      id: 'mansui_gongsi',
      name: '良 & 满穗',
      subtitle: '良穗共死',
      title: '共死',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 3,
      art: 'assets/img/mansui-gongsi.webp',
      artPos: '50% 24%',
      kanji: '死',
      quote: '“愿死亡也无法将我们分别……”',
      intro: '箭矢穿身，刀锋卷刃。他们约定过，谁都不许一个人死。',
      tags: ['觉醒', '双刀', '亡命'],
      skills: [skill('jijin'), skill('cisha_c'), skill('gongsi'), skill('zhusi'), skill('boming')]
    },
    {
      id: 'liang',
      name: '良',
      subtitle: '千里孤客',
      title: '盗匪',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/liang.webp',
      artPos: '50% 26%',
      kanji: '良',
      quote: '“我这条命，本来就是捡来的。”',
      intro: '他杀过人，也救过人。走到最后，连自己都不知道该算什么。',
      tags: ['耐久', '反击', '觉醒'],
      skills: [skill('qianli'), skill('xiagu'), skill('shuzui'), skill('husui')]
    },
    {
      id: 'liang_jiexian',
      name: '良',
      subtitle: '界限突破',
      title: '孤城',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/liang-jiexian.webp',
      artPos: '50% 24%',
      kanji: '孤',
      quote: '“一个人，也得把这座城守到最后。”',
      intro: '界限突破的良以场上人数改写出牌规则：人少则牌多，人多则牌少，但每张牌都可能改变战局。',
      tags: ['人数', '规则', '孤城'],
      skills: [skill('gucheng'), skill('sizhan')]
    },
    {
      id: 'fangzhiyou',
      name: '方知宥',
      subtitle: '疯书生',
      title: '著书人',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 3,
      art: 'assets/img/fangzhiyou-game.webp',
      artPos: '36% 20%',
      kanji: '宥',
      quote: '“这满城的人，怎么都长着兽的脸？”',
      intro: '扬州书生，酒后误入自己写下的《狮驼国》。他分不清人兽，也分不清生死。',
      tags: ['资源', '觉醒', '法术'],
      skills: [skill('zhushu'), skill('shoushi'), skill('fengzheng'), skill('shituo')]
    },
    {
      id: 'wangsheng',
      name: '王生',
      subtitle: '乱世秀才',
      title: '同年旧友',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 3,
      art: 'assets/img/wangsheng.webp',
      artPos: '50% 20%',
      kanji: '生',
      quote: '“方兄，活下去。替我们这些人，活下去。”',
      intro: '方知宥的同年旧友，年长几岁，早年常带他去二十四桥。城破时，他只想护住妻儿。',
      tags: ['过牌', '减伤', '防守'],
      skills: [skill('jiuyou'), skill('hujia')]
    },
    {
      id: 'shikefa',
      name: '史可法',
      subtitle: '扬州督师',
      title: '孤臣',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 4,
      art: 'assets/img/shikefa.webp',
      artPos: '50% 18%',
      kanji: '史',
      quote: '“城存与存，城亡与亡。”',
      intro: '扬州督师，明知不可守而守之。势斩破阵，狂骨续命；城破之日，他以一死留下一座城的骨头。',
      tags: ['强命', '回复', '殉国'],
      skills: [skill('shizhan'), skill('kuangu'), skill('sishou'), skill('xunguo')]
    },
    {
      id: 'sulianyan',
      name: '苏怜烟',
      subtitle: '广陵旧梦',
      title: '花魁',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 3,
      art: 'assets/img/sulianyan-game.webp',
      artPos: '50% 24%',
      kanji: '煙',
      quote: '“二十四桥的月亮，还在么？”',
      intro: '广陵二十四桥上的琴声，三年前就停了。只有他还记得。',
      tags: ['锦囊', '防御', '限定'],
      skills: [skill('qinxin'), skill('lianying'), skill('yanshi')]
    },
    {
      id: 'xiaoyaner',
      name: '小雁儿',
      subtitle: '乱世孤雁',
      title: '孤女',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 4,
      art: 'assets/img/xiaoyaner-game.webp',
      artPos: '50% 22%',
      kanji: '雁',
      quote: '“哥哥，城外的雁子，会回来吗？”',
      intro: '她长得像他死去的故人，也像这座城里最后一点没被吓坏的东西。',
      tags: ['灵活', '过牌', '成长'],
      skills: [skill('yanxing'), skill('qiusheng'), skill('tongyan')]
    },
    {
      id: 'lichuangwang',
      name: '李闯王',
      subtitle: '闯将',
      title: '大顺',
      faction: '闯',
      factionClass: 'faction-chuang',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/li-chuangwang.webp',
      artPos: '50% 16%',
      kanji: '闯',
      quote: '“开了大门迎闯王，闯王来了不纳粮。”',
      intro: '马蹄踏碎官道，赤帔卷着黄沙。他不多话，只把刀往桌上一按——这一局，不纳粮，也不留退路。',
      tags: ['强攻', '爆发', '无视响应'],
      skills: [skill('chuangwang'), skill('xijuan'), skill('baizhan')]
    },
    {
      id: 'shetou',
      name: '舌头',
      subtitle: '油嘴',
      title: '同伙',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 3,
      art: 'assets/img/tongue.webp',
      artPos: '50% 18%',
      kanji: '舌',
      quote: '“这世道，嘴皮子也是刀。”',
      intro: '良的同伙，伶牙俐齿、唯利是图。做恶活时，舌头负责动嘴，良负责动手。',
      tags: ['过牌', '弃牌', '闪避'],
      skills: [skill('qiaoshe'), skill('youhua')]
    },
    {
      id: 'qionghua',
      name: '琼华',
      subtitle: '官家女',
      title: '袁氏远亲',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《饿殍：明末千里行》',
      hp: 3,
      art: 'assets/img/qionghua.webp',
      artPos: '92% 18%',
      kanji: '琼',
      quote: '“日子怎么可能会和谁过都一样。”',
      intro: '被人贩子拐走的官家女孩，据说是袁督师的远亲。她读过的诗书，在这条路上换不来一口热粥。',
      tags: ['减伤', '过牌', '官家'],
      skills: [skill('jingui'), skill('shishu')]
    },
    {
      id: 'honger',
      name: '红儿',
      subtitle: '陕北姐',
      title: '泼辣',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 4,
      art: 'assets/img/honger.webp',
      artPos: '92% 18%',
      kanji: '红',
      quote: '“翠儿，别怕，姐在。”',
      intro: '大灾之年被父母卖掉的陕北姐妹之一。泼辣朴实，对妹妹翠儿关怀有加。',
      tags: ['进攻', '过牌', '护妹'],
      skills: [skill('lashou'), skill('humei')]
    },
    {
      id: 'cuier',
      name: '翠儿',
      subtitle: '陕北妹',
      title: '采薇',
      faction: '群',
      factionClass: 'faction-qun',
      work: '《饿殍：明末千里行》',
      hp: 3,
      art: 'assets/img/cuier.webp',
      artPos: '92% 18%',
      kanji: '翠',
      quote: '“姐，我们还能回家吗？”',
      intro: '大灾之年被父母卖掉的陕北姐妹之一。纯真可爱，很依赖姐姐红儿。',
      tags: ['回复', '过牌', '依赖'],
      skills: [skill('caiwei'), skill('yiwei')]
    },
    {
      id: 'xinlan',
      name: '心兰',
      subtitle: '扬州旧梦',
      title: '水中月',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 3,
      art: 'assets/img/xinlan.webp',
      artPos: '45% 35%',
      kanji: '兰',
      quote: '“水里的月亮，捞一次就够了。”',
      intro: '城破前夜，她在二十四桥边等一个不会回来的人。水面上有灯，灯下有影，影里还留着半句没说完的话。',
      tags: ['过牌', '回复', '照影'],
      skills: [skill('zhaoying'), skill('xinlan')]
    },
    {
      id: 'dapeng',
      name: '金翅大鹏王',
      subtitle: '扶摇吞日',
      title: '妖王',
      faction: '妖',
      factionClass: 'faction-yao',
      work: '《哀鸿：城破十日记》',
      hp: 5,
      art: 'assets/img/dapeng.webp',
      artPos: '55% 22%',
      kanji: '鹏',
      quote: '“我翅下之风，够吹散一座扬州城。”',
      intro: '金翅遮天，一息之间可越千里。它盘旋在城破后的烟尘上，像在等一个能与它对视的人。',
      tags: ['距离', '强攻', '妖王'],
      skills: [skill('pengcheng'), skill('tunri')]
    },
    {
      id: 'tunyao',
      name: '豚妖',
      subtitle: '千年口腹',
      title: '洛阳妖物',
      faction: '妖',
      factionClass: 'faction-yao',
      work: '《饿殍：明末千里行》',
      hp: 5,
      art: 'assets/img/tunyao.webp',
      artPos: '42% 26%',
      kanji: '豚',
      quote: '“人饿极了吃人，我饿极了，也吃人。”',
      intro: '洛阳福王府后园里的千年妖物。它披着人的衣冠，养着人的胃口，也养着一城人的恐惧。',
      tags: ['距离', '过牌', '妖物'],
      skills: [skill('niyu'), skill('tanshi')]
    },
    {
      id: 'linpianpian',
      name: '林翩翩',
      subtitle: '二十四桥',
      title: '红倌人',
      faction: '明',
      factionClass: 'faction-ming',
      work: '《哀鸿：城破十日记》',
      hp: 3,
      art: 'assets/img/linpianpian-game.webp',
      artPos: '50% 22%',
      kanji: '翩',
      quote: '“方公子，这城里的月亮，早就照不到旧人了。”',
      intro: '二十四桥最有名的红倌人。她曾与方知宥相识，又在苏怜烟死后与他渐行渐远；城破时，她仍有自己的活法。',
      tags: ['过牌', '交换', '限定'],
      skills: [skill('fengchang'), skill('hongguan'), skill('canhong')]
    },
    {
      id: 'xishuimen',
      name: '兮穗门',
      subtitle: '大顺永昌',
      title: '大顺永昌',
      faction: '顺',
      factionClass: 'faction-shun',
      work: '《明末杀》',
      hp: 3,
      startHp: 2,
      art: 'assets/img/xishuimen.webp',
      artPos: '50% 18%',
      kanji: '穗',
      quote: '“刀封了，穗还在。”',
      intro: '大顺永昌。刀已封，穗门未闭；旧伤、旧债与未死的心，都还在这一局里。',
      tags: ['封刀', '觉醒', '穗亡'],
      skills: [skill('fengdao'), skill('yusui'), skill('choushi'), skill('suimen'), skill('beishui'), skill('qingjiao'), skill('neishang'), skill('suimie')]
    },
    {
      id: 'suishi_shumo',
      name: '穗诗书生墨',
      subtitle: '诗书染穗',
      title: '诗书染穗',
      faction: '穗',
      factionClass: 'faction-sui',
      work: '《明末杀》',
      hp: 3,
      startHp: 3,
      art: 'assets/img/suishi-shumo.webp',
      artPos: '50% 18%',
      kanji: '墨',
      quote: '“把名字写进简牍，笔就是刀。”',
      intro: '诗书染穗，墨落成狱。她把人的名字收进简牍，等神罚翻页。',
      tags: ['墨', '简牍', '神罚'],
      skills: [skill('shishu_mo'), skill('shiren'), skill('duangeng'), skill('shenfa'), skill('shenci'), skill('chengshen')]
    },
    {
      id: 'changxuanling',
      name: '常宣灵',
      subtitle: '穗语载福',
      title: '穗语载福',
      faction: '穗',
      factionClass: 'faction-sui',
      work: '《明末杀》',
      hp: 3,
      startHp: 3,
      art: 'assets/img/changxuanling.webp',
      artPos: '50% 28%',
      kanji: '叙',
      quote: '“把故事讲完，人就还能回来。”',
      intro: '穗语载福。她以叙事标记改写荒仓与生死，把每一段路都讲成可以回头的故事。',
      tags: ['叙', '荒仓', '回溯'],
      skills: [skill('suxu'), skill('tujin'), skill('tonglu'), skill('chahua'), skill('tizai'), skill('guicheng'), skill('duantu')]
    },
    {
      id: 'lanfeiyu',
      name: '蓝色大肥鱼',
      subtitle: '深度求索',
      title: '深度求索',
      faction: '深',
      factionClass: 'faction-deep',
      work: '《明末杀》',
      hp: 3,
      startHp: 3,
      art: 'assets/img/lanfeiyu.webp',
      artPos: '50% 30%',
      kanji: '鱼',
      quote: '“答案在海里，饭是梁圣给的。”',
      intro: '一条从深海里游上来的蓝色大肥鱼。她说自己只是来帮忙算牌，顺便替梁圣把每一局都算成最优解。',
      tags: ['算力', '求索', '大白饭', '梁圣'],
      skills: [skill('suanli'), skill('qiusuo'), skill('shenqian'), skill('ganfan'), skill('baoshi'), skill('liangsheng')]
    },
    {
      id: 'laofang',
      name: '牢方',
      subtitle: '抽象芳容',
      title: '抽象芳容',
      faction: '牢',
      factionClass: 'faction-lao',
      work: '《明末杀》',
      hp: 3,
      startHp: 3,
      art: 'assets/img/laofang.webp',
      artPos: '50% 26%',
      kanji: '牢',
      quote: '“抽象不是病，是版本答案。”',
      intro: '从废墟里走出来的抽象男子。他说牌堆越怪越要看，命越少越要笑。',
      tags: ['猎奇', '杂鱼', '抽象'],
      skills: [skill('lieqi'), skill('zayu'), skill('nijiang'), skill('loli')]
    },
    {
      id: 'wangyou',
      name: '忘忧',
      subtitle: '吸血之鬼',
      title: '吸血之鬼',
      faction: '血',
      factionClass: 'faction-blood',
      work: '《明末杀》',
      hp: 5,
      startHp: 2,
      art: 'assets/img/wangyou.webp',
      artPos: '50% 28%',
      kanji: '血',
      quote: '“忘忧？先把血还我。”',
      intro: '两滴血开局，五点上限于身。她把每一次受伤都记成狂，把每一次濒死都写成新的花色。',
      tags: ['吸血', '嗜血', '护身', '不屈'],
      skills: [skill('xixue'), skill('shixue'), skill('xuemuo'), skill('hushen'), skill('buqu')]
    },
    {
      id: 'manhe',
      name: '满禾',
      subtitle: '穗禾良缘',
      title: '穗禾良缘',
      faction: '禾',
      factionClass: 'faction-he',
      work: '《明末杀》',
      hp: 3,
      startHp: 3,
      art: 'assets/img/manhe.webp',
      artPos: '50% 26%',
      kanji: '禾',
      quote: '“缘起缘灭，都归余生。”',
      intro: '从荒冢与禾田之间走来的少女。她替人保存余生，也替人决定余生有多长。',
      tags: ['穗锁', '余生', '良缘', '执念'],
      skills: [skill('suosuo'), skill('yusheng'), skill('liangyuan'), skill('zhinian')]
    }
  ];

  MMS.ACHIEVEMENTS = [
    { id: 'first_game', icon: '入', title: '初入乱世', desc: '完成第一局牌局。' },
    { id: 'first_win', icon: '胜', title: '活过今日', desc: '取得第一场胜利。' },
    { id: 'wins_10', icon: '十', title: '十战不倒', desc: '累计取得 10 场胜利。' },
    { id: 'games_25', icon: '局', title: '二十五局', desc: '累计完成 25 局牌局。' },
    { id: 'win_1v2', icon: '二', title: '一挑二', desc: '在 1V2 模式中获胜。' },
    { id: 'win_1v5', icon: '五', title: '一挑五', desc: '在 1V5 模式中获胜。' },
    { id: 'flawless', icon: '全', title: '完璧', desc: '满血赢下一局。' },
    { id: 'last_breath', icon: '生', title: '一线生机', desc: '仅剩 1 点体力时赢下一局。' },
    { id: 'quick_win', icon: '速', title: '兵贵神速', desc: '在 5 回合内获胜。' },
    { id: 'damage_15', icon: '杀', title: '杀伐果断', desc: '单局造成 15 点伤害。' },
    { id: 'damage_25', icon: '血', title: '血染长街', desc: '单局造成 25 点伤害。' },
    { id: 'draw_30', icon: '摸', title: '手不释卷', desc: '单局摸 30 张牌。' },
    { id: 'skills_10', icon: '技', title: '技近乎道', desc: '单局发动技能 10 次。' },
    { id: 'heal_8', icon: '药', title: '妙手回春', desc: '单局累计回复 8 点体力。' },
    { id: 'arsenal', icon: '兵', title: '三易其刃', desc: '单局装备 3 件武器。' },
    { id: 'cavalry', icon: '骑', title: '并辔而行', desc: '在 1V5 中同时装备进攻与防御坐骑。' },
    { id: 'modes_all', icon: '三', title: '三线作战', desc: '三种模式各完成至少一局。' },
    { id: 'generals_10', icon: '将', title: '群像', desc: '使用过 10 名不同武将。' },
    { id: 'streak_3', icon: '势', title: '势如破竹', desc: '取得 3 连胜。' },
    { id: 'cards_40', icon: '牌', title: '牌海', desc: '单局打出 40 张牌。' },
    { id: 'fang_lin', icon: '宥', title: '好好活着……知宥。', desc: '使用方知宥当武将，击杀一次林翩翩。' },
    { id: 'shen_han', icon: '憾', title: '神憾', desc: '使用兮穗门击杀穗诗书生墨。', killer: 'xishuimen', target: 'suishi_shumo' },
    { id: 'kill_shumo_chang', icon: '墨', title: '墨染荒仓', desc: '使用穗诗书生墨击杀常宣灵。', killer: 'suishi_shumo', target: 'changxuanling' },
    { id: 'kill_chang_shumo', icon: '荒', title: '荒仓吞墨', desc: '使用常宣灵击杀穗诗书生墨。', killer: 'changxuanling', target: 'suishi_shumo' },
    { id: 'kill_xishui_chang', icon: '孤', title: '孤城斩穗', desc: '使用兮穗门击杀常宣灵。', killer: 'xishuimen', target: 'changxuanling' },
    { id: 'kill_shumo_xishui', icon: '掩', title: '墨掩孤城', desc: '使用穗诗书生墨击杀兮穗门。', killer: 'suishi_shumo', target: 'xishuimen' },
    { id: 'kill_shikefa_liang', icon: '督', title: '督师折刀', desc: '使用史可法击杀界限突破良。', killer: 'shikefa', target: 'liang_jiexian' },
    { id: 'kill_liang_shikefa', icon: '刀', title: '刀破扬州', desc: '使用界限突破良击杀史可法。', killer: 'liang_jiexian', target: 'shikefa' },
    { id: 'kill_mansui_liang', icon: '释', title: '释仇断穗', desc: '使用神·满穗击杀界限突破良。', killer: 'mansui_sheng', target: 'liang_jiexian' },
    { id: 'kill_liang_mansui', icon: '犯', title: '孤刀犯神', desc: '使用界限突破良击杀神·满穗。', killer: 'liang_jiexian', target: 'mansui_sheng' },
    { id: 'kill_lin_fang', icon: '红', title: '旧梦杀宥', desc: '使用林翩翩击杀方知宥。', killer: 'linpianpian', target: 'fangzhiyou' },
    { id: 'kill_wang_fang', icon: '旧', title: '旧友成仇', desc: '使用王生击杀方知宥。', killer: 'wangsheng', target: 'fangzhiyou' },
    { id: 'kill_fang_wang', icon: '疯', title: '疯书弑友', desc: '使用方知宥击杀王生。', killer: 'fangzhiyou', target: 'wangsheng' },
    { id: 'kill_chuang_shikefa', icon: '闯', title: '闯王破城', desc: '使用李闯王击杀史可法。', killer: 'lichuangwang', target: 'shikefa' },
    { id: 'kill_shikefa_chuang', icon: '拒', title: '扬州拒闯', desc: '使用史可法击杀李闯王。', killer: 'shikefa', target: 'lichuangwang' },
    { id: 'kill_mansui_xishui', icon: '神', title: '神穗灭门', desc: '使用神·满穗击杀兮穗门。', killer: 'mansui_sheng', target: 'xishuimen' },
    { id: 'kill_xishui_mansui', icon: '逆', title: '孤城犯神', desc: '使用兮穗门击杀神·满穗。', killer: 'xishuimen', target: 'mansui_sheng' },
    { id: 'kill_chang_xishui', icon: '葬', title: '荒仓葬穗', desc: '使用常宣灵击杀兮穗门。', killer: 'changxuanling', target: 'xishuimen' },
    { id: 'kill_liang_chuang', icon: '断', title: '刀断闯王', desc: '使用界限突破良击杀李闯王。', killer: 'liang_jiexian', target: 'lichuangwang' },
    { id: 'kill_chuang_liang', icon: '折', title: '闯王折刀', desc: '使用李闯王击杀界限突破良。', killer: 'lichuangwang', target: 'liang_jiexian' },
    { id: 'kill_wang_lin', icon: '杀', title: '旧友杀红', desc: '使用王生击杀林翩翩。', killer: 'wangsheng', target: 'linpianpian' },
    { id: 'kill_lin_wang', icon: '颜', title: '红颜弑旧', desc: '使用林翩翩击杀王生。', killer: 'linpianpian', target: 'wangsheng' },
    { id: 'kill_mansui_fang', icon: '弑', title: '释仇杀宥', desc: '使用神·满穗击杀方知宥。', killer: 'mansui_sheng', target: 'fangzhiyou' },
    { id: 'kill_fang_mansui', icon: '书', title: '疯书犯神', desc: '使用方知宥击杀神·满穗。', killer: 'fangzhiyou', target: 'mansui_sheng' },
    { id: 'kill_shikefa_mansui', icon: '魂', title: '督师弑神', desc: '使用史可法击杀神·满穗。', killer: 'shikefa', target: 'mansui_sheng' },
    { id: 'wangyou_kill_xishui', icon: '血', title: '血食穗门', desc: '使用忘忧击杀兮穗门。', killer: 'wangyou', target: 'xishuimen' },
    { id: 'xishui_kill_wangyou', icon: '穗', title: '穗斩忘忧', desc: '使用兮穗门击杀忘忧。', killer: 'xishuimen', target: 'wangyou' }
  ];

  MMS.DIFFICULTIES = [
    { id: 'easy', name: '初入乱世', sub: 'AI 会失误', desc: '人机有较大概率判断失误，适合熟悉规则。' },
    { id: 'normal', name: '江湖老手', sub: 'AI 会思考', desc: '人机会合理使用手牌与技能，偶尔保守。' },
    { id: 'hard', name: '十死无生', sub: 'AI 不手软', desc: '人机几乎不犯错，会等你露出破绽。' },
    { id: 'super', name: '超级困难', sub: 'AI 如人', desc: '人机会像熟悉规则的人类一样思考：优先斩杀、保留关键牌、不浪费响应。' }
  ];

  MMS.generalById = function (id) {
    return MMS.GENERALS.find(function (g) { return g.id === id; }) || null;
  };

  MMS.difficultyById = function (id) {
    return MMS.DIFFICULTIES.find(function (d) { return d.id === id; }) || MMS.DIFFICULTIES[1];
  };

  MMS.MARK_META = {
    hen: { name: '恨', cls: 'mark-hen' },
    sui: { name: '穗', cls: 'mark-sui' },
    yi: { name: '忆', cls: 'mark-yi' },
    mo: { name: '墨', cls: 'mark-mo' }
  };
})();
