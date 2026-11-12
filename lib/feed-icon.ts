/**
 * 本地图标兜底：把名称首字（或首字母）画成一个内联 SVG data URI。
 *
 * 为什么不用 api.dicebear.com：那是第三方服务，用户在自己机器上部署
 * 这个项目时，页面每次加载都要往外发一次请求 —— 内网会被墙、断网时
 * 图标全裂、而且等于把「谁订阅了什么源」的标题泄给了第三方。开源项目
 * 的默认路径不该依赖外部服务。
 *
 * 直接返回 data URI：没有网络请求，没有额外依赖，SVG 矢量在任意尺寸
 * 下都清晰。背景色按名称哈希取，同一个源每次渲染颜色一致。
 */

const PALETTE = [
  "#8b6f47",
  "#5b7c99",
  "#7d6b91",
  "#5f8a6a",
  "#a8695c",
  "#6d7f99",
  "#8a7a4f",
  "#6b8b8b",
];

/** 名称里第一个有意义的字符（跳过空白和标点） */
function initialOf(name: string): string {
  const cleaned = (name || "").replace(/[\s\-_.·|/\\()[\]{}]+/g, "");
  const ch = Array.from(cleaned)[0] || "R";
  return ch.toUpperCase();
}

/** 稳定的颜色：同一名称永远得到同一个色 */
function colorOf(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) {
    sum = (sum + name.charCodeAt(i) * (i + 1)) % 100000;
  }
  return PALETTE[sum % PALETTE.length];
}

/**
 * 生成首字图标。
 *
 * @param name 源名称 / 用户名，用于取首字与配色
 * @param size 画布边长，默认 64（显示尺寸由 CSS 决定）
 */
export function generateInitialIcon(name: string, size = 64): string {
  const label = initialOf(name);
  const bg = colorOf(name);
  const fontSize = Math.round(size * 0.44);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" ` +
    `font-size="${fontSize}" fill="#ffffff" font-weight="500">${label}</text>` +
    `</svg>`;

  // encodeURIComponent 保证中文等非 ASCII 字符也能安全放进 data URI
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
