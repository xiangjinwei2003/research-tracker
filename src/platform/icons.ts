import { LOGO_SVG } from '@/lib/logo'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图标绘制失败'))
    img.src = src
  })
}

/**
 * 应用图标：256px 方形 PNG，图标占 81%（macOS 图标的内容区比例），四周留透明边。
 * Claude 不会替应用加圆角，圆角来自 logo 本身。
 */
export async function appIconPng(): Promise<string> {
  const size = 256
  const inset = Math.round(size * 0.095)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`)
  ctx.drawImage(img, inset, inset, size - inset * 2, size - inset * 2)
  return canvas.toDataURL('image/png')
}

/**
 * 菜单栏图标：18pt 高的模板图（这里画 36px，供高分屏），黑色画在透明底上，macOS 按菜单栏颜色着色。
 * 图形是一个圆环加一个勾，与应用图标一致。
 */
export function trayIconPng(): string {
  const size = 36
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.strokeStyle = '#000'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3.4
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(11.5, 18.5)
  ctx.lineTo(16, 23)
  ctx.lineTo(24.5, 13.5)
  ctx.stroke()
  return canvas.toDataURL('image/png')
}
