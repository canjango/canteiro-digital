import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded border px-1.5 py-px text-[0.72rem] font-semibold leading-[1.4] [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-muted-foreground",
        ok: "border-transparent bg-ok text-selo-texto",
        info: "border-transparent bg-info text-selo-texto",
        sinal: "border-transparent bg-sinal text-sinal-foreground",
        atencao: "border-transparent bg-atencao text-selo-texto",
        critico: "border-transparent bg-critico text-selo-texto",
        riscado: "border-transparent bg-transparent text-muted-foreground line-through",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
