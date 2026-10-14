<?php
/**
 * 随机数生成器插件
 *
 * 通过短代码 [random_generator letters="6" dice="10"] 在文章/页面中显示；
 * 也支持被主题直接调用，放到侧栏或做成悬浮窗：
 *
 *     RandomNumberGenerator_Plugin::renderCompact();   // 侧栏紧凑版
 *     RandomNumberGenerator_Plugin::renderFloating();  // 右下角悬浮窗
 *
 * 字母从 Z 往前取 N 个（6 → U V W X Y Z），每个字母配一个 1~面数 的随机数。
 *
 * ---------------------------------------------------------------------------
 * 本插件基于 doumiaojiang 的原作修改而来，原作者署名与版权声明一律保留：
 *
 *     原作作者：doumiaojiang
 *     原仓库：  https://github.com/doumiaojiang/RandomNumberGenerator
 *     原作版本：1.1.1
 *     （原作文件头原声明为 @author Grok / @version 1.1.1，此处按原作者本人署名）
 *
 * 原作未声明开源协议，按著作权默认规则，全部权利归原作者 doumiaojiang 所有。
 * 本插件对自身的修改与新增部分**不做版权主张**，也不代替原作者进行授权。
 * **使用、修改、再分发时必须完整保留原作者署名。**
 * 用于公开发布、分发或商业用途前，请先联系原作者取得授权。
 *
 * 详细改动见同目录 README.md 的「与原作的差异」。
 *
 * 实现与文档：鲸鱼少女（AI 编码助手 · DeepSeek Harness）
 * ---------------------------------------------------------------------------
 *
 * @package RandomNumberGenerator
 * @original-author doumiaojiang <https://github.com/doumiaojiang>
 * @author lt5d-yunzi <https://github.com/lt5d-yunzi>
 * @implemented-by 鲸鱼少女（AI 编码助手 · DeepSeek Harness）
 * @version 1.3.3
 * @license 未声明（原作未授权；本项目不主张版权，详见 LICENSE 与 NOTICE）
 * @link https://github.com/lt5d-yunzi/random-number-generator
 */

class RandomNumberGenerator_Plugin implements Typecho_Plugin_Interface
{
    /** 同一页可能有多个实例（侧栏 1 个 + 悬浮窗 1 个 + 正文若干），用它保证 id 唯一 */
    private static $seq = 0;

    /** 资源是否已输出过（避免同一页重复引入） */
    private static $assetsDone = false;

    const VERSION = '1.3.3';
    const MIN_LETTERS = 1;
    const MAX_LETTERS = 26;

    public static function activate()
    {
        Typecho_Plugin::factory('Widget_Abstract_Contents')->contentEx = array('RandomNumberGenerator_Plugin', 'parseShortcode');
        Typecho_Plugin::factory('Widget_Abstract_Contents')->excerptEx = array('RandomNumberGenerator_Plugin', 'parseShortcode');
        Typecho_Plugin::factory('admin/write-post.php')->bottom = array('RandomNumberGenerator_Plugin', 'editorEnhance');
        Typecho_Plugin::factory('admin/write-page.php')->bottom = array('RandomNumberGenerator_Plugin', 'editorEnhance');
        return _t('随机数生成器插件已启用，可在文章/页面用 [random_generator] 调用');
    }

    public static function deactivate()
    {
        return _t('随机数生成器插件已禁用');
    }

    public static function config(Typecho\Widget\Helper\Form $form)
    {
        $defaultLetters = new Typecho_Widget_Helper_Form_Element_Text(
            'defaultLetters',
            NULL,
            '6',
            _t('默认字母数'),
            _t('设置默认显示的字母数（1-26）。字母从 Z 往前取，6 表示 U~Z。')
        );
        $form->addInput($defaultLetters->addRule('isInteger', _t('请输入整数'))->addRule('min', _t('最小为 1'), 1)->addRule('max', _t('最大为 26'), 26));

        $defaultDice = new Typecho_Widget_Helper_Form_Element_Radio(
            'defaultDice',
            array('10' => _t('10 面'), '6' => _t('6 面')),
            '10',
            _t('默认骰子面数'),
            _t('选择默认骰子面数；页面上还有按钮可以随时在 10 面和 6 面之间切换。')
        );
        $form->addInput($defaultDice);

        // ---- 显示位置开关 ----
        // 用 Radio 而不是 Checkbox：Typecho 的 Checkbox 渲染成 name="xxx[]"、存的是数组，
        // 单个开关用它不好判断；Radio 存的就是 '1' / '0'，语义干净。
        $showSidebar = new Typecho_Widget_Helper_Form_Element_Radio(
            'showSidebar',
            array('1' => _t('显示'), '0' => _t('隐藏')),
            '1',
            _t('侧栏紧凑版'),
            _t('关掉后，主题里对 renderCompact() 的调用不再输出任何内容（连标题栏一起隐藏）。')
        );
        $form->addInput($showSidebar);

        $showFloating = new Typecho_Widget_Helper_Form_Element_Radio(
            'showFloating',
            array('1' => _t('显示'), '0' => _t('隐藏')),
            '1',
            _t('右下角悬浮窗'),
            _t('关掉后，主题里对 renderFloating() 的调用不再输出悬浮球。')
        );
        $form->addInput($showFloating);
    }

