/**
 * RSS 阅读器类型定义
 */

// 订阅源
export interface Feed {
  id: string;
  title: string;
  icon?: string;
  unread?: number;
  category?: string;
}

// 订阅源分组
export interface Group {
  id: string;
  name: string;
  feeds: Feed[];
}

// 文章
export interface Article {
  id: string;
  title: string;
  description?: string;
  content?: string;
  author?: string;
  pubDate: string;
  link?: string;
  /** 列表与正文封面图，解析 RSS 时从 enclosure / media:content / 正文首图提取 */
  imageUrl?: string | null;
  feed?: {
    id: string;
    title: string;
    icon?: string;
  };
  isRead?: boolean;
  isFavorited?: boolean;
}

// 字体大小配置
export interface FontSizeOption {
  label: string;
  value: string;
  className: string;
}

// 字体样式配置
export interface FontFamilyOption {
  label: string;
  value: string;
  className: string;
}

// 导航项
export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// 阅读设置
export interface ReadingSettings {
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  contentWidth: string;
  isDarkMode: boolean;
}

// 文章列表筛选类型
export type ArticleFilterType = 'all' | 'unread' | 'starred';
