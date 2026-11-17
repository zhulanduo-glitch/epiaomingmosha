/* 牢方 · 猎奇：观看牌堆顶8张并调整顺序，然后依次使用前X张。 */
(function () {
  const UI = MMS.UI;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  UI.lieqiOrder = function (config) {
    config = config || {};
    return new Promise(function (resolve) {
      let order = (config.cards || []).slice();
      const x = Math.min(order.length, Math.max(0, config.x | 0));
      let done = false;
      const layer = UI.openCustomModal({
        modalClass: 'lieqi-modal',
        kicker: '猎奇 · 牌堆顶' + order.length + '张',
        title: '调整顺序，然后使用前 ' + x + ' 张',
        sub: '用上移/下移调整牌堆顶顺序。确认后会从第一张开始依次使用；未能使用的牌留在牌堆顶。',
        body: '<div class="lieqi-hint">本次可使用 <b>' + x + '</b> 张 · 体力 + 手牌数</div><div class="lieqi-list" id="lieqi-list"></div>',
        actions: '<button class="btn btn-primary" type="button" data-lieqi-confirm>开始使用前 ' + x + ' 张</button><button class="btn btn-ghost" type="button" data-lieqi-cancel>取消</button>',
        closeable: true,
        cancel: function () { finish(null); }
      });
      if (!layer) { resolve(null); return; }
      const list = layer.querySelector('#lieqi-list');

      function render() {
        if (!list) return;
        list.innerHTML = order.map(function (c, i) {
          const red = c.suit === 'heart' || c.suit === 'diamond';
          return '<div class="lieqi-row' + (i < x ? ' is-use' : '') + '" data-lieqi-row="' + i + '">' +
            '<span class="lieqi-index">' + (i + 1) + '</span>' +
            '<div class="lieqi-card ' + (red ? 'is-red' : 'is-black') + '">' +
              '<b>' + esc(c.suitName || '') + esc(c.rankLabel || '') + '【' + esc(c.name) + '】</b>' +
              '<small>' + esc(c.desc || c.typeLabel || '') + '</small>' +
            '</div>' +
            '<div class="lieqi-move">' +
              '<button type="button" data-lieqi-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button type="button" data-lieqi-down="' + i + '"' + (i === order.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      function finish(value) {
        if (done) return;
        done = true;
        UI.closeModal();
        resolve(value);
      }

      layer.addEventListener('click', function (ev) {
        const up = ev.target.closest('[data-lieqi-up]');
        if (up) {
          const i = Number(up.getAttribute('data-lieqi-up'));
          if (i > 0) {
            const tmp = order[i - 1];
            order[i - 1] = order[i];
            order[i] = tmp;
            render();
          }
          return;
        }
        const down = ev.target.closest('[data-lieqi-down]');
        if (down) {
          const i = Number(down.getAttribute('data-lieqi-down'));
          if (i < order.length - 1) {
            const tmp = order[i + 1];
            order[i + 1] = order[i];
            order[i] = tmp;
            render();
          }
          return;
        }
        if (ev.target.closest('[data-lieqi-confirm]')) {
          finish(order.map(function (c) { return c.uid; }));
          return;
        }
        if (ev.target.closest('[data-lieqi-cancel]')) finish(null);
      });
      render();
    });
  };
})();
