"use client";

import React, { useState, useEffect, useRef, useId, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, KeyRound, Loader2, Check, TrendingUp, ShieldCheck } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Clean self-contained cn utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Dark mode helper
export const useDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDark = () => {
      const isHtmlDark = document.documentElement.classList.contains("dark");
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      return isHtmlDark || mediaQuery.matches;
    };

    setIsDark(checkDark());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setIsDark(checkDark());
    mediaQuery.addEventListener("change", handler);

    const observer = new MutationObserver(() => setIsDark(checkDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mediaQuery.removeEventListener("change", handler);
      observer.disconnect();
    };
  }, []);

  return isDark;
};

// Liquid Glass Presets
export const GLASS_PRESETS = {
  subtle: {
    backgroundOpacity: 0.14,
    saturation: 1.2,
    brightness: 55,
    blur: 10,
    displace: 0.25,
    distortionScale: -18,
    redOffset: -1,
    greenOffset: 1,
    blueOffset: 3,
    mixBlendMode: "difference",
  },
  default: {
    backgroundOpacity: 0.22,
    saturation: 1.4,
    brightness: 55,
    blur: 14,
    displace: 0.35,
    distortionScale: -28,
    redOffset: 0,
    greenOffset: 2,
    blueOffset: 4,
    mixBlendMode: "difference",
  },
  bold: {
    backgroundOpacity: 0.28,
    saturation: 1.8,
    brightness: 60,
    blur: 16,
    displace: 0.5,
    distortionScale: -45,
    redOffset: 1,
    greenOffset: 3,
    blueOffset: 6,
    mixBlendMode: "screen",
  },
  ghost: {
    backgroundOpacity: 0.05,
    saturation: 1,
    brightness: 55,
    blur: 8,
    displace: 0,
    distortionScale: 0,
    redOffset: 0,
    greenOffset: 0,
    blueOffset: 0,
    mixBlendMode: "difference",
  },
};

export type GlassVariant = keyof typeof GLASS_PRESETS;

export const GLASS_DEFAULTS = {
  width: "auto",
  height: "auto",
  borderRadius: 16,
  borderWidth: 0.03,
  opacity: 0.93,
  xChannel: "R",
  yChannel: "G",
};

export interface GlassProps {
  variant?: GlassVariant;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: "R" | "G" | "B" | "A";
  yChannel?: "R" | "G" | "B" | "A";
  mixBlendMode?: string;
  dark?: boolean;
}

export const Glass: React.FC<GlassProps> = (rawProps) => {
  const {
    variant = "default",
    children,
    className = "",
    style = {},
    width,
    height,
    borderRadius,
    dark,
  } = rawProps;

  const systemDarkMode = useDarkMode();
  const isDarkMode = dark !== undefined ? dark : systemDarkMode;

  const p = GLASS_PRESETS[variant] ?? GLASS_PRESETS.default;
  const resolvedRadius = borderRadius !== undefined ? borderRadius : GLASS_DEFAULTS.borderRadius;

  const containerStyle: React.CSSProperties = {
    ...style,
    ...(width && width !== "auto" && { width: typeof width === "number" ? `${width}px` : width }),
    ...(height && height !== "auto" && { height: typeof height === "number" ? `${height}px` : height }),
    borderRadius: `${resolvedRadius}px`,
    background: isDarkMode
      ? "rgba(6, 22, 19, 0.78)"
      : `rgba(255, 255, 255, ${p.backgroundOpacity})`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: isDarkMode
      ? "1px solid rgba(52, 211, 153, 0.24)"
      : "1px solid rgba(255, 255, 255, 0.18)",
    boxShadow: isDarkMode
      ? "0 0 1px 0 rgba(52, 211, 153, 0.15) inset, 0px 6px 18px rgba(0, 0, 0, 0.3)"
      : "0 0 1px 0 rgba(255, 255, 255, 0.1) inset, 0px 4px 16px rgba(17, 17, 26, 0.05)",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden transition-colors duration-200 ease-out",
        className
      )}
      style={containerStyle}
    >
      <div className="w-full h-full flex items-center justify-center p-0 rounded-[inherit] relative z-10">
        {children}
      </div>
    </div>
  );
};

