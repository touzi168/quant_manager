# NOFX Theme

这份目录包含可以被其他项目直接复用的 Binance 风格主题：

- `index.css`：注入 Tailwind 的基础层、全局 CSS 变量、常用组件样式（卡片、按钮、Toast、骨架屏等）。
- `tailwind.preset.js`：囊括颜色、阴影、字体等扩展，供 Tailwind `presets` 继承。

## 如何在其它项目中使用

1. 复制整个 `theme/` 目录到目标项目根目录（或任意你喜欢的位置）。
2. 在目标项目的入口样式文件中引用：

```css
@import '../theme/index.css'; /* 根据你的目录结构调整路径 */
```

3. 在 `tailwind.config.js` 中引入预设：

```js
import themePreset from './theme/tailwind.preset.js';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  presets: [themePreset],
};
```

复制完成后，所有引用 CSS 变量或 Tailwind 自定义颜色的组件就能保持 NOFX／Binance 视觉风格。你也可以在该目录内添加更多自定义组件样式，并在多个项目之间共享。