    public static function personalConfig(Typecho\Widget\Helper\Form $form) {}

    // ---------------------------------------------------------------
    // 短代码
    // ---------------------------------------------------------------

    public static function parseShortcode($content, $widget, $lastResult)
    {
        $content = empty($lastResult) ? $content : $lastResult;
        if (preg_match_all('/\[random_generator(?:\s+letters="(\d+)")?(?:\s+dice="(\d+)")?\s*\]/i', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                ob_start();
                self::render(
                    isset($match[1]) && $match[1] !== '' ? (int)$match[1] : null,
                    isset($match[2]) && $match[2] !== '' ? (int)$match[2] : null
                );
                $content = str_replace($match[0], ob_get_clean(), $content);
            }
        }
        return $content;
    }

    // ---------------------------------------------------------------
    // 对外渲染入口
    // ---------------------------------------------------------------

    // ---------------------------------------------------------------
    // 配置读取与显示开关
    // ---------------------------------------------------------------

    /**
     * 读一项插件配置
     *
     * @param string $key
     * @param mixed $default 配置不存在时（例如插件刚升级、还没保存过设置）返回它
     * @return mixed
     */
    private static function opt($key, $default = null)
    {
        try {
            $options = Helper::options()->plugin('RandomNumberGenerator');
        } catch (Exception $e) {
            return $default;
        }
        if (!$options) {
            return $default;
        }
        $value = $options->$key;
        // 注意 '0' 是合法值（表示隐藏），只有 null / 空串才算「没配过」
        return ($value === null || $value === '') ? $default : $value;
    }

    /**
     * 侧栏紧凑版是否启用
     *
     * 默认「开」——这样从旧版本升级上来、配置里还没有 showSidebar 这一项时，
     * 侧栏照旧显示，不会因为升级而突然消失。
     *
     * @return bool
     */
    public static function sidebarEnabled()
    {
        return (int)self::opt('showSidebar', '1') === 1;
    }

    /**
     * 右下角悬浮窗是否启用
     *
     * @return bool
     */
    public static function floatingEnabled()
    {
        return (int)self::opt('showFloating', '1') === 1;
    }

    /** 正文内联（短代码用），完整版 */
    public static function render($customLetters = null, $customDice = null)
    {
        self::assets();
        list($letters, $dice) = self::resolve($customLetters, $customDice);
        echo self::widgetHtml($letters, $dice, 'full');
    }

    /**
     * 侧栏紧凑版：宽度自适应父容器，竖向占用小
     *
     * @param bool $withTitle 是否输出组件自带的小标题。
     *                        设为 false 时由调用方（例如主题侧栏的 widget-title）提供标题。
     */
    public static function renderCompact($withTitle = true)
    {
        if (!self::sidebarEnabled()) {
            return;   // 后台把「侧栏紧凑版」关掉了
        }
        self::assets();
        list($letters, $dice) = self::resolve(null, null);
        echo self::widgetHtml($letters, $dice, 'compact', $withTitle);
    }

