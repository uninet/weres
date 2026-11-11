import { LayoutGrid, Star, BookOpen } from "lucide-react";
import type { FontSizeOption, FontFamilyOption, NavItem } from "@/types/reader";

// 字体大小配置
export const fontSizes: FontSizeOption[] = [
  { label: "小", value: "small", className: "text-[15px]" },
  { label: "中", value: "medium", className: "text-[17px]" },
  { label: "大", value: "large", className: "text-[19px]" },
  { label: "特大", value: "xlarge", className: "text-[21px]" },
];

// 字体样式配置
export const fontFamilies: FontFamilyOption[] = [
  { label: "系统默认", value: "system", className: "font-sans" },
  { label: "宋体", value: "serif", className: "font-serif-sc" },
  { label: "楷体", value: "kai", className: "font-kai" },
];

// 导航项配置
export const navItems: NavItem[] = [
  { id: "all", label: "全部", icon: LayoutGrid },
  { id: "starred", label: "稍后阅读", icon: Star },
  { id: "unread", label: "未读", icon: BookOpen },
];

// 行间距选项
export const lineHeightOptions = [
  { label: "紧凑", value: "compact" },
  { label: "适中", value: "relaxed" },
  { label: "宽松", value: "loose" },
];

// 内容宽度选项
export const contentWidthOptions = [
  { label: "窄", value: "narrow" },
  { label: "中", value: "medium" },
  { label: "宽", value: "wide" },
];

// 获取字体大小类名
export function getFontSizeClass(fontSize: string): string {
  return fontSizes.find((f) => f.value === fontSize)?.className || "text-[17px]";
}

// 获取字体家族类名
export function getFontFamilyClass(fontFamily: string): string {
  return fontFamilies.find((f) => f.value === fontFamily)?.className || "font-serif-sc";
}

// 获取行间距类名
export function getLineHeightClass(lineHeight: string): string {
  switch (lineHeight) {
    case "compact":
      return "leading-[1.6]";
    case "relaxed":
      return "leading-[1.8]";
    case "loose":
      return "leading-[2.0]";
    default:
      return "leading-[1.8]";
  }
}

// 获取内容宽度类名
export function getContentWidthClass(contentWidth: string): string {
  // 参照主流阅读器（QiReader、Reeder 等）的正文宽度：默认档约 900px，
  // 太窄会频繁换行、太宽会导致每行字数过多影响回扫。
  switch (contentWidth) {
    case "narrow":
      return "max-w-2xl";
    case "medium":
      return "max-w-4xl";
    case "wide":
      return "max-w-5xl";
    default:
      return "max-w-4xl";
  }
}

// 获取文章内容 CSS 变量
export function getArticleContentVars(
  fontSize: string,
  fontFamily: string,
  lineHeight: string
): React.CSSProperties {
  const fontSizeValue =
    {
      small: "15px",
      medium: "17px",
      large: "19px",
      xlarge: "21px",
    }[fontSize] || "17px";

  // 只使用各平台预装字体：不引入任何需要联网下载的 Web Font，
  // 否则离线/内网环境下正文会退化成默认字体，甚至触发首屏字体阻塞。
  const fontFamilyValue =
    {
      system:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      serif:
        "'Songti SC', 'Source Han Serif SC', 'Noto Serif SC', 'SimSun', '宋体', serif",
      kai: "'KaiTi', 'STKaiti', 'Kaiti SC', '楷体', serif",
    }[fontFamily] || "'Songti SC', 'SimSun', serif";

  const lineHeightValue =
    {
      compact: "1.6",
      relaxed: "1.8",
      loose: "2.0",
    }[lineHeight] || "1.8";

  return {
    "--article-font-size": fontSizeValue,
    "--article-font-family": fontFamilyValue,
    "--article-line-height": lineHeightValue,
  } as React.CSSProperties;
}
