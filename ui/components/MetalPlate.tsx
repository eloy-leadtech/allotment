import type { ReactNode } from 'react';

interface MetalPlateProps {
  children: ReactNode;
  className?: string;
}

/** Raised steel plate from the Mister skin (see ui/theme/mister.css). */
export function MetalPlate({ children, className }: MetalPlateProps) {
  return <div className={className ? `mst-plate ${className}` : 'mst-plate'}>{children}</div>;
}
