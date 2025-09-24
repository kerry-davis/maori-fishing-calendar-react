/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "main-500": "#0AA689",
        "main-600": "#088F75",
        primary: {
          50: "#ecfdf7",
          100: "#cffae9",
          200: "#a0f3d6",
          300: "#69e6c1",
          400: "#3fd3ac",
          500: "#0AA689",
          600: "#088F75",
          700: "#087862",
          800: "#085f51",
          900: "#064d44",
        },
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      boxShadow: {
        soft: "0 2px 6px rgba(0,0,0,0.06)",
        lift: "0 8px 24px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "Apple Color Emoji", "Segoe UI Emoji"],
      },
    },
  },
};
