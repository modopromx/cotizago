/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef9f5',
          100: '#d6f0e6',
          200: '#b0e1d0',
          300: '#7ecab5',
          400: '#4aac95',
          500: '#2e8f7b',
          600: '#1e7363',
          700: '#195d51',
          800: '#164a41',
          900: '#133d36',
          950: '#0a2420',
        },
        navy: {
          50:  '#f0f4fa',
          100: '#dce6f4',
          200: '#c0d0ea',
          300: '#95b1da',
          400: '#648bc5',
          500: '#426cb0',
          600: '#305395',
          700: '#274279',
          800: '#243865',
          900: '#1a2849',
          950: '#111a31',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}