export interface GlassInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: GlassVariant;
  containerClassName?: string;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  borderRadius?: number;
  height?: number | string;
  glassProps?: Partial<GlassProps>;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      variant = "default",
      className = "",
      containerClassName = "",
      rightElement,
      leftElement,
      borderRadius = 14,
      height = 50,
      glassProps,
      ...inputProps
    },
    ref
  ) => {
    return (
      <div
        style={{
          borderRadius: `${borderRadius}px`,
          height: typeof height === "number" ? `${height}px` : height,
          background: "rgba(4, 15, 13, 0.78)",
          border: "1px solid rgba(52, 211, 153, 0.24)",
          boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.45)",
        }}
        className={cn(
          "relative w-full min-h-[50px] flex items-center px-4 transition-all duration-200 focus-within:border-emerald-400/70 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
          containerClassName
        )}
      >
        {leftElement && (
          <div className="mr-3 flex items-center justify-center text-emerald-300/70">
            {leftElement}
          </div>
        )}
        <input
          ref={ref}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#f8fafc",
          }}
          className={cn(
            "w-full h-full bg-transparent text-slate-100 placeholder:text-slate-400/70 border-none outline-none text-[14px] sm:text-[15px] font-medium leading-none",
            rightElement ? "pr-10" : "pr-0",
            className
          )}
          {...inputProps}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";

export interface SpaceLoginProps {
  title?: string;
  subtitle?: string;
  astronautSrc?: string;
  onSubmit?: (data: { email: string; password: string; rememberMe: boolean }) => Promise<void> | void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  onSocialLogin?: (provider: "google" | "github" | "facebook" | "windows" | "passkey") => void;
  className?: string;
  defaultEmail?: string;
  showSocialButtons?: boolean;
  glassVariant?: GlassVariant;
  customContent?: React.ReactNode;
  topRightElement?: React.ReactNode;
}

export function SparkleStar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-4 h-4 pointer-events-none select-none", className)}
      style={style}
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  );
}

