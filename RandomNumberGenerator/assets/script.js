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

    /* ---------------- 悬浮窗 ---------------- */

    function initFloating() {
        var floats = document.querySelectorAll('.rng-float');
        Array.prototype.forEach.call(floats, function (box) {
            if (box.getAttribute('data-rng-float-ready') === '1') {
                return;
            }
            box.setAttribute('data-rng-float-ready', '1');

            var panel = box.querySelector('[data-rng-float-panel]');
            var toggles = box.querySelectorAll('[data-rng-float-toggle]');
            var btn = box.querySelector('.rng-float-btn');

            function setOpen(open) {
                if (!panel) {
                    return;
                }
                if (open) {
                    panel.removeAttribute('hidden');
                    box.classList.add('rng-float-open');
                } else {
                    panel.setAttribute('hidden', 'hidden');
                    box.classList.remove('rng-float-open');
                }
                Array.prototype.forEach.call(toggles, function (t) {
                    t.setAttribute('aria-expanded', open ? 'true' : 'false');
                });
                if (open && btn) {
                    btn.blur();
                }
            }

            Array.prototype.forEach.call(toggles, function (t) {
                t.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    setOpen(panel.hasAttribute('hidden'));
                });
            });

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
