/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Amazon orange ramp. `brand-500` is the exact Amazon Orange and
        // `brand-700` is the hover tone used on orange buttons.
        brand: {
          50: "#fff8ec",
          100: "#ffedcc",
          200: "#ffdb99",
          300: "#ffc966",
          400: "#ffb433",
          500: "#ff9900",
          600: "#e88a00",
          700: "#c7511f",
          800: "#9c3f18",
          900: "#7a3113",
        },
        // Amazon header / nav bar family.
        navy: {
          700: "#37475a",
          800: "#232f3e",
          900: "#131a22",
        },
        link: {
          DEFAULT: "#007185",
          hover: "#c7511f",
        },
        ink: "#0f1111",
        surface: "#eaeded",
      },
      fontFamily: {
        sans: ["Tahoma", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
