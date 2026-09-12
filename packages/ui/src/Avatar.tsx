import { cn } from './cn';
import { StatusDot, type StatusKind } from './StatusDot';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic accent color from a string so each user has a stable hue. */
function hueFrom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  status?: StatusKind;
  className?: string;
}

export function Avatar({ name, src, size = 40, status, className }: AvatarProps) {
  const hue = hueFrom(name);
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ backgroundColor: `hsl(${hue} 55% 45%)`, fontSize: size * 0.38 }}
        >
          {initials(name)}
        </span>
      )}
      {status && <StatusDot status={status} className="absolute -bottom-0.5 -right-0.5" />}
    </span>
  );
}
