/**
 * 运行环境判定。
 *
 * 网页版（Vercel 或本地开发）没有 `window.claude`；claude.ai 的 Artifact 在页面脚本运行前
 * 就已注入 `window.claude.use`。所以模块求值时同步判定一次即可，store 据此选择存储。
 * 两种环境不会互相切换：判定结果固定，存储出错时报错，不改用另一种存储。
 */

export function detectArtifact(scope: unknown = globalThis): boolean {
  const claude = (scope as { claude?: { use?: unknown } }).claude
  return typeof claude?.use === 'function'
}

export const IN_ARTIFACT = detectArtifact()

/** Artifact 里的 `window.claude`；网页版返回 null。 */
export function claudeRuntime(): Claude | null {
  return IN_ARTIFACT ? (globalThis as unknown as { claude: Claude }).claude : null
}
