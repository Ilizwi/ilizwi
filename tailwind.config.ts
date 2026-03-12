import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vault (dark shell)
        vault: {
          bg: "#0C0C0D",
          surface: "#161618",
          text: "#E8E2D9",
          muted: "#8B8680",
        },
        // Desk (light workspace)
        desk: {
          bg: "#F7F9FA",
          sheet: "#FFFFFF",
          text: "#1A1A24",
          border: "rgba(15, 23, 42, 0.08)",
        },
        // Accent
        historic: "#4A5D4E",
      },
      fontFamily: {
        serif: ["Playfair Display", "Newsreader", "serif"],
        sans: ["Inter", "Geist", "sans-serif"],
      },
      borderRadius: {
        ui: "4px",
        sheet: "8px",
      },
      boxShadow: {
        desk: "0 40px 80px rgba(0, 0, 0, 0.03)",
      },
      transitionDuration: {
        page: "1200ms",
        hover: "300ms",
        underline: "400ms",
      },
    },
  },
  plugins: [],
};

export default config;
