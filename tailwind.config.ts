import type { Config } from "tailwindcss";

// design 폴더 시안(Stitch)의 tailwind-config 값 중 이 앱에서 쓰는 색·글꼴만 옮겼습니다.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
        "text-muted": "#94A3B8",
        "surface-bg": "#F8FAFC",
        "surface-card": "#FFFFFF",
        "surface-subtle": "#F1F5F9",
        "border-default": "#E2E8F0",
        "border-strong": "#CBD5E1",
        "status-normal": "#059669",
        "status-normal-bg": "#ECFDF5",
        "status-normal-border": "#A7F3D0",
        "status-caution": "#D97706",
        "status-caution-bg": "#FFFBEB",
        "status-caution-border": "#FDE68A",
        "status-critical": "#E11D48",
        "status-critical-bg": "#FFF1F2",
        "status-critical-border": "#FECDD3",
        brand: "#0051d5",
        "brand-soft": "#dbe1ff",
        sidebar: "#000000",
        "sidebar-active": "#2563eb",
      },
      fontFamily: {
        sans: ["Inter", "Malgun Gothic", "Apple SD Gothic Neo", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "Malgun Gothic", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
