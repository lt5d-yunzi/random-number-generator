/*!
 * options.js —— 默认设置页
 */
(function () {
    'use strict';

    var el = {
        form: document.getElementById('form'),
        letters: document.getElementById('defaultLetters'),
        lettersRange: document.getElementById('defaultLettersRange'),
        previewLetters: document.getElementById('previewLetters'),
        status: document.getElementById('status'),
        btnReset: document.getElementById('btnReset'),
        pvRange: document.getElementById('pvRange'),
        pvDice: document.getElementById('pvDice'),
        pvResult: document.getElementById('pvResult'),
        btnPreviewRoll: document.getElementById('btnPreviewRoll')
    };

    var timers = [];
    var current = { letters: 6, dice: 10 };

    /* ---------------- 工具 ---------------- */
    function setStatus(msg, isErr) {
        el.status.textContent = msg || '';
        el.status.classList.toggle('err', !!isErr);
        if (msg) {
            clearTimeout(setStatus._t);
            setStatus._t = setTimeout(function () { el.status.textContent = ''; }, 2200);
        }
    }

    function pvClearTimers() {
        timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
        timers = [];
    }

    /* ---------------- 预览 ---------------- */
    function updateLettersHint() {
        var n = RNG.clampLetters(el.letters.value);
        el.previewLetters.textContent = RNG.lettersFor(n).join(' ');
    }

    function renderPreview() {
        pvClearTimers();
        var letters = RNG.lettersFor(current.letters);
        var sides = RNG.normalizeDice(current.dice);
        var numbers = RNG.roll(letters, sides);

        el.pvRange.textContent = RNG.rangeText(letters);
        el.pvDice.textContent = sides + ' 面';
        el.pvResult.innerHTML = letters.map(function (l) {
            return '<div class="pv-slot">' +
                   '<div class="pv-letter">' + l + '</div>' +
                   '<div class="pv-number" data-target="' + numbers[l] + '">' + numbers[l] + '</div>' +
                   '</div>';
        }).join('');

        // 与弹窗一致的数字滚动（无入场动画）
        var nodes = el.pvResult.querySelectorAll('.pv-number');
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

    /* ---------------- 表单 ---------------- */
    function fillForm(s) {
        el.letters.value = s.defaultLetters;
        el.lettersRange.value = s.defaultLetters;
        updateLettersHint();

        var diceRadio = el.form.querySelector('input[name="defaultDice"][value="' + s.defaultDice + '"]');
        if (diceRadio) { diceRadio.checked = true; }

        var themeRadio = el.form.querySelector('input[name="theme"][value="' + s.theme + '"]');
        if (themeRadio) { themeRadio.checked = true; }

        var injRadio = el.form.querySelector('input[name="injectPage"][value="' + (s.injectPage ? '1' : '0') + '"]');
        if (injRadio) { injRadio.checked = true; }

        current.letters = s.defaultLetters;
        current.dice = s.defaultDice;
        renderPreview();
    }

    function readForm() {
        var dice = el.form.querySelector('input[name="defaultDice"]:checked');
        var theme = el.form.querySelector('input[name="theme"]:checked');
        var inj = el.form.querySelector('input[name="injectPage"]:checked');
        return {
            defaultLetters: RNG.clampLetters(el.letters.value),
            defaultDice: RNG.normalizeDice(dice ? dice.value : RNG.DEFAULT_DICE),
            theme: theme ? theme.value : 'dark',
            injectPage: inj ? inj.value === '1' : true
        };
    }

    // 数字框与滑杆互相同步
    el.letters.addEventListener('input', function () {
        el.lettersRange.value = el.letters.value;
        updateLettersHint();
    });
    el.lettersRange.addEventListener('input', function () {
        el.letters.value = el.lettersRange.value;
        updateLettersHint();
    });
    el.letters.addEventListener('blur', function () {
        el.letters.value = RNG.clampLetters(el.letters.value);
        el.lettersRange.value = el.letters.value;
        updateLettersHint();
    });

    el.form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = readForm();
        RNGStore.set(v).then(function () {
            current.letters = v.defaultLetters;
            current.dice = v.defaultDice;
            renderPreview();
            setStatus('已保存');
        });
    });

    el.btnReset.addEventListener('click', function () {
        RNGStore.reset().then(function () {
            return RNGStore.get();
        }).then(function (s) {
            // 清掉弹窗的运行状态，让它下次跟随新的默认值
            return RNGStore.set({ lastLetters: null, lastDice: null, injectPage: true }).then(function () {
                fillForm(s);
                setStatus('已恢复默认');
            });
        });
    });

    el.btnPreviewRoll.addEventListener('click', renderPreview);

    /* ---------------- 启动 ---------------- */
    RNGStore.get().then(fillForm);
})();
