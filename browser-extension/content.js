/*!
 * content.js —— 把随机数生成器注入到任意网页上（右下角悬浮挂件）
 *
 * 要点：
 *   · 用 Shadow DOM 承载，宿主页面的 CSS 影响不到它，它也不污染宿主页面
 *   · 可拖动，位置记在 chrome.storage.local（按设备存，不跨屏同步）
 *   · 可隐藏，隐藏后原位置留一个小圆点可召回
 *   · 由设置项 injectPage 控制是否注入；在扩展弹窗里开关，改完立即生效
 */
(function () {
    'use strict';

    if (typeof RNG === 'undefined') {
        return;   // rng.js 没加载上，直接放弃
    }

    var HOST_ID = 'rng-page-widget-host';
    var DRAG_THRESHOLD = 5;
    var POS_KEY = 'pageWidgetPos';
    var HIDDEN_KEY = 'pageWidgetHidden';

    var host = null;
    var shadow = null;
    var refs = {};
    var state = { letters: [], dice: 10 };
    var timers = [];
    var drag = null;
    var linkEl = null;

    /* ================= 存储（local，按设备） ================= */

    function localGet(key) {
        return new Promise(function (resolve) {
            try {
                chrome.storage.local.get(key, function (o) {
                    resolve(o ? o[key] : undefined);
                });
            } catch (e) {
                resolve(undefined);
            }
        });
    }

    function localSet(key, value) {
        try {
            var o = {};
            o[key] = value;
            chrome.storage.local.set(o);
        } catch (e) {}
    }

    /* ================= 界面 ================= */

    function buildDom() {
        var html =
            '<div class="rng-float" data-rng-float="1">' +
              '<button type="button" class="rng-float-btn" data-act="toggle" title="随机数生成器（按住可拖动）">&#127922;</button>' +
              '<div class="rng-float-panel" data-panel hidden>' +
                '<div class="rng-float-bar">' +
                  '<span class="rng-float-title">随机数生成器</span>' +
                  '<span class="rng-float-tools">' +
                    '<button type="button" class="rng-float-min" data-act="hide" title="隐藏（原位置会留一个小圆点，点它可召回）">&#8211;</button>' +
                    '<button type="button" class="rng-float-close" data-act="toggle" title="关闭">&times;</button>' +
                  '</span>' +
                '</div>' +
                '<div class="rng-body">' +
                  '<div class="rng-meta"><span data-range>U~Z</span><span data-dice>10 面</span></div>' +
                  '<div class="rng-actions">' +
                    '<button type="button" class="rng-btn rng-btn-red" data-act="add">增加数字</button>' +
                    '<button type="button" class="rng-btn rng-btn-red" data-act="remove">减少数字</button>' +
                    '<button type="button" class="rng-btn rng-btn-blue" data-act="dice" data-dice-btn>切换到 6 面骰子</button>' +
                    '<button type="button" class="rng-btn rng-btn-red" data-act="roll">重新随机</button>' +
                  '</div>' +
                  '<div class="rng-result" data-result></div>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="rng-float-recall" data-act="recall" hidden title="显示随机数生成器">&#127922;</button>' +
            '</div>';

        host = document.createElement('div');
        host.id = HOST_ID;
        // 宿主元素本身不要影响页面布局
        host.style.cssText = 'all:initial;position:static;';
        shadow = host.attachShadow({ mode: 'open' });

        linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = chrome.runtime.getURL('content.css');
        shadow.appendChild(linkEl);

        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        shadow.appendChild(wrap.firstChild);

        (document.documentElement || document.body).appendChild(host);

        var box = shadow.querySelector('.rng-float');
        refs = {
            box: box,
            panel: shadow.querySelector('[data-panel]'),
            btn: shadow.querySelector('.rng-float-btn'),
            recall: shadow.querySelector('.rng-float-recall'),
            result: shadow.querySelector('[data-result]'),
            range: shadow.querySelector('[data-range]'),
            diceLabel: shadow.querySelector('[data-dice]'),
            diceBtn: shadow.querySelector('[data-dice-btn]')
        };
        refs.hideBtn = shadow.querySelector('[data-act="hide"]');
    }

    /* ================= 显示逻辑 ================= */

    function clearTimers() {
        timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
        timers = [];
    }

    function syncButtons() {
        var add = shadow.querySelector('[data-act="add"]');
        var rm = shadow.querySelector('[data-act="remove"]');
        if (add) { add.disabled = state.letters.length >= RNG.MAX_LETTERS; }
        if (rm) { rm.disabled = state.letters.length <= RNG.MIN_LETTERS; }
        if (refs.range) { refs.range.textContent = RNG.rangeText(state.letters); }
        if (refs.diceLabel) { refs.diceLabel.textContent = state.dice + ' 面'; }
        if (refs.diceBtn) { refs.diceBtn.textContent = '切换到 ' + RNG.nextDice(state.dice) + ' 面骰子'; }
    }

    function roll() {
        if (!refs.result) { return; }
        clearTimers();

        var sides = state.dice;
        var numbers = RNG.roll(state.letters, sides);

        refs.result.innerHTML = state.letters.map(function (l) {
            return '<div class="rng-slot">' +
                   '<div class="rng-letter">' + l + '</div>' +
                   '<div class="rng-number" data-target="' + numbers[l] + '">' + numbers[l] + '</div>' +
                   '</div>';
        }).join('');

        // 只保留数字滚动，无入场动画（与插件版一致）
        var nodes = refs.result.querySelectorAll('.rng-number');
        Array.prototype.forEach.call(nodes, function (node, i) {
            var tmp = 0;
            var iv = setInterval(function () {
                tmp = (tmp % sides) + 1;
                node.textContent = tmp;
            }, 45);
            timers.push(iv);
            var to = setTimeout(function () {
                clearInterval(iv);
                node.textContent = node.getAttribute('data-target');
            }, i * 110 + 300);
            timers.push(to);
        });
    }

    /* ================= 位置 ================= */

    /**
     * 挂件尺寸
     *
     * 不能只依赖 offsetWidth：Shadow DOM 里的 <link> 是异步加载的，
     * 样式生效前 .rng-float 是普通块级元素，offsetWidth 会是整页宽（比如 1440），
     * 用它去夹取位置会把坐标算到屏幕最左边。超过 200px 一律视为「没量准」，用兜底值。
     */
    function widgetSize() {
        var w = refs.box ? refs.box.offsetWidth : 0;
        var h = refs.box ? refs.box.offsetHeight : 0;
        if (!w || w > 200) { w = 48; }
        if (!h || h > 200) { h = 48; }
        return { w: w, h: h };
    }

    function applyPos(x, y, save) {
        var b = refs.box;
        var sz = widgetSize();
        var w = sz.w;
        var h = sz.h;
        var m = 6;
        var nx = Math.max(m, Math.min(window.innerWidth - w - m, x));
        var ny = Math.max(m, Math.min(window.innerHeight - h - m, y));
        b.style.left = Math.round(nx) + 'px';
        b.style.top = Math.round(ny) + 'px';
        b.style.right = 'auto';
        b.style.bottom = 'auto';
        if (save) { localSet(POS_KEY, { x: Math.round(nx), y: Math.round(ny) }); }
    }

    function currentPos() {
        var r = refs.box.getBoundingClientRect();
        return { x: r.left, y: r.top };
    }

    function placePanel() {
        var p = refs.panel;
        if (!p || p.hasAttribute('hidden')) { return; }
        var r = refs.btn.getBoundingClientRect();
        var pw = p.offsetWidth;
        var ph = p.offsetHeight;
        var m = 8;
        var left = Math.max(m, Math.min(window.innerWidth - pw - m, r.left + r.width / 2 - pw / 2));
        var top = r.top - ph - 10;
        if (top < m) { top = r.bottom + 10; }
        top = Math.max(m, Math.min(window.innerHeight - ph - m, top));
        p.style.left = Math.round(left) + 'px';
        p.style.top = Math.round(top) + 'px';
    }

    /* ================= 开合 / 隐藏 ================= */

    function setOpen(open) {
        if (!refs.panel || refs.box.classList.contains('rng-hidden')) { return; }
        if (open) {
            refs.panel.removeAttribute('hidden');
            refs.box.classList.add('rng-float-open');
            placePanel();
        } else {
            refs.panel.setAttribute('hidden', 'hidden');
            refs.box.classList.remove('rng-float-open');
        }
    }

    function setHidden(hidden, save) {
        if (hidden) { setOpen(false); }
        refs.box.classList.toggle('rng-hidden', hidden);
        if (refs.recall) {
            if (hidden) { refs.recall.removeAttribute('hidden'); }
            else { refs.recall.setAttribute('hidden', 'hidden'); }
        }
        if (!hidden) {
            var p = currentPos();
            applyPos(p.x, p.y, false);
        }
        if (save) { localSet(HIDDEN_KEY, hidden ? 1 : 0); }
    }

    /* ================= 拖动 ================= */

    function onDown(ev) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) { return; }
        var p = currentPos();
        drag = {
            id: ev.pointerId,
            startX: ev.clientX, startY: ev.clientY,
            baseX: p.x, baseY: p.y, moved: false
        };
        refs.box.classList.add('rng-dragging');
        try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
    }

    function onMove(ev) {
        if (!drag || ev.pointerId !== drag.id) { return; }
        var dx = ev.clientX - drag.startX;
        var dy = ev.clientY - drag.startY;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) { return; }
        drag.moved = true;
        applyPos(drag.baseX + dx, drag.baseY + dy, false);
        if (refs.box.classList.contains('rng-float-open')) { placePanel(); }
        ev.preventDefault();
    }

    function onUp(ev) {
        if (!drag || ev.pointerId !== drag.id) { return false; }
        var moved = drag.moved;
        drag = null;
        refs.box.classList.remove('rng-dragging');
        try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) {}
        var p = currentPos();
        applyPos(p.x, p.y, true);
        return moved;
    }

    function bindHandle(handle, onClick) {
        if (!handle) { return; }
        handle.addEventListener('pointerdown', onDown);
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', function (ev) {
            if (onUp(ev)) { return; }   // 拖过就不触发点击
            onClick();
        });
        handle.addEventListener('pointercancel', function (ev) { onUp(ev); });
    }

    function bindAll() {
        bindHandle(refs.btn, function () {
            setOpen(refs.panel.hasAttribute('hidden'));
        });
        bindHandle(refs.recall, function () {
            setHidden(false, true);
        });

        if (refs.hideBtn) {
            refs.hideBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                setHidden(true, true);
            });
        }

        // 面板里除「隐藏」外的按钮
        shadow.addEventListener('click', function (ev) {
            var btn = ev.target.closest ? ev.target.closest('[data-act]') : null;
            if (!btn) { return; }
            // 球和召回点是拖动句柄，交互已经在 pointerup 里处理过了。
            // 拖完浏览器还会补一个 click，这里必须跳过，否则拖动会被当成点击。
            if (btn === refs.btn || btn === refs.recall) { return; }
            var act = btn.getAttribute('data-act');
            if (act === 'add') {
                state.letters = RNG.grow(state.letters);
            } else if (act === 'remove') {
                state.letters = RNG.shrink(state.letters);
            } else if (act === 'dice') {
                state.dice = RNG.nextDice(state.dice);
            } else if (act === 'roll') {
                roll();
                return;
            } else if (act === 'toggle') {
                ev.preventDefault();
                setOpen(refs.panel.hasAttribute('hidden'));
                return;
            } else {
                return;
            }
            ev.preventDefault();
            syncButtons();
            roll();
        });

        // 点面板外收起
        document.addEventListener('click', function (ev) {
            if (!refs.box.classList.contains('rng-float-open')) { return; }
            if (ev.target === host || (ev.composedPath && ev.composedPath().indexOf(host) !== -1)) { return; }
            setOpen(false);
        });

        // Esc 收起
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') { setOpen(false); }
        });

        window.addEventListener('resize', function () {
            var p = currentPos();
            applyPos(p.x, p.y, true);
            if (refs.box.classList.contains('rng-float-open')) { placePanel(); }
        });
    }

    /* ================= 注入 / 移除 ================= */

    function inject(settings) {
        if (host) { return; }

        var n = settings.lastLetters != null ? settings.lastLetters : settings.defaultLetters;
        state.letters = RNG.lettersFor(n);
        state.dice = RNG.normalizeDice(settings.lastDice != null ? settings.lastDice : settings.defaultDice);

        buildDom();
        bindAll();
        syncButtons();
        roll();

        if (settings.theme === 'light') {
            refs.box.classList.add('rng-light');
        }

        // 样式加载完之后再校正一次：加载前量到的尺寸不准，位置可能被夹歪
        if (linkEl) {
            linkEl.addEventListener('load', function () {
                if (!refs.box) { return; }
                var p = currentPos();
                applyPos(p.x, p.y, false);
                if (refs.box.classList.contains('rng-float-open')) { placePanel(); }
            });
        }

        // 恢复位置与隐藏状态
        localGet(POS_KEY).then(function (pos) {
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                applyPos(pos.x, pos.y, false);
            }
        });
        localGet(HIDDEN_KEY).then(function (hidden) {
            if (hidden === 1) { setHidden(true, false); }
        });
    }

    function remove() {
        if (!host) { return; }
        clearTimers();
        try { host.remove(); } catch (e) {}
        host = null;
        shadow = null;
        refs = {};
    }

    /* ================= 启动与设置联动 ================= */

    RNGStore.get().then(function (settings) {
        if (settings.injectPage) {
            inject(settings);
        }

        // 弹窗里改设置后，页面上立即生效
        try {
            chrome.storage.onChanged.addListener(function (changes, area) {
                if (area !== 'sync') { return; }
                RNGStore.get().then(function (s) {
                    if (s.injectPage) {
                        if (!host) {
                            inject(s);
                        } else if (refs.box) {
                            refs.box.classList.toggle('rng-light', s.theme === 'light');
                        }
                    } else {
                        remove();
                    }
                });
            });
        } catch (e) {}
    });
})();
