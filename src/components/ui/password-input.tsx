import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="relative block h-4 w-4">
            <Eye
              className={cn(
                "absolute inset-0 h-4 w-4 transition-all duration-200",
                visible ? "opacity-0 scale-75 rotate-12" : "opacity-100 scale-100 rotate-0"
              )}
            />
            <EyeOff
              className={cn(
                "absolute inset-0 h-4 w-4 transition-all duration-200",
                visible ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 -rotate-12"
              )}
            />
          </span>
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
