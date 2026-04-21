import { cn } from '../../lib/utils';

interface MeshMarkProps {
  size?: number;
  stroke?: string;
  accent?: string;
  animate?: boolean;
  className?: string;
}

export function MeshMark({
  size = 24,
  stroke = 'currentColor',
  accent = 'var(--brand-magenta)',
  animate = false,
  className,
}: MeshMarkProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.38;

  // 6 hex nodes (flat-top hexagon, starting from top)
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  // Hub square (rotated 45deg = diamond)
  const hubSize = s * 0.22;
  const hubX = cx - hubSize / 2;
  const hubY = cy - hubSize / 2;

  // Play arrow inside hub
  const playW = hubSize * 0.55;
  const playH = hubSize * 0.55;
  const playX = cx - playW * 0.35;
  const playY = cy - playH / 2;

  // Hex edges: connect each node to neighbors
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [0, 2], [1, 3], [2, 4], [3, 5], [4, 0], [5, 1],
  ];

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animate && 'animate-pulse-subtle', className)}
      aria-hidden="true"
    >
      {/* Mesh edges */}
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke={stroke}
          strokeWidth={s * 0.025}
          strokeOpacity={0.4}
        />
      ))}

      {/* Outer nodes */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={s * 0.045}
          fill={i === 0 ? accent : stroke}
          fillOpacity={i === 0 ? 1 : 0.5}
        />
      ))}

      {/* Hub (rotated square = diamond) */}
      <rect
        x={hubX}
        y={hubY}
        width={hubSize}
        height={hubSize}
        fill={accent}
        rx={s * 0.02}
        transform={`rotate(45 ${cx} ${cy})`}
      />

      {/* Play arrow */}
      <polygon
        points={`${playX},${playY} ${playX},${playY + playH} ${playX + playW},${cy}`}
        fill="white"
      />
    </svg>
  );
}