    /** 右下角悬浮窗：一个圆按钮 + 展开面板（面板里是完整版） */
    public static function renderFloating()
    {
        if (!self::floatingEnabled()) {
            return;   // 后台把「右下角悬浮窗」关掉了
        }
        self::assets();
        list($letters, $dice) = self::resolve(null, null);
        $uid = 'rng-float-' . (++self::$seq);
        ?>
<div class="rng-float" id="<?php echo $uid; ?>" data-rng-float="1">
    <button type="button" class="rng-float-btn" data-rng-float-toggle="1"
            aria-expanded="false" aria-controls="<?php echo $uid; ?>-panel"
            title="随机数生成器（按住可拖动）">&#127922;</button>
    <div class="rng-float-panel" id="<?php echo $uid; ?>-panel" data-rng-float-panel="1" hidden>
        <div class="rng-float-bar">
            <span class="rng-float-title">随机数生成器</span>
            <span class="rng-float-tools">
                <button type="button" class="rng-float-min" data-rng-float-hide="1"
                        title="隐藏（原位置会留一个小圆点，点它可召回）">&#8211;</button>
                <button type="button" class="rng-float-close" data-rng-float-toggle="1"
                        aria-label="关闭">&times;</button>
            </span>
        </div>
        <?php echo self::widgetHtml($letters, $dice, 'full'); ?>
    </div>
    <button type="button" class="rng-float-recall" data-rng-float-recall="1" hidden
            title="显示随机数生成器">&#127922;</button>
</div>
        <?php
    }

    // ---------------------------------------------------------------
    // 内部
    // ---------------------------------------------------------------

    /** 解析最终生效的字母数与面数 */
    private static function resolve($customLetters, $customDice)
    {
        $options = Helper::options()->plugin('RandomNumberGenerator');

        // 规则与扩展版 rng.js 的 clampLetters() 完全一致：
        //   · 没传 / 配置没存过 / 非数字  → 用默认 6
        //   · 传了数字但越界            → 钳到 1~26（不是回退默认）
        if ($customLetters !== null) {
            $n = (int)$customLetters;
        } else {
            $raw = $options->defaultLetters;
            $n = ($raw === null || $raw === '') ? 6 : (int)$raw;
        }
        $n = max(self::MIN_LETTERS, min(self::MAX_LETTERS, $n));

        $d = $customDice !== null ? (int)$customDice : (int)$options->defaultDice;
        if ($d != 6 && $d != 10) {
            $d = 10;
        }

        $letters = array();
        $start = 90 - $n + 1; // 90 = 'Z'，从 Z 往前取
        for ($i = 0; $i < $n; $i++) {
            $letters[] = chr($start + $i);
        }

        return array($letters, $d);
    }

    /** 输出插件资源，同一页只输出一次 */
    private static function assets()
    {
        if (self::$assetsDone) {
            return;
        }
        self::$assetsDone = true;
        $url = rtrim(Helper::options()->rootUrl, '/') . '/usr/plugins/RandomNumberGenerator';
        $v = self::VERSION;
        echo '<link rel="stylesheet" href="' . $url . '/assets/style.css?v=' . $v . '">' . "\n";
        echo '<script defer src="' . $url . '/assets/script.js?v=' . $v . '"></script>' . "\n";
    }

