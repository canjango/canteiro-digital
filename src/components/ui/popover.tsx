"use client";

import * as React from "react";
import { Popover as P } from "radix-ui";

import { cn } from "@/lib/utils";

const Popover = P.Root;
const PopoverTrigger = P.Trigger;
const PopoverClose = P.Close;

function PopoverContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border bg-popover text-popover-foreground shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
