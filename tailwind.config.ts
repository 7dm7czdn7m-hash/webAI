import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans]
      },
      colors: {
        background: "hsl(240 10% 4%)",
        foreground: "hsl(210 40% 98%)",
        muted: {
          DEFAULT: "hsl(240 5% 20%)",
          foreground: "hsl(210 20% 80%)"
        },
        card: {
          DEFAULT: "hsl(240 5% 10%)",
          foreground: "hsl(210 40% 98%)"
        }
      }
    }
  },
  plugins: []
};

export default config;
