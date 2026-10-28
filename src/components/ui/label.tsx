"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("flex select-none flex-col gap-1 text-xs font-medium text-muted-foreground [&>*]:text-foreground", className)}
      {...props}
    />
  );
}

export { Label };