// Dynamic Financial Ledger & Wealth Particle Canvas (Lightweight 60fps Mobile & Desktop)
export function CosmicStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    interface WealthParticle {
      x: number;
      y: number;
      size: number;
      opacity: number;
      baseOpacity: number;
      speedY: number;
      pulseSpeed: number;
      color: string;
      symbol?: string;
    }

    let particles: WealthParticle[] = [];
    const palette = ["#10b981", "#14b8a6", "#34d399", "#fbbf24", "#2dd4bf", "#a7f3d0"];
    const symbols = ["Rp", "+", "◈", "↗", "●"];

    const initParticles = () => {
      particles = [];
      const isMobile = width < 768;
      const count = isMobile ? 14 : Math.min(28, Math.floor((width * height) / 38000));

      for (let i = 0; i < count; i++) {
        const hasSymbol = Math.random() < 0.16;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const baseOpacity = hasSymbol ? 0.22 + Math.random() * 0.28 : 0.14 + Math.random() * 0.4;

        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: hasSymbol ? 11 + Math.random() * 3 : Math.random() * 2 + 0.8,
          opacity: baseOpacity,
          baseOpacity,
          speedY: 0.15 + Math.random() * 0.25,
          pulseSpeed: 0.01 + Math.random() * 0.015,
          color,
          symbol: hasSymbol ? symbols[Math.floor(Math.random() * symbols.length)] : undefined,
        });
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener("resize", handleResize, { passive: true });
    initParticles();

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Single-batch Fintech Architectural Grid
      const gridSize = 72;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.03)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Floating Wealth & Ledger Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.speedY;
        if (p.y < -20) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }

        p.opacity = p.baseOpacity + Math.sin(tick * p.pulseSpeed + i) * 0.15;
        const boundedOpacity = Math.max(0.08, Math.min(0.75, p.opacity));

        ctx.fillStyle = p.color;
        ctx.globalAlpha = boundedOpacity;

        if (p.symbol) {
          ctx.font = `600 ${Math.round(p.size)}px Inter, monospace`;
          ctx.fillText(p.symbol, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}

// 3D-Style Digital Cash Book, Analytics & Family Vault SVG Illustration
export const DEFAULT_ASTRONAUT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 420" fill="none">
  <defs>
    <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.38"/>
      <stop offset="60%" stop-color="#0d9488" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ledgerCover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="50%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="glassSurface" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="goldCoin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="emeraldBar" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>

  <!-- Ambient Halo -->
  <circle cx="190" cy="210" r="170" fill="url(#emeraldGlow)"/>

  <!-- Back Ledger Book Spine -->
  <rect x="74" y="88" width="210" height="254" rx="26" transform="rotate(-6 74 88)" fill="url(#ledgerCover)" stroke="#34d399" stroke-width="2" stroke-opacity="0.45"/>

  <!-- Main Digital Cash Book Card -->
  <rect x="88" y="82" width="214" height="258" rx="24" fill="url(#glassSurface)" stroke="#10b981" stroke-width="2.5" stroke-opacity="0.6"/>

  <!-- Top Balance Header Inside Ledger -->
  <rect x="108" y="104" width="174" height="58" rx="14" fill="#064e3b" stroke="#34d399" stroke-width="1.5" stroke-opacity="0.4"/>
  <text x="122" y="125" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="10" font-weight="bold" letter-spacing="1">FAMILY CASH BOOK</text>
  <text x="122" y="148" fill="#ffffff" font-family="monospace" font-size="18" font-weight="bold">Rp 12.450.000</text>

  <!-- Rising Bar Chart Section -->
  <rect x="108" y="176" width="174" height="84" rx="14" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
  <rect x="126" y="224" width="18" height="24" rx="5" fill="#0d9488" opacity="0.7"/>
  <rect x="154" y="210" width="18" height="38" rx="5" fill="#14b8a6" opacity="0.85"/>
  <rect x="182" y="198" width="18" height="50" rx="5" fill="url(#emeraldBar)"/>
  <rect x="210" y="206" width="18" height="42" rx="5" fill="#14b8a6" opacity="0.85"/>
  <rect x="238" y="188" width="18" height="60" rx="5" fill="url(#goldCoin)"/>
  <!-- Trend line -->
  <path d="M135 218 L163 204 L191 192 L219 198 L247 182" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="247" cy="182" r="4" fill="#fde68a"/>

  <!-- Ledger Transaction Rows -->
  <rect x="108" y="272" width="174" height="22" rx="7" fill="#1e293b"/>
  <circle cx="121" cy="283" r="5" fill="#10b981"/>
  <rect x="133" y="279" width="76" height="8" rx="4" fill="#94a3b8"/>
  <rect x="234" y="279" width="36" height="8" rx="4" fill="#34d399"/>

  <rect x="108" y="302" width="174" height="22" rx="7" fill="#1e293b"/>
  <circle cx="121" cy="313" r="5" fill="#f59e0b"/>
  <rect x="133" y="309" width="62" height="8" rx="4" fill="#94a3b8"/>
  <rect x="234" y="309" width="36" height="8" rx="4" fill="#fbbf24"/>

  <!-- Floating Gold Rp Coin (Top Left) -->
  <circle cx="68" cy="116" r="30" fill="url(#goldCoin)" stroke="#fef3c7" stroke-width="2.5"/>
  <circle cx="68" cy="116" r="23" fill="none" stroke="#92400e" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="68" y="123" text-anchor="middle" fill="#451a03" font-family="Arial, sans-serif" font-weight="900" font-size="19">Rp</text>

  <!-- Floating Security Shield Badge (Bottom Right) -->
  <circle cx="312" cy="296" r="32" fill="#065f46" stroke="#34d399" stroke-width="2.5"/>
  <path d="M312 276 L328 283 V295 C328 306 321 314 312 318 C303 314 296 306 296 295 V283 L312 276 Z" fill="#10b981" stroke="#a7f3d0" stroke-width="1.5"/>
  <path d="M305 296 L310 301 L320 290" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

export function SpaceLogin({
  title = "",
  subtitle,
  astronautSrc = DEFAULT_ASTRONAUT_IMAGE,
  onSubmit,
  className,
  defaultEmail = "",
  glassVariant = "default",
  customContent,
  topRightElement,
}: SpaceLoginProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;

    setIsLoading(true);
    try {
      if (onSubmit) {
        await onSubmit({ email, password, rememberMe });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } catch (err) {
      console.error("Sign in error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(16, 185, 129, 0.14) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(20, 184, 166, 0.14) 0%, transparent 45%), linear-gradient(160deg, #020908 0%, #041411 50%, #071c18 100%)",
      }}
      className={cn(
        "cashbook-auth-root relative min-h-[100dvh] w-full text-white flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-4 pt-16 pb-8 sm:py-10 select-none",
        className
      )}
    >
      {/* Top Right Slot (Language Switcher) */}
      {topRightElement && (
        <div className="fixed top-3.5 right-3.5 sm:top-6 sm:right-6 z-30">
          {topRightElement}
        </div>
      )}

      {/* Dynamic Financial Ledger & Particle Canvas */}
      <CosmicStarfield />

      {/* Emerald & Gold Wealth Horizon Glow at the bottom */}
      <div className="fixed -bottom-48 sm:-bottom-56 md:-bottom-64 left-1/2 -translate-x-1/2 w-[150vw] max-w-[1800px] h-[380px] sm:h-[480px] pointer-events-none z-0">
        <div
          className="w-full h-full rounded-[100%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(16, 185, 129, 0.48) 0%, rgba(13, 148, 136, 0.32) 28%, rgba(245, 158, 11, 0.12) 48%, rgba(4, 24, 20, 0.18) 68%, transparent 85%)",
            filter: "blur(32px)",
          }}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-5xl flex items-center justify-center my-auto">
        {/* Floating 3D Cash Book Illustration on Desktop Left */}
        <div className="hidden lg:block absolute left-0 xl:left-4 top-1/2 -translate-y-1/2 pointer-events-none z-20">
          <motion.div
            animate={{
              y: [-8, 10, -8],
            }}
            transition={{
              duration: 6.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <img
              src={astronautSrc}
              alt="Digital Cash Book Vault"
              className="w-56 xl:w-64 h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] select-none"
              draggable={false}
            />

            {/* Floating Telemetry Pill */}
            <div
              style={{
                background: "rgba(6, 28, 23, 0.88)",
                border: "1px solid rgba(52, 211, 153, 0.35)",
                backdropFilter: "blur(10px)",
              }}
              className="mt-2 mx-auto w-fit px-3.5 py-2 rounded-2xl flex items-center gap-2 shadow-xl"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-emerald-300/80 font-semibold uppercase tracking-wider">
                  Multi-Family Vault
                </div>
                <div className="text-xs text-white font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>100% Terisolasi & Aman</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Central Form Container */}
        <div className="relative z-10 w-full max-w-[460px] mx-auto flex flex-col items-center">
          {title && (
            <h1 className="text-2xl sm:text-[36px] font-extrabold tracking-tight text-white mb-4 sm:mb-5 text-center drop-shadow-sm font-sans">
              {title}
            </h1>
          )}

          {subtitle && (
            <p className="text-xs sm:text-sm text-neutral-300/90 -mt-2 mb-4 sm:mb-5 text-center max-w-[380px] leading-relaxed">
              {subtitle}
            </p>
          )}

          {customContent ? (
            <div className="w-full">{customContent}</div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="space-email"
                  className="text-base font-semibold text-neutral-200 tracking-wide select-none"
                >
                  Email
                </label>
                <GlassInput
                  id="space-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  variant={glassVariant}
                  borderRadius={14}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="space-password"
                  className="text-base font-semibold text-neutral-200 tracking-wide select-none"
                >
                  Password
                </label>
                <GlassInput
                  id="space-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant={glassVariant}
                  borderRadius={14}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ background: "transparent", border: "none" }}
                      className="p-1 text-neutral-400 hover:text-neutral-200 focus:outline-none transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  }
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpaceLogin;
