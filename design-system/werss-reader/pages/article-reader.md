# Article Reader Page Overrides

> ⚠️ **本目录是设计阶段的配色/排版提案，不是当前实现的规范。**
>
> 这份文档里的色板（Primary `#18181B`、Accent `#EC4899`）与最终实现不同：
> 实际主题用的是 `#007AFF` 主色与米色底 `#f8f6f3`，并在
> `app/article-content.css` 里实现了浅色 / 米黄 / 电子墨水 / 深色四档可切换主题。
>
> 想看现在的实际样式，读 `app/globals.css`、`app/article-content.css`
> 与 `tailwind.config.ts`。**不要按这里的色值改代码。**
>
> 记录时间：2026-11-12

> **PROJECT:** WeRSS Reader
> **Generated:** 2026-02-24 17:36:10
> **Page Type:** Blog / Article

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** 1. Hero headline, 2. Short description, 3. Benefit bullets (3 max), 4. CTA, 5. Footer

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Minimalist: Brand + white #FFFFFF + accent. Buttons: High contrast 7:1+. Text: Black/Dark grey

### Component Overrides

- Avoid: Div soup with no semantics
- Avoid: Cramped or excessive line height
- Avoid: Full-width text on large screens

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Smooth scroll, reveal on scroll, parallax images, text animations, page-flip transitions
- Accessibility: Use semantic HTML and ARIA properly
- Typography: Use 1.5-1.75 for body text
- Typography: Limit to 65-75 characters per line
- CTA Placement: Center, large CTA button