    /**
     * 生成一个实例的 HTML
     *
     * 关键点：所有交互按钮用 data-rng-action 标记，不再用全局函数名和固定 id，
     * 这样同页多个实例互不干扰（原先 addNumber()/result 是全局的，放两个就打架）。
     */
    private static function widgetHtml(array $letters, $dice, $mode, $withTitle = true)
    {
        $uid = 'rng-' . (++self::$seq);
        $config = htmlspecialchars(json_encode(array(
            'letters' => $letters,
            'dice'    => $dice,
            'min'     => self::MIN_LETTERS,
            'max'     => self::MAX_LETTERS,
        ), JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');

        $count = count($letters);
        $rangeText = $letters[0] . '~' . $letters[$count - 1];

        if ($mode === 'compact') {
            $titleHtml = $withTitle ? '<span class="rng-c-title">随机数生成器</span>' : '';
            return <<<HTML
<div class="rng-container rng-mode-compact" id="{$uid}" data-rng-config='{$config}'>
  <div class="rng-c-head">
    {$titleHtml}
    <span class="rng-c-meta" data-rng-range>{$rangeText}</span>
  </div>
  <div class="rng-result rng-c-result" data-rng-result></div>
  <div class="rng-c-actions">
    <button type="button" class="rng-c-btn" data-rng-action="remove" title="减少一个字母">−</button>
    <button type="button" class="rng-c-btn" data-rng-action="add" title="增加一个字母">＋</button>
    <button type="button" class="rng-c-btn" data-rng-action="dice" title="切换骰子面数（10 面 / 6 面）" data-rng-dice-label>{$dice} 面</button>
    <button type="button" class="rng-c-btn rng-c-btn-roll" data-rng-action="roll" title="重新随机">重抽</button>
  </div>
</div>
HTML;
        }

        $nextDice = $dice == 10 ? 6 : 10;
        $toggleText = '切换到 ' . $nextDice . ' 面骰子';

        return <<<HTML
<div class="rng-container rng-mode-full" id="{$uid}" data-rng-config='{$config}'>
  <div class="rng-header">
    <h2>随机数生成器</h2>
    <div class="rng-theme-switch">
      <label class="rng-switch" title="日夜模式">
        <input type="checkbox" data-rng-theme>
        <span class="rng-slider"></span>
      </label>
    </div>
  </div>
  <div class="rng-button-group">
    <button type="button" class="rng-btn rng-btn-add" data-rng-action="add">增加数字</button>
    <button type="button" class="rng-btn rng-btn-remove" data-rng-action="remove">减少数字</button>
    <button type="button" class="rng-btn rng-toggle-btn" data-rng-action="dice" data-rng-dice-label>{$toggleText}</button>
    <button type="button" class="rng-btn rng-btn-reroll" data-rng-action="roll">重新随机</button>
  </div>
  <div class="rng-result" data-rng-result></div>
</div>
HTML;
    }

    // ---------------------------------------------------------------
    // 后台编辑器增强（插入短代码的弹窗）
    // ---------------------------------------------------------------

    public static function editorEnhance()
    {
        $defLetters = 6;
        $defDice = 10;
        try {
            $o = Helper::options()->plugin('RandomNumberGenerator');
            $defLetters = (int)$o->defaultLetters ?: 6;
            $defDice = (int)$o->defaultDice ?: 10;
        } catch (Exception $e) {
            // 用上面的默认值
        }
        ?>
<style>
.rng-editor-popup {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    padding: 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
}
.rng-editor-popup h3 { margin: 0 0 15px; font-size: 1.2rem; }
.rng-editor-popup label { display: block; margin-bottom: 10px; }
.rng-editor-popup input, .rng-editor-popup select { width: 100%; padding: 5px; margin-top: 5px; }
.rng-editor-popup button {
    margin-top: 10px; padding: 8px 15px; background: #3498db; color: #fff;
    border: none; border-radius: 3px; cursor: pointer;
}
.rng-editor-popup button:hover { background: #2980b9; }
.rng-editor-overlay {
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 999;
}
</style>
<div class="rng-editor-overlay" id="rngEditorOverlay"></div>
<div class="rng-editor-popup" id="rngEditorPopup">
    <h3>插入随机数生成器</h3>
    <label>
        字母数（1-26）:
        <input type="number" id="rngLetters" min="1" max="26" value="<?php echo (int)$defLetters; ?>">
    </label>
    <label>
        骰子面数:
        <select id="rngDice">
            <option value="10"<?php if ($defDice == 10) echo ' selected'; ?>>10 面</option>
            <option value="6"<?php if ($defDice == 6) echo ' selected'; ?>>6 面</option>
        </select>
    </label>
    <button onclick="insertRngShortcode()">插入</button>
    <button onclick="closeRngPopup()">取消</button>
</div>
<script>
function openRngPopup() {
    document.getElementById('rngEditorPopup').style.display = 'block';
    document.getElementById('rngEditorOverlay').style.display = 'block';
}
function closeRngPopup() {
    document.getElementById('rngEditorPopup').style.display = 'none';
    document.getElementById('rngEditorOverlay').style.display = 'none';
}
function insertRngShortcode() {
    var letters = document.getElementById('rngLetters').value;
    var dice = document.getElementById('rngDice').value;
    var shortcode = '[random_generator letters="' + letters + '" dice="' + dice + '"]';
    var textarea = document.getElementById('text');
    if (textarea) {
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var value = textarea.value;
        textarea.value = value.substring(0, start) + shortcode + value.substring(end);
    }
    closeRngPopup();
}
jQuery(document).ready(function ($) {
    var button = $('<button type="button" class="btn">插入随机数生成器</button>').click(openRngPopup);
    $('#wmd-button-row, .wmd-button-row').append($('<li class="wmd-spacer wmd-spacer1"></li>')).append(button);
});
</script>
        <?php
    }
}
