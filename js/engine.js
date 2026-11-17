/* =========================================================
   明末杀 · 游戏引擎
   纯状态机 + 异步回合流程
   ========================================================= */
(function () {
  'use strict';

  const MMS = window.MMS;
  const Engine = {};
  MMS.Engine = Engine;

  let G = null;
  let virtualSeq = 0;
  let lastEnemyGeneralIds = [];
  let cheats = {
    enabled: false,
    invincible: true,
    unlimited: true,
    unanswerable: false,
    damageMultiplier: 2,
    extraDamage: 0
  };

  const sleep = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  function ui() { return MMS.UI; }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tag(p) {
    if (!p) return '';
    if (p.side === 'player') return '<b>你</b>';
    return '<b class="red">' + esc(p.general.name) + '</b><span class="tag-sub">·' + esc(p.general.subtitle) + '</span>';
  }

  function tagSoft(p) {
    if (!p) return '';
    if (p.side === 'player') return '<b>你</b>';
    return '<b class="gold">' + esc(p.general.name) + '</b><span class="tag-sub">·' + esc(p.general.subtitle) + '</span>';
  }

  function ais() {
    if (!G) return [];
    if (Array.isArray(G.ais) && G.ais.length) return G.ais;
    return [G.ai, G.ai2].filter(Boolean);
  }

  function otherOf(p) {
    if (!G || !p) return null;
    if (p.side === 'player') {
      const list = livingEnemies(p);
      return list[0] || ais()[0] || null;
    }
    return G.player;
  }

  function allPlayers() {
    if (!G) return [];
    return [G.player].concat(ais()).filter(Boolean);
  }

  function playerBySide(side) {
    if (!G) return null;
    if (side === 'player') return G.player;
    return ais().find(function (p) { return p.side === side; }) || null;
  }

  function livingEnemies(p) {
    if (!G || !p) return [];
    if (p.side === 'player') {
      return ais().filter(function (x) { return x && x.alive; });
    }
    return G.player && G.player.alive ? [G.player] : [];
  }

  function primaryEnemy(p) {
    const list = livingEnemies(p);
    return list[0] || otherOf(p);
  }

  function nextSide(side) {
    if (!G) return null;
    const list = ais();
    if (side === 'player') {
      const first = list.find(function (p) { return p.alive; });
      return first ? first.side : null;
    }
    const idx = list.findIndex(function (p) { return p.side === side; });
    for (let i = idx + 1; i < list.length; i += 1) {
      if (list[i].alive) return list[i].side;
    }
    return 'player';
  }

  function seatPlayers() {
    if (!G) return [];
    return [G.player].concat(ais()).filter(function (p) { return p && p.alive; });
  }

  function seatIndex(p) {
    if (!p || !G) return 0;
    const list = seatPlayers();
    const idx = list.indexOf(p);
    return idx < 0 ? 0 : idx;
  }

  function seatDistance(a, b) {
    if (!a || !b) return 1;
    const list = seatPlayers();
    const ia = list.indexOf(a);
    const ib = list.indexOf(b);
    if (ia < 0 || ib < 0) return 1;
    const n = list.length;
    if (n < 2) return 1;
    const d = Math.abs(ia - ib);
    return Math.max(1, Math.min(d, n - d));
  }

  function distanceBetween(attacker, defender) {
    if (!G || G.mode !== '1v5') return 1;
    let d = seatDistance(attacker, defender);
    if (hasSkill(attacker, 'pengcheng')) d -= 1;
    if (attacker && attacker.mounts && attacker.mounts.offense) d -= 1;
    if (hasSkill(defender, 'niyu')) d += 1;
    if (defender && defender.mounts && defender.mounts.defense) d += 1;
    return Math.max(1, d);
  }

  function attackRange(p) {
    if (!p) return 1;
    return Math.max(1, (p.weapon && p.weapon.range) || 1);
  }

  function canReach(attacker, defender) {
    if (!G || G.mode !== '1v5') return true;
    return distanceBetween(attacker, defender) <= attackRange(attacker);
  }

  function isAoeCard(card) {
    return !!card && (card.kind === 'nanman' || card.kind === 'wanjian');
  }

  function isSlashCard(card) {
    return !!card && (card.name === '杀' || card.name === '雷杀' || card.name === '火杀');
  }

  function hasArmor(p, type) {
    return !!(p && p.armor && p.armor.armorType === type);
  }

  function emit() {
    if (ui() && ui().render) ui().render(G);
  }

  function log(html, cls) {
    if (!G) return;
    G.log.push({
      id: ++G.logId,
      html: html,
      cls: cls || 'log-system',
      round: G.round
    });
    if (G.log.length > 140) G.log.splice(0, G.log.length - 140);
  }

  function toast(text, cls) {
    if (ui() && ui().toast) ui().toast(text, cls);
  }

  function banner(title, sub, cls) {
    if (ui() && ui().banner) ui().banner(title, sub, cls);
  }

  function beat(ms) {
    if (!G) return sleep(0);
    const scale = G.delayScale == null ? 1 : G.delayScale;
    return sleep(Math.max(8, ms * scale));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  function randomOf(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function otherId(id) {
    const pool = MMS.GENERALS.filter(function (g) { return g.id !== id; });
    return randomOf(pool).id;
  }

  function createPlayer(general, side) {
    const startHp = general.startHp == null
      ? general.hp
      : Math.max(1, Math.min(general.startHp, general.hp));
    return {
      side: side,
      general: general,
      hp: startHp,
      maxHp: general.hp,
      hand: [],
      judge: [],
      weapon: null,
      armor: null,
      mounts: { offense: null, defense: null },
      marks: { hen: 0, sui: 0, yi: 0, mo: 0, xu: 0 },
      archive: [],
      narrative: [],
      lifeZone: [],
      gainedSkills: [],
      lostSkills: [],
      alive: true,
      flags: {
        slashUsed: 0,
        cishaUsed: false,
        danxiaoUsed: false,
        qinxinUsed: false,
        lianyingUsed: false,
        gongshengUsed: false,
        bomingUsed: false,
        shituoUsed: false,
        zhushuUsed: false,
        yanxingUsed: false,
        yanshiUsed: false,
        shuzuiUsed: false,
        wunaiUsed: false,
        gongsiUsed: false,
        fengzhengUsed: false,
        fengchangUsed: false,
        hongguanUsed: false,
        canhongUsed: false,
        chuangwangUsed: 0,
        chuangwangBuff: false,
        xijuanDraws: 0,
        baizhanUsed: false,
        qiaosheUsed: false,
        youhuaUsed: false,
        jinguiUsed: false,
        shishuUsed: false,
        humeiUsed: false,
        caiweiUsed: false,
        yiweiUsed: false,
        zhaoyingUsed: false,
        xinlanUsed: false,
        tunriUsed: false,
        tanshiUsed: false,
        baguaUsed: false,
        buyiUsed: false,
        zhanjueUsed: false,
        zhanjueSlash: false,
        zhanjueHeal: false,
        bumieUsed: false,
        suiyouUsed: false,
        jiuyouUsed: false,
        hujiaUsed: false,
        lieqiongHit: 0,
        lieqiongDamagePlus: false,
        lieqiongInvalid: false,
        lieqiongNoHeart: false,
        sishouUsed: false,
        xunguoUsed: false,
        guchengPrepareUsed: false,
        guchengRule: false,
        guchengCap: 0,
        cardsThisTurn: 0,
        choushiTimes: 0,
        choushiDouble: false,
        choushiHurt: false,
        fengdaoReborn: false,
        qingjiaoActive: false,
        suimenAwakened: false,
        beishuiAwakened: false,
        suimieUsed: false,
        duangengUsed: false,
        shenfaUsed: false,
        shenfaRemoved: 0,
        shenfaFree: false,
        shenfaDeathUsed: false,
        shenciUsed: false,
        chengshenUsed: false,
        tongluUsed: false,
        tongluSide: null,
        tongluExpireRound: 0,
        hungry: false,
        hungryBySide: null,
        tizaiUsed: false,
        tizaiAnchorSide: null,
        tizaiHits: 0,
        tizaiExpireRound: 0,
        chahuaUsed: false,
        suxuFree: false,
        chahuaAny: false,
        guichengAwakened: false,
        duantuUsed: false,
        qiusuoUsed: false,
        qiusuoExtra: 0,
        suanliTrickUsed: false,
        fanGained: 0,
        baoshiUsed: false,
        lieqiUsed: false,
        zayuUsed: false,
        xuemuoUsed: 0,
        buquSuits: [],
        liangyuanUsed: 0,
        zhinianAwake: false,
        zhinianMode: '',
        zhinianTurn: -1,
        tempNoSkillsTurn: -1,
        zhinianInvincibleUntil: -1,
        zhinianDamageBonus: 0,
        zhinianSkipDraw: false,
        zhinianSkipDiscard: false,
        loliUsed: false,
        dyingCount: 0,
        shenqianUsed: false,
        noShanTurn: false,
        weaponDoubled: false,
        skipPlayTurns: 0,
        skipDrawTurns: 0,
        jiuUsed: false,
        jiuBuff: 0,
        jiuTurn: 0,
        taoTurn: 0,
        eggTao: false,
        eggJiu: false,
        dying: false,
        awakened: false
      },
      stats: {
        damageDealt: 0,
        damageTaken: 0,
        cardsPlayed: 0,
        cardsDrawn: 0,
        skillsUsed: 0,
        heals: 0,
        weaponsEquipped: 0,
        mountsEquipped: 0,
        fangKilledLin: 0,
        xishuimenKilledShumo: 0,
        shenfaKills: 0,
        kills: {}
      }
    };
  }

  function hasSkill(p, id) {
    if (!p || !p.general) return false;
    if (p.lostSkills.indexOf(id) >= 0) return false;
    const s = p.general.skills.find(function (sk) { return sk.id === id; });
    if (!s) return false;
    if (s.dormant && p.gainedSkills.indexOf(id) < 0) return false;
    if (p.flags && G && p.flags.tempNoSkillsTurn === G.turnCount && s.type !== '锁定技') return false;
    return true;
  }

  function gainSkill(p, id) {
    if (p.gainedSkills.indexOf(id) < 0) p.gainedSkills.push(id);
  }

  function loseSkill(p, id) {
    if (p.lostSkills.indexOf(id) < 0) p.lostSkills.push(id);
  }

  function addMark(p, key, n, max) {
    if (!p || !p.marks) return 0;
    const cap = max == null ? 99 : max;
    const before = p.marks[key] || 0;
    p.marks[key] = Math.max(0, Math.min(cap, before + n));
    return p.marks[key] - before;
  }

  function spendMark(p, key, n) {
    if (!p || (p.marks[key] || 0) < n) return false;
    p.marks[key] -= n;
    return true;
  }

  function hasWeapon(p, kind) {
    return !!(p && p.weapon && p.weapon.kind === kind);
  }

  function cheatActive() {
    return !!(G && G.cheats && G.cheats.enabled);
  }

  function cheatPlayer(p) {
    return !!(cheatActive() && p && p.side === 'player');
  }

  function maxSlash(p) {
    if (p && p.flags && p.flags.guchengRule) return 99;
    if (p && p.flags && p.flags.fengdaoReborn) return 99;
    if (cheatPlayer(p) && G.cheats.unlimited) return 99;
    let n = hasSkill(p, 'zhusi') ? 2 : 1;
    if (G && G.mode === '1v5' && p && p.side === 'player') n += 1;
    if (hasWeapon(p, 'wangsheng_sword')) n = Math.max(n, p.flags.weaponDoubled ? 3 : 2);
    return n;
  }

  function canUseSlash(p) {
    return p.flags.slashUsed < maxSlash(p);
  }

  function handLimit(p) {
    if (!p) return 0;
    if (cheatPlayer(p) && G.cheats.unlimited) return 999;
    if (hasSkill(p, 'jingshang')) return 4;
    let limit = Math.max(0, p.hp);
    if (hasSkill(p, 'qianli')) limit -= 1;
    if (hasSkill(p, 'tongyan')) limit += 1;
    if (hasSkill(p, 'zhusi')) limit += 2;
    if (hasArmor(p, 'buyi')) limit += 1;
    if (hasSkill(p, 'hujia')) limit += 1;
    if (hasSkill(p, 'dushi')) limit += 1;
    if (hasSkill(p, 'suanli')) limit += 1;
    return Math.max(0, limit);
  }

  function playableSkills() {
    return ['danxiao', 'zhushu', 'shituo', 'yanxing', 'sui_mansui', 'hongguan', 'chuangwang', 'qiaoshe', 'shishu', 'caiwei', 'xinlan', 'tunri', 'shishu_mo', 'duangeng', 'shenfa', 'chengshen', 'suxu', 'tonglu', 'tizai', 'duantu', 'qiusuo', 'baoshi', 'lieqi', 'loli', 'xuemuo', 'suosuo', 'liangyuan'];
  }

  function skillUsedFlag(p, id) {
    switch (id) {
      case 'danxiao': return p.flags.danxiaoUsed;
      case 'zhushu': return p.flags.zhushuUsed;
      case 'shituo': return p.flags.shituoUsed;
      case 'yanxing': return p.flags.yanxingUsed;
      case 'cisha_a': return false;
      case 'cisha_b': return p.flags.cishaUsed;
      case 'cisha_c': return p.flags.cishaUsed;
      case 'lianying': return p.flags.lianyingUsed;
      case 'gongsheng': return p.flags.gongshengUsed;
      case 'boming': return p.flags.bomingUsed;
      case 'yanshi': return p.flags.yanshiUsed;
      case 'wunai': return p.flags.wunaiUsed;
      case 'shuzui': return p.flags.shuzuiUsed;
      case 'gongsi': return p.flags.gongsiUsed;
      case 'fengzheng': return p.flags.fengzhengUsed;
      case 'fengchang': return p.flags.fengchangUsed;
      case 'hongguan': return p.flags.hongguanUsed;
      case 'canhong': return p.flags.canhongUsed;
      case 'chuangwang': return (p.flags.chuangwangUsed || 0) >= 1;
      case 'qiaoshe': return p.flags.qiaosheUsed;
      case 'shishu': return p.flags.shishuUsed;
      case 'caiwei': return p.flags.caiweiUsed;
      case 'xinlan': return p.flags.xinlanUsed;
      case 'tunri': return p.flags.tunriUsed;
      case 'shishu_mo': return false;
      case 'duangeng': return p.flags.duangengUsed;
      case 'shenfa': return p.flags.shenfaUsed;
      case 'chengshen': return p.flags.chengshenUsed;
      case 'suxu': return false;
      case 'tonglu': return p.flags.tongluUsed;
      case 'tizai': return p.flags.tizaiUsed;
      case 'duantu': return p.flags.duantuUsed;
      case 'qiusuo': return p.flags.qiusuoUsed;
      case 'baoshi': return p.flags.baoshiUsed;
      case 'lieqi': return p.flags.lieqiUsed;
      case 'loli': return p.flags.loliUsed;
      case 'xuemuo': return (p.flags.xuemuoUsed || 0) >= 2;
      case 'liangyuan': return (p.flags.liangyuanUsed || 0) >= 2;
      case 'suosuo': return false;
      default: return false;
    }
  }

  function skillUsable(p, id) {
    if (!G) return { ok: false, reason: '牌局尚未开始' };
    if (G.over) return { ok: false, reason: '牌局已结束' };
    if (!hasSkill(p, id)) return { ok: false, reason: '尚未获得此技能' };
    if (G.turn !== p.side) return { ok: false, reason: '现在不是你的回合' };
    if (G.phase !== 'play') return { ok: false, reason: '只能在出牌阶段发动' };
    if (G.busy) return { ok: false, reason: '请等待当前结算完成' };
    if (skillUsedFlag(p, id)) return { ok: false, reason: '本回合已发动过' };

    if (id === 'danxiao') {
      const counts = { spade: 0, heart: 0, club: 0, diamond: 0 };
      p.hand.forEach(function (c) { if (counts[c.suit] != null) counts[c.suit] += 1; });
      if (!Object.keys(counts).some(function (s) { return counts[s] >= 2; })) {
        return { ok: false, reason: '需要两张同花色手牌' };
      }
      return { ok: true, reason: '' };
    }

    if (id === 'zhushu') {
      if ((p.marks.yi || 0) < 1) return { ok: false, reason: '没有“忆”' };
      return { ok: true, reason: '' };
    }

    if (id === 'shituo') {
      if ((p.marks.yi || 0) < 2) return { ok: false, reason: '需要2枚“忆”' };
      return { ok: true, reason: '' };
    }

    if (id === 'shishu_mo') {
      if ((p.marks.mo || 0) < 1) return { ok: false, reason: '没有“墨”' };
      if (!allPlayers().some(function (t) { return t && t.alive && targetHasZone(t); })) {
        return { ok: false, reason: '场上没有可取牌的角色' };
      }
      return { ok: true, reason: '' };
    }
    if (id === 'duangeng') {
      return { ok: true, reason: '' };
    }
    if (id === 'shenfa') {
      if (!p.flags.shenfaFree && archiveCount(p) < 1) return { ok: false, reason: '简牍区没有牌' };
      return { ok: true, reason: '' };
    }
    if (id === 'chengshen') {
      return { ok: true, reason: '' };
    }
    if (id === 'suxu') {
      if (!p.flags.suxuFree && (p.marks.xu || 0) < 1) return { ok: false, reason: '没有“叙”' };
      if (!allPlayers().some(function (t) { return t && t.alive && targetHasZone(t); })) return { ok: false, reason: '场上没有可取牌的角色' };
      return { ok: true, reason: '' };
    }
    if (id === 'tonglu') {
      if (!allPlayers().some(function (t) { return t && t.alive && t !== p; })) return { ok: false, reason: '没有可绑定的角色' };
      return { ok: true, reason: '' };
    }
    if (id === 'tizai') {
      if (!allPlayers().some(function (t) { return t && t.alive && t !== p; })) return { ok: false, reason: '没有可作为锚点的角色' };
      return { ok: true, reason: '' };
    }
    if (id === 'qiusuo') {
      if (!G.deck.length && !G.wasteland.length) return { ok: false, reason: '牌堆为空' };
      return { ok: true, reason: '' };
    }
    if (id === 'baoshi') {
      if ((p.marks.fan || 0) < 3) return { ok: false, reason: '需要3枚“大白饭”' };
      return { ok: true, reason: '' };
    }
    if (id === 'lieqi') {
      if (!G.deck.length && !G.wasteland.length) return { ok: false, reason: '牌堆为空' };
      return { ok: true, reason: '' };
    }
    if (id === 'loli') {
      const units = (p.marks.ma || 0) % 10;
      if (units <= 0) return { ok: false, reason: '“妈”的个位数为0' };
      if (!p.hand.some(function (c) { return c.type === 'basic'; })) return { ok: false, reason: '没有基本牌可弃' };
      return { ok: true, reason: '' };
    }
    if (id === 'xuemuo') {
      if ((p.flags.xuemuoUsed || 0) >= 2) return { ok: false, reason: '本回合血魔已用尽' };
      if (p.maxHp <= 1 && p.hp <= 1) return { ok: false, reason: '没有可转化的体力' };
      return { ok: true, reason: '' };
    }
    if (id === 'suosuo') {
      if (p.flags.zhinianMode !== 'free' && (p.marks.yuan || 0) < 1) return { ok: false, reason: '需要1枚缘' };
      if (!allPlayers().some(function (x) { return x && x.alive && x.hand.length; })) return { ok: false, reason: '没有可封存的手牌' };
      return { ok: true, reason: '' };
    }
    if (id === 'liangyuan') {
      const n = (p.lifeZone || []).length;
      if (n < 1) return { ok: false, reason: '余生区没有牌' };
      if (n <= 3 && (p.marks.yuan || 0) < 0.5) return { ok: false, reason: '需要0.5枚缘' };
      if (n >= 4 && n <= 6 && (p.marks.yuan || 0) < 1) return { ok: false, reason: '需要1枚缘' };
      if (n >= 7) {
        if ((p.marks.yuan || 0) < 3) return { ok: false, reason: '需要3枚缘' };
        if (!allPlayers().some(function (x) { return x && x.alive && x !== p && x.hp < p.hp; })) return { ok: false, reason: '没有体力低于你的目标' };
      }
      return { ok: true, reason: '' };
    }
    if (id === 'duantu') {
      if ((p.marks.xu || 0) < 5) return { ok: false, reason: '需要5枚“叙”' };
      if (!allPlayers().some(function (t) { return t && t.alive && t !== p; })) return { ok: false, reason: '没有目标' };
      return { ok: true, reason: '' };
    }

    if (id === 'yanxing') {
      if (!canUseSlash(p)) return { ok: false, reason: '本回合【杀】已用尽' };
      if (!p.hand.some(function (c) { return c.color === 'black'; })) {
        return { ok: false, reason: '没有黑色手牌' };
      }
      return { ok: true, reason: '' };
    }

    if (id === 'sui_mansui') {
      if (p.maxHp > 2) return { ok: false, reason: '体力上限大于2，无法发动' };
      if ((p.marks.sui || 0) < 1) return { ok: false, reason: '没有“穗”' };
      if (!canUseSlash(p) && p.hp >= p.maxHp) {
        return { ok: false, reason: '本回合【杀】已用尽，且体力已满' };
      }
      return { ok: true, reason: '' };
    }

    if (id === 'hongguan') {
      if (!p.hand.length) return { ok: false, reason: '需要一张手牌作为弃置代价' };
      return { ok: true, reason: '' };
    }

    if (id === 'tunri') {
      if (!p.hand.length) return { ok: false, reason: '需要一张手牌作为弃置代价' };
      const targets = livingEnemies(p);
      if (!targets.some(function (t) { return canReach(p, t); })) {
        return { ok: false, reason: '攻击范围内没有对手' };
      }
      return { ok: true, reason: '' };
    }

    if (id === 'chuangwang') {
      if ((p.flags.chuangwangUsed || 0) >= 1) return { ok: false, reason: '本回合已发动过' };
      if (p.flags.chuangwangBuff) return { ok: false, reason: '下一张牌已获得闯王效果' };
      return { ok: true, reason: '' };
    }

    if (id === 'qiaoshe') {
      if (!p.hand.length) return { ok: false, reason: '需要一张手牌' };
      return { ok: true, reason: '' };
    }

    if (id === 'shishu') return { ok: true, reason: '' };
    if (id === 'caiwei') return { ok: true, reason: '' };
    if (id === 'xinlan') {
      if (!p.hand.length) return { ok: false, reason: '需要一张手牌' };
      return { ok: true, reason: '' };
    }

    return { ok: false, reason: '此技能不能主动发动' };
  }

  function resetNewTurnFlags() {
    allPlayers().forEach(function (p) {
      if (!p) return;
      p.flags.lianyingUsed = false;
      p.flags.gongshengUsed = false;
      p.flags.bomingUsed = false;
      p.flags.fengchangUsed = false;
      p.flags.jiuBuff = 0;
      p.flags.jiuTurn = 0;
      p.flags.taoTurn = 0;
      p.flags.eggTao = false;
      p.flags.eggJiu = false;
      p.flags.baizhanUsed = false;
      p.flags.youhuaUsed = false;
      p.flags.jinguiUsed = false;
      p.flags.humeiUsed = false;
      p.flags.yiweiUsed = false;
      p.flags.zhaoyingUsed = false;
      p.flags.tanshiUsed = false;
      p.flags.baguaUsed = false;
      p.flags.buyiUsed = false;
      p.flags.zhanjueUsed = false;
      p.flags.zhanjueSlash = false;
      p.flags.zhanjueHeal = false;
      p.flags.suiyouUsed = false;
      p.flags.jiuyouUsed = false;
      p.flags.hujiaUsed = false;
      p.flags.lieqiongHit = 0;
      p.flags.lieqiongDamagePlus = false;
      p.flags.lieqiongInvalid = false;
      p.flags.lieqiongNoHeart = false;
      p.flags.sishouUsed = false;
      p.flags.guchengPrepareUsed = false;
      p.flags.guchengRule = false;
      p.flags.guchengCap = 0;
      p.flags.choushiTimes = 0;
      p.flags.duangengUsed = false;
      p.flags.shenfaUsed = false;
      p.flags.chengshenUsed = false;
      p.flags.noShanTurn = false;
      p.flags.chahuaUsed = false;
      p.flags.duantuUsed = false;
      p.flags.tongluUsed = false;
      p.flags.qiusuoUsed = false;
      p.flags.suanliTrickUsed = false;
      p.flags.fanGained = 0;
      p.flags.baoshiUsed = false;
      p.flags.lieqiUsed = false;
      p.flags.loliUsed = false;
      p.flags.liangyuanUsed = 0;
      p.flags.xuemuoUsed = 0;
    });
  }

  function resetPlayFlags(p) {
    p.flags.slashUsed = 0;
    p.flags.cardsThisTurn = 0;
    p.flags.cishaUsed = false;
    p.flags.danxiaoUsed = false;
    p.flags.qinxinUsed = false;
    p.flags.zhushuUsed = false;
    p.flags.shituoUsed = false;
    p.flags.yanxingUsed = false;
    p.flags.hongguanUsed = false;
    p.flags.chuangwangUsed = 0;
    p.flags.chuangwangBuff = false;
    p.flags.xijuanDraws = 0;
    p.flags.qiaosheUsed = false;
    p.flags.shishuUsed = false;
    p.flags.caiweiUsed = false;
    p.flags.tunriUsed = false;
    p.flags.xinlanUsed = false;
    p.flags.jiuUsed = false;
  }

  /* =======================================================
     牌堆
     ======================================================= */

  function drawTopCard() {
    if (G.wastelandActive) {
      if (!G.wasteland.length) return null;
      return G.wasteland.pop() || null;
    }
    if (!G.deck.length) {
      if (!G.discard.length) return null;
      G.deck = shuffle(G.discard.slice());
      G.discard.length = 0;
      log('牌堆已尽，弃牌堆重新洗入牌堆。', 'log-system');
      emit();
    }
    return G.deck.pop() || null;
  }

  async function drawCards(p, n, opts) {
    opts = opts || {};
    if (!p || !p.alive || G.over) return [];
    const drawn = [];
    const count = Math.max(0, n | 0);
    for (let i = 0; i < count; i += 1) {
      const card = drawTopCard();
      if (!card) {
        log('牌堆与弃牌堆皆空，无牌可摸。', 'log-system');
        break;
      }
      p.hand.push(card);
      p.stats.cardsDrawn += 1;
      drawn.push(card);
      if (ui() && ui().markNewCard) ui().markNewCard(card.uid, p.side);
      emit();
      if (!opts.silent && count <= 3) await beat(110);
    }
    if (drawn.length) {
      log(tag(p) + ' 摸了 ' + drawn.length + ' 张牌。', 'log-' + (p.side === 'player' ? 'player' : 'ai'));
      if (hasSkill(p, 'ganfan')) gainDabaifan(p, 1, '摸牌');
      if (p.side === 'player' && ui() && ui().toast) {
        // 不显示具体牌名，只给一个轻提示
      }
    }
    emit();
    return drawn;
  }

  function gainDabaifan(p, n, reason) {
    if (!p || !p.alive || !hasSkill(p, 'ganfan')) return 0;
    const hasLiang = hasSkill(p, 'liangsheng');
    const cap = hasLiang ? 8 : 6;
    const perTurn = hasLiang ? 3 : 2;
    const have = p.marks.fan || 0;
    const gained = p.flags.fanGained || 0;
    let gain = Math.max(0, Math.min(n | 0, perTurn - gained, cap - have));
    if (hasLiang && gained === 0) gain = Math.min(gain + 1, perTurn - gained, cap - have);
    if (!gain) return 0;
    p.marks.fan = have + gain;
    p.flags.fanGained = gained + gain;
    log(tag(p) + ' 的【干饭】获得 ' + gain + ' 枚大白饭（' + p.marks.fan + '/' + cap + '）。' + (hasLiang && gained === 0 ? ' 梁圣赐饭，额外+1。' : ''), 'log-skill');
    if (ui() && ui().float) ui().float(p.side, '饭+' + gain, 'is-mark');
    return gain;
  }

  function takeCardOfRank(rank) {
    rank = Number(rank) | 0;
    if (rank < 1 || rank > 13) return null;
    const pick = function (arr) {
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        if (Number(arr[i].rank) === rank) return arr.splice(i, 1)[0];
      }
      return null;
    };
    let card = pick(G.deck);
    if (!card) card = pick(G.wasteland);
    return card || null;
  }

  function removeBuquSuit(p, card) {
    if (!p || !card || !p.flags || !p.flags.buquSuits || !p.flags.buquSuits.length) return;
    const idx = p.flags.buquSuits.indexOf(card.suit);
    if (idx < 0) return;
    p.flags.buquSuits.splice(idx, 1);
    log(tag(p) + ' 打出' + cardFull(card) + '，移除【不屈】记录的' + card.suitName + '花色。', 'log-skill');
  }

  function gainYuan(p, n) {
    if (!p || !p.alive || !hasSkill(p, 'suosuo')) return;
    p.marks.yuan = Math.round(((p.marks.yuan || 0) + n) * 2) / 2;
    log(tag(p) + ' 的【穗锁】获得 ' + n + ' 枚缘（' + p.marks.yuan + '）。', 'log-skill');
  }

  function spendYuan(p, n) {
    if (!p || (p.marks.yuan || 0) < n) return false;
    p.marks.yuan = Math.round(((p.marks.yuan || 0) - n) * 2) / 2;
    return true;
  }

  function playLaofangVoice(p, key) {
    if (!p || !p.general || p.general.id !== 'laofang') return;
    if (ui() && ui().Sound && ui().Sound.playVoice) ui().Sound.playVoice(key);
  }

  function gainMa(p, card) {
    if (!p || !p.alive || !hasSkill(p, 'nijiang') || !card) return;
    const rank = Math.max(1, Math.min(13, Number(card.rank) || 1));
    const before = Math.floor((p.marks.ma || 0) / 10);
    p.marks.ma = (p.marks.ma || 0) + rank;
    const after = Math.floor(p.marks.ma / 10);
    log(tag(p) + ' 的【尼酱】获得 ' + rank + ' 枚“妈”（' + p.marks.ma + '）。', 'log-skill');
    if (after > before) {
      playLaofangVoice(p, 'oniichan');
      for (let t = before + 1; t <= after; t += 1) {
        if (t < 1 || t > 13) continue;
        const extra = takeCardOfRank(t);
        if (!extra) {
          log(tag(p) + ' 的“妈”十位数变为 ' + t + '，但牌堆中没有点数 ' + t + ' 的牌。', 'log-system');
          continue;
        }
        p.hand.push(extra);
        if (ui() && ui().markNewCard) ui().markNewCard(extra.uid, p.side);
        log(tag(p) + ' 的“妈”十位数变为 ' + t + '，获得' + cardFull(extra) + '。', 'log-skill');
      }
    }
    if (ui() && ui().float) ui().float(p.side, '妈+' + rank, 'is-mark');
  }

  function removeFromHand(p, card) {
    const idx = p.hand.findIndex(function (c) { return c.uid === card.uid; });
    if (idx < 0) return null;
    return p.hand.splice(idx, 1)[0];
  }

  function discardFromHand(p, card, silent) {
    const removed = removeFromHand(p, card);
    if (!removed) return null;
    G.discard.push(removed);
    if (!silent) {
      log(tag(p) + ' 弃置了【' + esc(removed.name) + '】。', 'log-system');
    }
    return removed;
  }

  function discardCardObject(card) {
    if (!card) return;
    G.discard.push(card);
  }

  function pickRandomHandCard(p) {
    if (!p || !p.hand.length) return null;
    return p.hand[Math.floor(Math.random() * p.hand.length)];
  }

  function cardName(card) {
    return card ? '【' + esc(card.name) + '】' : '';
  }

  function cardFull(card) {
    if (!card) return '';
    if (card.virtual) return '【' + esc(card.name) + '】';
    return '【' + esc(card.name) + '·' + esc(card.suitName) + esc(card.rankLabel) + '】';
  }

  function virtualCard(name, sourceLabel, sourceCard) {
    const kindKey = name === '桃' ? 'tao' : name === '闪' ? 'shan' : 'sha';
    const kind = MMS.CARD_KINDS[kindKey];
    const suit = sourceCard ? sourceCard.suit : 'heart';
    const suitMeta = MMS.SUITS[suit] || MMS.SUITS.heart;
    virtualSeq += 1;
    return {
      uid: 'v' + virtualSeq,
      kind: name === '桃' ? 'tao' : name === '闪' ? 'shan' : 'sha',
      name: name,
      type: 'basic',
      typeLabel: '虚拟牌',
      target: name === '闪' ? 'none' : name === '桃' ? 'self' : 'enemy',
      virtual: true,
      suit: suit,
      suitName: sourceLabel || suitMeta.name,
      suitSymbol: sourceCard ? sourceCard.suitSymbol : '穗',
      color: sourceCard ? sourceCard.color : 'red',
      rank: sourceCard ? sourceCard.rank : '穗',
      rankLabel: sourceCard ? sourceCard.rankLabel : '穗',
      glyph: kind.glyph,
      art: (MMS.CARD_ART && MMS.CARD_ART[kindKey]) || '',
      seal: sourceLabel ? '穗' : '杀',
      desc: kind.desc,
      flavor: sourceLabel || '以命换命。'
    };
  }

  /* =======================================================
     开局
     ======================================================= */

  Engine.getCheats = function () { return Object.assign({}, cheats); };
  Engine.setCheats = function (next) {
    cheats = Object.assign({}, cheats, next || {});
    if (G) G.cheats = Object.assign({}, cheats);
    return Object.assign({}, cheats);
  };

  Engine.startGame = function (opts) {
    opts = opts || {};
    const playerGen = MMS.generalById(opts.playerGeneralId) || MMS.GENERALS[0];
    const mode = opts.mode === '1v5' ? '1v5' : (opts.mode === '1v2' ? '1v2' : '1v1');
    const aiCount = mode === '1v5' ? 5 : (mode === '1v2' ? 2 : 1);
    const avoidIds = lastEnemyGeneralIds.slice();
    const candidates = MMS.GENERALS.filter(function (g) {
      return g.id !== playerGen.id && g.name !== playerGen.name && avoidIds.indexOf(g.id) < 0;
    });
    const fallbackCandidates = MMS.GENERALS.filter(function (g) {
      return g.id !== playerGen.id && g.name !== playerGen.name;
    });
    const requestedIds = Array.isArray(opts.aiGeneralIds)
      ? opts.aiGeneralIds.slice()
      : (opts.aiGeneralId ? [opts.aiGeneralId] : []);
    const requested = [];
    requestedIds.forEach(function (id) {
      const g = MMS.generalById(id);
      if (!g || g.id === playerGen.id) return;
      if (requested.some(function (x) { return x.id === g.id; })) return;
      requested.push(g);
    });
    const manual = requested.length > 0;
    const fillPool = shuffle((manual ? fallbackCandidates : (candidates.length ? candidates : fallbackCandidates))
      .filter(function (g) {
        return !requested.some(function (x) { return x.id === g.id; }) && g.name !== playerGen.name;
      }));
    const aiGens = requested.slice(0, aiCount);
    while (aiGens.length < aiCount) {
      const pick = fillPool.shift() || fallbackCandidates.find(function (g) {
        return !aiGens.some(function (x) { return x.id === g.id; }) && g.id !== playerGen.id;
      });
      if (!pick) break;
      aiGens.push(pick);
    }
    lastEnemyGeneralIds = aiGens.map(function (g) { return g.id; });
    const difficulty = MMS.difficultyById(opts.difficulty);
    const ais = aiGens.map(function (g, i) {
      return createPlayer(g, i === 0 ? 'ai' : 'ai' + (i + 1));
    });

    G = {
      player: createPlayer(playerGen, 'player'),
      ais: ais,
      ai: ais[0] || null,
      ai2: ais[1] || null,
      ai3: ais[2] || null,
      ai4: ais[3] || null,
      ai5: ais[4] || null,
      mode: mode,
      activeAI: null,
      deck: shuffle(MMS.buildDeck(mode)),
      discard: [],
      wasteland: [],
      wastelandActive: false,
      turn: 'player',
      phase: 'setup',
      round: 0,
      turnCount: 0,
      deathThisTurn: 0,
      busy: true,
      over: false,
      eggDamageDone: false,
      winner: null,
      difficulty: difficulty,
      cheats: Object.assign({}, cheats, opts.cheats || {}),
      log: [],
      logId: 0,
      humanTurnResolve: null,
      delayScale: opts.delayScale == null ? 1 : opts.delayScale,
      selectedUid: null,
      judgingCard: null,
      newCards: new Set(),
      startedAt: Date.now()
    };

    if (allPlayers().some(function (p) { return hasSkill(p, 'tujin'); })) {
      G.wasteland = shuffle(G.deck.concat(G.discard));
      G.deck = [];
      G.discard = [];
      G.wastelandActive = true;
      log('【途馑】发动：所有牌堆与弃牌堆合并为荒仓（' + G.wasteland.length + '张）。', 'log-skill');
    }

    emit();
    runOpening();
    return G;
  };

  async function runOpening() {
    log('崇祯十七年，四月。天下大旱，饿殍千里。', 'log-system');
    const foes = G.ais.map(tag).join('、');
    if (G.mode === '1v5') {
      log('你在乱世中坐下，四周是 ' + foes + '。五名对手，一局定生死。', 'log-system');
    } else if (G.mode === '1v2') {
      log('你在乱世中坐下，对面是 ' + foes + '。', 'log-system');
    } else {
      log('你在乱世中坐下，对面是 ' + foes + '。', 'log-system');
    }
    banner(G.mode === '1v5' ? '一挑五' : (G.mode === '1v2' ? '一挑二' : '乱世相逢'),
      G.mode === '1v5' ? '五名对手，按座次计算距离' : (G.mode === '1v2' ? '两名对手，一局定生死' : '一局定生死'), 'gold');
    emit();
    await beat(700);
    await drawCards(G.player, 4, { silent: true });
    for (const ai of G.ais) await drawCards(ai, 4, { silent: true });
    allPlayers().forEach(function (p) {
      if (!hasSkill(p, 'neishang') || p.hand.length <= 2) return;
      const removed = p.hand.splice(2);
      removed.forEach(function (c) { G.discard.push(c); });
      log(tag(p) + ' 的【内伤】发作：初始手牌变为2张。', 'log-skill');
    });
    allPlayers().forEach(function (p) {
      if (hasSkill(p, 'shishu_mo')) {
        p.marks.mo = 2;
        log(tag(p) + ' 的【诗书】获得2枚“墨”。', 'log-skill');
      }
      if (hasSkill(p, 'suxu')) {
        p.marks.xu = 3;
        log(tag(p) + ' 的【穗叙】获得3枚“叙”。', 'log-skill');
      }
      if (hasSkill(p, 'xixue')) {
        p.marks.kuang = 1;
        log(tag(p) + ' 的【吸血】开局获得1枚“狂”。', 'log-skill');
      }
      if (hasSkill(p, 'suosuo')) {
        p.marks.yuan = 3;
        log(tag(p) + ' 的【穗锁】开局获得3枚“缘”。', 'log-skill');
      }
    });
    log(G.mode === '1v5' ? '你与五名对手各摸四张起始手牌。牌局开始。' : '双方各摸四张起始手牌。牌局开始。', 'log-system');
    emit();
    await beat(500);
    beginTurn('player');
  }

  /* =======================================================
     回合流程
     ======================================================= */

  async function performZhanjue(p) {
    if (!p || !p.alive || !hasSkill(p, 'zhanjue') || p.flags.zhanjueUsed) return;
    p.flags.zhanjueUsed = true;
    const lost = Math.max(0, p.maxHp - p.hp);
    let choice = 'now';
    if (p.side === 'player') {
      choice = await ui().choose({
        kicker: '斩决 · 界限突破',
        title: '斩决：以血换箭，或以伤养战',
        sub: '当前体力 ' + p.hp + '/' + p.maxHp + '，已损失 ' + lost + ' 点。选择本阶段的一次斩决。',
        options: [
          {
            value: 'now',
            label: '摸 ' + p.hp + ' 张牌 · 下一张【杀】无距离且不可闪',
            desc: '本阶段下一张【杀】可以无视距离，目标不能打出【闪】。'
          },
          {
            value: 'lost',
            label: '摸 ' + lost + ' 张牌 · 下次伤害后回复等量体力',
            desc: '本阶段下一次造成伤害后，回复等同于伤害值的体力。'
          }
        ],
        cancelable: false
      });
      choice = choice === 'lost' ? 'lost' : 'now';
    } else {
      const hasSlash = p.hand.some(isSlashCard);
      choice = (hasSlash || p.hp <= 2) ? 'now' : 'lost';
    }
    p.stats.skillsUsed += 1;
    if (choice === 'now') {
      await drawCards(p, p.hp, { silent: true });
      p.flags.zhanjueSlash = true;
      log(tag(p) + ' 发动【斩决】，摸' + p.hp + '张牌；本阶段下一张【杀】无距离限制且不能被【闪】响应。', 'log-skill');
      toast('斩决 · 以血换箭', 'is-skill');
      if (ui() && ui().float) ui().float(p.side, '斩决 · 箭出无回', 'is-mark');
    } else {
      await drawCards(p, lost, { silent: true });
      p.flags.zhanjueHeal = true;
      log(tag(p) + ' 发动【斩决】，摸' + lost + '张牌；本阶段下一次造成伤害后回复等量体力。', 'log-skill');
      toast('斩决 · 以伤养战', 'is-skill');
      if (ui() && ui().float) ui().float(p.side, '斩决 · 伤返', 'is-mark');
    }
    emit();
    await beat(420);
  }

  function rankNumber(card) {
    if (!card) return 0;
    const map = { A: 1, J: 11, Q: 12, K: 13 };
    if (map[card.rank]) return map[card.rank];
    return Number(card.rank) || 0;
  }

  async function performYusui(p) {
    if (!p || !p.alive || !hasSkill(p, 'yusui') || G.over) return false;
    let use = false;
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '遇穗 · 摸牌阶段之前',
        title: '要跳过摸牌阶段，赌一次穗运吗？',
        sub: '展示牌堆顶一张牌，猜下一张点数更大或更小。猜对则体力上限+1并可继续；结束时获得所有展示过的牌。',
        options: [
          { value: 'yes', label: '发动【遇穗】', desc: '跳过摸牌阶段，开始猜牌。' },
          { value: 'no', label: '正常摸牌', desc: '照常摸两张牌。' }
        ],
        cancelable: false
      });
      use = choice === 'yes';
    } else {
      use = p.hand.length <= 3;
    }
    if (!use) return false;

    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【遇穗】，跳过摸牌阶段。', 'log-skill');
    toast('遇穗 · 穗落谁手', 'is-skill');
    emit();
    await beat(300);

    const shown = [];
    let rounds = 0;
    let guard = 0;
    while (!G.over && guard < 8) {
      guard += 1;
      const first = drawTopCard();
      if (!first) {
        log('牌堆已空，【遇穗】中止。', 'log-system');
        break;
      }
      shown.push(first);
      const firstText = first.suitName + first.rankLabel + '【' + first.name + '】';
      let guess = 'higher';
      if (p.side === 'player') {
        const choice = await ui().choose({
          kicker: '遇穗 · 猜点数',
          title: '下一张牌会更大，还是更小？',
          sub: '牌堆顶第一张：' + firstText + '。猜测下一张牌的点数大于或小于它；相等则猜错。',
          options: [
            { value: 'higher', label: '更大', desc: '下一张点数大于 ' + first.rankLabel + '。' },
            { value: 'lower', label: '更小', desc: '下一张点数小于 ' + first.rankLabel + '。' }
          ],
          cancelable: false
        });
        guess = choice === 'lower' ? 'lower' : 'higher';
      } else {
        guess = rankNumber(first) <= 7 ? 'higher' : 'lower';
      }

      const second = drawTopCard();
      if (!second) {
        log('牌堆已空，【遇穗】只展示了一张牌。', 'log-system');
        break;
      }
      shown.push(second);
      const secondText = second.suitName + second.rankLabel + '【' + second.name + '】';
      const correct = guess === 'higher'
        ? rankNumber(second) > rankNumber(first)
        : rankNumber(second) < rankNumber(first);
      log(tag(p) + ' 展示 ' + firstText + ' 与 ' + secondText + '，猜' + (guess === 'higher' ? '更大' : '更小') + '：' + (correct ? '猜对' : '猜错') + '。', 'log-skill');
      emit();
      await beat(320);

      if (!correct) {
        toast('遇穗 · 猜错，穗落', 'is-danger');
        break;
      }

      let reward = 'max';
      const canMax = p.maxHp < 10;
      const canHeal = p.hp < p.maxHp;
      if (p.side === 'player' && (canMax || canHeal)) {
        const options = [];
        if (canMax) options.push({ value: 'max', label: '增加体力上限', desc: '体力上限 +1，最多到10。当前 ' + p.maxHp + '。' });
        if (canHeal) options.push({ value: 'heal', label: '回复体力', desc: '回复1点体力。当前 ' + p.hp + '/' + p.maxHp + '。' });
        reward = await ui().choose({
          kicker: '遇穗 · 猜对',
          title: '要体力上限，还是要回复？',
          sub: '猜对了。增加1点体力上限（不超过10），或回复1点体力。',
          options: options,
          cancelable: false
        });
      } else if (p.side !== 'player') {
        reward = (canHeal && (!canMax || p.hp <= 1)) ? 'heal' : 'max';
      }
      if (reward === 'heal' && canHeal) {
        await heal(p, 1, '遇穗');
        log(tag(p) + ' 猜对，选择回复1点体力（' + p.hp + '/' + p.maxHp + '）。', 'log-heal');
        toast('遇穗 · 猜对，回复1点', 'is-success');
        if (ui() && ui().float) ui().float(p.side, '穗 · 回复1', 'is-heal');
      } else if (canMax) {
        p.maxHp = Math.min(10, p.maxHp + 1);
        log(tag(p) + ' 猜对，体力上限+1（' + p.maxHp + '，上限10）。', 'log-heal');
        toast('遇穗 · 猜对，体力上限 +1', 'is-success');
        if (ui() && ui().float) ui().float(p.side, '穗 +1上限', 'is-heal');
      } else {
        log(tag(p) + ' 猜对，但体力上限已达10且体力已满，无额外收益。', 'log-system');
      }
      rounds += 1;
      p.stats.skillsUsed += 1;
      emit();
      await beat(360);

      if (p.side === 'player') {
        const again = await ui().choose({
          kicker: '遇穗 · 继续',
          title: '还要继续猜吗？',
          sub: '已猜对 ' + rounds + ' 次，体力上限 ' + p.maxHp + '。继续猜错则停止；已展示的牌都会收入手牌。',
          options: [
            { value: 'yes', label: '继续', desc: '再赌一张。' },
            { value: 'no', label: '收手', desc: '停止猜牌，获得已展示的牌。' }
          ],
          cancelable: false
        });
        if (again !== 'yes') break;
      } else if (rounds >= 2) {
        break;
      }
    }

    shown.forEach(function (c) {
      p.hand.push(c);
      p.stats.cardsDrawn += 1;
      if (ui() && ui().markNewCard) ui().markNewCard(c.uid, p.side);
    });
    if (shown.length) {
      log(tag(p) + ' 获得【遇穗】展示的 ' + shown.length + ' 张牌。', 'log-skill');
      if (ui() && ui().toast) ui().toast('获得 ' + shown.length + ' 张展示牌', 'is-success');
    }
    emit();
    await beat(360);
    return true;
  }

  function archiveCount(p) {
    return p && Array.isArray(p.archive) ? p.archive.length : 0;
  }

  function shirenProtected(p) {
    return !!(p && p.alive && hasSkill(p, 'shiren') && archiveCount(p) >= 2);
  }

  function isSingleTargetTrick(card) {
    return !!(card && card.type === 'trick' && card.target === 'enemy' && !isAoeCard(card));
  }

  async function loseInk(p, n, reason) {
    if (!p || !p.alive) return 0;
    const have = p.marks.mo || 0;
    const lost = Math.max(0, Math.min(have, n | 0));
    if (!lost) return 0;
    p.marks.mo = have - lost;
    log(tag(p) + ' 失去 ' + lost + ' 枚“墨”（' + reason + '）。', 'log-skill');
    await drawCards(p, lost, { silent: true });
    emit();
    return lost;
  }

  function addInk(p, n) {
    if (!p) return 0;
    p.marks.mo = Math.max(0, (p.marks.mo || 0) + (n | 0));
    return p.marks.mo;
  }

  async function performShishuMo(p) {
    if (!p || !p.alive || !hasSkill(p, 'shishu_mo') || G.over) return;
    if ((p.marks.mo || 0) < 1) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive && targetHasZone(t); });
    if (!targets.length) return;
    let target = targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '诗书 · 墨',
        title: '要把谁的牌收入简牍？',
        sub: '消耗1枚“墨”，将一名角色的一张牌置于你的简牍区。回合结束时归还原主，除非被断更永久留下。',
        options: targets.map(function (t) {
          return {
            value: t.side,
            label: t.general.name + ' · ' + t.general.subtitle,
            desc: '手牌 ' + t.hand.length + ' · 装备 ' + targetEquipZones(t).length + ' 张'
          };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || targets[0];
    }
    const zone = await chooseTargetZone(target, p, '诗书', 'steal');
    if (!zone) return;
    let card = null;
    if (zone.type === 'equip') {
      card = removeTargetEquip(target, zone.slot);
    } else {
      card = await chooseEnemyHandCard(target, p, '诗书', 'steal');
      if (card) removeFromHand(target, card);
    }
    if (!card) return;

    await loseInk(p, 1, '诗书');
    p.archive.push({ card: card, ownerSide: target.side, permanent: false });
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【诗书】，将 ' + tag(target) + ' 的' + cardFull(card) + '收入简牍区。', 'log-skill');
    toast('诗书 · 简牍 +1', 'is-skill');
    emit();
    await beat(360);
  }

  async function performDuangeng(p) {
    if (!p || !p.alive || !hasSkill(p, 'duangeng') || p.flags.duangengUsed || G.over) return;
    p.flags.duangengUsed = true;
    p.flags.skipPlayTurns = (p.flags.skipPlayTurns || 0) + 1;
    p.archive.forEach(function (entry) { entry.permanent = true; });
    log(tag(p) + ' 发动【断更】：简牍区的牌永久保留，跳过下一个出牌阶段。', 'log-skill');
    toast('断更 · 此页不还', 'is-danger');
    await loseInk(p, p.marks.mo || 0, '断更');
    p.stats.skillsUsed += 1;
    emit();
    await beat(520);
  }

  async function performShenci(p) {
    if (!p || !p.alive || !hasSkill(p, 'shenci') || p.flags.shenciUsed || G.over) return;
    if (archiveCount(p) < 4) return;
    p.flags.shenciUsed = true;
    p.flags.awakened = true;
    gainSkill(p, 'chengshen');
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 的【神赐】觉醒：简牍区达到4张，获得【成神】。', 'log-skill');
    toast('觉醒 · 神赐', 'is-skill');
    if (ui() && ui().awaken) ui().awaken(p.side);
    emit();
    await beat(620);
  }

  async function performChengshen(p) {
    if (!p || !p.alive || !hasSkill(p, 'chengshen') || p.flags.chengshenUsed || G.over) return;
    p.flags.chengshenUsed = true;
    addInk(p, 2);
    p.flags.shenfaFree = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【成神】：获得2枚“墨”，【神罚】不再消耗简牍区的牌。', 'log-skill');
    toast('成神 · 神罚无价', 'is-success');
    emit();
    await beat(520);
  }

  function noteKill(source, target) {
    if (!source || !target) return;
    if (source.side === 'player' && source.general && target.general) {
      source.stats.kills = source.stats.kills || {};
      source.stats.kills[target.general.id] = (source.stats.kills[target.general.id] || 0) + 1;
      if (source.general.id === 'xishuimen' && target.general && target.general.id === 'suishi_shumo') {
        source.stats.xishuimenKilledShumo = (source.stats.xishuimenKilledShumo || 0) + 1;
      }
    }
  }

  async function directKill(target, source) {
    if (!target || !target.alive || G.over) return;
    target.hp = 0;
    target.alive = false;
    G.deathThisTurn = (G.deathThisTurn || 0) + 1;
    grantSuxuOnDeath(target);
    noteKill(source, target);
    target.flags.dying = false;
    log(tag(source) + ' 的直接死亡效果抹去了 ' + tag(target) + '。', 'log-result');
    banner('神罚', target.general.name + ' 被从简牍上抹去', 'red');
    if (ui() && ui().hit) ui().hit(target.side);
    emit();
    await beat(760);
    if (target.side === 'player') {
      endGame('ai', '你被从简牍上抹去了。');
    } else if (!livingEnemies(G.player).length) {
      endGame('player', G.mode === '1v5' ? '五名对手皆已从简牍上抹去。' : '对手已从简牍上抹去。');
    } else {
      log('一名对手被抹去，还剩 ' + livingEnemies(G.player).length + ' 名。', 'log-result');
      emit();
    }
  }

  async function performShenfa(p) {
    if (!p || !p.alive || !hasSkill(p, 'shenfa') || p.flags.shenfaUsed || G.over) return;
    if (!p.flags.shenfaFree && archiveCount(p) < 1) return;
    p.flags.shenfaUsed = true;

    let removedCard = null;
    if (!p.flags.shenfaFree) {
      if (p.side === 'player') {
        const choice = await ui().choose({
          kicker: '神罚 · 简牍',
          title: '要移出哪一张简牍？',
          sub: '移出简牍区的牌，然后降下神罚。',
          options: p.archive.map(function (entry, i) {
            return {
              value: String(i),
              label: entry.card.suitName + entry.card.rankLabel + '【' + entry.card.name + '】',
              desc: '原主：' + (playerBySide(entry.ownerSide) ? playerBySide(entry.ownerSide).general.name : '已阵亡') + (entry.permanent ? ' · 永久' : ' · 待归还')
            };
          }),
          cancelable: false
        });
        const idx = Math.max(0, Math.min(p.archive.length - 1, Number(choice) || 0));
        removedCard = p.archive.splice(idx, 1)[0];
      } else {
        removedCard = p.archive.shift();
      }
      if (!removedCard) return;
      p.flags.shenfaRemoved = (p.flags.shenfaRemoved || 0) + 1;
      G.discard.push(removedCard.card);
    }

    const canDeath = (p.flags.shenfaRemoved || 0) >= 4 && !p.flags.shenfaDeathUsed;
    const targets = allPlayers().filter(function (t) { return t && t.alive; });
    if (!targets.length) return;
    let target = targets.find(function (t) { return t.side !== p.side; }) || targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '神罚 · 目标',
        title: '降罚于谁？',
        sub: '选择一名角色。' + (canDeath ? '累计移出4张，本次可以直接令其死亡。' : ''),
        options: targets.map(function (t) {
          return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '体力 ' + Math.max(0, t.hp) + '/' + t.maxHp };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || target;
    }
    let mode = 'damage';
    if (p.side === 'player') {
      const options = [
        { value: 'damage', label: '造成1点伤害', desc: '对目标造成1点伤害。' },
        { value: 'lose', label: '流失1点体力', desc: '令目标流失1点体力。' }
      ];
      if (canDeath) options.push({ value: 'death', label: '直接死亡', desc: '将目标从简牍上抹去。' });
      mode = await ui().choose({
        kicker: '神罚 · 降罚',
        title: '选择神罚方式',
        sub: '简牍已移出 ' + (p.flags.shenfaRemoved || 0) + ' 张。',
        options: options,
        cancelable: false
      });
    } else {
      mode = canDeath && target.hp <= 1 ? 'death' : 'damage';
    }

    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【神罚】' + (removedCard ? '，移出简牍【' + esc(removedCard.card.name) + '】' : '') + '。', 'log-skill');
    toast('神罚 · 天页', 'is-skill');
    emit();
    await beat(320);

    if (mode === 'death' && canDeath) {
      p.flags.shenfaDeathUsed = true;
      if (p.side === 'player') p.stats.shenfaKills = (p.stats.shenfaKills || 0) + 1;
      await directKill(target, p);
      return;
    }
    if (mode === 'lose') {
      target.hp = Math.max(0, target.hp - 1);
      log(tag(target) + ' 被【神罚】令流失1点体力（' + target.hp + '/' + target.maxHp + '）。', 'log-damage');
      if (ui() && ui().float) ui().float(target.side, '-1', 'is-damage');
      emit();
      await beat(360);
      if (target.hp <= 0 && target.alive) await enterDying(target, p);
      return;
    }
    await dealDamage(p, target, 1, { reason: '神罚' });
  }

  async function returnArchive(p) {
    if (!p || !Array.isArray(p.archive)) return;
    const keep = [];
    const returned = [];
    p.archive.forEach(function (entry) {
      if (entry.permanent) { keep.push(entry); return; }
      const owner = playerBySide(entry.ownerSide);
      if (owner && owner.alive) {
        owner.hand.push(entry.card);
        if (ui() && ui().markNewCard) ui().markNewCard(entry.card.uid, owner.side);
      } else {
        G.discard.push(entry.card);
      }
      returned.push(entry.card);
    });
    p.archive = keep;
    if (returned.length) {
      log(tag(p) + ' 的【简牍区】归还 ' + returned.length + ' 张牌。', 'log-system');
      emit();
      await beat(300);
    }
  }

  function narrativeCount(p) {
    return p && Array.isArray(p.narrative) ? p.narrative.length : 0;
  }

  function tizaiActive(p) {
    if (!p || !p.flags.tizaiAnchorSide) return false;
    return (p.flags.tizaiExpireRound || 0) >= G.round;
  }

  async function performTizai(p) {
    if (!p || !p.alive || !hasSkill(p, 'tizai') || p.flags.tizaiUsed || G.over) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive && t !== p; });
    if (!targets.length) return;
    let target = targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '替灾 · 锚点',
        title: '选定一名角色作为锚点',
        sub: '直到你的下回合结束：你受到的伤害与回复转移给锚点。锚点累计承受3次转移后直接死亡。',
        options: targets.map(function (t) {
          return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '体力 ' + t.hp + '/' + t.maxHp };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || targets[0];
    }
    p.flags.tizaiUsed = true;
    p.flags.tizaiAnchorSide = target.side;
    p.flags.tizaiHits = 0;
    p.flags.tizaiExpireRound = G.round + 1;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【替灾】，锚点定为 ' + tag(target) + '。', 'log-skill');
    toast('替灾 · 福祸有锚', 'is-skill');
    emit();
    await beat(520);
  }

  function captureTurnSnapshot() {
    const players = {};
    allPlayers().forEach(function (p) {
      if (!p || !p.alive) return;
      players[p.side] = {
        hp: p.hp,
        maxHp: p.maxHp,
        hand: p.hand.slice(),
        weapon: p.weapon,
        armor: p.armor,
        mounts: { offense: p.mounts && p.mounts.offense, defense: p.mounts && p.mounts.defense },
        judge: (p.judge || []).slice()
      };
    });
    return { turn: G.turnCount, players: players, deaths: 0 };
  }

  function extractCardEverywhere(card) {
    if (!card) return;
    allPlayers().forEach(function (q) {
      if (!q) return;
      q.hand = q.hand.filter(function (c) { return c.uid !== card.uid; });
      if (q.weapon && q.weapon.uid === card.uid) q.weapon = null;
      if (q.armor && q.armor.uid === card.uid) q.armor = null;
      if (q.mounts && q.mounts.offense && q.mounts.offense.uid === card.uid) q.mounts.offense = null;
      if (q.mounts && q.mounts.defense && q.mounts.defense.uid === card.uid) q.mounts.defense = null;
      q.judge = (q.judge || []).filter(function (c) { return c.uid !== card.uid; });
      if (q.archive) q.archive = q.archive.filter(function (e) { return e.card.uid !== card.uid; });
      if (q.narrative) q.narrative = q.narrative.filter(function (e) { return e.card.uid !== card.uid; });
    });
    G.deck = G.deck.filter(function (c) { return c.uid !== card.uid; });
    G.discard = G.discard.filter(function (c) { return c.uid !== card.uid; });
    G.wasteland = G.wasteland.filter(function (c) { return c.uid !== card.uid; });
  }

  async function performChahua(p) {
    if (!p || !p.alive || !hasSkill(p, 'chahua') || p.flags.chahuaUsed || G.over) return;
    if (!G.deathThisTurn) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive; });
    if (!targets.length) return;
    let target = targets.find(function (t) { return t.side !== p.side; }) || targets[0];
    let snap = G.currentSnapshot;
    if (p.side === 'player' && p.flags.chahuaAny && G.previousSnapshot && G.previousSnapshot.players) {
      const choice = await ui().choose({
        kicker: '茶话 · 时序回溯',
        title: '要回溯哪一段时辰？',
        sub: '选择本回合或上一回合的快照，重置一名存活角色的体力、手牌与装备。',
        options: [
          { value: 'current', label: '本回合', desc: '回到本回合开始时。' },
          { value: 'previous', label: '上一回合', desc: '回到上一回合开始时。' }
        ],
        cancelable: false
      });
      if (choice === 'previous') snap = G.previousSnapshot;
    }
    if (!snap || !snap.players) return;
    if (p.side === 'player' && targets.length > 1) {
      const choice = await ui().choose({
        kicker: '茶话 · 回溯对象',
        title: '要回溯哪名角色？',
        sub: '将其体力、手牌与装备重置到选定回合开始。',
        options: targets.map(function (t) { return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '当前体力 ' + t.hp + '/' + t.maxHp }; }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || target;
    }
    const saved = snap.players[target.side];
    if (!saved) return;

    // 当前手牌、装备、判定区全部弃置
    target.hand.splice(0).forEach(function (c) { G.discard.push(c); });
    [target.weapon, target.armor, target.mounts && target.mounts.offense, target.mounts && target.mounts.defense].forEach(function (c) {
      if (c) G.discard.push(c);
    });
    target.weapon = null;
    target.armor = null;
    if (target.mounts) { target.mounts.offense = null; target.mounts.defense = null; }
    (target.judge || []).splice(0).forEach(function (c) { G.discard.push(c); });
    target.judge = [];

    saved.hand.forEach(function (c) { extractCardEverywhere(c); target.hand.push(c); });
    if (saved.weapon) extractCardEverywhere(saved.weapon);
    if (saved.armor) extractCardEverywhere(saved.armor);
    if (saved.mounts && saved.mounts.offense) extractCardEverywhere(saved.mounts.offense);
    if (saved.mounts && saved.mounts.defense) extractCardEverywhere(saved.mounts.defense);
    target.weapon = saved.weapon;
    target.armor = saved.armor;
    if (target.mounts) {
      target.mounts.offense = saved.mounts.offense;
      target.mounts.defense = saved.mounts.defense;
    }
    (saved.judge || []).forEach(function (c) { extractCardEverywhere(c); target.judge.push(c); });
    target.hp = Math.min(target.maxHp, saved.hp);
    p.flags.chahuaUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【茶话】，将 ' + tag(target) + ' 的生命轨迹回溯至' + (snap === G.previousSnapshot ? '上一回合' : '本回合') + '开始。', 'log-skill');
    toast('茶话 · 时序回溯', 'is-skill');
    emit();
    await beat(620);
    await drawCards(p, 2, { silent: true });
  }

  async function performGuicheng(p) {
    if (!p || !p.alive || !hasSkill(p, 'guicheng') || p.flags.guichengAwakened || G.over) return;
    if (!G.wastelandActive || G.wasteland.length > 10) return;
    p.flags.guichengAwakened = true;
    p.flags.suxuFree = true;
    p.flags.chahuaAny = true;
    p.flags.awakened = true;
    gainSkill(p, 'duantu');
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 的【归程】觉醒：荒仓仅余' + G.wasteland.length + '张。穗叙不再消耗叙，茶话可回溯上一回合，获得【断途】。', 'log-skill');
    toast('觉醒 · 归程', 'is-skill');
    if (ui() && ui().awaken) ui().awaken(p.side);
    emit();
    await beat(720);
  }

  async function performDuantu(p) {
    if (!p || !p.alive || !hasSkill(p, 'duantu') || p.flags.duantuUsed || (p.marks.xu || 0) < 5 || G.over) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive && t !== p; });
    if (!targets.length) return;
    let target = targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '断途 · 终章',
        title: '选择一名角色，直接死亡',
        sub: '消耗5枚“叙”，该死亡无法被阻止。',
        options: targets.map(function (t) {
          return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '体力 ' + t.hp + '/' + t.maxHp };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || targets[0];
    }
    p.marks.xu -= 5;
    p.flags.duantuUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【断途】，耗尽5枚“叙”，令 ' + tag(target) + ' 走向终局。', 'log-skill');
    toast('断途 · 无归', 'is-danger');
    emit();
    await beat(420);
    await directKill(target, p);
  }

  function clearTonglu(p) {
    if (!p || !p.flags.tongluSide) return;
    const bound = playerBySide(p.flags.tongluSide);
    if (bound) {
      bound.flags.hungry = false;
      bound.flags.hungryBySide = null;
    }
    p.flags.tongluSide = null;
    p.flags.tongluExpireRound = 0;
  }

  async function performTonglu(p) {
    if (!p || !p.alive || !hasSkill(p, 'tonglu') || p.flags.tongluUsed || G.over) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive && t !== p; });
    if (!targets.length) return;
    let target = targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '同路 · 绑定',
        title: '要与谁同路？',
        sub: '绑定敌方：其获得【饥】，每打出一张牌须交给你一张手牌。持续到你的下回合。',
        options: targets.map(function (t) {
          return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '手牌 ' + t.hand.length + ' · 体力 ' + t.hp + '/' + t.maxHp };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || targets[0];
    }
    clearTonglu(p);
    p.flags.tongluUsed = true;
    p.flags.tongluSide = target.side;
    p.flags.tongluExpireRound = G.round + 1;
    target.flags.hungry = true;
    target.flags.hungryBySide = p.side;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【同路】，与 ' + tag(target) + ' 绑定；其获得【饥】。', 'log-skill');
    toast('同路 · 饥', 'is-skill');
    emit();
    await beat(420);
  }

  async function performSuxu(p) {
    if (!p || !p.alive || !hasSkill(p, 'suxu') || G.over) return;
    if (!p.flags.suxuFree && (p.marks.xu || 0) < 1) return;
    const targets = allPlayers().filter(function (t) { return t && t.alive && targetHasZone(t); });
    if (!targets.length) return;
    let target = targets[0];
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '穗叙 · 叙事标记',
        title: '要取谁的牌？',
        sub: '移入叙事区，回合结束归还；然后摸一张牌，或令其本回合不能打出【闪】。',
        options: targets.map(function (t) {
          return { value: t.side, label: t.general.name + ' · ' + t.general.subtitle, desc: '手牌 ' + t.hand.length + ' · 装备 ' + targetEquipZones(t).length + ' 张' };
        }),
        cancelable: false
      });
      target = targets.find(function (t) { return t.side === choice; }) || targets[0];
    }
    const zone = await chooseTargetZone(target, p, '穗叙', 'steal');
    if (!zone) return;
    let card = null;
    if (zone.type === 'equip') card = removeTargetEquip(target, zone.slot);
    else {
      card = await chooseEnemyHandCard(target, p, '穗叙', 'steal');
      if (card) removeFromHand(target, card);
    }
    if (!card) return;
    if (!p.flags.suxuFree) p.marks.xu = Math.max(0, (p.marks.xu || 0) - 1);
    p.narrative.push({ card: card, ownerSide: target.side, permanent: false });
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【穗叙】，将 ' + tag(target) + ' 的' + cardFull(card) + '收入叙事区。', 'log-skill');
    emit();
    await beat(300);

    let mode = 'draw';
    if (p.side === 'player') {
      mode = await ui().choose({
        kicker: '穗叙 · 续写',
        title: '要摸牌，还是令其不能出闪？',
        sub: '选择一项结算。',
        options: [
          { value: 'draw', label: '摸一张牌', desc: '你摸一张牌。' },
          { value: 'noshan', label: '令其本回合不能出闪', desc: tag(target) + ' 本回合不能打出【闪】。' }
        ],
        cancelable: false
      });
    } else {
      mode = target.hp <= 1 ? 'noshan' : 'draw';
    }
    if (mode === 'noshan') {
      target.flags.noShanTurn = true;
      log(tag(target) + ' 因【穗叙】本回合不能打出【闪】。', 'log-skill');
      toast('穗叙 · 封闪', 'is-skill');
    } else {
      await drawCards(p, 1, { silent: true });
    }
    emit();
    await beat(260);
  }

  async function returnNarrative(p) {
    if (!p || !Array.isArray(p.narrative)) return;
    const keep = [];
    const returned = [];
    p.narrative.forEach(function (entry) {
      if (entry.permanent) { keep.push(entry); return; }
      const owner = playerBySide(entry.ownerSide);
      if (owner && owner.alive) {
        owner.hand.push(entry.card);
        if (ui() && ui().markNewCard) ui().markNewCard(entry.card.uid, owner.side);
      } else G.discard.push(entry.card);
      returned.push(entry.card);
    });
    p.narrative = keep;
    if (returned.length) {
      log(tag(p) + ' 的【叙事区】归还 ' + returned.length + ' 张牌。', 'log-system');
      emit();
      await beat(260);
    }
  }

  function grantSuxuOnDeath(dead) {
    allPlayers().forEach(function (p) {
      if (!p || !p.alive || !hasSkill(p, 'suxu')) return;
      p.marks.xu = (p.marks.xu || 0) + 1;
      log(tag(p) + ' 因 ' + tag(dead) + ' 阵亡获得1枚“叙”。', 'log-skill');
    });
  }

  async function performQiusuo(p) {
    if (!p || !p.alive || !hasSkill(p, 'qiusuo') || p.flags.qiusuoUsed || G.over) return;
    const extra = Math.max(0, p.flags.qiusuoExtra || 0);
    const viewCount = 4 + extra;
    const top = [];
    for (let i = 0; i < viewCount; i += 1) {
      const c = drawTopCard();
      if (!c) break;
      top.push(c);
    }
    if (!top.length) return;
    const takeCount = Math.min(top.length, 2 + extra);
    let chosen = [];
    if (p.side === 'player') {
      const picked = await ui().pickCards({
        kicker: '求索 · 深海检索',
        title: '从牌堆顶选择' + takeCount + '张',
        sub: '获得选中的牌，其余放回牌堆底。' + (extra ? '深潜余波：本次额外多拿1张。' : ''),
        cards: top.slice(),
        min: takeCount,
        max: takeCount,
        confirmLabel: '获得这些牌',
        cancelable: true
      });
      if (!picked || !picked.length) {
        if (G.wastelandActive) G.wasteland.unshift.apply(G.wasteland, top);
        else G.deck.unshift.apply(G.deck, top);
        emit();
        return;
      }
      chosen = top.filter(function (c) { return picked.indexOf(c.uid) >= 0; });
    } else {
      chosen = top.slice().sort(function (a, b) { return keepValue(b) - keepValue(a); }).slice(0, takeCount);
    }
    if (!chosen.length) chosen = [top[0]];
    p.flags.qiusuoUsed = true;
    p.flags.qiusuoExtra = 0;
    p.stats.skillsUsed += 1;
    const rest = top.filter(function (c) { return !chosen.some(function (x) { return x.uid === c.uid; }); });
    chosen.forEach(function (c) {
      p.hand.push(c);
      if (ui() && ui().markNewCard) ui().markNewCard(c.uid, p.side);
    });
    if (G.wastelandActive) G.wasteland.unshift.apply(G.wasteland, rest);
    else G.deck.unshift.apply(G.deck, rest);
    log(tag(p) + ' 发动【求索】，观看牌堆顶 ' + top.length + ' 张，获得 ' + chosen.length + ' 张，其余置于牌堆底。', 'log-skill');
    toast('求索 · 深海检索', 'is-skill');
    emit();
    await beat(260);
    const kinds = {};
    chosen.forEach(function (c) { kinds[c.type] = true; });
    if (Object.keys(kinds).length > 1) {
      log(tag(p) + ' 获得的牌类型不同，【求索】令其再摸1张。', 'log-skill');
      await drawCards(p, 1, { silent: true });
    }
    emit();
    await beat(300);
  }

  async function performBaoshi(p) {
    if (!p || !p.alive || !hasSkill(p, 'baoshi') || p.flags.baoshiUsed || G.over) return;
    const have = p.marks.fan || 0;
    if (have < 3) return;
    const feast = have >= 6;
    const cost = feast ? 6 : 3;
    p.marks.fan = have - cost;
    p.flags.baoshiUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【暴食】，消耗 ' + cost + ' 枚大白饭（余 ' + p.marks.fan + ' 枚）。', 'log-skill');
    toast(feast ? '暴食 · Token溢出' : '暴食 · 加餐', 'is-success');
    if (feast) {
      if (ui() && ui().awaken) ui().awaken(p.side);
      p.flags.qiusuoUsed = false;
      log(tag(p) + ' 的大白饭溢出，【求索】被重置。', 'log-skill');
    }
    emit();
    await beat(260);
    await drawCards(p, feast ? 3 : 2, { silent: true });
    await heal(p, 1, '暴食');
    emit();
    await beat(320);
  }

  function putCardsOnTop(cards) {
    if (!cards || !cards.length) return;
    const arr = G.wastelandActive ? G.wasteland : G.deck;
    for (let i = cards.length - 1; i >= 0; i -= 1) arr.push(cards[i]);
  }

  async function performLieqi(p) {
    if (!p || !p.alive || !hasSkill(p, 'lieqi') || p.flags.lieqiUsed || G.over) return;
    const top = [];
    for (let i = 0; i < 8; i += 1) {
      const c = drawTopCard();
      if (!c) break;
      top.push(c);
    }
    if (!top.length) return;
    const x = Math.min(top.length, Math.max(0, p.hp + p.hand.length));
    let order = top.slice();
    if (p.side === 'player' && ui() && ui().lieqiOrder) {
      const picked = await ui().lieqiOrder({ cards: top.slice(), x: x });
      if (!picked) {
        putCardsOnTop(top);
        emit();
        return;
      }
      order = picked.map(function (uid) { return top.find(function (c) { return c.uid === uid; }); }).filter(Boolean);
      if (!order.length) order = top.slice();
    }
    p.flags.lieqiUsed = true;
    p.stats.skillsUsed += 1;
    playLaofangVoice(p, 'zakou');
    log(tag(p) + ' 发动【猎奇】，观看牌堆顶 ' + top.length + ' 张，准备依次使用前 ' + x + ' 张。', 'log-skill');
    toast('猎奇 · 牌堆翻面', 'is-skill');
    emit();
    await beat(300);

    let used = 0;
    const rest = [];
    for (let i = 0; i < order.length; i += 1) {
      const card = order[i];
      if (!card) continue;
      if (used >= x || !G || G.over) {
        rest.push(card);
        continue;
      }
      p.hand.push(card);
      if (ui() && ui().markNewCard) ui().markNewCard(card.uid, p.side);
      emit();
      const check = Engine.canPlay(card, p);
      if (!check.ok) {
        removeFromHand(p, card);
        rest.push(card);
        continue;
      }
      let ok = false;
      try {
        if (p.side === 'player') {
          G.busy = false;
          ok = await Engine.humanUseCard(card.uid);
          G.busy = true;
        } else {
          const target = card.target === 'enemy' ? (livingEnemies(p)[0] || p) : p;
          ok = await playCard(p, target, card);
        }
      } catch (err) {
        console.error(err);
        ok = false;
      }
      if (ok) {
        used += 1;
      } else {
        const still = p.hand.find(function (c) { return c.uid === card.uid; });
        if (still) removeFromHand(p, still);
        rest.push(card);
      }
      emit();
      if (!G || G.over) break;
    }
    putCardsOnTop(rest);
    log(tag(p) + ' 的【猎奇】结束，实际使用 ' + used + ' 张，其余 ' + rest.length + ' 张留在牌堆顶。', 'log-skill');
    emit();
    await beat(320);
  }

  async function performLoli(p) {
    if (!p || !p.alive || !hasSkill(p, 'loli') || p.flags.loliUsed || G.over) return;
    const units = (p.marks.ma || 0) % 10;
    if (units <= 0) return;
    const basics = p.hand.filter(function (c) { return c.type === 'basic'; });
    if (!basics.length) return;
    let card = null;
    if (p.side === 'player' && ui() && ui().pickCards) {
      const picked = await ui().pickCards({
        kicker: '萝莉 · 闪电仪式',
        title: '弃置一张基本牌',
        sub: '“妈”的个位数是 ' + units + '，所有其他角色各进行 ' + units + ' 次闪电判定。',
        cards: basics,
        min: 1,
        max: 1,
        confirmLabel: '弃置并落雷',
        cancelable: true
      });
      if (!picked || !picked.length) return;
      card = basics.find(function (c) { return c.uid === picked[0]; }) || null;
    } else {
      card = basics.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0] || null;
    }
    if (!card) return;
    removeFromHand(p, card);
    G.discard.push(card);
    p.flags.loliUsed = true;
    p.stats.skillsUsed += 1;
    playLaofangVoice(p, 'zakou');
    log(tag(p) + ' 发动【萝莉】，弃置' + cardFull(card) + '，引动 ' + units + ' 道闪电。', 'log-skill');
    toast('萝莉 · 妈到雷到', 'is-danger');
    emit();
    await beat(260);
    const targets = allPlayers().filter(function (x) { return x && x.alive && x !== p; });
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      for (let j = 0; j < units; j += 1) {
        if (!G || G.over || !target.alive) break;
        const judged = await doJudge(target, '萝莉 · 闪电');
        if (!judged) break;
        const rank = Number(judged.rank);
        if (judged.suit === 'spade' && rank >= 2 && rank <= 9) {
          log('闪电劈中 ' + tag(target) + '：黑桃' + judged.rankLabel + '，受到3点雷电伤害。', 'log-damage');
          if (ui() && ui().float) ui().float(target.side, '雷', 'is-damage');
          await dealDamage(p, target, 3, { reason: '萝莉 · 闪电', element: 'thunder' });
          break;
        }
        log('闪电未中：' + tag(target) + ' 判定为 ' + judged.suitName + judged.rankLabel + '。', 'log-system');
      }
      emit();
      await beat(220);
    }
    await beat(300);
  }

  async function performXuemuo(p) {
    if (!p || !p.alive || !hasSkill(p, 'xuemuo') || (p.flags.xuemuoUsed || 0) >= 2 || G.over) return;
    const maxToHp = p.maxHp > 1;
    const hpToMax = p.hp > 1;
    if (!maxToHp && !hpToMax) return;
    let mode = maxToHp ? 'maxToHp' : 'hpToMax';
    if (p.side === 'player') {
      const options = [];
      if (maxToHp) options.push({ value: 'maxToHp', label: '扣体力上限 → 回复体力', desc: '扣除1~' + (p.maxHp - 1) + '点体力上限，回复等量体力。' });
      if (hpToMax) options.push({ value: 'hpToMax', label: '扣体力 → 提高体力上限', desc: '扣除1~' + (p.hp - 1) + '点体力，提高等量体力上限。' });
      options.push({ value: 'none', label: '不发动', desc: '保留当前体力结构。' });
      const picked = await ui().choose({
        kicker: '血魔 · 血肉转化',
        title: '选择转化方向',
        sub: '本回合还可发动 ' + (2 - (p.flags.xuemuoUsed || 0)) + ' 次。',
        options: options,
        cancelable: false
      });
      if (!picked || picked === 'none') return;
      mode = picked;
    } else {
      mode = (p.hp <= 1 && maxToHp) ? 'maxToHp' : (hpToMax ? 'hpToMax' : 'maxToHp');
    }
    const maxAmount = mode === 'maxToHp' ? p.maxHp - 1 : p.hp - 1;
    if (maxAmount <= 0) return;
    let amount = 1;
    if (p.side === 'player') {
      const opts = [];
      for (let i = 1; i <= maxAmount; i += 1) {
        opts.push({ value: String(i), label: i + ' 点', desc: mode === 'maxToHp' ? '体力上限 -' + i + '，回复 ' + i + '。' : '体力 -' + i + '，体力上限 +' + i + '。' });
      }
      const pickedAmount = await ui().choose({
        kicker: '血魔 · 数额',
        title: '转化多少？',
        sub: mode === 'maxToHp' ? '当前体力上限 ' + p.maxHp + '，最多扣 ' + maxAmount + '。' : '当前体力 ' + p.hp + '，最多扣 ' + maxAmount + '。',
        options: opts,
        cancelable: false
      });
      amount = Math.max(1, Math.min(maxAmount, Number(pickedAmount) || 1));
    }
    if (mode === 'maxToHp') {
      await reduceMaxHp(p, amount, '血魔');
      await heal(p, amount, '血魔');
      log(tag(p) + ' 发动【血魔】：扣除 ' + amount + ' 点体力上限，回复等量体力。', 'log-skill');
    } else {
      p.hp -= amount;
      p.maxHp += amount;
      log(tag(p) + ' 发动【血魔】：扣除 ' + amount + ' 点体力，体力上限提高 ' + amount + '。', 'log-skill');
    }
    p.flags.xuemuoUsed = (p.flags.xuemuoUsed || 0) + 1;
    p.stats.skillsUsed += 1;
    toast('血魔 · 血肉转化', 'is-skill');
    emit();
    await beat(420);
  }

  async function performSuosuo(p) {
    if (!p || !p.alive || !hasSkill(p, 'suosuo') || G.over) return;
    const free = p.flags.zhinianMode === 'free';
    if (!free && (p.marks.yuan || 0) < 1) return;
    const canExchange = free && (p.lifeZone || []).length > 0 && p.hand.length > 0;
    if (canExchange && p.side === 'player') {
      const mode = await ui().choose({
        kicker: '穗锁 · 觉醒执念',
        title: '要封存，还是交换？',
        sub: '当前缘 ' + (p.marks.yuan || 0) + '；余生区 ' + p.lifeZone.length + ' 张。',
        options: [
          { value: 'seal', label: '封存一张手牌', desc: '免费封存一名角色的一张手牌，继续削减其体力上限。' },
          { value: 'swap', label: '等量交换', desc: '用一张手牌交换一张余生区的牌，不消耗缘。' },
          { value: 'none', label: '取消', desc: '不发动。' }
        ],
        cancelable: false
      });
      if (!mode || mode === 'none') return;
      if (mode === 'swap') {
        const handPick = await ui().pickCards({ kicker: '穗锁 · 交换', title: '选择一张手牌', cards: p.hand.slice(), min: 1, max: 1, confirmLabel: '交换', cancelable: true });
        if (!handPick || !handPick.length) return;
        const lifePick = await ui().pickCards({ kicker: '穗锁 · 交换', title: '选择一张余生牌', cards: p.lifeZone.slice(), min: 1, max: 1, confirmLabel: '换回', cancelable: true });
        if (!lifePick || !lifePick.length) return;
        const handCard = p.hand.find(function (c) { return c.uid === handPick[0]; });
        const lifeCard = p.lifeZone.find(function (c) { return c.uid === lifePick[0]; });
        if (!handCard || !lifeCard) return;
        removeFromHand(p, handCard);
        p.lifeZone = p.lifeZone.filter(function (c) { return c.uid !== lifeCard.uid; });
        p.hand.push(lifeCard);
        p.lifeZone.push(handCard);
        log(tag(p) + ' 发动【穗锁】，用' + cardFull(handCard) + '换回余生区的' + cardFull(lifeCard) + '。', 'log-skill');
        toast('穗锁 · 等量交换', 'is-skill');
        emit();
        await beat(320);
        return;
      }
    }

    const targets = allPlayers().filter(function (x) { return x && x.alive && x.hand.length; });
    if (!targets.length) return;
    let target = null;
    if (p.side === 'player') {
      const pick = await ui().choose({
        kicker: '穗锁 · 封存手牌',
        title: '选择一名角色，封存其一张手牌',
        sub: '其他角色每被你封存一张牌，体力上限永久-1（最低1）。',
        options: targets.map(function (x) {
          return { value: x.side, label: x.general.name + ' · ' + x.general.subtitle, desc: '体力 ' + Math.max(0, x.hp) + '/' + x.maxHp + ' · 手牌 ' + x.hand.length + (x === p ? ' · 自己' : ' · 上限-1') };
        }),
        cancelable: false
      });
      target = targets.find(function (x) { return x.side === pick; }) || null;
    } else {
      target = targets.filter(function (x) { return x !== p; }).sort(function (a, b) { return a.hp - b.hp; })[0] || targets[0];
    }
    if (!target) return;
    if (!free && !spendYuan(p, 1)) return;
    const sealed = pickRandomHandCard(target);
    if (!sealed) return;
    removeFromHand(target, sealed);
    p.lifeZone.push(sealed);
    if (target !== p) {
      target.maxHp = Math.max(1, target.maxHp - 1);
      if (target.hp > target.maxHp) target.hp = target.maxHp;
    }
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【穗锁】，将 ' + tag(target) + ' 的一张手牌封入余生区（余生 ' + p.lifeZone.length + ' 张）' + (target !== p ? '，其体力上限-1。' : '。'), 'log-skill');
    toast('穗锁 · 余生 -1', 'is-skill');
    emit();
    await beat(300);
  }

  async function performLiangyuan(p) {
    if (!p || !p.alive || !hasSkill(p, 'liangyuan') || (p.flags.liangyuanUsed || 0) >= 2 || G.over) return;
    const n = (p.lifeZone || []).length;
    if (n < 1) return;
    let tier = n <= 3 ? 1 : (n <= 6 ? 4 : 7);
    let costYuan = tier === 1 ? 0.5 : (tier === 4 ? 1 : 3);
    let costLife = tier === 1 ? 1 : (tier === 4 ? Math.ceil(n / 2) : n);
    if ((p.marks.yuan || 0) < costYuan) return;
    let targets = allPlayers().filter(function (x) { return x && x.alive && (tier < 7 || (x !== p && x.hp < p.hp)); });
    if (!targets.length) return;
    let target = null;
    if (p.side === 'player') {
      const pick = await ui().choose({
        kicker: '良缘 · 余生 ' + n + ' 张',
        title: tier === 1 ? '封禁目标技能一回合' : (tier === 4 ? '清空目标手牌与装备' : '直接索命'),
        sub: tier === 1 ? '消耗1张余生牌与0.5枚缘。' : (tier === 4 ? '消耗一半余生牌与1枚缘。' : '消耗全部余生牌与3枚缘；目标体力必须低于你。'),
        options: targets.map(function (x) {
          return { value: x.side, label: x.general.name + ' · ' + x.general.subtitle, desc: '体力 ' + Math.max(0, x.hp) + '/' + x.maxHp + ' · 手牌 ' + x.hand.length };
        }),
        cancelable: false
      });
      target = targets.find(function (x) { return x.side === pick; }) || null;
    } else {
      target = targets.slice().sort(function (a, b) { return a.hp - b.hp; })[0] || null;
    }
    if (!target) return;
    if (tier === 7) {
      if (!spendYuan(p, 3)) return;
      (p.lifeZone || []).splice(0).forEach(function (c) { G.discard.push(c); });
      p.flags.liangyuanUsed = (p.flags.liangyuanUsed || 0) + 1;
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 发动【良缘·索命】，耗尽余生区与3枚缘，令 ' + tag(target) + ' 立即死亡。', 'log-skill');
      toast('良缘 · 余生已尽', 'is-danger');
      if (ui() && ui().awaken) ui().awaken(p.side);
      emit();
      await beat(500);
      await directKill(target, p);
      return;
    }
    if (!spendYuan(p, costYuan)) return;
    const removedLife = (p.lifeZone || []).splice(0, costLife);
    removedLife.forEach(function (c) { G.discard.push(c); });
    p.flags.liangyuanUsed = (p.flags.liangyuanUsed || 0) + 1;
    p.stats.skillsUsed += 1;
    if (tier === 1) {
      target.flags.tempNoSkillsTurn = G.turnCount;
      log(tag(p) + ' 发动【良缘·封技】，令 ' + tag(target) + ' 本回合失去所有非锁定技。', 'log-skill');
      toast('良缘 · 封技', 'is-skill');
    } else {
      target.hand.splice(0).forEach(function (c) { G.discard.push(c); });
      const gear = [];
      if (target.weapon) { gear.push(target.weapon); target.weapon = null; }
      if (target.armor) { gear.push(target.armor); target.armor = null; }
      if (target.mounts) {
        if (target.mounts.offense) { gear.push(target.mounts.offense); target.mounts.offense = null; }
        if (target.mounts.defense) { gear.push(target.mounts.defense); target.mounts.defense = null; }
      }
      gear.forEach(function (c) { G.discard.push(c); });
      log(tag(p) + ' 发动【良缘·清空】，弃置 ' + tag(target) + ' 全部手牌与装备。', 'log-skill');
      toast('良缘 · 清空', 'is-danger');
    }
    emit();
    await beat(420);
  }

  async function performManhePrepare(p) {
    if (!p || !p.alive || !hasSkill(p, 'suosuo')) return;
    if ((p.lifeZone || []).length && (p.judge || []).length) {
      const cleared = p.judge.splice(0);
      cleared.forEach(function (c) { G.discard.push(c); });
      log(tag(p) + ' 的【余生】生效，弃置判定区全部 ' + cleared.length + ' 张牌。', 'log-skill');
      toast('余生 · 判定区清空', 'is-skill');
      emit();
      await beat(260);
    }
    const hasZhinian = p.general.skills.some(function (sk) { return sk.id === 'zhinian'; });
    if (!hasZhinian) return;
    if (!p.flags.zhinianAwake && (p.lifeZone || []).length >= 5) {
      p.flags.zhinianAwake = true;
      gainSkill(p, 'zhinian');
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 的【执念】觉醒：余生区已有 ' + p.lifeZone.length + ' 张牌。', 'log-skill');
      toast('觉醒 · 执念', 'is-success');
      if (ui() && ui().awaken) ui().awaken(p.side);
      emit();
      await beat(520);
    }
    if (!p.flags.zhinianAwake) return;
    // 晨曦选择：不叠加，清空上一回合执念
    p.flags.zhinianMode = '';
    p.flags.zhinianSkipDraw = false;
    p.flags.zhinianSkipDiscard = false;
    p.flags.zhinianDamageBonus = 0;
    p.flags.zhinianInvincibleUntil = -1;
    let mode = 'damage';
    if (p.side === 'player') {
      const pick = await ui().choose({
        kicker: '执念 · 三选一',
        title: '本回合的执念',
        sub: '觉醒后的每个准备阶段选择一项，不能叠加。',
        options: [
          { value: 'free', label: '无消耗穗锁 · 等量交换', desc: '穗锁不消耗缘；可将等量手牌与余生区交换。' },
          { value: 'guard', label: '跳过摸牌 · 无敌', desc: '跳过摸牌阶段，直到下一个出牌阶段前不会受到伤害。' },
          { value: 'damage', label: '伤害+2 · 跳过弃牌', desc: '本回合造成的伤害+2，并跳过弃牌阶段。' }
        ],
        cancelable: false
      });
      mode = pick === 'free' || pick === 'guard' || pick === 'damage' ? pick : 'damage';
    } else {
      mode = p.hp <= 1 ? 'guard' : ((p.lifeZone || []).length >= 5 ? 'free' : 'damage');
    }
    p.flags.zhinianMode = mode;
    p.flags.zhinianTurn = G.turnCount;
    if (mode === 'guard') {
      p.flags.zhinianSkipDraw = true;
      p.flags.zhinianInvincibleUntil = G.turnCount + 1;
    } else if (mode === 'damage') {
      p.flags.zhinianDamageBonus = 2;
      p.flags.zhinianSkipDiscard = true;
    }
    log(tag(p) + ' 选择执念：' + (mode === 'free' ? '穗锁免缘/交换' : (mode === 'guard' ? '跳过摸牌/无敌' : '伤害+2/跳过弃牌')) + '。', 'log-skill');
    emit();
    await beat(280);
  }

  async function performGuchengPrepare(p) {
    if (!p || !p.alive || !hasSkill(p, 'gucheng') || p.flags.guchengPrepareUsed) return;
    p.flags.guchengPrepareUsed = true;
    const othersAlive = allPlayers().filter(function (x) { return x && x !== p && x.alive; }).length;
    const x = othersAlive % 2 === 0 ? othersAlive * 2 : othersAlive;
    const cap = Math.max(1, 7 - x);
    let useRule = true;
    if (p.side === 'player') {
      const choice = await ui().choose({
        kicker: '孤城 · 准备阶段',
        title: '要改写本回合的出牌规则吗？',
        sub: '场上其他存活角色 ' + othersAlive + ' 人；X = ' + x + '，本回合至多使用 ' + cap + ' 张牌。',
        options: [
          {
            value: 'yes',
            label: '修改规则 · 至多 ' + cap + ' 张牌',
            desc: '本回合出牌无距离限制、【杀】次数无限制，但最多使用 ' + cap + ' 张牌。'
          },
          {
            value: 'no',
            label: '不修改 · 正常出牌',
            desc: '保持普通出牌规则。'
          }
        ],
        cancelable: false
      });
      useRule = choice === 'yes';
    } else {
      useRule = cap >= 2;
    }
    p.flags.guchengRule = useRule;
    p.flags.guchengCap = useRule ? cap : 0;
    p.flags.cardsThisTurn = 0;
    if (useRule) {
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 发动【孤城】：本回合无距离与【杀】次数限制，至多使用 ' + cap + ' 张牌（X=' + x + '）。', 'log-skill');
      toast('孤城 · 改写规则', 'is-skill');
    } else {
      log(tag(p) + ' 未改写【孤城】规则，正常出牌。', 'log-system');
    }
    emit();
    await beat(360);
  }

  async function performSuimen(p) {
    if (!p || !p.alive || !hasSkill(p, 'suimen') || p.flags.suimenAwakened || G.over) return;
    if (Math.abs(p.hand.length - p.hp) < 3) return;
    p.flags.suimenAwakened = true;
    p.flags.choushiDouble = true;
    p.flags.awakened = true;
    p.maxHp = Math.max(1, p.maxHp - 1);
    p.hp = Math.min(p.hp, p.maxHp);
    gainSkill(p, 'beishui');
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【穗门】觉醒：手牌与体力相差3以上，失去1点体力上限，获得【背水】；【仇视】在自己回合可发动两次。', 'log-skill');
    toast('觉醒 · 穗门', 'is-skill');
    if (ui() && ui().awaken) ui().awaken(p.side);
    emit();
    await beat(620);
  }

  async function performBeishui(p) {
    if (!p || !p.alive || !hasSkill(p, 'beishui') || p.flags.beishuiAwakened || G.over) return;
    if (p.hand.length >= 2 && p.hp >= 2) return;
    p.flags.beishuiAwakened = true;
    p.flags.choushiHurt = true;
    p.flags.awakened = true;
    p.maxHp = Math.max(1, p.maxHp - 1);
    p.hp = Math.min(p.hp, p.maxHp);
    gainSkill(p, 'qingjiao');
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【背水】觉醒：手牌或体力不足2，失去1点体力上限，获得【清剿】；【仇视】可在受到伤害后发动。', 'log-skill');
    toast('觉醒 · 背水', 'is-skill');
    if (ui() && ui().awaken) ui().awaken(p.side);
    emit();
    await beat(620);
  }

  function qingjiaoPool() {
    return G.deck.concat(G.discard).filter(function (c) {
      return c && c.uid && G.player.hand.concat(G.ais.reduce(function (a, x) { return a.concat(x.hand); }, [])).every(function (h) { return h.uid !== c.uid; });
    });
  }

  async function performQingjiao(p) {
    if (!p || !p.alive || !hasSkill(p, 'qingjiao') || G.over) return;
    let use = false;
    if (p.hand.length) {
      if (p.side === 'player') {
        const choice = await ui().choose({
          kicker: '清剿 · 出牌阶段开始',
          title: '要弃光手牌，换八张不同的牌吗？',
          sub: '弃置当前所有手牌，从牌堆与弃牌堆随机获得八张牌名与类别各不相同的牌；结束阶段弃置所有手牌。',
          options: [
            { value: 'yes', label: '发动【清剿】', desc: '当前手牌 ' + p.hand.length + ' 张。' },
            { value: 'no', label: '不发动', desc: '保留当前手牌。' }
          ],
          cancelable: false
        });
        use = choice === 'yes';
      } else {
        use = p.hand.length <= 3;
      }
    }
    if (!use) return;

    const discarded = p.hand.splice(0);
    discarded.forEach(function (c) { G.discard.push(c); });
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【清剿】，弃置全部手牌，开始清点战利品。', 'log-skill');
    toast('清剿 · 八门俱开', 'is-skill');
    emit();
    await beat(360);

    const pool = shuffle(qingjiaoPool().slice());
    const picked = [];
    const names = {};
    const kinds = {};
    pool.forEach(function (c) {
      if (picked.length >= 8) return;
      if (names[c.name] || kinds[c.kind]) return;
      names[c.name] = true;
      kinds[c.kind] = true;
      picked.push(c);
    });
    const pickedIds = picked.map(function (c) { return c.uid; });
    G.deck = G.deck.filter(function (c) { return pickedIds.indexOf(c.uid) < 0; });
    G.discard = G.discard.filter(function (c) { return pickedIds.indexOf(c.uid) < 0; });
    picked.forEach(function (c) {
      p.hand.push(c);
      p.stats.cardsDrawn += 1;
      if (ui() && ui().markNewCard) ui().markNewCard(c.uid, p.side);
    });
    p.flags.qingjiaoActive = true;
    log(tag(p) + ' 的【清剿】获得 ' + picked.length + ' 张牌名与类别各不相同的牌。', 'log-skill');
    emit();
    await beat(520);
  }

  async function endPhaseEffects(p) {
    if (G.currentSnapshot) G.currentSnapshot.deaths = G.deathThisTurn || 0;
    await performChahua(p);
    await returnArchive(p);
    await returnNarrative(p);
    if (p.flags.tizaiAnchorSide && (p.flags.tizaiExpireRound || 0) <= G.round) {
      p.flags.tizaiAnchorSide = null;
      p.flags.tizaiHits = 0;
      log('【替灾】的锚点契约到期。', 'log-system');
      emit();
      await beat(220);
    }
    if (hasSkill(p, 'shishu_mo')) {
      addInk(p, 1);
      log(tag(p) + ' 的【诗书】在回合结束补充1枚“墨”。', 'log-skill');
      emit();
      await beat(220);
    }
    if (p.flags.qingjiaoActive) {
      p.flags.qingjiaoActive = false;
      const discarded = p.hand.splice(0);
      [p.weapon, p.armor, p.mounts && p.mounts.offense, p.mounts && p.mounts.defense].forEach(function (c) {
        if (c) discarded.push(c);
      });
      discarded.push.apply(discarded, p.judge || []);
      p.weapon = null;
      p.armor = null;
      if (p.mounts) { p.mounts.offense = null; p.mounts.defense = null; }
      p.judge = [];
      discarded.forEach(function (c) { G.discard.push(c); });
      if (discarded.length) {
        log(tag(p) + ' 的【清剿】代价：结束阶段弃置所有牌（' + discarded.length + ' 张）。', 'log-skill');
        toast('清剿 · 尽付一空', 'is-danger');
        emit();
        await beat(420);
      }
    }
    await performSuimen(p);
  }

  async function beginTurn(side) {
    if (!G || G.over) return;
    const p = playerBySide(side);
    if (!p) return;
    if (!p.alive) {
      if (side === 'player') {
        endGame('ai', '你已倒下。');
        return;
      }
      const ns = nextSide(side);
      if (ns) beginTurn(ns);
      return;
    }
    if (side === 'player' && G.mode !== '1v1' && !livingEnemies(G.player).length) {
      endGame('player', G.mode === '1v5' ? '五名对手皆已倒下。' : '两名对手皆已倒下。');
      return;
    }

    G.turn = side;
    G.activeAI = side === 'player' ? null : p;
    G.turnCount += 1;
    G.deathThisTurn = 0;
    if (side === 'player') G.round += 1;
    G.phase = 'turnStart';
    G.busy = true;
    G.selectedUid = null;
    resetNewTurnFlags();
    p.flags.dying = false;

    log('—— 第 ' + G.round + ' 回合 · ' + (side === 'player' ? '你的回合' : esc(p.general.name) + '·' + esc(p.general.subtitle) + '的回合') + ' ——',
      'log-turn');
    banner(side === 'player' ? '你的回合' : p.general.name + '的回合', side === 'player' ? '执牌，落子' : '人机正在思考', side === 'player' ? '' : 'red');
    emit();
    await beat(500);
    if (!G || G.over) return;

    if (G.wastelandActive && !G.wasteland.length) {
      log('荒仓已空，所有存活角色在回合开始流失1点体力。', 'log-damage');
      toast('途馑 · 荒仓已空', 'is-danger');
      const victims = allPlayers().filter(function (x) { return x && x.alive; });
      for (let i = 0; i < victims.length; i += 1) {
        const v = victims[i];
        if (!v.alive) continue;
        v.hp = Math.max(0, v.hp - 1);
        log(tag(v) + ' 因荒仓枯竭流失1点体力（' + v.hp + '/' + v.maxHp + '）。', 'log-damage');
        if (ui() && ui().float) ui().float(v.side, '-1', 'is-damage');
        emit();
        await beat(240);
        if (v.hp <= 0 && v.alive) {
          await enterDying(v, null);
          if (!G || G.over) return;
        }
      }
    }

    if (p.side === 'player' && p.flags.tongluSide && (p.flags.tongluExpireRound || 0) <= G.round) {
      clearTonglu(p);
      log('【同路】绑定到期。', 'log-system');
      emit();
      await beat(220);
    }

    G.previousSnapshot = G.currentSnapshot || null;
    G.currentSnapshot = captureTurnSnapshot();

    // 准备阶段（判定阶段之前）
    if (hasSkill(p, 'suosuo')) {
      await performManhePrepare(p);
      if (!G || G.over) return;
    }
    if (hasSkill(p, 'gucheng') && !p.flags.guchengPrepareUsed) {
      await performGuchengPrepare(p);
      if (!G || G.over) return;
    }
    if (hasSkill(p, 'beishui')) {
      await performBeishui(p);
      if (!G || G.over) return;
    }
    if (hasSkill(p, 'shenci')) {
      await performShenci(p);
      if (!G || G.over) return;
    }
    if (hasSkill(p, 'guicheng')) {
      await performGuicheng(p);
      if (!G || G.over) return;
    }

    // 判定阶段
    G.phase = 'judge';
    emit();
    await beat(260);
    let skipDraw = false;
    let skipPlay = false;
    const carrySkipDraw = (p.flags.skipDrawTurns || 0) > 0;
    const carrySkipPlay = (p.flags.skipPlayTurns || 0) > 0;
    if (carrySkipDraw) p.flags.skipDrawTurns -= 1;
    if (carrySkipPlay) p.flags.skipPlayTurns -= 1;

    if (p.judge.length) {
      const judges = p.judge.slice();
      for (let i = 0; i < judges.length; i += 1) {
        if (G.over) return;
        const card = judges[i];
        p.judge = p.judge.filter(function (c) { return c.uid !== card.uid; });
        if (card.kind !== 'shandian') discardCardObject(card);
        log(tag(p) + ' 判定区中的【' + esc(card.name) + '】开始判定。', 'log-system');
        emit();
        await beat(240);
        const judged = await doJudge(p, card.name);
        if (!judged) {
          if (card.kind === 'shandian') G.discard.push(card);
          log('无牌可判，【' + esc(card.name) + '】未能生效。', 'log-system');
          continue;
        }
        if (card.kind === 'lebu') {
          if (judged.suit !== 'heart') {
            skipPlay = true;
            if (card.doubleSkip) {
              p.flags.skipPlayTurns = (p.flags.skipPlayTurns || 0) + 1;
              log('【闯王】令【乐不思蜀】延长一回合。', 'log-skill');
            }
            log('判定结果不为红桃：' + tag(p) + ' 跳过出牌阶段。', 'log-damage');
            if (ui() && ui().toast) ui().toast('乐不思蜀 · 出牌阶段被跳过', 'is-danger');
          } else {
            log('判定结果为红桃：' + tag(p) + ' 摆脱了乐不思蜀。', 'log-system');
          }
        } else if (card.kind === 'bingliang') {
          if (judged.suit !== 'club') {
            skipDraw = true;
            if (card.doubleSkip) {
              p.flags.skipDrawTurns = (p.flags.skipDrawTurns || 0) + 1;
              log('【闯王】令【兵粮寸断】延长一回合。', 'log-skill');
            }
            log('判定结果不为梅花：' + tag(p) + ' 跳过摸牌阶段。', 'log-damage');
            if (ui() && ui().toast) ui().toast('兵粮寸断 · 摸牌阶段被跳过', 'is-danger');
          } else {
            log('判定结果为梅花：' + tag(p) + ' 撑过了兵粮寸断。', 'log-system');
          }
        } else if (card.kind === 'shandian') {
          const rank = Number(judged.rankLabel);
          if (judged.suit === 'spade' && rank >= 2 && rank <= 9) {
            G.discard.push(card);
            log('【闪电】判定为黑桃' + judged.rankLabel + '，雷光落下！', 'log-damage');
            if (ui() && ui().toast) ui().toast('闪电 · 黑桃' + judged.rankLabel + ' · 3点雷电伤害', 'is-danger');
            const thunderDamage = card.doubleSkip ? 6 : 3;
            if (card.doubleSkip) log('【闯王】令【闪电】伤害翻倍。', 'log-skill');
            emit();
            await beat(320);
            await dealDamage(makeThunderSource(), p, thunderDamage, { reason: '闪电' });
          } else {
            const ns = nextSide(p.side);
            const nextP = playerBySide(ns);
            if (nextP && nextP.alive && !nextP.judge.some(function (c) { return c.kind === 'shandian'; })) {
              nextP.judge.push(card);
              log('【闪电】未劈中，移动到 ' + tag(nextP) + ' 的判定区。', 'log-system');
            } else {
              G.discard.push(card);
              log('【闪电】未劈中，也无人可传，进入弃牌堆。', 'log-system');
            }
          }
        }
        emit();
        await beat(330);
      }
    }

    if (carrySkipPlay) {
      skipPlay = true;
      log('【闯王】的延时效果仍在：' + tag(p) + ' 再次跳过出牌阶段。', 'log-skill');
    }
    if (carrySkipDraw) {
      skipDraw = true;
      log('【闯王】的延时效果仍在：' + tag(p) + ' 再次跳过摸牌阶段。', 'log-skill');
    }

    if (!G || G.over) return;

    // 摸牌阶段
    G.phase = 'draw';
    emit();
    await beat(260);
    let yusuiUsed = false;
    if (!skipDraw && hasSkill(p, 'yusui')) {
      yusuiUsed = await performYusui(p);
      if (!G || G.over) return;
    }
    if (skipDraw || p.flags.zhinianSkipDraw) {
      if (p.flags.zhinianSkipDraw) p.flags.zhinianSkipDraw = false;
      log(tag(p) + ' 的摸牌阶段被跳过。', 'log-system');
    } else if (yusuiUsed) {
      log(tag(p) + ' 以【遇穗】代替了摸牌阶段。', 'log-skill');
    } else {
      let count = 2;
      if (hasSkill(p, 'qianli')) count += 1;
      if (hasSkill(p, 'zhusi')) count += 1;
      if (hasSkill(p, 'suanli')) count += 1;
      if (G.mode === '1v5' && p.side === 'player') count += 2;
      log(tag(p) + ' 进入摸牌阶段。', 'log-system');
      await drawCards(p, count);
    }

    if (!G || G.over) return;

    // 出牌阶段
    if (skipPlay) {
      log(tag(p) + ' 的出牌阶段被跳过。', 'log-system');
      emit();
      await beat(450);
    } else {
      G.phase = 'play';
      resetPlayFlags(p);
      if (hasSkill(p, 'qingjiao')) {
        await performQingjiao(p);
        if (!G || G.over) return;
      }
      if (hasSkill(p, 'zhanjue') && !p.flags.zhanjueUsed) {
        await performZhanjue(p);
        if (!G || G.over) return;
      }
      G.busy = true;
      emit();
      await beat(220);
      if (side === 'player') {
        G.busy = false;
        if (ui() && ui().setHint) ui().setHint('出牌阶段：选择手牌，或点击武将技能。');
        emit();
        await new Promise(function (resolve) { G.humanTurnResolve = resolve; });
        G.humanTurnResolve = null;
        G.busy = true;
        if (!G || G.over) return;
      } else {
        await aiPlay();
      }
    }

    if (!G || G.over) return;

    // 弃牌阶段
    G.phase = 'discard';
    if (p.flags.zhinianSkipDiscard) {
      p.flags.zhinianSkipDiscard = false;
      log(tag(p) + ' 的弃牌阶段被【执念】跳过。', 'log-skill');
    } else {
      emit();
      await beat(280);
      await discardPhase(p);
    }

    if (!G || G.over) return;

    // 结束阶段
    G.phase = 'end';
    emit();
    await beat(320);
    if (!G || G.over) return;
    await endPhaseEffects(p);
    if (!G || G.over) return;

    await beat(260);
    if (!G || G.over) return;
    const nxt = nextSide(p.side);
    if (nxt) beginTurn(nxt);
  }

  async function discardPhase(p) {
    const limit = handLimit(p);
    const excess = p.hand.length - limit;
    if (excess <= 0) {
      emit();
      return;
    }

    if (p.side === 'human' || p.side === 'player') {
      G.busy = true;
      emit();
      const cards = p.hand.slice();
      const result = await ui().pickCards({
        kicker: '弃牌阶段',
        title: '手牌超出上限',
        sub: '手牌上限为 ' + limit + '，请弃置 ' + excess + ' 张手牌。',
        cards: cards,
        min: excess,
        max: excess,
        confirmLabel: '确认弃置',
        cancelable: false,
        validate: function (selected) {
          if (selected.length !== excess) return '请选择 ' + excess + ' 张手牌';
          return '';
        }
      });
      let ids = result || [];
      if (!ids.length) {
        // 防御性兜底：随机弃牌，保证流程不中断
        ids = p.hand.slice(0, excess).map(function (c) { return c.uid; });
      }
      ids.forEach(function (uid) {
        const c = p.hand.find(function (x) { return x.uid === uid; });
        if (c) discardFromHand(p, c, true);
      });
      log('你弃置了 ' + ids.length + ' 张手牌。', 'log-player');
    } else {
      const sorted = p.hand.slice().sort(function (a, b) {
        return keepValue(a) - keepValue(b);
      });
      const toDiscard = sorted.slice(0, excess);
      toDiscard.forEach(function (c) { discardFromHand(p, c, true); });
      if (toDiscard.length) {
        log(tagSoft(p) + ' 弃置了 ' + toDiscard.length + ' 张手牌。', 'log-ai');
      }
    }
    emit();
    await beat(300);
  }

  function keepValue(card) {
    if (!card) return 0;
    switch (card.name) {
      case '桃': return 100;
      case '酒': return 90;
      case '闪': return 85;
      case '无中生有': return 72;
      case '顺手牵羊': return 60;
      case '杀':
      case '雷杀':
      case '火杀': return 55;
      case '乐不思蜀': return 46;
      case '兵粮寸断': return 44;
      case '决斗': return 38;
      case '过河拆桥': return 34;
      case '南蛮入侵': return 28;
      case '万箭齐发': return 30;
      case '无懈可击': return 82;
      case '良的朴刀': return 52;
      case '王生的长剑': return 56;
      case '妖兵的角弓': return 54;
      default: return 10;
    }
  }

  /* =======================================================
     玩家操作入口
     ======================================================= */

  async function choosePlayerTarget(card) {
    const enemies = livingEnemies(G.player);
    if (!enemies.length) return null;
    if (G.mode === '1v1' && enemies.length === 1 && shirenProtected(enemies[0]) && (isSlashCard(card) || isSingleTargetTrick(card))) return null;
    if (G.mode === '1v1' || isAoeCard(card) || enemies.length === 1) return enemies[0];
    const isSlash = isSlashCard(card);
    const options = enemies.map(function (p) {
      const noZone = (card.name === '过河拆桥' || card.name === '顺手牵羊') && !targetHasZone(p);
      const blocked = (card.kind === 'lebu' || card.kind === 'bingliang') &&
        p.judge.some(function (c) { return c.kind === card.kind; });
      const protectedByPoet = shirenProtected(p) && (isSlash || isSingleTargetTrick(card));
      const reachable = !isSlash || cheatPlayer(G.player) || G.player.flags.zhanjueSlash || G.player.flags.guchengRule || hasSkill(G.player, 'shizhan') || canReach(G.player, p);
      const dist = G.mode === '1v5' ? ' · 距离 ' + distanceBetween(G.player, p) + '（范围 ' + attackRange(G.player) + '）' : '';
      return {
        value: p.side,
        label: p.general.name + ' · ' + p.general.subtitle,
        desc: '体力 ' + Math.max(0, p.hp) + '/' + p.maxHp + ' · 手牌 ' + p.hand.length + (p.weapon ? ' · 武器 ' + p.weapon.name : '') + dist + (blocked ? ' · 判定区已有同名牌' : '') + (noZone ? ' · 没有可指定牌' : '') + (!reachable ? ' · 不在攻击范围' : '') + (protectedByPoet ? ' · 诗人：不能被指定' : ''),
        disabled: blocked || noZone || !reachable || protectedByPoet
      };
    });
    const choice = await ui().choose({
      kicker: '指定目标',
      title: '选择一名对手',
      sub: G.mode === '1v5' ? '一挑五：先看座次距离，再看武器攻击范围。' : '一挑二：这张牌只能指定一名对手。',
      options: options,
      cancelable: false
    });
    return enemies.find(function (p) { return p.side === choice; }) || null;
  }

  Engine.humanUseCard = async function (uid) {
    if (!G || G.over) return false;
    if (G.turn !== 'player' || G.phase !== 'play' || G.busy) {
      toast('现在不能出牌。', 'is-danger');
      return false;
    }
    const c = G.player.hand.find(function (x) { return x.uid === uid; });
    if (!c) return false;
    const check = Engine.canPlay(c, G.player);
    if (!check.ok) {
      toast(check.reason, 'is-danger');
      return false;
    }
    G.busy = true;
    G.selectedUid = null;
    emit();
    if (G.player.flags.fengdaoReborn && G.phase === 'play' && c.type === 'trick') {
      const targets = livingEnemies(G.player).filter(function (t) { return targetHasZone(t); });
      let mode = 'jiu';
      if (targets.length) {
        const chooseMode = await ui().choose({
          kicker: '封刀 · 锦囊化形',
          title: '这张锦囊要当作什么使用？',
          sub: '【' + c.name + '】在穗亡后可视为【酒】或【过河拆桥】。',
          options: [
            { value: 'jiu', label: '视为【酒】', desc: '饮下此牌，获得1层酒意。' },
            { value: 'chai', label: '视为【过河拆桥】', desc: '指定一名有牌的角色，拆掉其一张牌。' }
          ],
          cancelable: false
        });
        mode = chooseMode === 'chai' ? 'chai' : 'jiu';
      }
      if (mode === 'chai') {
        const originalName = c.name;
        c.kind = 'chaiqiao';
        c.name = '过河拆桥';
        c.type = 'trick';
        c.target = 'enemy';
        c.responseOnly = false;
        c.fengdaoAsChai = true;
        c.element = null;
        c.glyph = '拆';
        c.seal = '拆';
        c.desc = '出牌阶段，锦囊牌视为【过河拆桥】。';
        let target = primaryEnemy(G.player) || G.ai;
        if (G.mode !== '1v1') {
          target = await choosePlayerTarget(c);
          if (!target) {
            G.busy = false;
            return false;
          }
        }
        log(tag(G.player) + ' 的【封刀】将【' + esc(originalName) + '】视为【过河拆桥】。', 'log-skill');
        toast('封刀 · 锦囊化拆', 'is-skill');
        emit();
        await playCard(G.player, target, c);
      } else {
        log(tag(G.player) + ' 的【封刀】将【' + esc(c.name) + '】视为【酒】。', 'log-skill');
        toast('封刀 · 锦囊化酒', 'is-skill');
        await playCard(G.player, primaryEnemy(G.player) || G.ai, c);
      }
      if (G && !G.over && G.turn === 'player' && G.phase === 'play') {
        G.busy = false;
        emit();
      }
      return true;
    }
    const asSha = G.player.flags.fengdaoReborn && G.phase === 'play' && c.type === 'basic' && !isSlashCard(c) && c.kind !== 'jiu';
    if (asSha) {
      let target = primaryEnemy(G.player) || G.ai;
      if (G.mode !== '1v1') {
        target = await choosePlayerTarget(c);
        if (!target) {
          G.busy = false;
          return false;
        }
      }
      await playCard(G.player, target, c);
      if (G && !G.over && G.turn === 'player' && G.phase === 'play') {
        G.busy = false;
        emit();
      }
      return true;
    }
    let target = primaryEnemy(G.player) || G.ai;
    if (c.target === 'enemy' && !isAoeCard(c) && G.mode !== '1v1') {
      target = await choosePlayerTarget(c);
      if (!target) {
        G.busy = false;
        return false;
      }
    }
    try {
      await playCard(G.player, target, c);
    } catch (err) {
      console.error(err);
      toast('结算出现异常，已跳过本次出牌。', 'is-danger');
    }
    if (G && !G.over && G.turn === 'player' && G.phase === 'play') {
      G.busy = false;
      emit();
    }
    return true;
  };

  Engine.humanEndTurn = function () {
    if (!G || G.over) return;
    if (G.turn !== 'player' || G.phase !== 'play' || G.busy) {
      toast('现在还不能结束回合。', 'is-danger');
      return;
    }
    G.busy = true;
    G.selectedUid = null;
    G.phase = 'ending';
    emit();
    const resolve = G.humanTurnResolve;
    G.humanTurnResolve = null;
    if (resolve) resolve();
  };

  Engine.humanActivateSkill = async function (skillId) {
    if (!G || G.over) return false;
    const state = skillUsable(G.player, skillId);
    if (!state.ok) {
      playLaofangVoice(G.player, 'oniichan');
      toast(state.reason, 'is-danger');
      return false;
    }
    G.busy = true;
    G.selectedUid = null;
    emit();
    try {
      await activateHumanSkill(skillId);
    } catch (err) {
      console.error(err);
      toast('技能结算出现异常。', 'is-danger');
    }
    if (G && !G.over && G.turn === 'player' && G.phase === 'play') {
      G.busy = false;
      emit();
    }
    return true;
  };

  Engine.selectCard = function (uid) {
    if (!G || G.over || G.turn !== 'player' || G.phase !== 'play' || G.busy) return;
    G.selectedUid = uid;
    emit();
  };

  Engine.clearSelection = function () {
    if (!G) return;
    G.selectedUid = null;
    emit();
  };

  Engine.surrender = function () {
    if (!G || G.over) return;
    log('你放下了手中的牌。', 'log-result');
    endGame('ai', '你选择了认输。');
  };

  Engine.setSpeed = function (scale) {
    if (G) G.delayScale = scale;
  };

  Engine.getState = function () { return G; };
  Engine.other = otherOf;
  Engine.hasSkill = hasSkill;
  Engine.handLimit = handLimit;
  Engine.maxSlash = maxSlash;
  Engine.spendMark = spendMark;
  Engine.canUseSlash = canUseSlash;
  Engine.skillUsedFlag = skillUsedFlag;
  Engine.skillUsable = skillUsable;
  Engine.virtualCard = virtualCard;
  Engine.distanceBetween = distanceBetween;
  Engine.attackRange = attackRange;
  Engine.canReach = canReach;

  Engine.canPlay = function (card, p) {
    p = p || (G ? G.player : null);
    if (!G || !p) return { ok: false, reason: '牌局尚未开始' };
    if (G.over) return { ok: false, reason: '牌局已结束' };
    if (G.turn !== p.side || G.phase !== 'play') {
      return { ok: false, reason: '现在不是你的出牌阶段' };
    }
    if (!card) return { ok: false, reason: '牌不存在' };
    if (hasSkill(p, 'shixue') && card.kind === 'tao') {
      return { ok: true, reason: '', bloodTao: true };
    }
    const rebornPlay = p.flags.fengdaoReborn && G.phase === 'play';
    if (rebornPlay && card.type === 'basic' && !isSlashCard(card) && card.kind !== 'jiu') {
      return { ok: true, reason: '', virtualSlash: true, target: livingEnemies(p)[0] || null };
    }
    if (rebornPlay && card.type === 'trick') {
      return { ok: true, reason: '', virtualTrick: true };
    }
    if (card.responseOnly) return { ok: false, reason: '此牌只能在响应时打出' };
    if (isSlashCard(card) && hasSkill(p, 'fengdao') && !p.flags.fengdaoReborn) {
      return { ok: false, reason: '【封刀】锁定：你不能使用或打出【杀】' };
    }
    if (p.flags.lieqiongNoHeart && card.suit === 'heart') {
      return { ok: false, reason: '【裂穹 · 气海】封印，不能使用红桃牌' };
    }
    if (!cheatPlayer(p) && p.flags.guchengRule && (p.flags.cardsThisTurn || 0) >= p.flags.guchengCap) {
      return { ok: false, reason: '【孤城】本回合最多使用 ' + p.flags.guchengCap + ' 张牌' };
    }

    const enemies = livingEnemies(p);
    const enemy = enemies[0] || otherOf(p);
    if (card.type === 'weapon' || card.type === 'mount' || card.type === 'armor') {
      return { ok: true, reason: '', target: p };
    }
    switch (card.name) {
      case '杀':
      case '雷杀':
      case '火杀':
        if (!canUseSlash(p)) return { ok: false, reason: '本回合【杀】已用尽' };
        if (!enemies.length) return { ok: false, reason: '没有可攻击的对手' };
        if (G.mode === '1v5' && !cheatPlayer(p) && !p.flags.zhanjueSlash && !p.flags.guchengRule && !hasSkill(p, 'shizhan') && !enemies.some(function (x) { return canReach(p, x); })) {
          return { ok: false, reason: '攻击范围内没有对手（当前范围 ' + attackRange(p) + '）' };
        }
        return { ok: true, reason: '', target: enemy };
      case '桃':
        if (p.hp >= p.maxHp) return { ok: false, reason: '体力已满' };
        return { ok: true, reason: '', target: p };
      case '酒':
        return { ok: true, reason: '', target: p };
      case '无中生有':
        if (hasSkill(p, 'jijin')) return { ok: false, reason: '饥馑：你无法使用【无中生有】' };
        return { ok: true, reason: '', target: p };
      case '过河拆桥':
      case '顺手牵羊':
        if (!enemies.some(function (x) { return targetHasZone(x); })) {
          return { ok: false, reason: '对手没有可指定的手牌或装备' };
        }
        return { ok: true, reason: '', target: enemy };
      case '决斗':
      case '南蛮入侵':
      case '万箭齐发':
        if (!enemies.length) return { ok: false, reason: '没有目标' };
        return { ok: true, reason: '', target: enemy };
      case '乐不思蜀':
      case '兵粮寸断':
        if (!enemies.length) return { ok: false, reason: '没有目标' };
        if (enemies.every(function (x) { return x.judge.some(function (c) { return c.kind === card.kind; }); })) {
          return { ok: false, reason: '对手判定区已有同名牌' };
        }
        return { ok: true, reason: '', target: enemy };
      case '闪电':
        if (p.judge.some(function (c) { return c.kind === 'shandian'; })) {
          return { ok: false, reason: '你的判定区已有【闪电】' };
        }
        return { ok: true, reason: '', target: p };
      default:
        return { ok: false, reason: '这张牌现在不能使用' };
    }
  };

  Engine.getSkillState = function (p, skillId) {
    p = p || (G ? G.player : null);
    if (!p) return { usable: false, reason: '', used: false, gained: false, active: false };
    const s = p.general.skills.find(function (sk) { return sk.id === skillId; });
    const active = playableSkills().indexOf(skillId) >= 0;
    let usable = false;
    let reason = '';
    if (active) {
      const st = skillUsable(p, skillId);
      usable = st.ok;
      reason = st.reason;
    }
    return {
      usable: usable,
      reason: reason,
      used: skillUsedFlag(p, skillId),
      gained: hasSkill(p, skillId),
      active: active,
      dormant: !!(s && s.dormant),
      lost: p.lostSkills.indexOf(skillId) >= 0
    };
  };

  /* =======================================================
     出牌与结算
     ======================================================= */

  async function playCard(source, target, card) {
    if (!source || !target || !card) return false;
    if (target !== source && shirenProtected(target) && (isSlashCard(card) || isSingleTargetTrick(card))) {
      log(tag(target) + ' 的【诗人】令其不能成为此牌的目标。', 'log-skill');
      toast('诗人 · 刀笔难近', 'is-skill');
      emit();
      await beat(220);
      return false;
    }
    if (source.flags.fengdaoReborn && G.phase === 'play' && card.type === 'basic' && !isSlashCard(card) && card.kind !== 'jiu') {
      const originalName = card.name;
      card.kind = 'sha';
      card.name = '杀';
      card.type = 'basic';
      card.typeLabel = '基本牌';
      card.target = 'enemy';
      card.responseOnly = false;
      card.element = null;
      card.glyph = '刀';
      card.seal = '杀';
      card.desc = '出牌阶段，除【杀】外的所有基本牌均视为【杀】。';
      log(tag(source) + ' 的【封刀】将【' + esc(originalName) + '】视为【杀】。', 'log-skill');
      toast('封刀 · 杀出', 'is-skill');
      emit();
      await beat(180);
    }
    if (source.flags.fengdaoReborn && G.phase === 'play' && card.type === 'trick' && !card.fengdaoAsChai) {
      removeFromHand(source, card);
      G.discard.push(card);
      source.stats.cardsPlayed += 1;
      source.flags.cardsThisTurn = (source.flags.cardsThisTurn || 0) + 1;
      source.flags.jiuUsed = true;
      source.flags.jiuBuff = (source.flags.jiuBuff || 0) + 1;
      G.selectedUid = null;
      log(tag(source) + ' 的【封刀】将' + cardFull(card) + '视为【酒】饮下，酒意 +' + source.flags.jiuBuff + '。', 'log-skill');
      toast('封刀 · 万物皆酒 +' + source.flags.jiuBuff, 'is-skill');
      await noteJiuUse(source);
      emit();
      await beat(320);
      return true;
    }
    removeFromHand(source, card);
    source.stats.cardsPlayed += 1;
    source.flags.cardsThisTurn = (source.flags.cardsThisTurn || 0) + 1;
    G.selectedUid = null;
    gainMa(source, card);
    playLaofangVoice(source, 'zakou');
    gainYuan(source, 0.5);
    removeBuquSuit(source, card);

    if (hasSkill(source, 'suanli') && card.type === 'trick' && !source.flags.suanliTrickUsed) {
      source.flags.suanliTrickUsed = true;
      source.stats.skillsUsed += 1;
      log(tag(source) + ' 的【算力】在首张锦囊后运转，摸1张牌。', 'log-skill');
      await drawCards(source, 1, { silent: true });
      emit();
      await beat(160);
    }

    if (source.flags.hungry && source.hand.length) {
      const binder = playerBySide(source.flags.hungryBySide);
      if (binder && binder.alive) {
        const tribute = source.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
        if (tribute) {
          removeFromHand(source, tribute);
          binder.hand.push(tribute);
          log(tag(source) + ' 因【饥】将' + cardFull(tribute) + '交给 ' + tag(binder) + '。', 'log-skill');
          emit();
          await beat(160);
        }
      }
    }

    if (source.flags.guchengRule) {
      card.unanswerable = true;
      card.unanswerableBy = '孤城';
    }
    if (cheatPlayer(source) && G.cheats.unanswerable) {
      card.unanswerable = true;
      card.unanswerableBy = '作弊模式';
    }
    if (hasSkill(source, 'fengdao') && source.flags.jiuBuff && (card.kind === 'juedou' || card.kind === 'nanman' || card.kind === 'wanjian')) {
      card.jiuTrickBonus = source.flags.jiuBuff;
      source.flags.jiuBuff = 0;
      log(tag(source) + ' 的【封刀】将酒意附加在【' + esc(card.name) + '】上，伤害+' + card.jiuTrickBonus + '。', 'log-skill');
      toast('封刀 · 酒入锦囊 +' + card.jiuTrickBonus, 'is-skill');
      emit();
      await beat(220);
    }

    if (source.flags.lieqiongInvalid) {
      source.flags.lieqiongInvalid = false;
      G.discard.push(card);
      log(tag(source) + ' 的下一张牌被【裂穹 · 中枢】化为无效。', 'log-skill');
      toast('裂穹 · 中枢 · 牌无效', 'is-danger');
      emit();
      await beat(360);
      return false;
    }

    if (hasSkill(source, 'jiuyou') && !source.flags.jiuyouUsed) {
      source.flags.jiuyouUsed = true;
      source.stats.skillsUsed += 1;
      log(tag(source) + ' 发动【旧游】，旧友相携，摸一张牌。', 'log-skill');
      toast('旧游 · 二十四桥旧事', 'is-skill');
      await drawCards(source, 1, { silent: true });
      emit();
      await beat(260);
    }

    if (source.flags.chuangwangBuff) {
      source.flags.chuangwangBuff = false;
      card.unanswerable = true;
      card.doubled = true;
      log(tag(source) + ' 的【闯王】生效：此牌无法被响应，结算效果翻倍。', 'log-skill');
      toast('闯王 · 破城', 'is-skill');
      emit();
      await beat(240);
    }

    const targetText = isSlashCard(card) ? ' 对 ' + tag(target) + ' 使用' : (card.target === 'enemy' ? ' 对 ' + tag(target) + ' 使用' : ' 使用');
    log(tag(source) + targetText + cardFull(card) + '。', 'log-' + (source.side === 'player' ? 'player' : 'ai'));
    if (ui() && ui().playCardFx) ui().playCardFx(card, source.side);
    emit();
    await beat(260);

    if (card.target === 'enemy' && target && target.alive) {
      await triggerFengchang(target);
    }

    let placed = false;
    let cancelledTrick = false;

    if (card.type === 'mount') {
      const slot = card.mountType === 'defense' ? 'defense' : 'offense';
      if (source.mounts[slot]) {
        G.discard.push(source.mounts[slot]);
        log(tag(source) + ' 弃置了原坐骑【' + esc(source.mounts[slot].name) + '】。', 'log-system');
      }
      source.mounts[slot] = card;
      source.stats.mountsEquipped += 1;
      placed = true;
      log(tag(source) + ' 装备了' + (slot === 'offense' ? '进攻' : '防御') + '坐骑【' + esc(card.name) + '】。', 'log-skill');
      toast('坐骑 · ' + card.name, 'is-success');
      if (ui() && ui().float) ui().float(source.side, slot === 'offense' ? '进攻坐骑' : '防御坐骑', 'is-mark');
      emit();
      await beat(320);
    } else if (card.type === 'armor') {
      if (source.armor) {
        G.discard.push(source.armor);
        log(tag(source) + ' 弃置了原防具【' + esc(source.armor.name) + '】。', 'log-system');
      }
      source.armor = card;
      placed = true;
      log(tag(source) + ' 装备了防具【' + esc(card.name) + '】。', 'log-skill');
      toast('防具 · ' + card.name, 'is-success');
      if (ui() && ui().float) ui().float(source.side, '防具', 'is-mark');
      emit();
      await beat(320);
    } else if (card.type === 'weapon') {
      if (source.weapon) {
        G.discard.push(source.weapon);
        log(tag(source) + ' 弃置了原武器【' + esc(source.weapon.name) + '】。', 'log-system');
      }
      source.weapon = card;
      source.stats.weaponsEquipped += 1;
      source.flags.weaponDoubled = !!card.doubled;
      placed = true;
      log(tag(source) + ' 装备了【' + esc(card.name) + '】。', 'log-skill');
      toast(card.name, 'is-skill');
      if (ui() && ui().float) ui().float(source.side, '武器', 'is-mark');
      emit();
      await beat(320);
    } else if ((card.type === 'trick' || card.type === 'delayed') && card.kind !== 'wuxie') {
      cancelledTrick = await resolveWuxieChain(source, target, card);
      if (cancelledTrick) {
        placed = true;
        G.discard.push(card);
        log('【' + esc(card.name) + '】被【无懈可击】抵消，未产生效果。', 'log-system');
        emit();
        await beat(420);
      }
    }

    if (hasSkill(source, 'shixue') && card.kind === 'tao') {
      card.kind = 'jiu';
      card.name = '酒';
      card.type = 'basic';
      card.typeLabel = '基本牌';
      card.target = 'self';
      card.responseOnly = false;
      card.glyph = '酒';
      card.seal = '酒';
      card.desc = '嗜血：桃视为酒。饮下后本回合下一张杀伤害+1。';
      log(tag(source) + ' 的【嗜血】将【桃】视为【酒】。', 'log-skill');
      toast('嗜血 · 桃化为酒', 'is-skill');
      emit();
      await beat(180);
    }

    if (!cancelledTrick && card.type !== 'weapon') {
      if (card.kind === 'jiu') {
        source.flags.jiuUsed = true;
        source.flags.jiuBuff = (source.flags.jiuBuff || 0) + (card.doubled ? 2 : 1);
        log(tag(source) + ' 饮下【酒】，酒意叠至 +' + source.flags.jiuBuff + '，下一张【杀】伤害提升。', 'log-skill');
        toast('酒 · 女儿红 +' + source.flags.jiuBuff, 'is-skill');
        if (ui() && ui().float) ui().float(source.side, '酒 · +' + source.flags.jiuBuff, 'is-mark');
        await noteJiuUse(source);
        emit();
        await beat(320);
      } else if (isSlashCard(card)) {
        source.flags.slashUsed += 1;
        if (ui() && ui().slashSwing) ui().slashSwing(source.side, target.side);
        let bonus = 0;
        if (hasSkill(source, 'hen_sui')) {
          addMark(source, 'hen', 1, 3);
          log(tag(source) + ' 发动【满穗】，获得1枚“恨”，摸一张牌。', 'log-skill');
          toast('满穗 · 恨 +1', 'is-skill');
          emit();
          await drawCards(source, 1, { silent: true });
        }
        if (hasSkill(source, 'cisha_b') && !source.flags.cishaUsed) {
          bonus += await triggerCishaB(source, target);
        }
        if (hasSkill(source, 'cisha_c')) {
          addMark(source, 'sui', 1, 3);
          log(tag(source) + ' 的【刺殺】获得1枚“穗”。', 'log-skill');
          emit();
        }
        await resolveSlash(source, target, card, { bonus: bonus });
      } else if (card.kind === 'tao') {
        await heal(source, card.doubled ? 2 : 1, '桃');
        await noteTaoUse(source);
      } else if (card.kind === 'wuzhong') {
        const drawCount = card.doubled ? 4 : 2;
        await drawCards(source, drawCount, { silent: false });
        log(tag(source) + ' 使用【无中生有】，摸' + drawCount + '张牌。', 'log-system');
      } else if (card.kind === 'chaiqiao') {
        for (let i = 0; i < (card.doubled ? 2 : 1); i += 1) {
          if (!target || !targetHasZone(target)) break;
          await discardFromTarget(target, source, '过河拆桥');
        }
      } else if (card.kind === 'shunshou') {
        for (let i = 0; i < (card.doubled ? 2 : 1); i += 1) {
          if (!target || !targetHasZone(target)) break;
          await stealFromTarget(target, source);
        }
      } else if (card.kind === 'juedou') {
        await resolveDuel(source, target, card);
      } else if (card.kind === 'nanman') {
        await resolveAoe(source, target, card, '杀');
      } else if (card.kind === 'wanjian') {
        await resolveAoe(source, target, card, '闪');
      } else if (card.kind === 'lebu' || card.kind === 'bingliang' || card.kind === 'shandian') {
        card.doubleSkip = !!card.doubled;
        const judgeTarget = card.kind === 'shandian' ? source : target;
        judgeTarget.judge.push(card);
        placed = true;
        log('【' + esc(card.name) + '】置于 ' + tag(judgeTarget) + ' 的判定区。', 'log-system');
        if (card.doubleSkip) {
          log('【闯王】令此延时锦囊的生效延长一回合。', 'log-skill');
        }
      }
    }

    if (!placed) {
      G.discard.push(card);
    }

    if (!G.over && (card.type === 'trick' || card.type === 'delayed')) {
      await maybeQinXin(source);
    }

    if (!G.over && hasSkill(source, 'xijuan') && (source.flags.xijuanDraws || 0) < 2) {
      source.flags.xijuanDraws = (source.flags.xijuanDraws || 0) + 1;
      source.stats.skillsUsed += 1;
      log(tag(source) + ' 发动【席卷】，摸一张牌。', 'log-skill');
      toast(source.general.name + ' · 席卷', 'is-skill');
      await drawCards(source, 1, { silent: true });
    }

    if (!G.over) {
      emit();
      await beat(260);
    }
    return true;
  }

  async function resolveWuxieChain(source, target, card) {
    if (card.unanswerable) return false;
    if (G.mode !== '1v1') {
      const order = allPlayers().filter(function (p) {
        return p && p.alive && p !== source;
      });
      if (!order.length) return false;
      let count = 0;
      let idx = 0;
      let passes = 0;
      let chainSource = source;
      while (!G.over && count < 8 && passes < order.length) {
        const current = order[idx % order.length];
        idx += 1;
        const opts = buildResponseOptions(current, '无懈可击');
        if (!opts.cards.length) {
          passes += 1;
          continue;
        }
        const used = await askForResponse(current, '无懈可击', {
          reason: card.name,
          source: chainSource,
          wuxie: true,
          title: '要打出【无懈可击】吗？',
          sub: '【' + card.name + '】即将生效。任何一方都可以打出【无懈可击】抵消，另一方也可以再反制。'
        });
        if (!used) {
          passes += 1;
          continue;
        }
        count += 1;
        passes = 0;
        chainSource = current;
        log('【无懈可击】' + (count % 2 === 1
          ? '抵消了【' + esc(card.name) + '】。'
          : '反制了前一张【无懈可击】。'), 'log-system');
        emit();
        await beat(320);
      }
      return count % 2 === 1;
    }

    let current = otherOf(source);
    let other = source;
    let count = 0;
    while (!G.over && count < 8) {
      const opts = buildResponseOptions(current, '无懈可击');
      if (!opts.cards.length) break;
      const used = await askForResponse(current, '无懈可击', {
        reason: card.name,
        source: other,
        wuxie: true,
        title: '要打出【无懈可击】吗？',
        sub: '【' + card.name + '】即将生效。打出【无懈可击】可抵消；对方也可以再用【无懈可击】反制。'
      });
      if (!used) break;
      count += 1;
      log('【无懈可击】' + (count % 2 === 1
        ? '抵消了【' + esc(card.name) + '】。'
        : '反制了前一张【无懈可击】。'), 'log-system');
      emit();
      await beat(320);
      const tmp = current;
      current = other;
      other = tmp;
    }
    return count % 2 === 1;
  }

  async function noteTaoUse(p) {
    if (!p || !p.alive || G.over) return;
    p.flags.taoTurn = (p.flags.taoTurn || 0) + 1;
    if (p.flags.taoTurn >= 3 && !p.flags.eggTao) {
      p.flags.eggTao = true;
      if (ui() && ui().easterEgg) ui().easterEgg('medical', '医术高超', '一回合连续使用三张【桃】');
      emit();
      await beat(1500);
    }
  }

  async function noteJiuUse(p) {
    if (!p || !p.alive || G.over) return;
    p.flags.jiuTurn = (p.flags.jiuTurn || 0) + 1;
    if (p.flags.jiuTurn >= 3 && !p.flags.eggJiu) {
      p.flags.eggJiu = true;
      if (ui() && ui().easterEgg) ui().easterEgg('wine', '酒醉万世', '一回合连续饮下三坛【酒】');
      emit();
      await beat(1500);
    }
  }

  async function triggerFengchang(p) {
    if (!G || G.over || !p || !p.alive) return;
    if (!hasSkill(p, 'fengchang') || p.flags.fengchangUsed) return;
    p.flags.fengchangUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【逢场】，摸一张牌。', 'log-skill');
    toast('林翩翩 · 逢场', 'is-skill');
    emit();
    await beat(260);
    await drawCards(p, 1, { silent: true });
  }

  async function maybeQinXin(p) {
    if (!hasSkill(p, 'qinxin') || p.flags.qinxinUsed) return;
    p.flags.qinxinUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【琴心】，摸一张牌。', 'log-skill');
    toast(p.general.name + ' · 琴心', 'is-skill');
    emit();
    await beat(260);
    await drawCards(p, 1, { silent: true });
  }

  async function resolveSlash(source, target, card, opts) {
    if (G.over) return;
    opts = opts || {};
    const bonus = opts.bonus || 0;
    const zhanjueNoDodge = hasSkill(source, 'zhanjue') && !!source.flags.zhanjueSlash;
    const shizhanNoDodge = hasSkill(source, 'shizhan');
    let zhangbaNoDodge = false;
    if (zhanjueNoDodge) source.flags.zhanjueSlash = false;
    let jiuBonus = 0;

    if (source.flags.jiuBuff) {
      jiuBonus = source.flags.jiuBuff;
      source.flags.jiuBuff = 0;
      log(tag(source) + ' 的酒意上涌，此【杀】伤害+' + jiuBonus + '。', 'log-skill');
      toast('酒 · 伤害 +' + jiuBonus, 'is-skill');
      emit();
      await beat(220);
    }

    if (hasWeapon(source, 'yaobing_bow')) {
      const bowDraw = source.flags.weaponDoubled ? 2 : 1;
      log(tag(source) + ' 的【妖兵的角弓】令其摸' + bowDraw + '张牌。', 'log-skill');
      await drawCards(source, bowDraw, { silent: true });
    }

    if (hasSkill(target, 'zhaoying') && !target.flags.zhaoyingUsed) {
      target.flags.zhaoyingUsed = true;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【照影】，摸一张牌。', 'log-skill');
      await drawCards(target, 1, { silent: true });
      emit();
    }

    if (hasArmor(target, 'tengjia') && card.name === '杀') {
      log(tag(target) + ' 的【藤甲】令普通【杀】无效。', 'log-skill');
      toast('藤甲 · 刀箭不入', 'is-skill');
      emit();
      await beat(320);
      return;
    }

    if (!zhanjueNoDodge && !shizhanNoDodge && hasWeapon(source, 'zhangba_spear') && source.hand.length && target.hand.some(function (c) { return c.name === '闪'; })) {
      let useZhangba = false;
      if (source.side === 'player') {
        const zchoice = await ui().choose({
          kicker: '丈八蛇矛',
          title: '要弃一张手牌，令此【杀】不可闪吗？',
          sub: '目标手中有【闪】。弃置一张手牌，可令此【杀】无法被【闪】响应。',
          options: [
            { value: 'yes', label: '发动丈八蛇矛', desc: '弃一张手牌，此【杀】不可被【闪】响应。' },
            { value: 'no', label: '不发动', desc: '保留手牌，正常结算。' }
          ],
          cancelable: false
        });
        useZhangba = zchoice === 'yes';
      } else {
        useZhangba = true;
      }
      if (useZhangba) {
        const pitched = source.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
        if (pitched) {
          removeFromHand(source, pitched);
          G.discard.push(pitched);
          zhangbaNoDodge = true;
          log(tag(source) + ' 发动【丈八蛇矛】，弃置' + cardFull(pitched) + '，此【杀】不可被【闪】响应。', 'log-skill');
          toast('丈八蛇矛 · 蛇咬', 'is-skill');
          emit();
          await beat(260);
        }
      }
    }

    if (card.unanswerable || zhanjueNoDodge || shizhanNoDodge || zhangbaNoDodge) {
      if (zhanjueNoDodge) {
        log(tag(source) + ' 的【斩决】令此【杀】无距离限制且无法被【闪】响应。', 'log-skill');
        toast('斩决 · 箭出无回', 'is-skill');
      } else if (shizhanNoDodge) {
        log(tag(source) + ' 的【势斩】令此【杀】无法被【闪】响应。', 'log-skill');
        toast('势斩 · 孤军不退', 'is-skill');
      } else if (zhangbaNoDodge) {
        log(tag(source) + ' 的【丈八蛇矛】令此【杀】无法被【闪】响应。', 'log-skill');
      } else {
        log('【' + (card.unanswerableBy || '闯王') + '】令此【杀】无法被响应：' + tag(target) + ' 不能打出【闪】。', 'log-skill');
      }
    } else {
      // 舌头 · 油滑
      const slipped = await triggerYouhua(target, source);
      if (slipped) return;

      // 苏怜烟 · 怜影
      const negated = await triggerLianying(target, source);
      if (negated) return;

      const flashOptions = buildResponseOptions(target, '闪');
      if (hasArmor(target, 'bagua') && !target.flags.baguaUsed && !flashOptions.cards.length && !flashOptions.extras.length) {
        target.flags.baguaUsed = true;
        target.stats.skillsUsed += 1;
        log(tag(target) + ' 发动【八卦阵】，进行判定。', 'log-skill');
        emit();
        await beat(260);
        const judged = await doJudge(target, '八卦阵');
        if (judged && judged.color === 'red') {
          log('【八卦阵】判定为红色，视为打出【闪】，' + tag(target) + ' 避开了此【杀】。', 'log-skill');
          toast('八卦阵 · 吉', 'is-skill');
          if (ui() && ui().float) ui().float(target.side, '闪', 'is-heal');
          emit();
          await beat(300);
          return;
        }
        log('【八卦阵】判定为黑色，未能化险为夷。', 'log-system');
        emit();
        await beat(220);
      }

      const dodged = await askForResponse(target, '闪', {
        reason: card.name,
        source: source,
        card: card
      });
      if (dodged) return;
    }

    let amount = 1 + bonus + jiuBonus;
    if (hasSkill(source, 'cisha_c') && !source.flags.cishaUsed && (source.marks.sui || 0) > 0) {
      let use = false;
      if (source.side === 'player') {
        use = await ui().choose({
          kicker: '刺殺 · 良穗共死',
          title: '要再添一刀吗？',
          sub: '你在本回合尚未发动过【刺殺】。弃1枚“穗”，令此【杀】伤害+1。',
          options: [
            { value: 'yes', label: '弃1枚“穗”，伤害+1', desc: '当前“穗”：' + source.marks.sui + '｜目标体力：' + target.hp },
            { value: 'no', label: '不发动', desc: '保留“穗”用于【搏命】。' }
          ],
          cancelable: false
        });
        use = use === 'yes';
      } else {
        use = aiCishaCChoice(source, target, amount);
      }
      if (use && spendMark(source, 'sui', 1)) {
        source.flags.cishaUsed = true;
        amount += 1;
        source.stats.skillsUsed += 1;
        log(tag(source) + ' 发动【刺殺】，消耗1枚“穗”，伤害+1。', 'log-skill');
        toast('刺殺 · 伤害 +1', 'is-skill');
        emit();
        await beat(260);
      }
    }

    if (card.doubled) {
      amount *= 2;
      log('【闯王】令此【杀】伤害翻倍，最终伤害为 ' + amount + '。', 'log-skill');
      toast('闯王 · 伤害翻倍 ×2', 'is-skill');
      emit();
    }

    if (hasArmor(target, 'tengjia') && card.element === 'fire') {
      amount += 1;
      log(tag(target) + ' 的【藤甲】被火焰点燃，伤害+1。', 'log-damage');
      toast('藤甲 · 遇火', 'is-danger');
      emit();
      await beat(260);
    }

    if (ui() && ui().slashFx) ui().slashFx(source.side, target.side, card);
    await beat(90);
    await dealDamage(source, target, amount, { isSlash: true, card: card, element: card.element || null });

    if (G.over) return;
    if (source.alive && hasSkill(source, 'lashou')) {
      const n = target.hand.length > source.hand.length ? 2 : 1;
      log(tag(source) + ' 发动【辣手】，摸' + n + '张牌。', 'log-skill');
      await drawCards(source, n, { silent: true });
    }
    if (source.alive && target.alive && hasWeapon(source, 'liang_blade') && target.hand.length === 0) {
      const bladeDraw = source.flags.weaponDoubled ? 2 : 1;
      log(tag(source) + ' 的【良的朴刀】令其摸' + bladeDraw + '张牌。', 'log-skill');
      await drawCards(source, bladeDraw, { silent: true });
    }
    if (hasSkill(source, 'husui') && source.alive) {
      await heal(source, 1, '护穗');
    }

    if (!G.over && target.alive && hasSkill(source, 'cisha_a')) {
      const x = source.marks.hen || 0;
      if (x > 0) {
        const n = Math.min(x, target.hand.length);
        if (n > 0) {
          const removed = target.hand.splice(0, n);
          removed.forEach(function (c) { G.discard.push(c); });
          log(tag(source) + ' 发动【刺殺】，令 ' + tag(target) + ' 弃置 ' + n + ' 张手牌。', 'log-skill');
          toast('刺殺 · 弃牌 ' + n, 'is-skill');
        }
        if (target.hand.length < x) {
          await drawCards(source, 1, { silent: true });
          log(tag(source) + ' 的【刺殺】令其摸一张牌。', 'log-skill');
        }
        emit();
      }
    }
  }

  async function triggerCishaB(p, target) {
    p.flags.cishaUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【刺殺】，开始判定。', 'log-skill');
    toast(p.general.name + ' · 刺殺', 'is-skill');
    emit();
    await beat(200);
    const judged = await doJudge(p, '刺殺');
    if (!judged) return 0;
    if (judged.suit === 'heart') {
      log('判定为红桃，【刺殺】未能生效。', 'log-system');
      return 0;
    }

    let choice = 'damage';
    if (p.side === 'player') {
      const options = [
        { value: 'heal', label: '回复1点体力', desc: p.hp >= p.maxHp ? '体力已满，但仍可选择。' : '当前体力：' + p.hp + '/' + p.maxHp },
        { value: 'maxhp', label: '体力上限+1（至多8）', desc: '当前体力上限：' + p.maxHp + (p.maxHp >= 8 ? '（已达上限）' : ''), disabled: p.maxHp >= 8 },
        { value: 'damage', label: '此【杀】伤害+1', desc: '让这一刀更重。' }
      ];
      choice = await ui().choose({
        kicker: '刺殺 · 饿殍共生',
        title: '判定结果不为红桃',
        sub: '选择一项发动。',
        options: options,
        cancelable: false
      });
    } else {
      choice = aiCishaBChoice(p, target);
    }

    if (choice === 'heal') {
      await heal(p, 1, '刺殺');
      log(tag(p) + ' 因【刺殺】回复1点体力。', 'log-skill');
      return 0;
    }
    if (choice === 'maxhp') {
      p.maxHp = Math.min(8, p.maxHp + 1);
      log(tag(p) + ' 因【刺殺】增加1点体力上限（' + p.maxHp + '）。', 'log-skill');
      if (ui() && ui().float) ui().float(p.side, '上限 +1', 'is-mark');
      emit();
      return 0;
    }
    log(tag(p) + ' 的【刺殺】令此【杀】伤害+1。', 'log-skill');
    return 1;
  }

  async function resolveDuel(source, target, card) {
    if (G.over) return;
    if (card && card.unanswerable) {
      log('【' + (card.unanswerableBy || '闯王') + '】令【决斗】无法被响应：' + tag(target) + ' 不能打出【杀】。', 'log-skill');
      const dmg = (card.doubled ? 2 : 1) + (card.jiuTrickBonus || 0);
      if (card.doubled) log('【闯王】令【决斗】伤害翻倍为 ' + dmg + ' 点。', 'log-skill');
      await dealDamage(source, target, dmg, { reason: '决斗' });
      return;
    }
    log('【决斗】开始：由 ' + tag(target) + ' 先打出【杀】。', 'log-system');
    let responder = target;
    let opponent = source;
    let rounds = 0;
    while (!G.over && rounds < 24) {
      rounds += 1;
      const ok = await askForResponse(responder, '杀', {
        reason: '决斗',
        source: opponent,
        duel: true
      });
      if (!ok) {
        log(tag(responder) + ' 未能打出【杀】。', 'log-system');
        await dealDamage(opponent, responder, 1 + (card.jiuTrickBonus || 0), { reason: '决斗' });
        return;
      }
      const tmp = responder;
      responder = opponent;
      opponent = tmp;
      await beat(220);
    }
    if (rounds >= 24 && !G.over) {
      log('【决斗】久持不下，' + tag(responder) + ' 受到1点伤害。', 'log-damage');
      await dealDamage(opponent, responder, 1 + (card.jiuTrickBonus || 0), { reason: '决斗' });
    }
  }

  async function resolveAoe(source, target, card, responseName) {
    if (G.over) return;
    const targets = (G.mode !== '1v1' && source.side === 'player') ? livingEnemies(source) : [target];
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      if (!t || !t.alive || G.over) continue;
      if (hasArmor(t, 'tengjia') && (card.kind === 'nanman' || card.kind === 'wanjian')) {
        log(tag(t) + ' 的【藤甲】令【' + card.name + '】无效。', 'log-skill');
        toast('藤甲 · 刀箭不入', 'is-skill');
        emit();
        await beat(260);
        continue;
      }
      let ok = false;
      if (card.unanswerable) {
        log('【' + (card.unanswerableBy || '闯王') + '】令【' + esc(card.name) + '】无法被响应：' + tag(t) + ' 不能打出【' + esc(responseName) + '】。', 'log-skill');
      } else {
        ok = await askForResponse(t, responseName, {
          reason: card.name,
          source: source,
          card: card
        });
      }
      if (!ok) {
        const dmg = (card.doubled ? 2 : 1) + (card.jiuTrickBonus || 0);
        if (card.doubled) log('【闯王】令伤害翻倍：' + tag(t) + ' 受到 ' + dmg + ' 点伤害。', 'log-skill');
        await dealDamage(source, t, dmg, { reason: card.name });
      }
      emit();
      await beat(260);
    }
  }

  async function chooseEnemyHandCard(target, source, reason, purpose) {
    if (!target.hand.length) return null;
    if (source.side === 'player') {
      const res = await ui().pickCards({
        kicker: reason,
        title: purpose === 'steal' ? '选择要获得的手牌' : '选择要弃置的手牌',
        sub: '敌方手牌背面朝上。选择一张，结算后才会揭示，并进入' + (purpose === 'steal' ? '你的手牌' : '弃牌堆') + '。',
        hint: '选择一张背面手牌',
        cards: target.hand.slice(),
        min: 1,
        max: 1,
        faceDown: true,
        confirmLabel: purpose === 'steal' ? '取走此牌' : '拆掉此牌',
        cancelable: false
      });
      if (!res || !res.length) return lowestValueCard(target);
      return target.hand.find(function (c) { return c.uid === res[0]; }) || null;
    }
    // AI looks for the most valuable card in the human's hand.
    return target.hand.slice().sort(function (a, b) { return keepValue(b) - keepValue(a); })[0] || null;
  }

  function targetEquipZones(target) {
    const zones = [];
    if (target.weapon) zones.push({ slot: 'weapon', label: '武器', card: target.weapon });
    if (target.armor) zones.push({ slot: 'armor', label: '防具', card: target.armor });
    if (target.mounts && target.mounts.offense) zones.push({ slot: 'offense', label: '进攻坐骑', card: target.mounts.offense });
    if (target.mounts && target.mounts.defense) zones.push({ slot: 'defense', label: '防御坐骑', card: target.mounts.defense });
    return zones;
  }

  function targetHasZone(target) {
    return !!(target && (target.hand.length || targetEquipZones(target).length));
  }

  function removeTargetEquip(target, slot) {
    let card = null;
    if (slot === 'weapon') { card = target.weapon; target.weapon = null; }
    else if (slot === 'armor') { card = target.armor; target.armor = null; }
    else if (slot === 'offense') { card = target.mounts.offense; target.mounts.offense = null; }
    else if (slot === 'defense') { card = target.mounts.defense; target.mounts.defense = null; }
    return card;
  }

  async function chooseTargetZone(target, source, reason, purpose) {
    const hasHand = target.hand.length > 0;
    const equips = targetEquipZones(target);
    if (!hasHand && !equips.length) return null;
    if (hasHand && !equips.length) return { type: 'hand' };
    if (!hasHand && equips.length === 1) return { type: 'equip', slot: equips[0].slot, card: equips[0].card, label: equips[0].label };

    const options = [];
    if (hasHand) options.push({ value: 'hand', label: '手牌区 · 背面选择', desc: '选择一张背面手牌，结算后才揭示。' });
    equips.forEach(function (z) {
      options.push({
        value: 'equip:' + z.slot,
        label: '装备区 · ' + z.label + ' · ' + z.card.name,
        desc: z.card.desc || ''
      });
    });
    if (source.side === 'player') {
      const choice = await ui().choose({
        kicker: reason,
        title: purpose === 'steal' ? '选择要获得的目标' : '选择要弃置的目标',
        sub: '对手的手牌背面朝上，装备区的牌则已公开。请选择目标区域。',
        options: options,
        cancelable: false
      });
      if (choice && choice.indexOf('equip:') === 0) {
        const slot = choice.slice(6);
        const found = equips.find(function (z) { return z.slot === slot; }) || equips[0];
        return { type: 'equip', slot: found.slot, card: found.card, label: found.label };
      }
      return { type: 'hand' };
    }
    const bestHand = target.hand.slice().sort(function (a, b) { return keepValue(b) - keepValue(a); })[0];
    const bestEquip = equips.slice().sort(function (a, b) { return keepValue(b.card) - keepValue(a.card); })[0];
    if (bestEquip && (!hasHand || keepValue(bestEquip.card) >= keepValue(bestHand))) {
      return { type: 'equip', slot: bestEquip.slot, card: bestEquip.card, label: bestEquip.label };
    }
    return { type: 'hand' };
  }

  async function discardFromTarget(target, source, reason) {
    if (!targetHasZone(target)) {
      log(tag(target) + ' 没有可弃置的手牌或装备。', 'log-system');
      return null;
    }
    const zone = await chooseTargetZone(target, source, reason, 'discard');
    if (!zone) return null;
    if (zone.type === 'equip') {
      const equip = removeTargetEquip(target, zone.slot);
      if (!equip) return null;
      G.discard.push(equip);
      log(tag(source) + ' 发动【' + esc(reason) + '】，拆掉了 ' + tag(target) + ' 装备区的【' + esc(equip.name) + '】。', 'log-system');
      emit();
      return equip;
    }
    const card = await chooseEnemyHandCard(target, source, reason, 'discard');
    if (!card) return null;
    removeFromHand(target, card);
    G.discard.push(card);
    log(tag(source) + ' 发动【' + esc(reason) + '】，弃置了 ' + tag(target) + ' 的' + cardFull(card) + '。', 'log-system');
    emit();
    return card;
  }

  async function stealFromTarget(target, source) {
    if (!targetHasZone(target)) {
      log(tag(target) + ' 没有可获得的手牌或装备。', 'log-system');
      return null;
    }
    const zone = await chooseTargetZone(target, source, '顺手牵羊', 'steal');
    if (!zone) return null;
    if (zone.type === 'equip') {
      const equip = removeTargetEquip(target, zone.slot);
      if (!equip) return null;
      source.hand.push(equip);
      log(tag(source) + ' 发动【顺手牵羊】，获得了 ' + tag(target) + ' 装备区的【' + esc(equip.name) + '】。', 'log-system');
      if (source.side === 'player' && ui() && ui().toast) ui().toast('获得装备【' + equip.name + '】', '');
      emit();
      return equip;
    }
    const card = await chooseEnemyHandCard(target, source, '顺手牵羊', 'steal');
    if (!card) return null;
    removeFromHand(target, card);
    source.hand.push(card);
    if (source.side === 'player') {
      log('你从 ' + tag(target) + ' 手中获得了' + cardFull(card) + '。', 'log-player');
      if (ui() && ui().toast) ui().toast('获得 ' + cardFull(card), '');
    } else {
      log(tag(source) + ' 从你手中获得了' + cardFull(card) + '。', 'log-ai');
    }
    emit();
    return card;
  }

  function buildResponseOptions(p, kind) {
    const cards = [];
    const extras = [];
    if (!p || !p.alive) return { cards: cards, extras: extras };
    if (kind === '闪' && p.flags.noShanTurn) return { cards: cards, extras: extras };
    if (kind === '杀' && hasSkill(p, 'fengdao')) return { cards: cards, extras: extras };

    p.hand.forEach(function (c) {
      if (p.flags.lieqiongNoHeart && c.suit === 'heart') return;
      if (kind === '闪') {
        if (c.name === '闪') {
          cards.push({ card: c, asName: '闪', via: null, label: '闪' });
        } else if (hasSkill(p, 'yanxing') && c.color === 'red') {
          cards.push({ card: c, asName: '闪', via: '雁行', label: '雁行 · 红牌当闪' });
        }
      } else if (kind === '杀') {
        if (isSlashCard(c)) {
          cards.push({ card: c, asName: c.name, via: null, label: c.name });
        }
      } else if (kind === '桃') {
        if ((c.name === '桃' && !hasSkill(p, 'shixue')) || c.name === '酒') {
          cards.push({ card: c, asName: '桃', via: null, label: c.name === '酒' ? '酒' : '桃' });
        }
      } else if (kind === '无懈可击') {
        if (c.name === '无懈可击') {
          cards.push({ card: c, asName: '无懈可击', via: null, label: '无懈可击' });
        }
      }
    });

    if (kind === '闪' && hasSkill(p, 'sui_mansui') && p.maxHp <= 2 && (p.marks.sui || 0) > 0) {
      extras.push({
        value: 'sui_shan',
        label: '穗 · 闪',
        desc: '消耗1枚“穗”，当作【闪】打出。'
      });
    }
    if (kind === '桃' && hasSkill(p, 'sui_mansui') && p.maxHp <= 2 && (p.marks.sui || 0) > 0) {
      extras.push({
        value: 'sui_tao',
        label: '穗 · 桃',
        desc: '消耗1枚“穗”，当作【桃】使用。'
      });
    }

    return { cards: cards, extras: extras };
  }

  async function askForResponse(target, kind, ctx) {
    if (!G || G.over) return false;
    ctx = ctx || {};
    const opts = buildResponseOptions(target, kind);
    if (!opts.cards.length && !opts.extras.length) return false;

    if (target.side === 'player') {
      const hasJiu = opts.cards.some(function (x) { return x.card.name === '酒'; });
      const res = await ui().askResponse({
        kicker: ctx.reason === '杀' ? '杀至' : (ctx.reason || '响应'),
        title: ctx.title || (kind === '桃' && hasJiu ? '使用【桃】或【酒】自救' : ('请打出【' + kind + '】')),
        sub: ctx.sub || (ctx.reason === '杀'
          ? tag(ctx.source) + ' 的【杀】已至。打出【闪】可令其无效。'
          : (kind === '桃' && hasJiu ? '体力垂危。使用【桃】或【酒】回复1点体力。' : '若不打出，将承受1点伤害。')),
        cards: opts.cards,
        extras: opts.extras,
        cancelLabel: '不出',
        kind: kind
      });
      if (!res || res.type === 'none') {
        log('你选择不出【' + esc(kind) + '】。', 'log-system');
        return false;
      }
      return await applyResponse(target, kind, res);
    }

    const decision = aiResponseDecision(target, kind, ctx, opts);
    if (!decision) {
      log(tagSoft(target) + ' 未能打出【' + esc(kind) + '】。', 'log-ai');
      return false;
    }
    await beat(420);
    return await applyResponse(target, kind, decision);
  }

  async function applyResponse(p, kind, choice) {
    if (!choice) return false;
    if (choice.type === 'card') {
      const card = p.hand.find(function (c) { return c.uid === choice.card.uid; });
      if (!card) return false;
      if (!choice.via && ui() && ui().playCardFx) ui().playCardFx(card, p.side);
      removeFromHand(p, card);
      G.discard.push(card);
      gainMa(p, card);
      playLaofangVoice(p, 'zakou');
      gainYuan(p, 0.5);
      removeBuquSuit(p, card);
      const via = choice.via || (choice.card.via || null);
      if (p.side === 'player') {
        if (via) {
          log('你发动【雁行】，将' + cardFull(card) + '当【闪】打出。', 'log-player');
          toast('雁行 · 红牌当闪', 'is-skill');
        } else {
          log('你打出了' + cardFull(card) + '。', 'log-player');
        }
      } else {
        if (via) {
          log(tagSoft(p) + ' 发动【雁行】，将一张红色手牌当【闪】打出。', 'log-ai');
        } else {
          log(tagSoft(p) + ' 打出了【' + esc(card.name) + '】。', 'log-ai');
        }
      }
      p.stats.skillsUsed += via ? 1 : 0;
      if (kind === '闪' && ui() && ui().dodge) ui().dodge(p.side);
      if (kind === '无懈可击') {
        toast('无懈可击', 'is-skill');
      }
      if (kind === '桃') {
        if (card.name === '酒') toast('酒 · 回魂', 'is-skill');
        await heal(p, 1, card.name === '酒' ? '酒' : '桃');
        if (card.name === '桃') await noteTaoUse(p);
      }
      emit();
      await beat(260);
      return true;
    }
    if (choice.type === 'skill') {
      const value = choice.value;
      if (value === 'sui_shan') {
        if (!spendMark(p, 'sui', 1)) return false;
        log(tag(p) + ' 消耗1枚“穗”，当作【闪】打出。', 'log-skill');
        toast('滿穗 · 穗当闪', 'is-skill');
        if (ui() && ui().dodge) ui().dodge(p.side);
        if (ui() && ui().float) ui().float(p.side, '穗 -1', 'is-mark');
      } else if (value === 'sui_tao') {
        if (!spendMark(p, 'sui', 1)) return false;
        log(tag(p) + ' 消耗1枚“穗”，当作【桃】使用。', 'log-skill');
        if (ui() && ui().float) ui().float(p.side, '穗 -1', 'is-mark');
        await heal(p, 1, '穗');
      }
      emit();
      await beat(260);
      return true;
    }
    return false;
  }

  function aiResponseDecision(target, kind, ctx, opts) {
    if (!opts.cards.length && !opts.extras.length) return null;
    const cfg = aiConfig();
    let chance = kind === '闪' ? cfg.respond : cfg.respond - 0.04;
    if (target.hp <= 1) chance = Math.min(1, chance + 0.18);
    if (ctx.reason === '万箭齐发' && target.hp <= 2) chance = Math.min(1, chance + 0.08);
    if (kind === '杀' && ctx.duel && target.hp <= 2) chance = Math.min(1, chance + 0.08);

    // 先尝试真牌；雁行红牌只在别无选择或危急时使用
    const normal = opts.cards.filter(function (o) { return !o.via; });
    const converted = opts.cards.filter(function (o) { return o.via; });
    if (normal.length) {
      if (Math.random() <= chance) {
        return { type: 'card', card: normal[0].card, via: null };
      }
      return null;
    }
    if (converted.length) {
      const useConverted = target.hp <= 1 || Math.random() <= chance * 0.72;
      if (useConverted) {
        const sorted = converted.slice().sort(function (a, b) {
          return keepValue(a.card) - keepValue(b.card);
        });
        return { type: 'card', card: sorted[0].card, via: '雁行' };
      }
      return null;
    }
    if (opts.extras.length) {
      const extra = opts.extras[0];
      if (target.hp <= 1 || Math.random() <= chance * 0.8) {
        return { type: 'skill', value: extra.value };
      }
    }
    return null;
  }

  /* =======================================================
     伤害 / 治疗 / 濒死
     ======================================================= */

  function makeThunderSource() {
    return {
      side: 'system',
      general: { name: '天雷', subtitle: '天罚', skills: [] },
      hp: 1,
      maxHp: 1,
      hand: [],
      judge: [],
      weapon: null,
      armor: null,
      mounts: { offense: null, defense: null },
      marks: {},
      gainedSkills: [],
      lostSkills: [],
      flags: {},
      stats: {
        damageDealt: 0, damageTaken: 0, cardsPlayed: 0, cardsDrawn: 0,
        skillsUsed: 0, heals: 0, weaponsEquipped: 0, mountsEquipped: 0
      },
      alive: true
    };
  }

  async function performLieqiong(source, target) {
    if (!G || G.over || !source || !target || !source.alive || !target.alive) return;
    if (source === target || target.hp <= 0 || !hasSkill(source, 'lieqiong')) return;
    const head = (target.flags.lieqiongHit || 0) > 0;
    const options = [];
    if (head) {
      options.push({
        value: 'tianchong',
        label: '天冲 · 令其失去当前体力值数点体力',
        desc: '若其因此死亡，你加1点体力上限。本回合已击伤过该角色才可选。'
      });
    }
    options.push(
      { value: 'lipeng', label: '力烽 · 随机弃置其一半手牌', desc: '向上取整。' },
      { value: 'diji', label: '地机 · 其下一次受到的伤害+1', desc: '直到其回合结束。' },
      { value: 'zhongshu', label: '中枢 · 其下一张牌无效', desc: '直到其回合结束。' },
      { value: 'qihai', label: '气海 · 其不能使用或打出红桃牌', desc: '直到其回合结束。' },
      { value: 'none', label: '不击伤', desc: '保留裂穹，不追加效果。' }
    );
    let choice = 'none';
    if (source.side === 'player') {
      choice = await ui().choose({
        kicker: '裂穹 · 击伤',
        title: '选择击伤部位',
        sub: '目标体力 ' + Math.max(0, target.hp) + '/' + target.maxHp + ' · 手牌 ' + target.hand.length +
          (head ? ' · 本回合已击伤过，可选天冲' : ' · 首次击伤不能选天冲'),
        options: options,
        cancelable: false
      });
    } else {
      if (head) choice = 'tianchong';
      else if (target.hand.length >= 2) choice = 'lipeng';
      else if (target.hp > 1) choice = 'diji';
      else if (target.hand.length) choice = 'zhongshu';
      else choice = 'qihai';
    }
    if (!choice || choice === 'none') return;
    source.stats.skillsUsed += 1;
    target.flags.lieqiongHit = (target.flags.lieqiongHit || 0) + 1;

    if (choice === 'tianchong') {
      if (cheatActive() && target.side === 'player' && G.cheats.invincible) {
        log('作弊模式 · 无敌：天冲无法伤及玩家。', 'log-skill');
        toast('作弊模式 · 无敌', 'is-success');
        return;
      }
      const lost = Math.max(0, target.hp);
      target.hp = 0;
      log(tag(source) + ' 发动【裂穹 · 天冲】，令 ' + tag(target) + ' 失去 ' + lost + ' 点体力。', 'log-skill');
      toast('裂穹 · 天冲', 'is-skill');
      emit();
      await beat(420);
      await enterDying(target, source);
      if (!target.alive && source.alive) {
        source.maxHp += 1;
        log(tag(source) + ' 因【天冲】击杀目标，体力上限+1。', 'log-skill');
        toast('裂穹 · 天冲 · 体力上限+1', 'is-success');
        emit();
        await beat(300);
      }
      return;
    }

    if (choice === 'lipeng') {
      const n = Math.ceil(target.hand.length / 2);
      const removed = shuffle(target.hand.slice()).slice(0, n);
      removed.forEach(function (c) {
        removeFromHand(target, c);
        G.discard.push(c);
      });
      log(tag(source) + ' 发动【裂穹 · 力烽】，' + tag(target) + ' 随机弃置 ' + removed.length + ' 张手牌。', 'log-skill');
      toast('裂穹 · 力烽', 'is-skill');
    } else if (choice === 'diji') {
      target.flags.lieqiongDamagePlus = true;
      log(tag(source) + ' 发动【裂穹 · 地机】，' + tag(target) + ' 下一次受到的伤害+1。', 'log-skill');
      toast('裂穹 · 地机', 'is-skill');
    } else if (choice === 'zhongshu') {
      target.flags.lieqiongInvalid = true;
      log(tag(source) + ' 发动【裂穹 · 中枢】，' + tag(target) + ' 下一张牌无效。', 'log-skill');
      toast('裂穹 · 中枢', 'is-skill');
    } else if (choice === 'qihai') {
      target.flags.lieqiongNoHeart = true;
      log(tag(source) + ' 发动【裂穹 · 气海】，' + tag(target) + ' 不能使用或打出红桃牌直到其回合结束。', 'log-skill');
      toast('裂穹 · 气海', 'is-skill');
    }
    emit();
    await beat(360);
  }

  function choushiLimit(p) {
    return (p && p.flags && p.flags.choushiDouble && G && G.turn === p.side) ? 2 : 1;
  }

  async function maybeChoushi(p, trigger) {
    if (!p || !p.alive || !hasSkill(p, 'choushi') || G.over) return;
    if (trigger === 'hurt' && !p.flags.choushiHurt) return;
    const used = p.flags.choushiTimes || 0;
    if (used >= choushiLimit(p)) return;
    const hand = p.hand.length;
    const hp = Math.max(0, p.hp);
    const canDraw = hand < hp;
    const canHeal = hp < hand && hp < p.maxHp;
    if (!canDraw && !canHeal) return;

    let choice = 'none';
    if (p.side === 'player') {
      const options = [];
      if (canDraw) options.push({ value: 'draw', label: '摸牌至体力值', desc: '手牌 ' + hand + ' → ' + hp + '，摸 ' + (hp - hand) + ' 张。' });
      if (canHeal) options.push({ value: 'heal', label: '回复至手牌数', desc: '体力 ' + hp + ' → ' + Math.min(p.maxHp, hand) + '。' });
      options.push({ value: 'none', label: '不发动', desc: '保留当前手牌与体力。' });
      choice = await ui().choose({
        kicker: '仇视 · ' + (trigger === 'hurt' ? '受伤后' : '造成伤害后'),
        title: '要结算【仇视】吗？',
        sub: '每回合限 ' + choushiLimit(p) + ' 次，本回合已发动 ' + used + ' 次。',
        options: options,
        cancelable: false
      });
    } else {
      if (canHeal && (!canDraw || hp <= 1)) choice = 'heal';
      else if (canDraw) choice = 'draw';
      else if (canHeal) choice = 'heal';
    }
    if (!choice || choice === 'none') return;

    p.flags.choushiTimes = used + 1;
    p.stats.skillsUsed += 1;
    if (choice === 'draw') {
      const n = Math.max(0, hp - p.hand.length);
      log(tag(p) + ' 发动【仇视】，将手牌摸至 ' + hp + ' 张（摸' + n + '张）。', 'log-skill');
      toast('仇视 · 手牌至体力', 'is-skill');
      await drawCards(p, n, { silent: true });
    } else {
      const targetHp = Math.min(p.maxHp, p.hand.length);
      const n = Math.max(0, targetHp - p.hp);
      log(tag(p) + ' 发动【仇视】，将体力回复至手牌数 ' + p.hand.length + '（回复' + n + '点）。', 'log-skill');
      toast('仇视 · 体力至手牌', 'is-skill');
      await heal(p, n, '仇视');
    }
    emit();
    await beat(360);
  }

  async function reduceMaxHp(p, amount, reason) {
    if (!p || !p.alive || !G || G.over) return 0;
    const loss = Math.max(0, Math.min(p.maxHp, amount | 0));
    if (!loss) return 0;
    p.maxHp -= loss;
    let hpLost = 0;
    if (p.hp > p.maxHp) {
      hpLost = p.hp - p.maxHp;
      p.hp = p.maxHp;
    }
    if (hpLost > 0 && hasSkill(p, 'xixue')) {
      p.marks.kuang = (p.marks.kuang || 0) + hpLost;
    }
    log(tag(p) + ' 因【' + reason + '】失去 ' + loss + ' 点体力上限' + (hpLost ? '，并因此失去 ' + hpLost + ' 点体力（转化为狂）' : '') + '。', 'log-skill');
    return hpLost;
  }

  async function dealDamage(source, target, amount, opts) {
    opts = opts || {};
    if (!G || G.over || !target || !target.alive) return;
    amount = Math.max(0, amount | 0);
    if (!amount) return;
    if (cheatActive() && target.side === 'player' && G.cheats.invincible) {
      log('作弊模式 · 无敌：' + tag(target) + ' 免疫了这次伤害。', 'log-skill');
      toast('作弊模式 · 无敌', 'is-success');
      emit();
      await beat(180);
      return;
    }
    if (target.side === 'player' && tizaiActive(target)) {
      const anchor = playerBySide(target.flags.tizaiAnchorSide);
      if (anchor && anchor.alive) {
        target.flags.tizaiHits = (target.flags.tizaiHits || 0) + 1;
        log(tag(target) + ' 的【替灾】将伤害转移给锚点 ' + tag(anchor) + '（' + target.flags.tizaiHits + '/3）。', 'log-skill');
        emit();
        await beat(260);
        if (target.flags.tizaiHits >= 3) {
          await directKill(anchor, target);
          return;
        }
        await dealDamage(source, anchor, amount, opts);
        return;
      }
    }

    if (target.flags.lieqiongDamagePlus) {
      target.flags.lieqiongDamagePlus = false;
      amount += 1;
      log(tag(target) + ' 的【裂穹 · 地机】发作，本次伤害+1。', 'log-skill');
      toast('裂穹 · 地机', 'is-skill');
      emit();
      await beat(220);
    }

    // 界限突破满穗 · 穗佑：每回合首次伤害完全防止
    if (hasSkill(target, 'suiyou') && !target.flags.suiyouUsed) {
      target.flags.suiyouUsed = true;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【穗佑】，防止了这次伤害，并摸一张牌。', 'log-skill');
      toast('穗佑 · 穗影护身', 'is-skill');
      if (ui() && ui().float) ui().float(target.side, '穗佑', 'is-mark');
      emit();
      await drawCards(target, 1, { silent: true });
      emit();
      await beat(360);
      return;
    }

    // 满穗 · 共生：防止伤害，改为失去体力上限
    if (hasSkill(target, 'gongsheng') && !target.flags.gongshengUsed && target.maxHp > 1) {
      let use = false;
      if (target.side === 'player') {
        const choice = await ui().choose({
          kicker: '共生 · 饿殍共生',
          title: '要发动【共生】吗？',
          sub: '防止即将受到的 ' + amount + ' 点伤害，改为失去1点体力上限（至少保留1点），获得1枚“穗”。',
          options: [
            { value: 'yes', label: '发动【共生】', desc: '当前体力 ' + target.hp + '/' + target.maxHp + '；当前“穗” ' + target.marks.sui + '。' },
            { value: 'no', label: '不发动', desc: '承受 ' + amount + ' 点伤害。' }
          ],
          cancelable: false
        });
        use = choice === 'yes';
      } else {
        use = aiGongshengChoice(target, amount);
      }
      if (use) {
        target.flags.gongshengUsed = true;
        target.maxHp = Math.max(1, target.maxHp - 1);
        target.hp = Math.min(target.hp, target.maxHp);
        addMark(target, 'sui', 1, 99);
        target.stats.skillsUsed += 1;
        log(tag(target) + ' 发动【共生】，防止了伤害，失去1点体力上限，获得1枚“穗”。', 'log-skill');
        toast('共生 · 穗 +1', 'is-skill');
        if (ui() && ui().float) ui().float(target.side, '共生', 'is-mark');
        emit();
        await beat(360);
        return;
      }
    }

    // 琼华 · 矜贵
    if (hasSkill(target, 'jingui') && !target.flags.jinguiUsed && amount > 0) {
      target.flags.jinguiUsed = true;
      target.stats.skillsUsed += 1;
      amount -= 1;
      log(tag(target) + ' 发动【矜贵】，防止1点伤害。', 'log-skill');
      toast(target.general.name + ' · 矜贵', 'is-skill');
      if (amount <= 0) {
        emit();
        await beat(300);
        return;
      }
    }

    if (hasArmor(target, 'buyi') && !target.flags.buyiUsed && amount > 0) {
      target.flags.buyiUsed = true;
      amount -= 1;
      log(tag(target) + ' 的【布衣】吸收了1点伤害。', 'log-skill');
      toast('布衣 · 卸力', 'is-skill');
      if (amount <= 0) {
        emit();
        await beat(260);
        return;
      }
    }

    if (hasSkill(target, 'hujia') && !target.flags.hujiaUsed && amount > 0) {
      target.flags.hujiaUsed = true;
      target.stats.skillsUsed += 1;
      amount -= 1;
      log(tag(target) + ' 发动【护家】，护住家人，伤害-1。', 'log-skill');
      toast('护家 · 护住家人', 'is-skill');
      if (amount <= 0) {
        emit();
        await beat(280);
        return;
      }
    }

    if (hasSkill(target, 'sishou') && !target.flags.sishouUsed && amount > 0) {
      target.flags.sishouUsed = true;
      target.stats.skillsUsed += 1;
      amount -= 1;
      log(tag(target) + ' 发动【死守】，死守扬州，伤害-1。', 'log-skill');
      toast('死守 · 城在人在', 'is-skill');
      if (amount <= 0) {
        emit();
        await beat(280);
        return;
      }
    }

    if (cheatActive() && source.side === 'player') {
      const mult = Math.max(1, Number(G.cheats.damageMultiplier) || 1);
      const extra = Math.max(0, Number(G.cheats.extraDamage) || 0);
      const before = amount;
      amount = Math.max(1, Math.round(amount * mult) + extra);
      log('作弊模式：伤害 ' + before + ' → ' + amount + '（×' + mult + ' +' + extra + '）。', 'log-skill');
      toast('作弊伤害 ×' + mult + (extra ? ' +' + extra : ''), 'is-skill');
    }

    if (hasSkill(target, 'shixue') && opts && opts.isSlash && (opts.element === 'fire' || (opts.card && opts.card.element === 'fire'))) {
      amount += 1;
      log(tag(target) + ' 的【嗜血】被火【杀】点燃，伤害+1。', 'log-skill');
      toast('嗜血 · 火伤+1', 'is-danger');
      emit();
      await beat(220);
    }

    if (target.flags.zhinianInvincibleUntil >= G.turnCount) {
      log(tag(target) + ' 的【执念·无敌】抵消了这次伤害。', 'log-skill');
      toast('执念 · 无敌', 'is-success');
      emit();
      await beat(220);
      return;
    }

    if (source.flags.zhinianDamageBonus) {
      amount += source.flags.zhinianDamageBonus;
      log(tag(source) + ' 的【执念】令本次伤害 +' + source.flags.zhinianDamageBonus + '。', 'log-skill');
      emit();
      await beat(180);
    }

    if (hasSkill(target, 'hushen') && target.hp < target.maxHp && target.maxHp > amount && amount > 0) {
      let use = false;
      if (target.side === 'player') {
        const choice = await ui().choose({
          kicker: '护身 · 血肉为盾',
          title: '要发动【护身】吗？',
          sub: '将这次 ' + amount + ' 点伤害改为失去 ' + amount + ' 点体力上限，并摸1张牌。',
          options: [
            { value: 'yes', label: '发动【护身】', desc: '体力 ' + target.hp + '/' + target.maxHp + '；上限将降至 ' + (target.maxHp - amount) + '，然后摸1张。' },
            { value: 'no', label: '不发动', desc: '正常承受 ' + amount + ' 点伤害。' }
          ],
          cancelable: false
        });
        use = choice === 'yes';
      } else {
        use = target.hp <= amount || target.hp <= 1 || (target.maxHp - amount >= 3 && target.hp < target.maxHp);
      }
      if (use) {
        target.stats.skillsUsed += 1;
        await reduceMaxHp(target, amount, '护身');
        log(tag(target) + ' 发动【护身】，以体力上限代替伤害，并摸1张牌。', 'log-skill');
        toast('护身 · 血肉为盾', 'is-skill');
        if (ui() && ui().awaken) ui().awaken(target.side);
        await drawCards(target, 1, { silent: true });
        emit();
        await beat(420);
        return;
      }
    }

    target.hp -= amount;
    source.stats.damageDealt += amount;
    target.stats.damageTaken += amount;
    log(tag(source) + ' 对 ' + tag(target) + ' 造成 ' + amount + ' 点伤害（' + tag(target) + ' ' + Math.max(0, target.hp) + '/' + target.maxHp + '）。', 'log-damage');
    if (opts && opts.isSlash && source !== target && source.alive && hasSkill(source, 'xixue')) {
      const kuang = source.marks.kuang || 0;
      if (kuang > 0) {
        log(tag(source) + ' 的【吸血】按 ' + kuang + ' 枚“狂”回复体力。', 'log-skill');
        toast('吸血 · 狂 ' + kuang, 'is-heal');
        await heal(source, kuang, '吸血');
      }
    }
    if (source.flags.zhanjueHeal && amount > 0) {
      source.flags.zhanjueHeal = false;
      log(tag(source) + ' 的【斩决】发动：以伤养战，回复 ' + amount + ' 点体力。', 'log-skill');
      toast('斩决 · 以伤养战', 'is-skill');
      await heal(source, amount, '斩决');
    }

    if (hasSkill(source, 'kuangu') && source !== target && source.alive && source.hp < source.maxHp) {
      log(tag(source) + ' 发动【狂骨】，以战养战，回复1点体力。', 'log-skill');
      toast('狂骨 · 以战养战', 'is-skill');
      await heal(source, 1, '狂骨');
    }

    if (hasSkill(source, 'sizhan') && source.alive) {
      const othersAlive = allPlayers().filter(function (x) { return x && x !== source && x.alive; }).length;
      const drawN = othersAlive >= 3 ? 2 : 1;
      log(tag(source) + ' 发动【死战】，场上其他存活角色 ' + othersAlive + ' 人，摸' + drawN + '张牌。', 'log-skill');
      await drawCards(source, drawN, { silent: true });
    }
    if (ui() && ui().hit) ui().hit(target.side, amount);
    if (ui() && ui().float) ui().float(target.side, '-' + amount, 'is-damage' + (amount >= 2 ? ' is-heavy-damage' : ''));
    emit();
    await beat(amount >= 2 ? 700 : 430);

    if (source !== target && source.alive) await maybeChoushi(source, 'damage');
    if (!G || G.over) return;
    if (target.alive && target.hp > 0) await maybeChoushi(target, 'hurt');
    if (!G || G.over) return;

    if (target.alive && target.hp > 0 && hasSkill(source, 'lieqiong') && source !== target) {
      await performLieqiong(source, target);
      if (!G || G.over) return;
    }

    if (opts.isSlash && hasSkill(source, 'tanshi') && !source.flags.tanshiUsed && source !== target) {
      source.flags.tanshiUsed = true;
      source.stats.skillsUsed += 1;
      log(tag(source) + ' 发动【贪食】，摸一张牌。', 'log-skill');
      toast(source.general.name + ' · 贪食', 'is-skill');
      await drawCards(source, 1, { silent: true });
    }

    if (source.side === 'player' && amount >= 3 && !G.eggDamageDone) {
      G.eggDamageDone = true;
      if (ui() && ui().easterEgg) ui().easterEgg('massacre', '癫狂屠戮', '一次造成三点伤害');
      emit();
      await beat(1500);
    }

    // 方知宥 · 兽视
    if (hasSkill(target, 'shoushi')) {
      addMark(target, 'yi', amount, 4);
      log(tag(target) + ' 发动【兽视】，获得' + amount + '枚“忆”。', 'log-skill');
      emit();
    }
    if (hasSkill(source, 'shoushi')) {
      addMark(source, 'yi', 1, 4);
      log(tag(source) + ' 发动【兽视】，获得1枚“忆”。', 'log-skill');
      emit();
    }

    // 小雁儿 · 求生
    if (hasSkill(target, 'qiusheng')) {
      const n = target.hp === 1 ? 2 : 1;
      log(tag(target) + ' 发动【求生】，摸' + n + '张牌。', 'log-skill');
      await drawCards(target, n, { silent: true });
    }

    // 良 · 侠骨
    if (hasSkill(target, 'xiagu') && source.hand.length) {
      const discarded = pickRandomHandCard(source);
      if (discarded) {
        removeFromHand(source, discarded);
        G.discard.push(discarded);
        log(tag(target) + ' 发动【侠骨】，弃置了 ' + tag(source) + ' 一张手牌。', 'log-skill');
        emit();
      }
    }

    // 红儿 · 护妹
    if (hasSkill(target, 'humei') && !target.flags.humeiUsed && target.alive && target.hand.length < Math.max(0, target.hp)) {
      target.flags.humeiUsed = true;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【护妹】，摸一张牌。', 'log-skill');
      toast(target.general.name + ' · 护妹', 'is-skill');
      await drawCards(target, 1, { silent: true });
      emit();
    }

    // 翠儿 · 依偎
    if (hasSkill(target, 'yiwei') && !target.flags.yiweiUsed && target.alive) {
      target.flags.yiweiUsed = true;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【依偎】，摸一张牌。', 'log-skill');
      toast(target.general.name + ' · 依偎', 'is-skill');
      await drawCards(target, 1, { silent: true });
      emit();
    }

    // 李闯王 · 百战
    if (hasSkill(target, 'baizhan') && !target.flags.baizhanUsed && target.hp <= 2 && target.alive) {
      target.flags.baizhanUsed = true;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【百战】，回复1点体力。', 'log-skill');
      toast(target.general.name + ' · 百战', 'is-skill');
      await heal(target, 1, '百战');
      emit();
    }

    // 方知宥 · 疯症觉醒
    await checkFangAwakening(target);
    await checkFangAwakening(source);
    if (!G || G.over) return;

    if (hasSkill(source, 'xinsheng') && source.alive) {
      await heal(source, 1, '新生');
    }

    if (!G || G.over) return;
    if (target.hp <= 0 && target.alive) {
      await enterDying(target, source);
    } else {
      emit();
    }
  }

  async function heal(p, n, reason) {
    if (!G || !p || !p.alive || G.over) return 0;
    if (p.side === 'player' && tizaiActive(p)) {
      const anchor = playerBySide(p.flags.tizaiAnchorSide);
      if (anchor && anchor.alive) {
        p.flags.tizaiHits = (p.flags.tizaiHits || 0) + 1;
        log(tag(p) + ' 的【替灾】将回复转移给锚点 ' + tag(anchor) + '（' + p.flags.tizaiHits + '/3）。', 'log-skill');
        emit();
        await beat(220);
        if (p.flags.tizaiHits >= 3) {
          await directKill(anchor, p);
          return 0;
        }
        return await heal(anchor, n, reason);
      }
    }
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    const actual = p.hp - before;
    if (actual > 0) {
      p.stats.heals += actual;
      log(tag(p) + ' 回复了 ' + actual + ' 点体力（' + p.hp + '/' + p.maxHp + '）。', 'log-heal');
      if (ui() && ui().heal) ui().heal(p.side);
      if (ui() && ui().float) ui().float(p.side, '+' + actual, 'is-heal');
      emit();
      await beat(300);
    }
    return actual;
  }

  async function checkFangAwakening(p) {
    if (!G || G.over || !p || !p.alive) return;
    if (!hasSkill(p, 'fengzheng')) return;
    if (p.flags.fengzhengUsed) return;
    if ((p.marks.yi || 0) < 4) return;
    if (p.maxHp <= 1) return;

    p.flags.fengzhengUsed = true;
    p.flags.awakened = true;
    p.maxHp = Math.max(1, p.maxHp - 1);
    p.hp = Math.min(p.hp, p.maxHp);
    gainSkill(p, 'shituo');
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 的“忆”达到4枚，【疯症】觉醒：失去1点体力上限，获得【狮驼】。', 'log-skill');
    if (ui() && ui().awaken) ui().awaken(p.side);
    banner('觉醒 · 疯症', '狮驼国，从纸上爬了出来', 'gold');
    emit();
    await beat(620);
    await drawCards(p, 2, { silent: true });
    if (ui() && ui().float) ui().float(p.side, '狮驼', 'is-mark');
  }

  async function enterDying(target, source) {
    if (!G || G.over || !target.alive) return;
    if (target.flags.dying) return;
    target.flags.dying = true;
    if (target.general && target.general.id === 'laofang') {
      target.flags.dyingCount = (target.flags.dyingCount || 0) + 1;
    }
    G.busy = true;

    log(tag(target) + ' 进入濒死状态，命悬一线。', 'log-damage');
    banner('濒死', target.general.name + ' 还剩一口气', 'red');
    if (ui() && ui().hit) ui().hit(target.side);
    emit();
    await beat(560);

    // 忘忧 · 不屈
    if (hasSkill(target, 'buqu') && target.hp <= 0) {
      const judged = await doJudge(target, '不屈');
      if (judged) {
        const suits = target.flags.buquSuits || [];
        if (suits.indexOf(judged.suit) < 0) {
          suits.push(judged.suit);
          target.flags.buquSuits = suits;
          target.hp = 1;
          target.stats.skillsUsed += 1;
          log(tag(target) + ' 发动【不屈】：判定为' + judged.suitName + judged.rankLabel + '，记录新花色，免于死亡。', 'log-skill');
          toast('不屈 · 新花色续命', 'is-success');
          if (ui() && ui().awaken) ui().awaken(target.side);
          emit();
          await beat(620);
        } else {
          log(tag(target) + ' 的【不屈】判定花色已记录，未能续命。', 'log-system');
          emit();
          await beat(320);
        }
      }
    }

    // 牢方 · 杂鱼
    if (hasSkill(target, 'zayu') && !target.flags.zayuUsed && target.hp <= 0) {
      target.flags.zayuUsed = true;
      playLaofangVoice(target, 'oniichan');
      const y = Math.max(1, target.flags.dyingCount || 1);
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【杂鱼】：本局第 ' + y + ' 次濒死，回复 ' + y + ' 点体力，并召唤等量雷电。', 'log-skill');
      toast('杂鱼 · 越死越精神', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      await heal(target, y, '杂鱼');
      let chosen = null;
      const others = allPlayers().filter(function (x) { return x && x.alive && x !== target; });
      if (others.length) {
        if (target.side === 'player' && ui() && ui().choose) {
          const pick = await ui().choose({
            kicker: '杂鱼 · 等量雷电',
            title: '选择一名角色承受 ' + y + ' 点雷电伤害',
            sub: '“杂鱼”回复的体力，会原样劈向一个人。',
            options: others.map(function (x) {
              return { value: x.side, label: x.general.name + ' · ' + x.general.subtitle, desc: '体力 ' + Math.max(0, x.hp) + '/' + x.maxHp + ' · 手牌 ' + x.hand.length };
            }),
            cancelable: false
          });
          chosen = others.find(function (x) { return x.side === pick; }) || others[0];
        } else {
          chosen = livingEnemies(target)[0] || others[0];
        }
      }
      if (chosen) {
        emit();
        await beat(260);
        await dealDamage(target, chosen, y, { reason: '杂鱼', element: 'thunder' });
      }
      gainSkill(target, 'nijiang');
      gainSkill(target, 'loli');
      log(tag(target) + ' 获得【尼酱】与【萝莉】。', 'log-skill');
      emit();
      await beat(620);
    }

    // 蓝肥鱼 · 深潜
    if (hasSkill(target, 'shenqian') && !target.flags.shenqianUsed && target.hp <= 0) {
      target.flags.shenqianUsed = true;
      target.hp = Math.min(target.maxHp, Math.max(target.hp, 3));
      target.flags.qiusuoUsed = false;
      target.flags.qiusuoExtra = (target.flags.qiusuoExtra || 0) + 1;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【深潜】：回复至3点体力，摸3张，重置求索并使下次求索多拿1张。', 'log-skill');
      toast('深潜 · 浮上水面', 'is-success');
      if (ui() && ui().awaken) ui().awaken(target.side);
      await drawCards(target, 3, { silent: true });
      emit();
      await beat(620);
    }

    // 兮穗门 · 穗亡
    if (hasSkill(target, 'suimie') && !target.flags.suimieUsed && target.hp <= 0) {
      target.flags.suimieUsed = true;
      target.flags.fengdaoReborn = true;
      target.hp = Math.min(target.maxHp, 4);
      loseSkill(target, 'choushi');
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【穗亡】：首次死亡时回复4点体力，废除【仇视】，【封刀】改写为杀酒不限、基本化杀、锦囊化酒或拆。', 'log-skill');
      toast('穗亡 · 刀开', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      emit();
      await beat(720);
    }

    // 界限突破满穗 · 不灭
    if (hasSkill(target, 'bumie') && !target.flags.bumieUsed && target.hp <= 0) {
      target.flags.bumieUsed = true;
      target.flags.awakened = true;
      target.hp = 2;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【不灭】：破穗不肯断，体力回复至2点，摸一张牌。', 'log-skill');
      toast('不灭 · 穗不肯断', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      await drawCards(target, 1, { silent: true });
      emit();
      await beat(620);
    }

    // 史可法 · 殉国
    if (hasSkill(target, 'xunguo') && !target.flags.xunguoUsed && target.hp <= 0) {
      target.flags.xunguoUsed = true;
      target.flags.awakened = true;
      target.hp = 2;
      target.stats.skillsUsed += 1;
      log(tag(target) + ' 发动【殉国】：城存与存，城亡与亡，体力回复至2点。', 'log-skill');
      toast('殉国 · 城亡与亡', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      await drawCards(target, 1, { silent: true });
      emit();
      await beat(620);
    }

    // 满穗 · 无奈
    if (hasSkill(target, 'wunai') && !target.flags.wunaiUsed) {
      target.flags.wunaiUsed = true;
      target.flags.awakened = true;
      target.hp = Math.min(target.maxHp, 2);
      gainSkill(target, 'xinsheng');
      log(tag(target) + ' 发动【无奈】觉醒：回复2点体力，获得【新生】。', 'log-skill');
      toast('觉醒 · 无奈', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      emit();
      await beat(520);
    }

    // 良 & 满穗 · 共死
    if (hasSkill(target, 'gongsi') && !target.flags.gongsiUsed && target.hp <= 0) {
      target.flags.gongsiUsed = true;
      target.flags.awakened = true;
      target.maxHp = Math.max(1, target.maxHp - 1);
      target.hp = 1;
      gainSkill(target, 'zhusi');
      gainSkill(target, 'boming');
      log(tag(target) + ' 发动【共死】觉醒：失去1点体力上限，回复至1点体力，获得【殊死】与【搏命】。', 'log-skill');
      toast('觉醒 · 良穗共死', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      emit();
      await beat(560);
    }

    // 良 · 赎罪
    if (hasSkill(target, 'shuzui') && !target.flags.shuzuiUsed && target.hp <= 0) {
      target.flags.shuzuiUsed = true;
      target.flags.awakened = true;
      target.hp = Math.min(target.maxHp, 2);
      loseSkill(target, 'qianli');
      gainSkill(target, 'husui');
      log(tag(target) + ' 发动【赎罪】觉醒：回复2点体力，失去【千里行】，获得【护穗】。', 'log-skill');
      toast('觉醒 · 赎罪', 'is-skill');
      if (ui() && ui().awaken) ui().awaken(target.side);
      emit();
      await beat(520);
    }

    // 苏怜烟 · 烟逝
    if (hasSkill(target, 'yanshi') && !target.flags.yanshiUsed && target.hp <= 0) {
      target.flags.yanshiUsed = true;
      log(tag(target) + ' 发动【烟逝】，翻开牌堆顶一张牌。', 'log-skill');
      emit();
      await beat(360);
      const card = drawTopCard();
      if (card) {
        if (ui() && ui().showJudge) ui().showJudge(card, '烟逝', card.color === 'red' ? '红色 · 烟消未散' : '黑色 · 生死由天');
        emit();
        await beat(650);
        G.discard.push(card);
        if (ui() && ui().clearJudge) ui().clearJudge();
        if (card.color === 'red') {
          target.hp = Math.min(target.maxHp, 2);
          loseSkill(target, 'yanshi');
          log('翻出红色牌，' + tag(target) + ' 回复2点体力并摸一张牌，然后失去【烟逝】。', 'log-skill');
          toast('烟逝 · 烟消未散', 'is-skill');
          if (ui() && ui().awaken) ui().awaken(target.side);
          emit();
          await drawCards(target, 1, { silent: true });
          await beat(360);
        } else {
          log('翻出黑色牌，【烟逝】未能生效。', 'log-system');
          emit();
          await beat(360);
        }
      }
    }

    // 林翩翩 · 残红
    if (hasSkill(target, 'canhong') && !target.flags.canhongUsed && target.hp <= 0) {
      target.flags.canhongUsed = true;
      target.stats.skillsUsed += 1;
      const reds = target.hand.filter(function (c) { return c.color === 'red'; });
      reds.forEach(function (c) {
        removeFromHand(target, c);
        G.discard.push(c);
      });
      if (reds.length) {
        target.hp = Math.min(target.maxHp, 2);
        log(tag(target) + ' 发动【残红】，弃置 ' + reds.length + ' 张红色手牌，回复2点体力并摸一张牌。', 'log-skill');
        toast('残红 · 花落人未死', 'is-skill');
        if (ui() && ui().awaken) ui().awaken(target.side);
        emit();
        await drawCards(target, 1, { silent: true });
      } else {
        target.hp = Math.min(target.maxHp, 1);
        log(tag(target) + ' 发动【残红】，没有红色手牌可弃，回复1点体力。', 'log-skill');
        toast('残红 · 一枝残花', 'is-skill');
        if (ui() && ui().awaken) ui().awaken(target.side);
        emit();
      }
      await beat(520);
    }

    // 满穗 · 搏命
    if (hasSkill(target, 'boming') && !target.flags.bomingUsed && (target.marks.sui || 0) >= 2 && target.hp <= 0) {
      let use = false;
      if (target.side === 'player') {
        const choice = await ui().choose({
          kicker: '搏命 · 良穗共死',
          title: '还不到死的时候',
          sub: '消耗2枚“穗”，将体力回复至2点。每回合限一次。',
          options: [
            { value: 'yes', label: '消耗2枚“穗”', desc: '当前“穗”：' + target.marks.sui },
            { value: 'no', label: '不再挣扎', desc: '接受死亡。' }
          ],
          cancelable: false
        });
        use = choice === 'yes';
      } else {
        use = true;
      }
      if (use && spendMark(target, 'sui', 2)) {
        target.flags.bomingUsed = true;
        target.hp = 2;
        target.stats.skillsUsed += 1;
        log(tag(target) + ' 发动【搏命】，消耗2枚“穗”，将体力回复至2点。', 'log-skill');
        toast('搏命 · 命不该绝', 'is-skill');
        if (ui() && ui().awaken) ui().awaken(target.side);
        emit();
        await beat(520);
      }
    }

    if (target.hp > 0) {
      target.flags.dying = false;
      log(tag(target) + ' 从鬼门关前活了回来。', 'log-heal');
      emit();
      await beat(380);
      return true;
    }

    // 使用桃 / 穗
    let guard = 0;
    while (!G.over && target.hp <= 0 && guard < 12) {
      guard += 1;
      const opts = buildResponseOptions(target, '桃');
      if (!opts.cards.length && !opts.extras.length) break;

      if (target.side === 'player') {
        const hasJiu = opts.cards.some(function (x) { return x.card.name === '酒'; });
        const res = await ui().askResponse({
          kicker: '濒死',
          title: '命悬一线',
          sub: hasJiu ? '使用【桃】/【酒】或“穗”回复1点体力。若放弃，角色将死亡。' : '使用【桃】或“穗”回复1点体力。若放弃，角色将死亡。',
          cards: opts.cards,
          extras: opts.extras,
          cancelLabel: '放弃',
          kind: '桃'
        });
        if (!res || res.type === 'none') {
          log('你放弃了最后的挣扎。', 'log-damage');
          break;
        }
        await applyResponse(target, '桃', res);
      } else {
        if (!aiUsePeach(target)) break;
        if (opts.cards.length) {
          const card = opts.cards[0].card;
          await applyResponse(target, '桃', { type: 'card', card: card, via: null });
        } else if (opts.extras.length) {
          await applyResponse(target, '桃', { type: 'skill', value: opts.extras[0].value });
        } else {
          break;
        }
        await beat(420);
      }
      emit();
      await beat(220);
    }

    if (target.hp > 0) {
      target.flags.dying = false;
      if (ui() && ui().float) ui().float(target.side, '活', 'is-heal');
      log(tag(target) + ' 从濒死中回复过来。', 'log-heal');
      emit();
      await beat(360);
      return true;
    }

    target.flags.dying = false;
    target.hp = 0;
    target.alive = false;
    G.deathThisTurn = (G.deathThisTurn || 0) + 1;
    grantSuxuOnDeath(target);
    noteKill(source, target);
    if (source && source.side === 'player' && source.general && target.general &&
        source.general.id === 'fangzhiyou' && target.general.id === 'linpianpian') {
      source.stats.fangKilledLin = (source.stats.fangKilledLin || 0) + 1;
    }
    log(tag(target) + ' 倒下了。', 'log-result');
    if (ui() && ui().hit) ui().hit(target.side);
    banner('身死', target.general.name + ' 倒在了乱世里', 'red');
    emit();
    await beat(850);
    if (G.mode !== '1v1') {
      if (target.side === 'player') {
        endGame('ai', target.general.name + '已经倒下。');
      } else if (!livingEnemies(G.player).length) {
        endGame('player', G.mode === '1v5' ? '五名对手皆已倒下。' : '两名对手皆已倒下。');
      } else {
        log('一名对手倒下，还剩 ' + livingEnemies(G.player).length + ' 名对手。', 'log-result');
        emit();
      }
    } else {
      endGame(otherOf(target).side, target.general.name + '已经倒下。');
    }
    return false;
  }

  function aiUsePeach(target) {
    const cfg = aiConfig();
    if (cfg.respond >= 0.9) return true;
    return Math.random() <= 0.58;
  }

  async function performQiaoshe(p, chosen) {
    removeFromHand(p, chosen);
    G.discard.push(chosen);
    p.flags.qiaosheUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【巧舌】，弃置' + cardFull(chosen) + '，摸两张牌。', 'log-skill');
    toast(p.general.name + ' · 巧舌', 'is-skill');
    await drawCards(p, 2, { silent: true });
    if (chosen.color === 'black') {
      const enemy = primaryEnemy(p);
      const stolen = enemy ? pickRandomHandCard(enemy) : null;
      if (stolen) {
        removeFromHand(enemy, stolen);
        G.discard.push(stolen);
        log('【巧舌】令 ' + tag(enemy) + ' 随机弃置一张手牌。', 'log-skill');
        if (ui() && ui().float) ui().float(enemy.side, '巧舌 · 弃牌', 'is-mark');
      }
    }
    emit();
    await beat(300);
  }

  async function performShishu(p) {
    p.flags.shishuUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【诗书】，摸两张牌，然后弃置一张手牌。', 'log-skill');
    toast(p.general.name + ' · 诗书', 'is-skill');
    await drawCards(p, 2, { silent: true });
    if (!p.hand.length) return;
    let chosen = null;
    if (p.side === 'player') {
      const res = await ui().pickCards({
        kicker: '诗书',
        title: '弃置一张手牌',
        sub: '摸两张牌后，弃置一张手牌。',
        cards: p.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '弃置',
        cancelable: false
      });
      chosen = p.hand.find(function (c) { return c.uid === (res && res[0]); }) || null;
    } else {
      chosen = p.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
    }
    if (!chosen) chosen = p.hand[p.hand.length - 1];
    removeFromHand(p, chosen);
    G.discard.push(chosen);
    log(tag(p) + ' 弃置' + cardFull(chosen) + '。', 'log-system');
    emit();
    await beat(260);
  }

  async function performCaiwei(p) {
    p.flags.caiweiUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【采薇】，摸一张牌。', 'log-skill');
    toast(p.general.name + ' · 采薇', 'is-skill');
    const before = p.hand.length;
    await drawCards(p, 1, { silent: true });
    const card = p.hand[p.hand.length - 1];
    if (p.hand.length > before && card && card.color === 'red') {
      log('【采薇】翻出红色牌，' + tag(p) + ' 回复1点体力。', 'log-heal');
      await heal(p, 1, '采薇');
    }
    emit();
    await beat(260);
  }

  async function performXinlan(p, chosen) {
    removeFromHand(p, chosen);
    G.discard.push(chosen);
    p.flags.xinlanUsed = true;
    p.stats.skillsUsed += 1;
    log(tag(p) + ' 发动【心兰】，弃置' + cardFull(chosen) + '，回复1点体力并摸一张牌。', 'log-skill');
    toast(p.general.name + ' · 心兰', 'is-skill');
    await heal(p, 1, '心兰');
    await drawCards(p, 1, { silent: true });
    emit();
    await beat(280);
  }

  async function performTunri(p, chosen, target) {
    removeFromHand(p, chosen);
    G.discard.push(chosen);
    p.flags.tunriUsed = true;
    p.stats.skillsUsed += 1;
    const drawBack = target.hp <= p.hp;
    log(tag(p) + ' 发动【吞日】，弃置' + cardFull(chosen) + '，对 ' + tag(target) + ' 造成1点伤害。', 'log-skill');
    toast(p.general.name + ' · 吞日', 'is-skill');
    emit();
    await beat(220);
    await dealDamage(p, target, 1, { reason: '吞日' });
    if (!G.over && drawBack && p.alive) {
      log(tag(p) + ' 的【吞日】吞下日轮，摸一张牌。', 'log-skill');
      await drawCards(p, 1, { silent: true });
    }
    emit();
    await beat(260);
  }

  async function activateHumanSkill(skillId) {
    const p = G.player;
    const enemy = primaryEnemy(p) || G.ai;

    if (skillId === 'suxu') {
      await performSuxu(p);
      return true;
    }
    if (skillId === 'qiusuo') {
      await performQiusuo(p);
      return true;
    }
    if (skillId === 'baoshi') {
      await performBaoshi(p);
      return true;
    }
    if (skillId === 'lieqi') {
      await performLieqi(p);
      return true;
    }
    if (skillId === 'loli') {
      await performLoli(p);
      return true;
    }
    if (skillId === 'xuemuo') {
      await performXuemuo(p);
      return true;
    }
    if (skillId === 'suosuo') {
      await performSuosuo(p);
      return true;
    }
    if (skillId === 'liangyuan') {
      await performLiangyuan(p);
      return true;
    }
    if (skillId === 'tonglu') {
      await performTonglu(p);
      return true;
    }
    if (skillId === 'tizai') {
      await performTizai(p);
      return true;
    }
    if (skillId === 'duantu') {
      await performDuantu(p);
      return true;
    }
    if (skillId === 'shishu_mo') {
      await performShishuMo(p);
      return true;
    }
    if (skillId === 'duangeng') {
      await performDuangeng(p);
      return true;
    }
    if (skillId === 'shenfa') {
      await performShenfa(p);
      return true;
    }
    if (skillId === 'chengshen') {
      await performChengshen(p);
      return true;
    }

    if (skillId === 'chuangwang') {
      if (!hasSkill(p, 'chuangwang') || (p.flags.chuangwangUsed || 0) >= 1 || p.flags.chuangwangBuff) return false;
      p.flags.chuangwangUsed = (p.flags.chuangwangUsed || 0) + 1;
      p.flags.chuangwangBuff = true;
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 发动【闯王】，下一张牌无法被响应，结算效果翻倍。', 'log-skill');
      toast('闯王 · 破城', 'is-skill');
      if (ui() && ui().float) ui().float(p.side, '闯王 · 下一张翻倍', 'is-mark');
      emit();
      await beat(320);
      return true;
    }

    if (skillId === 'qiaoshe') {
      if (!hasSkill(p, 'qiaoshe') || p.flags.qiaosheUsed || !p.hand.length) return false;
      const res = await ui().pickCards({
        kicker: '巧舌',
        title: '弃置一张手牌',
        sub: '弃一张手牌，摸两张牌；若弃的是黑色牌，再令一名对手随机弃一张手牌。',
        cards: p.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '发动巧舌',
        cancelable: true
      });
      if (!res || !res.length) return false;
      const chosen = p.hand.find(function (c) { return c.uid === res[0]; });
      if (!chosen) return false;
      await performQiaoshe(p, chosen);
      return true;
    }

    if (skillId === 'shishu') {
      if (!hasSkill(p, 'shishu') || p.flags.shishuUsed) return false;
      await performShishu(p);
      return true;
    }

    if (skillId === 'caiwei') {
      if (!hasSkill(p, 'caiwei') || p.flags.caiweiUsed) return false;
      await performCaiwei(p);
      return true;
    }

    if (skillId === 'xinlan') {
      if (!hasSkill(p, 'xinlan') || p.flags.xinlanUsed || !p.hand.length) return false;
      const res = await ui().pickCards({
        kicker: '心兰',
        title: '弃置一张手牌',
        sub: '弃一张手牌，回复1点体力并摸一张牌。',
        cards: p.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '发动心兰',
        cancelable: true
      });
      if (!res || !res.length) return false;
      const chosen = p.hand.find(function (c) { return c.uid === res[0]; });
      if (!chosen) return false;
      await performXinlan(p, chosen);
      return true;
    }

    if (skillId === 'tunri') {
      if (!hasSkill(p, 'tunri') || p.flags.tunriUsed || !p.hand.length) return false;
      const targets = livingEnemies(p).filter(function (t) { return canReach(p, t); });
      if (!targets.length) return false;
      let target = targets[0];
      if (targets.length > 1) {
        const options = targets.map(function (t) {
          return {
            value: t.side,
            label: t.general.name + ' · ' + t.general.subtitle,
            desc: '体力 ' + t.hp + '/' + t.maxHp + ' · 距离 ' + distanceBetween(p, t) + ' · 手牌 ' + t.hand.length
          };
        });
        const pick = await ui().choose({
          kicker: '吞日',
          title: '选择攻击范围内的一名对手',
          sub: '弃一张手牌，对其造成1点伤害；若其体力不大于你，你摸一张牌。',
          options: options,
          cancelable: true
        });
        if (!pick) return false;
        target = targets.find(function (t) { return t.side === pick; }) || targets[0];
      }
      const res = await ui().pickCards({
        kicker: '吞日',
        title: '弃置一张手牌',
        sub: '弃一张手牌，对 ' + target.general.name + ' 造成1点伤害。',
        cards: p.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '发动吞日',
        cancelable: true
      });
      if (!res || !res.length) return false;
      const chosen = p.hand.find(function (c) { return c.uid === res[0]; });
      if (!chosen) return false;
      await performTunri(p, chosen, target);
      return true;
    }

    if (skillId === 'danxiao') {
      const res = await ui().pickCards({
        kicker: '淡笑',
        title: '弃两张同花色手牌',
        sub: '红色回复1点体力；黑色对对手造成1点伤害。',
        cards: p.hand.slice(),
        min: 2,
        max: 2,
        confirmLabel: '发动淡笑',
        cancelable: true,
        validate: function (selected) {
          if (selected.length !== 2) return '请选择两张手牌';
          const suits = {};
          selected.forEach(function (uid) {
            const c = p.hand.find(function (x) { return x.uid === uid; });
            if (c) suits[c.suit] = true;
          });
          if (Object.keys(suits).length !== 1) return '两张牌必须同花色';
          return '';
        }
      });
      if (!res) return false;
      const chosen = res.map(function (uid) { return p.hand.find(function (c) { return c.uid === uid; }); }).filter(Boolean);
      if (chosen.length !== 2) return false;
      const color = chosen[0].color;
      chosen.forEach(function (c) {
        removeFromHand(p, c);
        G.discard.push(c);
      });
      p.flags.danxiaoUsed = true;
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 发动【淡笑】，弃置两张' + (color === 'red' ? '红色' : '黑色') + '牌。', 'log-skill');
      toast('淡笑 · ' + (color === 'red' ? '红' : '黑'), 'is-skill');
      emit();
      await beat(300);
      if (color === 'red') {
        await heal(p, 1, '淡笑');
      } else {
        await dealDamage(p, enemy, 1, { reason: '淡笑' });
      }
      if (!G.over) emit();
      return true;
    }

    if (skillId === 'zhushu') {
      const options = [
        { value: 'draw', label: '弃1枚“忆”，摸两张牌', desc: '当前“忆”：' + p.marks.yi },
        { value: 'heal', label: '弃2枚“忆”，回复1点体力', desc: p.marks.yi >= 2 ? '当前“忆”：' + p.marks.yi : '“忆”不足，无法选择。', disabled: p.marks.yi < 2 }
      ];
      const choice = await ui().choose({
        kicker: '著书',
        title: '写下去，还是活下去？',
        sub: '出牌阶段限一次。',
        options: options,
        cancelable: true
      });
      if (!choice) return false;
      if (choice === 'draw' && spendMark(p, 'yi', 1)) {
        p.flags.zhushuUsed = true;
        p.stats.skillsUsed += 1;
        log(tag(p) + ' 发动【著书】，弃1枚“忆”，摸两张牌。', 'log-skill');
        emit();
        await drawCards(p, 2);
      } else if (choice === 'heal' && spendMark(p, 'yi', 2)) {
        p.flags.zhushuUsed = true;
        p.stats.skillsUsed += 1;
        log(tag(p) + ' 发动【著书】，弃2枚“忆”，回复1点体力。', 'log-skill');
        await heal(p, 1, '著书');
      } else {
        return false;
      }
      if (!G.over) emit();
      return true;
    }

    if (skillId === 'shituo') {
      if (!spendMark(p, 'yi', 2)) return false;
      p.flags.shituoUsed = true;
      p.stats.skillsUsed += 1;
      log(tag(p) + ' 发动【狮驼】，弃2枚“忆”，对 ' + tag(enemy) + ' 造成1点伤害。', 'log-skill');
      toast('狮驼 · 妖从纸出', 'is-skill');
      emit();
      await beat(360);
      await dealDamage(p, enemy, 1, { reason: '狮驼' });
      if (!G.over) emit();
      return true;
    }

    if (skillId === 'yanxing') {
      const cards = p.hand.filter(function (c) { return c.color === 'black'; });
      const res = await ui().pickCards({
        kicker: '雁行',
        title: '将一张黑色手牌当【杀】使用',
        sub: '出牌阶段限一次。此牌将进入弃牌堆。',
        cards: cards,
        min: 1,
        max: 1,
        confirmLabel: '当【杀】使用',
        cancelable: true
      });
      if (!res || !res.length) return false;
      const chosen = p.hand.find(function (c) { return c.uid === res[0]; });
      if (!chosen) return false;
      removeFromHand(p, chosen);
      G.discard.push(chosen);
      p.flags.yanxingUsed = true;
      p.flags.slashUsed += 1;
      p.stats.cardsPlayed += 1;
      p.stats.skillsUsed += 1;
      const vc = virtualCard('杀', '雁行', chosen);
      log(tag(p) + ' 发动【雁行】，将' + cardFull(chosen) + '当【杀】对 ' + tag(enemy) + ' 使用。', 'log-skill');
      if (ui() && ui().playCardFx) ui().playCardFx(vc, 'player');
      emit();
      await beat(300);
      await resolveSlash(p, enemy, vc, {});
      if (!G.over) emit();
      return true;
    }

    if (skillId === 'sui_mansui') {
      const options = [];
      if (canUseSlash(p)) {
        options.push({ value: 'sha', label: '穗 · 当【杀】使用', desc: '消耗1枚“穗”，视为使用一张【杀】。' });
      }
      if (p.hp < p.maxHp) {
        options.push({ value: 'tao', label: '穗 · 当【桃】使用', desc: '消耗1枚“穗”，回复1点体力。' });
      }
      if (!options.length) {
        toast('当前无法使用“穗”。', 'is-danger');
        return false;
      }
      const choice = await ui().choose({
        kicker: '滿穗',
        title: '穗，是粮食，也是命',
        sub: '当前体力上限为 ' + p.maxHp + '，可以消耗1枚“穗”。',
        options: options,
        cancelable: true
      });
      if (!choice) return false;
      if (choice === 'tao') {
        if (!spendMark(p, 'sui', 1)) return false;
        p.stats.skillsUsed += 1;
        log(tag(p) + ' 消耗1枚“穗”，当作【桃】使用。', 'log-skill');
        await heal(p, 1, '滿穗');
        if (!G.over) emit();
        return true;
      }
      if (!spendMark(p, 'sui', 1)) return false;
      p.flags.slashUsed += 1;
      p.stats.cardsPlayed += 1;
      p.stats.skillsUsed += 1;
      const vc = virtualCard('杀', '穗', null);
      log(tag(p) + ' 消耗1枚“穗”，当作【杀】对 ' + tag(enemy) + ' 使用。', 'log-skill');
      if (ui() && ui().playCardFx) ui().playCardFx(vc, 'player');
      emit();
      await beat(260);
      let bonus = 0;
      if (hasSkill(p, 'cisha_b') && !p.flags.cishaUsed) {
        bonus = await triggerCishaB(p, enemy);
      }
      await resolveSlash(p, enemy, vc, { bonus: bonus });
      if (!G.over) emit();
      return true;
    }

    if (skillId === 'hongguan') {
      return await resolveHongguanHuman(p, enemy);
    }

    return false;
  }

  function lowestValueCard(p) {
    if (!p || !p.hand.length) return null;
    return p.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
  }

  function transferHandCard(from, to, card) {
    if (!from || !to || !card) return false;
    const idx = from.hand.findIndex(function (c) { return c.uid === card.uid; });
    if (idx < 0) return false;
    from.hand.splice(idx, 1);
    to.hand.push(card);
    return true;
  }

  async function resolveHongguanHuman(p, enemy) {
    const cost = await ui().pickCards({
      kicker: '红倌',
      title: '弃一张手牌，看客该还礼了',
      sub: '弃置一张手牌作为代价，然后令对手选择：交给你一张手牌，或受到1点伤害。',
      cards: p.hand.slice(),
      min: 1,
      max: 1,
      confirmLabel: '发动红倌',
      cancelable: true
    });
    if (!cost || !cost.length) return false;
    const discard = p.hand.find(function (c) { return c.uid === cost[0]; });
    if (!discard) return false;
    p.flags.hongguanUsed = true;
    p.stats.skillsUsed += 1;
    discardFromHand(p, discard, true);
    log(tag(p) + ' 发动【红倌】，弃置一张手牌。', 'log-skill');
    toast('林翩翩 · 红倌', 'is-skill');
    emit();
    await beat(320);
    if (!G.over) emit();

    let give = false;
    if (enemy.hand.length) {
      const cheapest = lowestValueCard(enemy);
      give = enemy.hp <= 1 || keepValue(cheapest) <= 40 || enemy.hand.length > handLimit(enemy);
    }
    if (give) {
      const card = lowestValueCard(enemy);
      if (card && transferHandCard(enemy, p, card)) {
        log(tag(enemy) + ' 选择交给 ' + tag(p) + ' 一张手牌（' + cardFull(card) + '）。', 'log-skill');
        if (ui() && ui().toast) ui().toast('红倌 · 得牌', 'is-skill');
        emit();
      }
    } else {
      log(tag(enemy) + ' 拒绝还礼，【红倌】造成1点伤害。', 'log-skill');
      await dealDamage(p, enemy, 1, { reason: '红倌' });
    }
    if (!G.over) emit();
    return true;
  }

  async function resolveHongguanAI(p, enemy) {
    const cost = lowestValueCard(p);
    if (!cost) return false;
    p.flags.hongguanUsed = true;
    p.stats.skillsUsed += 1;
    discardFromHand(p, cost, true);
    log(tag(p) + ' 发动【红倌】，弃置一张手牌。', 'log-skill');
    toast('林翩翩 · 红倌', 'is-skill');
    emit();
    await beat(380);

    let give = false;
    if (enemy.hand.length) {
      const choice = await ui().choose({
        kicker: '红倌 · 林翩翩',
        title: '她要你“还个礼”',
        sub: '交给她一张手牌，或承受1点伤害。',
        options: [
          { value: 'give', label: '交出一张手牌', desc: '由你选择交出的牌。' },
          { value: 'damage', label: '承受1点伤害', desc: '手牌一张也不给。' }
        ],
        cancelable: false
      });
      give = choice === 'give';
    }
    if (give) {
      const pick = await ui().pickCards({
        kicker: '红倌',
        title: '选择交给林翩翩的手牌',
        sub: '该牌将进入对手手牌。',
        cards: enemy.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '交给她',
        cancelable: false
      });
      const card = pick && pick.length ? enemy.hand.find(function (c) { return c.uid === pick[0]; }) : null;
      if (card && transferHandCard(enemy, p, card)) {
        log(tag(enemy) + ' 交给 ' + tag(p) + ' 一张手牌（' + cardFull(card) + '）。', 'log-system');
        emit();
      }
    } else {
      log(tag(enemy) + ' 拒绝还礼，【红倌】造成1点伤害。', 'log-skill');
      await dealDamage(p, enemy, 1, { reason: '红倌' });
    }
    if (!G.over) emit();
    return true;
  }

  /* =======================================================
     苏怜烟 · 怜影
     ======================================================= */

  async function triggerYouhua(target, source) {
    if (!target || !source || G.over) return false;
    if (!hasSkill(target, 'youhua') || target.flags.youhuaUsed || !target.hand.length) return false;
    let chosen = null;
    if (target.side === 'player') {
      const res = await ui().pickCards({
        kicker: '油滑',
        title: '要弃牌令此【杀】无效吗？',
        sub: '弃置一张手牌，令此【杀】对你无效。',
        cards: target.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '弃牌闪避',
        cancelable: true
      });
      if (!res || !res.length) return false;
      chosen = target.hand.find(function (c) { return c.uid === res[0]; });
    } else {
      chosen = target.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
    }
    if (!chosen) return false;
    target.flags.youhuaUsed = true;
    target.stats.skillsUsed += 1;
    removeFromHand(target, chosen);
    G.discard.push(chosen);
    log(tag(target) + ' 发动【油滑】，弃置一张手牌，令此【杀】无效。', 'log-skill');
    toast(target.general.name + ' · 油滑', 'is-skill');
    if (ui() && ui().dodge) ui().dodge(target.side);
    if (ui() && ui().float) ui().float(target.side, '油滑', 'is-heal');
    emit();
    await beat(300);
    return true;
  }

  async function triggerLianying(target, source) {
    if (!target || !source || G.over) return false;
    if (!hasSkill(target, 'lianying') || target.flags.lianyingUsed || !target.hand.length) return false;

    let use = false;
    if (target.side === 'player') {
      const choice = await ui().choose({
        kicker: '怜影 · 苏怜烟',
        title: '此【杀】已至，要发动【怜影】吗？',
        sub: '弃置1张手牌，令此【杀】对你无效。每回合限一次。',
        options: [
          { value: 'yes', label: '弃一张手牌，令此【杀】无效', desc: '以一张牌，换一次不死。' },
          { value: 'no', label: '不发动', desc: '承受此【杀】。' }
        ],
        cancelable: false
      });
      use = choice === 'yes';
    } else {
      const cfg = aiConfig();
      use = target.hp <= 2 ? (!(cfg.respond < 0.7) || Math.random() < 0.5) : Math.random() < cfg.respond * 0.36;
    }
    if (!use) return false;

    let card = null;
    if (target.side === 'player') {
      const res = await ui().pickCards({
        kicker: '怜影',
        title: '弃置一张手牌',
        sub: '被弃置的牌将进入弃牌堆。',
        cards: target.hand.slice(),
        min: 1,
        max: 1,
        confirmLabel: '弃置并令【杀】无效',
        cancelable: true
      });
      if (!res || !res.length) return false;
      card = target.hand.find(function (c) { return c.uid === res[0]; });
    } else {
      card = target.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
    }
    if (!card) return false;
    target.flags.lianyingUsed = true;
    target.stats.skillsUsed += 1;
    discardFromHand(target, card, true);
    log(tag(target) + ' 发动【怜影】，弃置一张手牌，令此【杀】无效。', 'log-skill');
    toast('怜影 · 杀意成空', 'is-skill');
    if (ui() && ui().dodge) ui().dodge(target.side);
    if (ui() && ui().float) ui().float(target.side, '闪', 'is-heal');
    emit();
    await beat(450);
    return true;
  }

  /* =======================================================
     判定
     ======================================================= */

  async function doJudge(p, label) {
    if (!G || G.over) return null;
    const card = drawTopCard();
    if (!card) {
      if (ui() && ui().clearJudge) ui().clearJudge();
      return null;
    }
    G.judgingCard = card;
    const resultText = card.suitName + card.rankLabel + ' · ' + (card.color === 'red' ? '红' : '黑');
    log('判定：' + tag(p) + ' 翻出 ' + cardFull(card) + '。', 'log-system');
    if (ui() && ui().showJudge) ui().showJudge(card, label || '判定', resultText);
    emit();
    await beat(720);
    G.discard.push(card);
    G.judgingCard = null;
    if (ui() && ui().clearJudge) ui().clearJudge();
    emit();
    await beat(180);
    return card;
  }

  /* =======================================================
     AI
     ======================================================= */

  function aiConfig() {
    const d = G && G.difficulty ? G.difficulty.id : 'normal';
    if (d === 'easy') return { respond: 0.64, skill: 0.52, smart: 0.4 };
    if (d === 'super') return { respond: 1, skill: 1, smart: 1, human: true };
    if (d === 'hard') return { respond: 1, skill: 1, smart: 1 };
    return { respond: 0.92, skill: 0.86, smart: 0.8 };
  }

  async function aiPlay() {
    const p = G.activeAI || G.ai;
    const enemy = G.player;
    if (!p || !p.alive) return;
    log(tagSoft(p) + ' 开始出牌。', 'log-ai');
    if (ui() && ui().setIntent) ui().setIntent(p.general.name + '正在权衡每一张牌');
    emit();
    await beat(560);

    for (let step = 0; step < 30 && !G.over; step += 1) {
      if (G.phase !== 'play' || G.turn !== p.side) break;

      const usedSkill = await aiTryActiveSkill();
      if (usedSkill) {
        if (ui() && ui().setIntent) ui().setIntent(p.general.name + '正在权衡每一张牌');
        emit();
        await beat(520);
        continue;
      }

      const card = aiChooseCard(p, enemy);
      if (!card) break;

      if (ui() && ui().setIntent) ui().setIntent(p.general.name + '打出了' + cardName(card));
      emit();
      await playCard(p, enemy, card);
      await beat(620);
    }

    if (ui() && ui().setIntent) ui().setIntent('');
    emit();
    await beat(300);
  }

  function aiChooseCard(p, enemy) {
    let playable = p.hand.filter(function (c) { return Engine.canPlay(c, p).ok; });
    if (shirenProtected(enemy)) {
      playable = playable.filter(function (c) { return !(isSlashCard(c) || isSingleTargetTrick(c)); });
    }
    if (!playable.length) return null;

    const byName = function (name) {
      return playable.find(function (c) { return c.name === name; });
    };
    const cfg = aiConfig();

    // 超级困难：像人一样先看能不能直接收掉
    if (cfg.human && enemy.hp <= 2 && canUseSlash(p) && (p.flags.guchengRule || hasSkill(p, 'shizhan') || canReach(p, enemy))) {
      const lethal = playable.find(isSlashCard);
      if (lethal) return lethal;
    }
    if (cfg.human && enemy.hp <= 2) {
      const aoe = byName('南蛮入侵') || byName('万箭齐发');
      if (aoe) return aoe;
    }

    // 1. 濒危时吃桃
    if (p.hp <= 2) {
      const tao = byName('桃');
      if (tao) return tao;
    }
    // 1.5 斩杀优先：对手只剩两血且杀在射程内
    if (canUseSlash(p) && (p.flags.guchengRule || hasSkill(p, 'shizhan') || canReach(p, enemy)) && enemy.hp <= 2) {
      const lethalSlash = playable.find(isSlashCard);
      if (lethalSlash) return lethalSlash;
    }
    // 2. 酒：手里有杀时先饮酒，可叠多层
    const jiu = byName('酒');
    if (jiu && p.hand.some(isSlashCard) && enemy.hp > 1) return jiu;
    // 3. 无中
    const wuzhong = byName('无中生有');
    if (wuzhong) return wuzhong;
    // 3. 防具 / 坐骑 / 武器
    const armor = playable.find(function (c) {
      return c.type === 'armor' && (!p.armor || p.armor.kind !== c.kind);
    });
    if (armor) return armor;
    const mount = playable.find(function (c) {
      return c.type === 'mount' && !p.mounts[c.mountType === 'defense' ? 'defense' : 'offense'];
    });
    if (mount) return mount;
    if (!p.weapon) {
      const weapon = playable.find(function (c) { return c.type === 'weapon'; });
      if (weapon) return weapon;
    }
    // 4. 延时锦囊
    const lebu = byName('乐不思蜀');
    if (lebu && !enemy.judge.some(function (c) { return c.kind === 'lebu'; })) return lebu;
    const bing = byName('兵粮寸断');
    if (bing && !enemy.judge.some(function (c) { return c.kind === 'bingliang'; })) return bing;
    // 4. 拆 / 顺
    const shun = byName('顺手牵羊');
    if (shun && targetHasZone(enemy)) return shun;
    const chai = byName('过河拆桥');
    if (chai && targetHasZone(enemy)) return chai;
    // 5. 决斗
    const juedou = byName('决斗');
    if (juedou) {
      const slashes = p.hand.filter(isSlashCard).length;
      if (slashes >= 1 || enemy.hp <= 2) return juedou;
    }
    // 6. AOE
    const nanman = byName('南蛮入侵');
    if (nanman && (enemy.hand.length <= 2 || enemy.hp <= 2)) return nanman;
    const wanjian = byName('万箭齐发');
    if (wanjian && (enemy.hand.length <= 2 || enemy.hp <= 2)) return wanjian;
    // 7. 杀
    const sha = playable.find(isSlashCard);
    if (sha && canUseSlash(p) && (p.flags.guchengRule || hasSkill(p, 'shizhan') || canReach(p, enemy))) return sha;
    // 8. 有富余再吃桃
    if (p.hp < p.maxHp) {
      const tao = byName('桃');
      if (tao && (p.hand.length > handLimit(p) || p.hp <= 2)) return tao;
    }
    // 9. 其他可用牌
    const fallback = playable.filter(function (c) {
      return ['南蛮入侵', '万箭齐发', '决斗', '过河拆桥', '顺手牵羊'].indexOf(c.name) >= 0;
    });
    return fallback[0] || null;
  }

  async function aiTryActiveSkill() {
    const p = G.activeAI || G.ai;
    const enemy = G.player;
    if (!p || !p.alive || G.over) return false;

    if (hasSkill(p, 'tunri') && !p.flags.tunriUsed && p.hand.length && canReach(p, enemy)) {
      const chosen = p.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
      if (chosen) {
        await performTunri(p, chosen, enemy);
        return true;
      }
    }

    // 李闯王 · 闯王：两次强化下一张牌
    if (hasSkill(p, 'chuangwang') && (p.flags.chuangwangUsed || 0) < 1 && !p.flags.chuangwangBuff) {
      const hasPlayable = p.hand.some(function (c) { return Engine.canPlay(c, p).ok; });
      if (hasPlayable) {
        p.flags.chuangwangUsed = (p.flags.chuangwangUsed || 0) + 1;
        p.flags.chuangwangBuff = true;
        p.stats.skillsUsed += 1;
        log(tagSoft(p) + ' 发动【闯王】，下一张牌无法被响应，结算效果翻倍。', 'log-skill');
        toast(p.general.name + ' · 闯王', 'is-skill');
        emit();
        await beat(300);
        return true;
      }
    }

    if (hasSkill(p, 'qiaoshe') && !p.flags.qiaosheUsed && p.hand.length) {
      const chosen = p.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
      await performQiaoshe(p, chosen);
      return true;
    }
    if (hasSkill(p, 'shishu') && !p.flags.shishuUsed) {
      await performShishu(p);
      return true;
    }
    if (hasSkill(p, 'caiwei') && !p.flags.caiweiUsed) {
      await performCaiwei(p);
      return true;
    }
    if (hasSkill(p, 'xinlan') && !p.flags.xinlanUsed && p.hand.length) {
      const chosen = p.hand.slice().sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
      await performXinlan(p, chosen);
      return true;
    }

    // 满穗 · 共生：濒危时穗当桃 / 缺杀时穗当杀
    if (hasSkill(p, 'sui_mansui') && p.maxHp <= 2 && (p.marks.sui || 0) > 0) {
      if (p.hp < p.maxHp && (p.hp <= 1 || !p.hand.some(function (c) { return c.name === '桃'; }))) {
        spendMark(p, 'sui', 1);
        p.stats.skillsUsed += 1;
        log(tagSoft(p) + ' 发动【滿穗】，消耗1枚“穗”当作【桃】。', 'log-skill');
        await heal(p, 1, '滿穗');
        return true;
      }
      if (canUseSlash(p) && !p.hand.some(isSlashCard) && ((p.marks.sui || 0) >= 2 || enemy.hp <= 2)) {
        spendMark(p, 'sui', 1);
        p.flags.slashUsed += 1;
        p.stats.cardsPlayed += 1;
        p.stats.skillsUsed += 1;
        const vc = virtualCard('杀', '穗', null);
        log(tagSoft(p) + ' 发动【滿穗】，消耗1枚“穗”当作【杀】。', 'log-skill');
        if (ui() && ui().playCardFx) ui().playCardFx(vc, p.side);
        emit();
        await beat(380);
        let bonus = 0;
        if (hasSkill(p, 'cisha_b') && !p.flags.cishaUsed) {
          bonus = await triggerCishaB(p, enemy);
        }
        await resolveSlash(p, enemy, vc, { bonus: bonus });
        return true;
      }
    }

    // 林翩翩 · 红倌
    if (hasSkill(p, 'hongguan') && !p.flags.hongguanUsed && p.hand.length >= 2 && (enemy.hand.length || enemy.hp <= 2)) {
      const used = await resolveHongguanAI(p, enemy);
      if (used) return true;
    }

    // 方知宥 · 著书
    if (hasSkill(p, 'zhushu') && !p.flags.zhushuUsed) {
      if ((p.marks.yi || 0) >= 2 && p.hp < p.maxHp) {
        spendMark(p, 'yi', 2);
        p.flags.zhushuUsed = true;
        p.stats.skillsUsed += 1;
        log(tagSoft(p) + ' 发动【著书】，弃2枚“忆”，回复1点体力。', 'log-skill');
        await heal(p, 1, '著书');
        return true;
      }
      if ((p.marks.yi || 0) >= 1 && p.hand.length <= 3) {
        spendMark(p, 'yi', 1);
        p.flags.zhushuUsed = true;
        p.stats.skillsUsed += 1;
        log(tagSoft(p) + ' 发动【著书】，弃1枚“忆”，摸两张牌。', 'log-skill');
        await drawCards(p, 2);
        return true;
      }
    }

    // 方知宥 · 狮驼
    if (hasSkill(p, 'shituo') && !p.flags.shituoUsed && (p.marks.yi || 0) >= 2) {
      if (enemy.hp <= 2 || G.round >= 3) {
        spendMark(p, 'yi', 2);
        p.flags.shituoUsed = true;
        p.stats.skillsUsed += 1;
        log(tagSoft(p) + ' 发动【狮驼】，对 ' + tag(enemy) + ' 造成1点伤害。', 'log-skill');
        emit();
        await beat(400);
        await dealDamage(p, enemy, 1, { reason: '狮驼' });
        return true;
      }
    }

    // 小雁儿 · 雁行
    if (hasSkill(p, 'yanxing') && !p.flags.yanxingUsed && canUseSlash(p)) {
      const blackCards = p.hand.filter(function (c) { return c.color === 'black'; });
      const hasSha = p.hand.some(isSlashCard);
      if (blackCards.length && (!hasSha || blackCards.some(function (c) { return keepValue(c) <= 35; }))) {
        const chosen = blackCards.sort(function (a, b) { return keepValue(a) - keepValue(b); })[0];
        removeFromHand(p, chosen);
        G.discard.push(chosen);
        p.flags.yanxingUsed = true;
        p.flags.slashUsed += 1;
        p.stats.cardsPlayed += 1;
        p.stats.skillsUsed += 1;
        const vc = virtualCard('杀', '雁行', chosen);
        log(tagSoft(p) + ' 发动【雁行】，将一张黑色手牌当【杀】使用。', 'log-skill');
        if (ui() && ui().playCardFx) ui().playCardFx(vc, p.side);
        emit();
        await beat(400);
        await resolveSlash(p, enemy, vc, {});
        return true;
      }
    }

    // 满穗 · 淡笑
    if (hasSkill(p, 'danxiao') && !p.flags.danxiaoUsed) {
      const pair = findSameSuitPair(p.hand);
      if (pair) {
        const color = pair[0].color;
        const wantHeal = color === 'red' && p.hp < p.maxHp;
        const wantDamage = color === 'black' && (enemy.hp <= 2 || p.hand.length > handLimit(p));
        if (wantHeal || wantDamage || G.difficulty.id === 'hard') {
          pair.forEach(function (c) {
            removeFromHand(p, c);
            G.discard.push(c);
          });
          p.flags.danxiaoUsed = true;
          p.stats.skillsUsed += 1;
          log(tagSoft(p) + ' 发动【淡笑】，弃置两张' + (color === 'red' ? '红色' : '黑色') + '牌。', 'log-skill');
          emit();
          await beat(360);
          if (color === 'red') await heal(p, 1, '淡笑');
          else await dealDamage(p, enemy, 1, { reason: '淡笑' });
          return true;
        }
      }
    }

    return false;
  }

  function findSameSuitPair(cards) {
    const groups = {};
    cards.forEach(function (c) {
      if (!groups[c.suit]) groups[c.suit] = [];
      groups[c.suit].push(c);
    });
    const keys = Object.keys(groups).filter(function (k) { return groups[k].length >= 2; });
    if (!keys.length) return null;
    // 优先用低价值的牌凑对
    keys.sort(function (a, b) {
      const av = groups[a].slice().sort(function (x, y) { return keepValue(x) - keepValue(y); });
      const bv = groups[b].slice().sort(function (x, y) { return keepValue(x) - keepValue(y); });
      return (keepValue(av[0]) + keepValue(av[1])) - (keepValue(bv[0]) + keepValue(bv[1]));
    });
    return groups[keys[0]].sort(function (a, b) { return keepValue(a) - keepValue(b); }).slice(0, 2);
  }

  function aiCishaBChoice(p, target) {
    if (p.hp <= 2 && p.hp < p.maxHp) return 'heal';
    if (target.hp <= 2) return 'damage';
    if (p.maxHp < 5) return 'maxhp';
    return 'damage';
  }

  function aiCishaCChoice(source, target, currentDamage) {
    const sui = source.marks.sui || 0;
    if (sui <= 0) return false;
    if (target.hp <= currentDamage) return true;
    if (target.hp <= 2 && sui >= 2) return true;
    if (sui >= 3) return true;
    return false;
  }

  function aiGongshengChoice(target, amount) {
    if (target.maxHp <= 1) return false;
    const cfg = aiConfig();
    if (target.hp <= amount) return true;
    if (target.hp < target.maxHp) return true;
    return Math.random() < cfg.smart;
  }

  /* =======================================================
     结束
     ======================================================= */

  function endGame(winnerSide, reason) {
    if (!G || G.over) return;
    G.over = true;
    G.winner = winnerSide;
    G.phase = 'over';
    G.busy = true;
    G.selectedUid = null;
    log(winnerSide === 'player' ? '你活了下来。' : '你没能活过这一局。', 'log-result');
    emit();

    const resolve = G.humanTurnResolve;
    G.humanTurnResolve = null;
    if (resolve) resolve();

    if (ui() && ui().showResult) {
      setTimeout(function () {
        if (!G) return;
        ui().showResult({
          win: winnerSide === 'player',
          reason: reason,
          round: G.round,
          player: G.player,
          ai: G.ai,
          ai2: G.ai2,
          ais: G.ais,
          ai3: G.ai3,
          ai4: G.ai4,
          ai5: G.ai5,
          mode: G.mode,
          difficulty: G.difficulty
        });
      }, G.delayScale < 0.1 ? 120 : 950);
    }
  }
})();
