import Image from "next/image";
import { cn } from "@/lib/utils";

type HousatLogoProps = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-14 w-14",
  lg: "h-20 w-20"
};

const sizePixels = {
  sm: 36,
  md: 56,
  lg: 80
};

export function HousatLogo({ size = "md", withWordmark = false, className }: HousatLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative grid shrink-0 place-items-center rounded-[22%] border border-white/80 bg-card text-primary shadow-[0_16px_34px_rgba(15,61,58,0.16)]",
          sizeClasses[size]
        )}
        aria-hidden="true"
      >
        <Image
          src="/brand/housat-mark.svg"
          alt=""
          width={sizePixels[size]}
          height={sizePixels[size]}
          className="h-[76%] w-[76%] object-contain"
          priority={size === "lg"}
        />
      </div>
      {withWordmark ? (
        <span className="min-w-0">
          <span className="brand-wordmark block truncate text-primary">Housat AI</span>
          <span className="block truncate text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            AI-powered rental search
          </span>
        </span>
      ) : null}
    </div>
  );
}
