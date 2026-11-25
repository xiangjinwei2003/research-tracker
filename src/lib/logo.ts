/**
 * 应用图标。页面里用 data URI，网页版与桌面版（单文件 Artifact，没有静态文件）都能显示。
 * 网页版的标签页图标是 public/logo-mark.svg，两者内容必须一致，logo.test.ts 会检查。
 */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <!-- 底色为强调色 oklch(0.57 0.17 258)，白色勾号 -->
  <rect width="32" height="32" rx="7" fill="#2d74d9"/>
  <path d="M9.5 16.5l4.2 4.2 8.8-9.4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

export const LOGO_URL = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`
