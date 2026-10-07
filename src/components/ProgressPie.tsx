/** Things 式进度饼：外圈为项目色细环，内部扇形按完成比例填充。 */
export function ProgressPie({
  color,
  value,
  size = 14,
  className,
}: {
  color: string
  /** 0 到 1 */
  value: number
  size?: number
  className?: string
}) {
  const v = Math.min(1, Math.max(0, value))
  const r = 4.2
  const a = v * 2 * Math.PI
  const x = 7 + r * Math.sin(a)
  const y = 7 - r * Math.cos(a)
  const large = v > 0.5 ? 1 : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={className}
      style={{ flex: 'none' }}
    >
      <circle cx={7} cy={7} r={6.25} fill="none" stroke={color} strokeWidth={1.5} />
      {v >= 1 ? (
        <circle cx={7} cy={7} r={r} fill={color} />
      ) : v > 0 ? (
        <path d={`M7 7 L7 ${7 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill={color} />
      ) : null}
    </svg>
  )
}
