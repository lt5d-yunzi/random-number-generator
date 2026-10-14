# RandomNumberGenerator · Typecho 随机数生成器插件

一个模仿 [faproulette.co](https://faproulette.co) 风格的随机数生成器：
**字母从 Z 往前取 N 个，每个字母配一个 1~面数 的随机数**，面数支持 10 面 / 6 面随时切换。

> **本项目基于 [doumiaojiang/RandomNumberGenerator](https://github.com/doumiaojiang/RandomNumberGenerator) 修改而来。**
> 原作作者：**doumiaojiang**　原作版本：`1.1.1`
> 原作的署名与版权声明已完整保留，详见文末「[版权与致谢](#署名与致谢)」。

![侧栏紧凑版](../screenshots/typecho-sidebar.png)

---

## 目录

- [功能](#功能)
- [安装](#安装)
- [三种用法](#三种用法)
  - [1. 正文短代码](#1-正文短代码)
  - [2. 侧栏紧凑版](#2-侧栏紧凑版)
  - [3. 右下角悬浮窗](#3-右下角悬浮窗)
- [设置](#设置)
- [与原作的差异](#与原作的差异)
- [常见问题](#常见问题)
- [版权与致谢](#署名与致谢)

---

## 功能

| 功能 | 说明 |
|---|---|
| **字母序列** | 从 Z 往前取 N 个。6 个 → `U V W X Y Z`；8 个 → `S T U V W X Y Z` |
| **随机数** | 每个字母配一个 `1 ~ 面数` 的随机数 |
| **面数切换** | **10 面**（1~10） ⇄ **6 面**（1~6），点一下立刻重抽 |
| **增减字母** | 往字母表前面扩 / 从前面收；到 `A` 或剩 1 个为止 |
| **重新随机** | 保持字母范围不变，重新掷一遍 |
| **日夜模式** | 组件内自带滑块，选择记在浏览器本地 |
| **数字滚动** | 所有格子立刻开始滚，然后按顺序逐个定格。**无入场动画** |
| **多实例** | 同一页可同时存在多个（侧栏 + 悬浮窗 + 正文），互不干扰 |
| **后台编辑器** | 写文章工具栏多一个「插入随机数生成器」按钮，弹窗选参数直接插入 |

---

## 安装

1. 把 `RandomNumberGenerator/` 整个目录放进 Typecho 的 **`usr/plugins/`** 下
2. 到 **后台 → 插件 → 找到「随机数生成器」→ 启用**

```
usr/plugins/
└── RandomNumberGenerator/
    ├── Plugin.php
    └── assets/
        ├── script.js
        └── style.css
```

> ⚠️ **目录名必须保持 `RandomNumberGenerator`**，插件类名前缀与它绑定，改名会失效。

启用后即可在文章/页面里使用短代码；想把生成器放到侧栏或做成悬浮窗，见下一节。

---

## 三种用法

### 1. 正文短代码

在文章或页面正文里写：

```
[random_generator]
```

带参数（`letters` 与 `dice` 可以只写一个）：

```
[random_generator letters="8"]
[random_generator dice="6"]
[random_generator letters="8" dice="6"]
```

| 参数 | 取值 | 说明 |
|---|---|---|
| `letters` | 1 ~ 26 | 字母个数，不写则用后台设置的默认值 |
| `dice` | `10` / `6` | 骰子面数，不写则用后台设置的默认值 |

写文章时也可以点工具栏上的 **「插入随机数生成器」** 按钮，弹窗里选好参数自动插入。

### 2. 侧栏紧凑版

在主题的 `sidebar.php` 里调用 `renderCompact()`：

```php
<?php if (class_exists('RandomNumberGenerator_Plugin')): ?>
<section id="random-generator-2" class="widget wrapper-md clear">
  <h3 class="widget-title m-t-none text-md">随机数生成器</h3>
  <?php RandomNumberGenerator_Plugin::renderCompact(false); ?>
</section>
<?php endif; ?>
```

- `renderCompact(false)` — **不输出**组件自带的小标题，由主题的 `widget-title` 提供，
  这样和侧栏其它区块样式一致（就是上面截图里的样子）
- `renderCompact(true)` 或 `renderCompact()` — 输出组件自带的小标题，适合直接丢进任意位置

紧凑版会自适应父容器宽度，在约 240px 的侧栏里 6 个字母排成 3×2 网格。

> 不想显示时**不用改代码**：后台插件设置里有「侧栏紧凑版」开关，关掉即可（详见[设置](#设置)）。

### 3. 右下角悬浮窗

在主题的 `footer.php` 的 `</body>` 之前加一行：

```php
<?php if (class_exists('RandomNumberGenerator_Plugin')) RandomNumberGenerator_Plugin::renderFloating(); ?>
```

页面右下角会出现一个骰子圆按钮，点击展开完整版面板。
点面板外部或按 `Esc` 也会收起。

**可以拖动、可以隐藏**（都是访客侧行为，互相不影响）：

| 操作 | 效果 |
|---|---|
| **按住小球拖动** | 移到任意位置，**位置记在浏览器本地**，刷新/换页仍在原处 |
| **单击小球** | 展开 / 收起面板（拖动不算点击，有 5px 阈值区分） |
| **面板标题栏 `–`** | 隐藏挂件；原位置留一个半透明**小圆点**，点它可召回 |
| **面板标题栏 `×`** | 只关面板，小球还在 |
| 面板位置 | 始终贴着小球并自动避开视口边缘，拖到屏幕角上也不会溢出 |

> **和后台开关的区别**：
> 后台「右下角悬浮窗」开关是**站长**控制「要不要输出这个挂件」；
> 这里的拖动/隐藏是**访客**在浏览器里自己调整，状态只存在访客本地。
> 后台关掉时挂件根本不输出，访客也就无从拖动。

![右下角悬浮窗](../screenshots/typecho-floating.png)

> 不想显示时后台插件设置里有「右下角悬浮窗」开关。
>
> **位置提示**：悬浮球固定在右下角。
> 若你的主题在右下角已有别的悬浮元素，改 `assets/style.css` 里
> `.rng-float { right: 18px; bottom: 18px; }` 即可挪开。

### 用 `class_exists` 包起来的原因

插件被停用时类不存在，包一层判断可以让主题**不报错、只是不显示**。

---

## 设置

**后台 → 插件 → 随机数生成器 → 设置**

| 项 | 默认 | 说明 |
|---|---|---|
| **侧栏紧凑版** | **显示** | 显示 / 隐藏。关掉后主题里对 `renderCompact()` 的调用**连标题栏一起**不输出 |
| **右下角悬浮窗** | **显示** | 显示 / 隐藏。关掉后不输出右下角的悬浮球 |
| 默认字母数 | **6** | 1 ~ 26。字母从 Z 往前取，6 表示 `U~Z` |
| 默认骰子面数 | **10 面** | 10 面 / 6 面。页面上随时可切 |

![插件设置页](../screenshots/typecho-plugin-settings.png)

侧栏和悬浮窗都用这里的默认值；正文短代码里写了参数则以参数优先。

### 显示开关

两个位置的开关是**独立**的，可以只留一个：

| 想保留 | 设置 |
|---|---|
| 只要侧栏 | 侧栏=显示，悬浮窗=隐藏 |
| 只要悬浮球 | 侧栏=隐藏，悬浮窗=显示 |
| 都不要 | 两个都隐藏（也可以直接停用插件） |
| 正文短代码 | **不受这两个开关影响**，始终可用 |

> **为什么不直接把 `sidebar.php` 那段删掉？**
> 删代码是一次性动作，改回去要动文件。开关让你在后台随时切换，
> 主题里那几行调用保持不动。

**升级兼容**：如果配置里还没有这两个项（从旧版本升级上来），
按**显示**处理，侧栏和悬浮球不会因为升级而突然消失。

**主题侧是怎么接的**（供参考）：

```php
<!-- sidebar.php -->
<?php if (class_exists('RandomNumberGenerator_Plugin')
       && RandomNumberGenerator_Plugin::sidebarEnabled()): ?>
<section class="widget wrapper-md clear">
  <h3 class="widget-title m-t-none text-md">随机数生成器</h3>
  <?php RandomNumberGenerator_Plugin::renderCompact(false); ?>
</section>
<?php endif; ?>
```

```php
<!-- footer.php -->
<?php if (class_exists('RandomNumberGenerator_Plugin')
       && RandomNumberGenerator_Plugin::floatingEnabled())
       RandomNumberGenerator_Plugin::renderFloating(); ?>
```

侧栏这里**必须由主题判断开关**——因为 `<section>` 和标题在主题模板里，
只让 `renderCompact()` 返回空的话，会剩一个空标题挂在侧栏上。
`renderCompact()` 内部也做了同样的判断，作为双保险。

---

## 与原作的差异

原作 `1.1.1` 只有「正文短代码」一种用法。本版本在保留原有功能与视觉风格的前提下做了这些改动：

### 新增

| 改动 | 说明 |
|---|---|
| **侧栏紧凑版** | 新增 `renderCompact()` 与一整套 `.rng-mode-compact` 样式，适配窄侧栏 |
| **右下角悬浮窗** | 新增 `renderFloating()` 与 `.rng-float` 样式 |
| **多实例隔离** | 见下方「为什么改多实例」 |
| **`letters` / `dice` 可省略** | 短代码参数支持只写一个 |
| **默认字母数 4 → 6** | 原作默认 4 个（`W X Y Z`），本版默认 6 个（`U~Z`） |
| **显示开关** | 后台可分别开关侧栏版与悬浮窗，不用改主题代码 |
| **悬浮窗可拖动 / 可隐藏** | 原作悬浮窗固定右下角且无法关闭；本版支持拖动、记住位置、访客可隐藏并召回 |

### 修复

| 问题 | 原作情况 | 本版 |
|---|---|---|
| **入场动画** | 定格后会触发 `rng-scroll` 下落 + 淡入动画 | 按要求**移除**，只保留数字滚动 |
| **CSS 死规则** | `.rng-scrolling .rng-number` —— 选择器写反了，类实际加在 `.rng-number` 自身，动画**从未生效过** | 修正为 `.rng-number.rng-scrolling`，后按需求整体移除 |
| **日志噪音** | `parseShortcode()` 里 3 处 `error_log()`，**每解析一次正文就写一次日志** | 移除 |
| **边界规则** | `letters=0` 会回退到默认值 | 统一为：非数字才回退默认，数字越界钳到 1~26（与浏览器扩展版一致） |

### 为什么改多实例

原作的交互是全局函数 + 固定 ID：

```js
window.addNumber = function () { ... };
document.getElementById('result')      // ← 固定 ID
document.getElementById('diceToggle')  // ← 固定 ID
```

**同一页放两个实例就会互相抢元素**——在侧栏点「＋」，悬浮窗里的也跟着变。

本版改成：每个 `.rng-container` 各自持有一份状态，交互统一走 `data-rng-action` 属性，
所有查询限定在自己的 root 内，脚本 `defer` 加载后扫描页面自动初始化（不依赖加载顺序）。
实测：侧栏扩到 `T~Z`、切到 6 面时，悬浮窗仍保持 `U~Z` / 10 面。

### 升级注意

改了 `assets/` 里的 JS 或 CSS 之后，**记得同时升 `Plugin.php` 里的 `VERSION` 常量**。
资源 URL 带 `?v=<版本>`，不升版本浏览器会一直用缓存里的旧文件。

---

## 常见问题

**Q：启用了插件，但前台没看到生成器？**
A：插件只提供短代码。要在侧栏/悬浮窗显示，需要按上面第 2、3 节在主题里调用。

**Q：悬浮窗被主题右下角的其它元素挡住了？**
A：改 `.rng-float` 的 `right` / `bottom`，或调大 `z-index`（默认 1050）。

**Q：数字滚动太快/太慢？**
A：`assets/script.js` 里，`setInterval(..., 50)` 是滚动速度，
`index * 110 + 300` 是逐个定格的节奏，按需调整。

**Q：升级 Typecho 会覆盖我的改动吗？**
A：不会。插件在 `usr/plugins/` 下，与 Typecho 核心分离。

**Q：和浏览器扩展版是什么关系？**
A：同一套规则的两份实现。扩展是独立的 Manifest V3 项目，见仓库的 `browser-extension/`。

---

## 署名与致谢

### 原作

- **作者：doumiaojiang**
- **仓库：<https://github.com/doumiaojiang/RandomNumberGenerator>**
- **版本：1.1.1**
- 原作源码文件头部声明：`@package RandomNumberGenerator`　`@author Grok`　`@version 1.1.1`

原作**未声明开源协议**（仓库中没有 `LICENSE` 文件，GitHub API 的 `license` 字段为 `null`）。
按著作权默认规则，**原作的全部权利归原作者 doumiaojiang 所有**。

### 本仓库的版权状态

本插件基于原作修改而来，**对自身的修改与新增部分不做版权主张**：

- [LICENSE](../LICENSE) **不是开源协议**，只是对版权状态与署名要求的如实陈述
- 本仓库**没有、也无法**代替原作者进行授权
- 版权人只有一位：**原作者 doumiaojiang**

### 署名

| 角色 | 署名 |
|---|---|
| **原作** | doumiaojiang |
| **维护者** | lt5d-yunzi |
| **代码实现与文档** | **鲸鱼少女**（AI 编码助手 · DeepSeek Harness） |

实现者署在 `Plugin.php` 头部的 `@implemented-by` 标签与本文档中。

### ⚠️ 使用前请注意

原作为**公开仓库**，但**未声明开源协议**，全部权利归原作者 doumiaojiang。
本仓库不对原作部分作出任何授权；用于**商业用途**前，建议先联系原作者取得授权。
如原作者提出要求，我们会立即下架。

### 原作者异议

若原作者对本次修改、再分发或授权方式有异议，
请在 <https://github.com/lt5d-yunzi/random-number-generator/issues> 提出，
我们会立即配合调整（包括但不限于修改署名方式、变更授权说明或下架）。

**感谢 doumiaojiang 的开源分享。**
