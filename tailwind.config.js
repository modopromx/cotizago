/** @type {import('tailwindcss').Config} */
// Paleta oficial Cotiza Go (Sprint 1). Anclas exactas de la marca:
//   turquesa #08AEB6 · cian #17C5C9 · navy #06213B · azul profundo #07162B
//   azul #0B6DAD · verde éxito #19A974 · fondo #F3F6F9
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Turquesa de marca — color primario de acentos y botones
        primary: {
          50:  '#e7f9fa',
          100: '#c3f1f2',
          200: '#8fe6e8',
          300: '#4fd7db',
          400: '#17C5C9', // cian oficial
          500: '#08AEB6', // turquesa oficial
          600: '#078f96',
          700: '#0a7176',
          800: '#0d5a5e',
          900: '#0f4a4d',
          950: '#052e30',
        },
        // Navy — fondo del menú lateral oscuro y textos fuertes
        navy: {
          50:  '#eff3f8',
          100: '#dae3ef',
          200: '#b8cae0',
          300: '#8ba7cb',
          400: '#5b7fae',
          500: '#3a5f92',
          600: '#2b4a76',
          700: '#243c5f',
          800: '#1a2d48',
          900: '#06213B', // navy oficial
          950: '#07162B', // azul profundo oficial
        },
        // Azul de enlaces / gráficas secundarias
        azul: {
          50:  '#eaf4fb',
          100: '#cfe6f6',
          200: '#a3d0ee',
          300: '#6bb3e2',
          400: '#3a92d1',
          500: '#0B6DAD', // azul oficial
          600: '#095a91',
          700: '#0a4a76',
          800: '#0c3e61',
          900: '#0e3452',
        },
        // Verde de estados de éxito (aceptada, activo, pagado)
        success: {
          50:  '#e8f8f0',
          100: '#c7eeda',
          200: '#93ddb8',
          300: '#57c891',
          400: '#2eb47a',
          500: '#19A974', // verde éxito oficial
          600: '#138a5f',
          700: '#136e4d',
          800: '#12573e',
          900: '#0f4834',
        },
        // Fondo neutro de la app
        fondo: '#F3F6F9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(6 33 59 / 0.06), 0 1px 2px -1px rgb(6 33 59 / 0.08)',
        'card-hover': '0 8px 24px -6px rgb(6 33 59 / 0.12)',
      },
    },
  },
  plugins: [],
}
