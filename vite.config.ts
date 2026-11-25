import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// `vite build --mode artifact`：桌面版。所有 JS、CSS、图片内联进一个 HTML，
// 再由 scripts/artifact-page.mjs 改成 Artifact 要求的页面格式（见 npm run build:artifact）。
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    plugins: [react(), tailwindcss(), ...(artifact ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    ...(artifact
      ? { publicDir: false as const, build: { outDir: 'dist-artifact', emptyOutDir: true } }
      : {}),
  }
})
