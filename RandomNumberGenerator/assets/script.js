/*!
 * RandomNumberGenerator —— 随机数生成器前端
 *
 * 实例隔离版：
 *   原先用 addNumber()/removeNumber()/toggleDice()/reroll() 这些全局函数和
 *   写死的 #result、#diceToggle，同一页放两个实例（侧栏一个 + 悬浮窗一个）
 *   就会互相抢元素。现在每个 .rng-container 各自是一个独立实例，
 *   交互统一走 data-rng-action 属性，查询全部限定在自己的 root 里。
 *
 * 自动初始化：脚本带 defer，解析完后扫描页面上所有 .rng-container[data-rng-config]
 * 逐个初始化，所以放在侧栏、页脚、正文任意位置都能正常工作，也不依赖加载顺序。
 */
(function () {
    'use strict';

    var MAX_LETTERS = 26;
    var MIN_LETTERS = 1;

    function RNGInstance(root) {
        this.root = root;

        var cfg = {};
        try {
            cfg = JSON.parse(root.getAttribute('data-rng-config') || '{}') || {};
        } catch (e) {
            cfg = {};
        }

        this.letters = (cfg.letters && cfg.letters.length) ? cfg.letters.slice() : ['U', 'V', 'W', 'X', 'Y', 'Z'];
        this.dice = (parseInt(cfg.dice, 10) === 6) ? 6 : 10;
        this.max = parseInt(cfg.max, 10) || MAX_LETTERS;
        this.min = parseInt(cfg.min, 10) || MIN_LETTERS;

        this.resultEl = root.querySelector('[data-rng-result]');
        this.rangeEl = root.querySelector('[data-rng-range]');
        this.diceLabelEl = root.querySelector('[data-rng-dice-label]');

        this._timers = [];
        this._bindActions();
        this._bindTheme();
        this._syncButtons();
        this.roll();
    }

    /* ---------------- 交互 ---------------- */

    RNGInstance.prototype._bindActions = function () {
        var self = this;
        this.root.addEventListener('click', function (ev) {
            var btn = ev.target.closest ? ev.target.closest('[data-rng-action]') : null;
            if (!btn || !self.root.contains(btn)) {
                return;
            }
            ev.preventDefault();
            var action = btn.getAttribute('data-rng-action');
            if (action === 'add') {
                self.addLetter();
            } else if (action === 'remove') {
                self.removeLetter();
            } else if (action === 'dice') {
                self.toggleDice();
            } else if (action === 'roll') {
                self.roll();
            }
        });
    };

    RNGInstance.prototype._bindTheme = function () {
        var toggle = this.root.querySelector('[data-rng-theme]');
        if (!toggle) {
            return;
        }
        var self = this;
        var saved = null;
        try {
            saved = window.localStorage.getItem('rngTheme');
        } catch (e) {}
        if (saved === 'light') {
            self.root.classList.add('rng-light');
            toggle.checked = true;
        }
        toggle.addEventListener('change', function () {
            self.root.classList.toggle('rng-light');
            try {
                window.localStorage.setItem('rngTheme', self.root.classList.contains('rng-light') ? 'light' : 'dark');
            } catch (e) {}
        });
    };

    /* ---------------- 业务 ---------------- */

    RNGInstance.prototype.addLetter = function () {
        if (this.letters.length >= this.max) {
            return;
        }
        var prev = this.letters[0].charCodeAt(0) - 1;
        if (prev >= 65) {
            this.letters.unshift(String.fromCharCode(prev));
            this.roll();
        }
        this._syncButtons();
    };

    RNGInstance.prototype.removeLetter = function () {
        if (this.letters.length > this.min) {
            this.letters.shift();
            this.roll();
        }
        this._syncButtons();
    };

    RNGInstance.prototype.toggleDice = function () {
        this.dice = this.dice === 10 ? 6 : 10;
        this._syncButtons();
        this.roll();
    };

    RNGInstance.prototype._syncButtons = function () {
        var addBtn = this.root.querySelector('[data-rng-action="add"]');
        var rmBtn = this.root.querySelector('[data-rng-action="remove"]');
        if (addBtn) {
            addBtn.disabled = this.letters.length >= this.max;
        }
        if (rmBtn) {
            rmBtn.disabled = this.letters.length <= this.min;
        }
        if (this.rangeEl) {
            this.rangeEl.textContent = this.letters[0] + '~' + this.letters[this.letters.length - 1];
        }
        if (this.diceLabelEl) {
            // 紧凑版显示当前面数，完整版显示"切换到 X 面骰子"
            if (this.diceLabelEl.classList.contains('rng-btn')) {
                this.diceLabelEl.textContent = '切换到 ' + (this.dice === 10 ? 6 : 10) + ' 面骰子';
            } else {
                this.diceLabelEl.textContent = this.dice + ' 面';
            }
        }
    };

    RNGInstance.prototype._clearTimers = function () {
        for (var i = 0; i < this._timers.length; i++) {
            clearInterval(this._timers[i]);
            clearTimeout(this._timers[i]);
        }
        this._timers = [];
    };

    RNGInstance.prototype.roll = function () {
        var self = this;
        if (!this.resultEl) {
            return;
        }
        this._clearTimers();

        var sides = this.dice;
        var numbers = {};
        this.letters.forEach(function (letter) {
            numbers[letter] = Math.floor(Math.random() * sides) + 1;
        });

        this.resultEl.innerHTML = this.letters.map(function (letter) {
            return '<div class="rng-slot">' +
                   '<div class="rng-letter">' + letter + '</div>' +
                   '<div class="rng-number" data-target="' + numbers[letter] + '">' + numbers[letter] + '</div>' +
                   '</div>';
        }).join('');

        // 只保留数字滚动：所有格子立刻开始滚，然后按顺序定格。
        // （原先还会在定格后加一个 rng-scrolling 的下落+淡入动画，属于入场动画，已去掉）
        var els = this.resultEl.querySelectorAll('.rng-number');
        Array.prototype.forEach.call(els, function (el, index) {
            var temp = 0;
            var iv = setInterval(function () {
                temp = (temp % sides) + 1;
                el.textContent = temp;
            }, 50);
            self._timers.push(iv);

            var to = setTimeout(function () {
                clearInterval(iv);
                el.textContent = el.getAttribute('data-target');
            }, index * 110 + 300);
            self._timers.push(to);
        });
    };

    /* ---------------- 初始化 ---------------- */

    function initAll() {
        var roots = document.querySelectorAll('.rng-container[data-rng-config]');
        Array.prototype.forEach.call(roots, function (root) {
            if (root.getAttribute('data-rng-ready') === '1') {
                return; // 已初始化，避免重复绑定
            }
            root.setAttribute('data-rng-ready', '1');
            try {
                new RNGInstance(root);
            } catch (e) {
                // 单个实例失败不影响其它实例
                if (window.console && console.error) {
                    console.error('RandomNumberGenerator: 实例初始化失败', e);
                }
            }
        });
    }

    /* ---------------- 悬浮窗：拖动 + 隐藏/召回 + 面板定位 ---------------- */

    var POS_KEY = 'rngFloatPos';
    var HIDDEN_KEY = 'rngFloatHidden';
    var DRAG_THRESHOLD = 5;   // 移动不超过这个距离算「点击」，不算拖动

    function lsGet(key) {
        try {
            var raw = window.localStorage.getItem(key);
            return raw === null ? null : JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function lsSet(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
    }

    function clampNum(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function initFloating() {
        var boxes = document.querySelectorAll('.rng-float[data-rng-float]');
        Array.prototype.forEach.call(boxes, function (box, index) {
            if (box.getAttribute('data-rng-float-ready') === '1') {
                return;
            }
            box.setAttribute('data-rng-float-ready', '1');

            var panel = box.querySelector('[data-rng-float-panel]');
            var hideBtn = box.querySelector('[data-rng-float-hide]');
            var recall = box.querySelector('[data-rng-float-recall]');
            var btn = box.querySelector('.rng-float-btn');
            var allToggles = box.querySelectorAll('[data-rng-float-toggle]');

            // 同一页可能有多个悬浮件，位置与隐藏状态按序号分开存
            var keyPos = POS_KEY + (index ? '-' + index : '');
            var keyHidden = HIDDEN_KEY + (index ? '-' + index : '');

            /* ---------- 位置 ---------- */

            function size() {
                return {
                    w: box.offsetWidth || 48,
                    h: box.offsetHeight || 48
                };
            }

            /** 把悬浮件放到 (x,y)，自动夹在视口内；save=true 时记住 */
            function applyPos(x, y, save) {
                var s = size();
                var m = 6;
                var nx = clampNum(x, m, Math.max(m, window.innerWidth - s.w - m));
                var ny = clampNum(y, m, Math.max(m, window.innerHeight - s.h - m));
                box.style.left = Math.round(nx) + 'px';
                box.style.top = Math.round(ny) + 'px';
                box.style.right = 'auto';
                box.style.bottom = 'auto';
                if (save) {
                    lsSet(keyPos, { x: Math.round(nx), y: Math.round(ny) });
                }
                return { x: nx, y: ny };
            }

            function currentPos() {
                var r = box.getBoundingClientRect();
                return { x: r.left, y: r.top };
            }

            // 恢复上次位置
            var saved = lsGet(keyPos);
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                applyPos(saved.x, saved.y, false);
            }

            /* ---------- 面板开合与定位 ---------- */

            /** 面板贴着球，并自动避开视口边缘 */
            function placePanel() {
                if (!panel || !btn || panel.hasAttribute('hidden')) {
                    return;
                }
                var r = btn.getBoundingClientRect();
                var pw = panel.offsetWidth;
                var ph = panel.offsetHeight;
                var m = 8;

                var left = r.left + r.width / 2 - pw / 2;
                left = clampNum(left, m, Math.max(m, window.innerWidth - pw - m));

                var top = r.top - ph - 10;                      // 优先放上方
                if (top < m) {
                    top = r.bottom + 10;                        // 上方放不下就放下面
                }
                top = clampNum(top, m, Math.max(m, window.innerHeight - ph - m));

                panel.style.left = Math.round(left) + 'px';
                panel.style.top = Math.round(top) + 'px';
            }

            function setOpen(open) {
                if (!panel || box.classList.contains('rng-hidden')) {
                    return;
                }
                if (open) {
                    panel.removeAttribute('hidden');
                    box.classList.add('rng-float-open');
                    placePanel();
                } else {
                    panel.setAttribute('hidden', 'hidden');
                    box.classList.remove('rng-float-open');
                }
                Array.prototype.forEach.call(allToggles, function (t) {
                    t.setAttribute('aria-expanded', open ? 'true' : 'false');
                });
            }

            /* ---------- 隐藏 / 召回 ---------- */

            function setHidden(hidden, save) {
                if (hidden) {
                    setOpen(false);
                }
                box.classList.toggle('rng-hidden', hidden);
                if (recall) {
                    if (hidden) {
                        recall.removeAttribute('hidden');
                    } else {
                        recall.setAttribute('hidden', 'hidden');
                    }
                }
                if (!hidden) {
                    // 召回后重新夹一次，避免视口变小后跑到屏幕外
                    var p = currentPos();
                    applyPos(p.x, p.y, false);
                }
                if (save) {
                    lsSet(keyHidden, hidden ? 1 : 0);
                }
            }

            if (lsGet(keyHidden) === 1) {
                setHidden(true, false);
            }

            /* ---------- 拖动（Pointer Events，鼠标/触摸统一）---------- */

            var drag = null;

            function onDown(ev) {
                if (ev.pointerType === 'mouse' && ev.button !== 0) {
                    return;
                }
                var p = currentPos();
                drag = {
                    id: ev.pointerId,
                    startX: ev.clientX,
                    startY: ev.clientY,
                    baseX: p.x,
                    baseY: p.y,
                    moved: false
                };
                box.classList.add('rng-dragging');
                try {
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                } catch (e) {}
            }

            function onMove(ev) {
                if (!drag || ev.pointerId !== drag.id) {
                    return;
                }
                var dx = ev.clientX - drag.startX;
                var dy = ev.clientY - drag.startY;
                if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) {
                    return;
                }
                drag.moved = true;
                applyPos(drag.baseX + dx, drag.baseY + dy, false);
                if (box.classList.contains('rng-float-open')) {
                    placePanel();
                }
                ev.preventDefault();
            }

            /** 返回本次是否真的拖动过 */
            function onUp(ev) {
                if (!drag || ev.pointerId !== drag.id) {
                    return false;
                }
                var moved = drag.moved;
                drag = null;
                box.classList.remove('rng-dragging');
                try {
                    ev.currentTarget.releasePointerCapture(ev.pointerId);
                } catch (e) {}
                var p = currentPos();
                applyPos(p.x, p.y, true);            // 夹回视口并记住
                return moved;
            }

            // 球和召回点都是拖动句柄；没拖动时算点击
            [btn, recall].forEach(function (handle) {
                if (!handle) {
                    return;
                }
                handle.addEventListener('pointerdown', onDown);
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', function (ev) {
                    var moved = onUp(ev);
                    if (moved) {
                        return;                       // 拖过就不触发开合
                    }
                    if (handle === recall) {
                        setHidden(false, true);       // 点召回点 → 显示
                    } else {
                        setOpen(panel.hasAttribute('hidden'));
                    }
                });
                handle.addEventListener('pointercancel', function (ev) {
                    onUp(ev);
                });
            });

            // 面板里的关闭按钮（非拖动句柄）走普通 click
            Array.prototype.forEach.call(allToggles, function (t) {
                if (t === btn || t === recall) {
                    return;
                }
                t.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setOpen(panel.hasAttribute('hidden'));
                });
            });

            // 隐藏按钮
            if (hideBtn) {
                hideBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setHidden(true, true);
                });
            }

            /* ---------- 其它 ---------- */

            // 点面板外部收起
            document.addEventListener('click', function (ev) {
                if (!box.classList.contains('rng-float-open')) {
                    return;
                }
                if (!box.contains(ev.target)) {
                    setOpen(false);
                }
            });

            // Esc 收起
            document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && box.classList.contains('rng-float-open')) {
                    setOpen(false);
                }
            });

            // 视口变化后把位置与面板夹回可视区
            window.addEventListener('resize', function () {
                var p = currentPos();
                applyPos(p.x, p.y, true);
                if (box.classList.contains('rng-float-open')) {
                    placePanel();
                }
            });
        });
    }

    function boot() {
        initAll();
        initFloating();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.RandomNumberGenerator = {
        init: boot,
        instances: function () {
            return document.querySelectorAll('.rng-container[data-rng-ready="1"]').length;
        }
    };
})();
