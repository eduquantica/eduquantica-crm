import Image from "next/image";
import { cn } from "@/lib/cn";

type BrandLogoProps = {
  variant?: "default" | "white";
  width?: number;
  priority?: boolean;
  className?: string;
};

export default function BrandLogo({
  variant = "default",
  width = 190,
  priority = false,
  className,
}: BrandLogoProps) {
  const src = variant === "white" ? "/images/logo-white.png" : "/images/logo.png";
  const height = Math.round(width / 3.5);

  return (
    <Image
      src={src}
      alt="EduQuantica"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
