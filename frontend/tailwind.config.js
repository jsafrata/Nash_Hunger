/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0c11",
        surface: "#13161e",
        elevated: "#1a1e28",
        line: "#252a36",
        muted: "#7c8390",
        text: "#e8eaf0",
        accent: "#f5b914",
        bid: "#34d399",
        ask: "#f87171",
        danger: "#ef4444",
        warn: "#fbbf24",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
