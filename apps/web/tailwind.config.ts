import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Variation C: Cormorant Garamond (serif headings) + Manrope (sans body)
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-manrope)", "Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        // Brand palette — confirm exact values against docs/06_Couple_Landing_Page_Designs_v1.html
        aubergine: {
          DEFAULT: "#6B3F5C",
          50: "#F7F1F5",
          100: "#EBDDE5",
          200: "#D6BACB",
          300: "#BC93AC",
          400: "#9D6B89",
          500: "#7E4D6E",
          600: "#6B3F5C",
          700: "#56324A",
          800: "#3F2436",
          900: "#291723",
        },
      },
    },
  },
  plugins: [],
};

export default config;
