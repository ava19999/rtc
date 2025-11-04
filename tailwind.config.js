/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Chakra+Petch', 'sans-serif'],
      },
      colors: {
        electric: '#00BFFF', // Deep Sky Blue / Electric Blue
        lime: '#32CD32',     // Lime Green
        magenta: '#FF00FF',  // Magenta
      },
    },
  },
  plugins: [],
}