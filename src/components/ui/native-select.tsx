import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Select nativo com o visual do shadcn/ui (funciona com FormData e no celular). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative flex w-full min-w-0", className)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className="h-9 w-full min-w-0 appearance-none truncate rounded-md border border-input bg-card py-1 pl-3 pr-8 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </span>
  );
}

export { NativeSelect };
