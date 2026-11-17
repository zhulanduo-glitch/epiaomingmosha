/* 本地战绩记录：查询、筛选、删除。数据只保存在当前浏览器。 */
(function () {
  const UI = MMS.UI;
  const KEY = 'mms-match-history';
  const MAX = 100;
  let activeFilter = 'all';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function loadHistory() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (e) {}
  }

  function dateText(ts) {
    const d = new Date(ts || Date.now());
    if (isNaN(d.getTime())) return '';
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function opponentsOf(data) {
    let list = [];
    if (Array.isArray(data.ais)) list = data.ais.filter(Boolean);
    if (!list.length && data.ai) list = [data.ai];
    return list.map(function (p) {
      return { id: p.general ? p.general.id : '', name: p.general ? p.general.name : '对手' };
    });
  }

  UI.recordHistory = function (data) {
    if (!data || !data.player || !data.player.general) return;
    const p = data.player;
    const st = p.stats || {};
    const record = {
      id: 'h' + Date.now() + '-' + Math.floor(Math.random() * 9999),
      time: Date.now(),
      win: !!data.win,
      mode: data.mode || '1v1',
      difficulty: data.difficulty && data.difficulty.name ? data.difficulty.name : '',
      round: data.round || 0,
      reason: data.reason || '',
      player: {
        id: p.general.id,
        name: p.general.name,
        subtitle: p.general.subtitle || ''
      },
      opponents: opponentsOf(data),
      stats: {
        damage: st.damageDealt || 0,
        skills: st.skillsUsed || 0,
        heals: st.heals || 0,
        cards: st.cardsPlayed || 0,
        hp: p.hp,
        maxHp: p.maxHp
      }
    };
    const list = loadHistory();
    list.unshift(record);
    saveHistory(list);
  };

  function filtered(list) {
    if (activeFilter === 'win') return list.filter(function (r) { return r.win; });
    if (activeFilter === 'lose') return list.filter(function (r) { return !r.win; });
    return list;
  }

  function rowHTML(record) {
    const names = (record.opponents || []).map(function (o) { return o.name; }).join('、') || '对手';
    const stats = record.stats || {};
    return '<div class="history-row" data-history-row="' + esc(record.id) + '">' +
      '<span class="history-result ' + (record.win ? 'is-win' : 'is-lose') + '">' + (record.win ? '胜' : '负') + '</span>' +
      '<div class="history-body">' +
        '<b>' + esc(record.player ? record.player.name : '未知武将') + ' <em>VS</em> ' + esc(names) + '</b>' +
        '<small>' + esc(dateText(record.time)) + ' · ' + esc(record.mode) + (record.difficulty ? ' · ' + esc(record.difficulty) : '') + ' · ' + (record.round || 0) + ' 回合</small>' +
        '<small>伤害 ' + (stats.damage || 0) + ' · 技能 ' + (stats.skills || 0) + ' · 回复 ' + (stats.heals || 0) + ' · 出牌 ' + (stats.cards || 0) + '</small>' +
      '</div>' +
      '<button class="history-delete" type="button" data-history-delete="' + esc(record.id) + '">删除</button>' +
    '</div>';
  }

  UI.openHistory = function () {
    const layer = UI.openCustomModal({
      modalClass: 'history-modal',
      kicker: '本地记录 · 最多保留 100 局',
      title: '历史战绩',
      sub: '查询每一局的胜负、武将、模式、难度与关键数据。记录只保存在当前浏览器。',
      body:
        '<div class="history-summary" id="history-summary"></div>' +
        '<div class="history-toolbar">' +
          '<div class="history-filters">' +
            '<button type="button" data-history-filter="all" class="is-active">全部</button>' +
            '<button type="button" data-history-filter="win">胜利</button>' +
            '<button type="button" data-history-filter="lose">失败</button>' +
          '</div>' +
          '<button type="button" class="history-clear" data-history-clear>清空全部</button>' +
        '</div>' +
        '<div class="history-list" id="history-list"></div>',
      actions: UI.modalButton('关闭', '__close__', 'btn-primary'),
      closeable: true,
      cancel: function () { UI.closeModal(); }
    });
    if (!layer) return;

    const summary = layer.querySelector('#history-summary');
    const listEl = layer.querySelector('#history-list');
    const clearBtn = layer.querySelector('[data-history-clear]');
    let clearArmed = false;
    let clearTimer = null;

    function render() {
      const all = loadHistory();
      const wins = all.filter(function (r) { return r.win; }).length;
      const rate = all.length ? Math.round(wins / all.length * 100) : 0;
      if (summary) {
        summary.innerHTML =
          '<div><b>' + all.length + '</b><span>总对局</span></div>' +
          '<div><b>' + wins + '</b><span>胜场</span></div>' +
          '<div><b>' + rate + '%</b><span>胜率</span></div>';
      }
      const list = filtered(all);
      if (listEl) {
        listEl.innerHTML = list.length
          ? list.map(rowHTML).join('')
          : '<div class="history-empty">' + (all.length ? '当前筛选下没有记录。' : '还没有历史战绩。完成一局后会记录在这里。') + '</div>';
      }
      layer.querySelectorAll('[data-history-filter]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-history-filter') === activeFilter);
      });
    }

    layer.addEventListener('click', function (ev) {
      const filter = ev.target.closest('[data-history-filter]');
      if (filter) {
        activeFilter = filter.getAttribute('data-history-filter') || 'all';
        render();
        return;
      }
      const del = ev.target.closest('[data-history-delete]');
      if (del) {
        const id = del.getAttribute('data-history-delete');
        const list = loadHistory().filter(function (r) { return r.id !== id; });
        saveHistory(list);
        UI.toast('战绩已删除。', 'is-success');
        render();
        return;
      }
      if (ev.target.closest('[data-history-clear]')) {
        if (!clearArmed) {
          clearArmed = true;
          if (clearBtn) clearBtn.textContent = '再点一次确认清空';
          clearTimer = setTimeout(function () {
            clearArmed = false;
            if (clearBtn) clearBtn.textContent = '清空全部';
          }, 2600);
          return;
        }
        clearTimeout(clearTimer);
        saveHistory([]);
        clearArmed = false;
        if (clearBtn) clearBtn.textContent = '清空全部';
        UI.toast('历史战绩已清空。', 'is-success');
        render();
        return;
      }
      if (ev.target.closest('[data-modal-value="__close__"]')) UI.closeModal();
    });
    render();
  };
})();
