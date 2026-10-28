import * as React from "react";

import { cn } from "@/lib/utils";

/** Barra de avanço com marcador opcional do previsto (estilo shadcn Progress, sem JS). */
function Progress({
  value,
  marca,
  className,
  cor = "bg-ok",
  ...props
}: React.ComponentProps<"span"> & { value: number; marca?: number | null; cor?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      data-slot="progress"
      className={cn("relative block h-1.5 w-full rounded-full bg-muted", className)}
      {...props}
    >
      <span className={cn("block h-full rounded-full transition-[width]", cor)} style={{ width: `${v * 100}%` }} />
      {marca !== undefined && marca !== null && (
        <span
          title="Previsto"
          className="absolute -top-[3px] h-3 w-0.5 bg-foreground"
          style={{ left: `${Math.max(0, Math.min(1, marca)) * 100}%` }}
        />
      )}
    </span>
  );
}

export { Progress };
