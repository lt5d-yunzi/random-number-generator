/*!
 * popup.js —— 扩展弹窗的界面逻辑
 *
 * 纯计算都在 rng.js 里，这里只负责：读设置 → 渲染 → 处理点击 → 存状态。
 * 存储用 chrome.storage.sync（跨设备同步）；在没有 chrome API 的环境
 * （例如直接用浏览器打开 popup.html 预览）自动退回 localStorage。
 */
(function () {
    'use strict';

    /* ---------------- 存储 ---------------- */
    // 具体实现见 storage.js（chrome.storage.sync，无 chrome API 时退回 localStorage）
    function loadSettings() {
        return RNGStore.get();
    }

    function saveSettings(patch) {
        return RNGStore.set(patch);
    }

    /* ---------------- 状态 ---------------- */
    var settings = null;
    var state = { letters: [], dice: RNG.DEFAULT_DICE };
    var timers = [];

    /* ---------------- DOM ---------------- */
    var el = {
        rng: document.getElementById('rng'),
        result: document.getElementById('result'),
        metaRange: document.getElementById('metaRange'),
        metaDice: document.getElementById('metaDice'),
        btnDice: document.getElementById('btnDice'),
        themeToggle: document.getElementById('themeToggle'),
        btnOptions: document.getElementById('btnOptions'),
        injectToggle: document.getElementById('injectToggle')
    };

    /* ---------------- 渲染 ---------------- */
    function clearTimers() {
        timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
        timers = [];
    }

    function render() {
        clearTimers();

        var letters = state.letters;
        var sides = state.dice;
        var numbers = RNG.roll(letters, sides);

        el.metaRange.textContent = RNG.rangeText(letters);
        el.metaDice.textContent = sides + ' 面';
        el.btnDice.textContent = '切换到 ' + RNG.nextDice(sides) + ' 面骰子';

        var addBtn = el.rng.querySelector('[data-action="add"]');
        var rmBtn = el.rng.querySelector('[data-action="remove"]');
        if (addBtn) { addBtn.disabled = letters.length >= RNG.MAX_LETTERS; }
        if (rmBtn) { rmBtn.disabled = letters.length <= RNG.MIN_LETTERS; }

        el.result.innerHTML = letters.map(function (l) {
            return '<div class="rng-slot">' +
                   '<div class="rng-letter">' + l + '</div>' +
                   '<div class="rng-number" data-target="' + numbers[l] + '">' + numbers[l] + '</div>' +
                   '</div>';
        }).join('');

        // 只保留数字滚动：所有格子立刻开始滚，然后按顺序定格。
        // （原先定格后还会加一个 rng-scrolling 的下落+淡入动画，属于入场动画，已去掉）
        var nodes = el.result.querySelectorAll('.rng-number');
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

    function applyTheme() {
        var light = settings.theme === 'light';
        el.rng.classList.toggle('rng-light', light);
        el.themeToggle.checked = light;
        document.documentElement.classList.toggle('rng-auto-light', light);
    }

    /* ---------------- 交互 ---------------- */
    el.rng.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-action]');
        if (!btn || btn.disabled) {
            return;
        }
        var action = btn.getAttribute('data-action');

        if (action === 'add') {
            state.letters = RNG.grow(state.letters);
        } else if (action === 'remove') {
            state.letters = RNG.shrink(state.letters);
        } else if (action === 'dice') {
            state.dice = RNG.nextDice(state.dice);
        }
        // 'roll' 不改状态，直接重渲染即可

        saveSettings({ lastLetters: state.letters.length, lastDice: state.dice });
        render();
    });

    el.themeToggle.addEventListener('change', function () {
        settings.theme = el.themeToggle.checked ? 'light' : 'dark';
        applyTheme();
        saveSettings({ theme: settings.theme });
    });

    el.injectToggle.addEventListener('change', function () {
        RNGStore.setInject(el.injectToggle.checked);
    });

    el.btnOptions.addEventListener('click', function () {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open('options.html', '_blank');
        }
    });

    /* ---------------- 启动 ---------------- */
    loadSettings().then(function (s) {
        settings = s;

        var n = s.lastLetters != null ? s.lastLetters : s.defaultLetters;
        var d = s.lastDice != null ? s.lastDice : s.defaultDice;

        state.letters = RNG.lettersFor(n);
        state.dice = RNG.normalizeDice(d);

        applyTheme();
        render();
        el.injectToggle.checked = !!s.injectPage;

        // 首次使用：把默认值写入存储，之后选项页改动能生效
        if (s.lastLetters == null) {
            saveSettings({ lastLetters: state.letters.length, lastDice: state.dice });
        }
    });
})();
