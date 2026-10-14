/*!
 * rng.js —— 随机数生成器的纯逻辑（不碰 DOM，方便单独跑测试）
 *
 * 规则与 Typecho 插件版一致：
 *   · 字母从 Z 往前取 N 个，所以 6 个是 U V W X Y Z，8 个是 S T U V W X Y Z
 *   · 每个字母配一个 1 ~ 面数 的随机数
 *   · 面数支持 10 和 6
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;          // Node（跑测试）
    } else {
        root.RNG = api;                // 浏览器
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MIN_LETTERS = 1;
    var MAX_LETTERS = 26;
    var DEFAULT_LETTERS = 6;
    var DEFAULT_DICE = 10;
    var ALLOWED_DICE = [10, 6];

    function clampLetters(n) {
        n = parseInt(n, 10);
        if (isNaN(n)) {
            n = DEFAULT_LETTERS;
        }
        return Math.max(MIN_LETTERS, Math.min(MAX_LETTERS, n));
    }

    function normalizeDice(d) {
        d = parseInt(d, 10);
        return ALLOWED_DICE.indexOf(d) === -1 ? DEFAULT_DICE : d;
    }

    /** 取字母表最后 n 个字母：n=6 → ['U','V','W','X','Y','Z'] */
    function lettersFor(n) {
        n = clampLetters(n);
        var out = [];
        var start = 90 - n + 1;        // 90 === 'Z'
        for (var i = 0; i < n; i++) {
            out.push(String.fromCharCode(start + i));
        }
        return out;
    }

    /** 字母范围文本：['U'...'Z'] → 'U~Z' */
    function rangeText(letters) {
        if (!letters || !letters.length) {
            return '';
        }
        return letters[0] + '~' + letters[letters.length - 1];
    }

    /** 给每个字母掷一个 1~sides 的数 */
    function roll(letters, sides) {
        sides = normalizeDice(sides);
        var out = {};
        for (var i = 0; i < letters.length; i++) {
            out[letters[i]] = Math.floor(Math.random() * sides) + 1;
        }
        return out;
    }

    /** 往字母表前面扩一个：['U'..'Z'] → ['T'..'Z']；已经到 A 则不变 */
    function grow(letters) {
        if (letters.length >= MAX_LETTERS) {
            return letters.slice();
        }
        var prev = letters[0].charCodeAt(0) - 1;
        if (prev < 65) {
            return letters.slice();
        }
        return [String.fromCharCode(prev)].concat(letters);
    }

    /** 去掉最前面一个；到下限则不变 */
    function shrink(letters) {
        if (letters.length <= MIN_LETTERS) {
            return letters.slice();
        }
        return letters.slice(1);
    }

    function nextDice(sides) {
        return normalizeDice(sides) === 10 ? 6 : 10;
    }

    return {
        MIN_LETTERS: MIN_LETTERS,
        MAX_LETTERS: MAX_LETTERS,
        DEFAULT_LETTERS: DEFAULT_LETTERS,
        DEFAULT_DICE: DEFAULT_DICE,
        ALLOWED_DICE: ALLOWED_DICE,
        clampLetters: clampLetters,
        normalizeDice: normalizeDice,
        lettersFor: lettersFor,
        rangeText: rangeText,
        roll: roll,
        grow: grow,
        shrink: shrink,
        nextDice: nextDice
    };
});
