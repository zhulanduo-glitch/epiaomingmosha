/* =========================================================
   明末杀 · 入口
   ========================================================= */
(function () {
  'use strict';

  const MMS = window.MMS;
  const $ = function (sel) { return document.querySelector(sel); };

  let lastMatch = null;

  function boot() {
    if (!MMS || !MMS.UI || !MMS.Engine) {
      document.body.innerHTML = '<div class="noscript">脚本加载失败，请确认 js 文件夹完整。</div>';
      return;
    }

    MMS.UI.init();
    bindTitle();
    bindSelect();
    bindBattle();
    bindGlobal();

    const params = new URLSearchParams(window.location.search);
    if (params.get('fast') === '1') {
      window.MMS_FAST = true;
    }

    MMS.App = {
      startMatch: startMatch,
      toSelect: toSelect,
      toTitle: toTitle,
      handleResult: handleResult
    };
  }

  function bindGlobal() {
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        const modal = document.querySelector('#modal-root .modal-layer');
        if (modal) return;
        if (MMS.UI.getState && MMS.UI.getState()) {
          // 对局中按 Esc 只清除选牌，不退出牌局
          MMS.Engine.clearSelection();
        }
      }
    });
  }

  function bindTitle() {
    const enter = $('#btn-enter');
    if (enter) enter.addEventListener('click', function () {
      toSelect();
    });
    const rules = $('#btn-rules-title');
    if (rules) rules.addEventListener('click', function () { MMS.UI.openRules(); });
    const rulesNav = $('#btn-rules-title-nav');
    if (rulesNav) rulesNav.addEventListener('click', function () { MMS.UI.openRules(); });
    const historyBtn = $('#btn-history');
    if (historyBtn) historyBtn.addEventListener('click', function () { MMS.UI.openHistory(); });
    const changelog = $('#btn-changelog');
    if (changelog) changelog.addEventListener('click', function () { MMS.UI.openChangelog(); });
    const cheats = $('#btn-cheats');
    if (cheats) cheats.addEventListener('click', function () { MMS.UI.openCheatPanel(); });
    const bgmTitle = $('#btn-bgm-title');
    if (bgmTitle) bgmTitle.addEventListener('click', function () { MMS.UI.openAudioSettings(); });
    const achievements = $('#btn-achievements');
    if (achievements) achievements.addEventListener('click', function (ev) {
      ev.stopPropagation();
      MMS.UI.openAchievements();
    });
    const achBar = $('#title-achievements');
    if (achBar) achBar.addEventListener('click', function () { MMS.UI.openAchievements(); });
  }

  function bindSelect() {
    const back = $('#btn-back-title');
    if (back) back.addEventListener('click', toTitle);

    const rules = $('#btn-rules-select');
    if (rules) rules.addEventListener('click', function () { MMS.UI.openRules(); });

    const roster = $('#roster');
    if (roster) {
      let hoverCard = null;
      roster.addEventListener('pointerover', function (ev) {
        const card = ev.target.closest('[data-general]');
        if (!card || card === hoverCard) return;
        hoverCard = card;
        MMS.UI.Sound.play('hover');
      });
      roster.addEventListener('pointerout', function (ev) {
        const card = ev.target.closest('[data-general]');
        if (card && !card.contains(ev.relatedTarget)) hoverCard = null;
      });
      roster.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-general]');
        if (!btn) return;
        MMS.UI.setSelectedGeneral(btn.getAttribute('data-general'));
      });
    }

    const diff = $('#difficulty');
    if (diff) diff.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-difficulty]');
      if (!btn) return;
      MMS.UI.setDifficulty(btn.getAttribute('data-difficulty'));
    });

    const mode = $('#match-mode');
    if (mode) mode.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-mode]');
      if (!btn) return;
      MMS.UI.setMode(btn.getAttribute('data-mode'));
    });

    const opponents = $('#btn-opponents');
    if (opponents) opponents.addEventListener('click', function () {
      MMS.UI.openOpponentPicker();
    });

    const start = $('#btn-start');
    if (start) start.addEventListener('click', function () {
      const id = MMS.UI.getSelectedGeneralId();
      const difficulty = MMS.UI.getDifficulty();
      const mode = MMS.UI.getMode();
      start.disabled = true;
      const original = start.innerHTML;
      start.innerHTML = '<span>入局中…</span><small>SHUFFLING THE DECK</small>';
      setTimeout(function () {
        start.disabled = false;
        start.innerHTML = original;
        startMatch({
          playerGeneralId: id,
          difficulty: difficulty,
          mode: mode,
          aiGeneralIds: MMS.UI.getOpponentIds()
        });
      }, 180);
    });
  }

  function bindBattle() {
    const rules = $('#btn-rules-battle');
    if (rules) rules.addEventListener('click', function () {
      const s = MMS.Engine.getState();
      if (s && !s.over && (s.turn === 'ai' || s.busy)) {
        MMS.UI.toast('等对手这一手落定，再看兵法。', 'is-danger');
        return;
      }
      MMS.UI.openRules();
    });

    const sound = $('#btn-sound');
    if (sound) sound.addEventListener('click', function () { MMS.UI.toggleSound(); });
    const volume = $('#btn-volume');
    if (volume) volume.addEventListener('click', function () { MMS.UI.openVolumeSettings(); });
    const bgm = $('#btn-bgm');
    if (bgm) bgm.addEventListener('click', function () { MMS.UI.openAudioSettings(); });

    const surrender = $('#btn-surrender');
    if (surrender) surrender.addEventListener('click', function () {
      const s = MMS.Engine.getState();
      if (!s || s.over) return;
      if (s.turn !== 'player' || s.busy) {
        MMS.UI.toast('只能在自己的出牌阶段认输。', 'is-danger');
        return;
      }
      MMS.UI.choose({
        kicker: '收手',
        title: '要放下牌认输吗？',
        sub: '这一局会立刻结束，胜负已定。',
        options: [
          { value: 'yes', label: '认输', desc: '把命交给这局牌。' },
          { value: 'no', label: '继续', desc: '还没到认输的时候。' }
        ],
        cancelable: true
      }).then(function (value) {
        if (value === 'yes') MMS.Engine.surrender();
      });
    });

    const logBtn = $('#btn-log-mobile');
    const logPanel = $('#log-panel');
    const logClose = $('#btn-log-close');
    function toggleLog(open) {
      if (!logPanel) return;
      if (open == null) logPanel.classList.toggle('is-open');
      else logPanel.classList.toggle('is-open', open);
    }
    if (logBtn) logBtn.addEventListener('click', function () { toggleLog(); });
    if (logClose) logClose.addEventListener('click', function () { toggleLog(false); });

    const hand = $('#player-hand');
    if (hand) hand.addEventListener('click', function (ev) {
      const card = ev.target.closest('.card[data-uid]');
      if (!card) return;
      const s = MMS.Engine.getState();
      if (!s || s.over) return;
      MMS.Engine.selectCard(card.getAttribute('data-uid'));
    });

    const useBtn = $('#btn-use-card');
    if (useBtn) useBtn.addEventListener('click', function () {
      const s = MMS.Engine.getState();
      if (!s || !s.selectedUid) return;
      MMS.Engine.humanUseCard(s.selectedUid);
    });

    const cancelBtn = $('#btn-cancel-card');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { MMS.Engine.clearSelection(); });

    const endBtn = $('#btn-end-turn');
    if (endBtn) endBtn.addEventListener('click', function () { MMS.Engine.humanEndTurn(); });

    const battleScreen = $('#screen-battle');
    if (battleScreen) battleScreen.addEventListener('click', function (ev) {
      const chip = ev.target.closest('.skill-chip[data-skill]');
      if (!chip) return;
      MMS.UI.openSkillModal(chip.getAttribute('data-side'), chip.getAttribute('data-skill'));
    });
  }

  function toSelect() {
    MMS.UI.closeModal();
    MMS.UI.Sound.stopAmbient();
    MMS.UI.showScreen('select');
  }

  function toTitle() {
    MMS.UI.closeModal();
    MMS.UI.Sound.stopAmbient();
    MMS.UI.showScreen('title');
  }

  function startMatch(opts) {
    try {
      MMS.UI.closeModal();
      MMS.UI.showScreen('battle');
      MMS.UI.setIntent('');
      MMS.UI.clearJudge();
      const logPanel = $('#log-panel');
      if (logPanel) logPanel.classList.remove('is-open');

      const params = new URLSearchParams(window.location.search);
      const chosenOpponents = Array.isArray(opts.aiGeneralIds) ? opts.aiGeneralIds.slice() : null;
      const g = MMS.Engine.startGame({
        playerGeneralId: opts.playerGeneralId || MMS.UI.getSelectedGeneralId(),
        aiGeneralId: opts.aiGeneralId || null,
        aiGeneralIds: chosenOpponents,
        mode: opts.mode || MMS.UI.getMode(),
        difficulty: opts.difficulty || MMS.UI.getDifficulty(),
        delayScale: params.get('fast') === '1' ? 0.03 : 1
      });
      MMS.UI.setBattleState(g);
      MMS.UI.Sound.startAmbient();
      lastMatch = {
        playerGeneralId: g.player.general.id,
        mode: g.mode,
        difficulty: g.difficulty.id,
        aiGeneralIds: chosenOpponents || []
      };
    } catch (err) {
      console.error(err);
      MMS.UI.toast('开局失败，请刷新页面重试。', 'is-danger');
    }
  }

  function handleResult(action, data) {
    if (action === 'rematch') {
      if (!lastMatch) {
        toSelect();
        return;
      }
      startMatch(lastMatch);
      return;
    }
    if (action === 'reselect') {
      if (lastMatch) MMS.UI.setSelectedGeneral(lastMatch.playerGeneralId);
      toSelect();
      return;
    }
    toTitle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
