/*!
 * storage.js —— 设置读写（popup 与 options 共用）
 *
 * 优先用 chrome.storage.sync（装了扩展时，设置能跨设备同步）；
 * 在没有 chrome API 的环境（例如直接用浏览器打开 popup.html 预览、或跑单测）
 * 自动退回 localStorage，保证同一份代码在两种环境下都能跑。
 */
(function (root) {
    'use strict';

    var DEFAULTS = {
        defaultLetters: 6,      // 选项页设置：默认字母数
        defaultDice: 10,        // 选项页设置：默认面数
        theme: 'dark',          // 选项页设置：dark | light
        injectPage: true,       // 是否把挂件注入到网页上
        lastLetters: null,      // 弹窗上次用的字母数（null = 跟随默认）
        lastDice: null          // 弹窗上次用的面数
    };

    var hasChrome = (typeof chrome !== 'undefined') &&
                    chrome.storage && chrome.storage.sync;

    function get() {
        if (hasChrome) {
            return new Promise(function (resolve) {
                chrome.storage.sync.get(DEFAULTS, function (v) {
                    resolve(Object.assign({}, DEFAULTS, v || {}));
                });
            });
        }
        var out = Object.assign({}, DEFAULTS);
        try {
            Object.keys(DEFAULTS).forEach(function (k) {
                var raw = root.localStorage.getItem('rng.' + k);
                if (raw !== null) {
                    out[k] = JSON.parse(raw);
                }
            });
        } catch (e) {}
        return Promise.resolve(out);
    }

    function set(patch) {
        if (hasChrome) {
            return new Promise(function (resolve) {
                chrome.storage.sync.set(patch, resolve);
            });
        }
        try {
            Object.keys(patch).forEach(function (k) {
                root.localStorage.setItem('rng.' + k, JSON.stringify(patch[k]));
            });
        } catch (e) {}
        return Promise.resolve();
    }

    /** 恢复默认（只重置设置项，不动 last* 这类运行状态） */
    function reset() {
        return set({
            defaultLetters: DEFAULTS.defaultLetters,
            defaultDice: DEFAULTS.defaultDice,
            theme: DEFAULTS.theme
        });
    }

    /** 网页挂件的显示开关（与其它设置分开，便于弹窗里单独切换） */
    function setInject(on) {
        var o = {};
        o.injectPage = !!on;
        return set(o);
    }

    root.RNGStore = {
        DEFAULTS: DEFAULTS,
        hasChrome: !!hasChrome,
        get: get,
        set: set,
        reset: reset,
        setInject: setInject
    };
})(typeof self !== 'undefined' ? self : this);
