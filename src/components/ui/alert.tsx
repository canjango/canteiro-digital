import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-md border-l-4 px-4 py-2.5 text-sm font-medium", {
  variants: {
    variant: {
      ok: "border-l-ok bg-ok-suave text-foreground",
      erro: "border-l-critico bg-critico-suave text-foreground",
      info: "border-l-info bg-info-suave text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role={variant === "erro" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
