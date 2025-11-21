/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: 'var(--brand-yellow)',
          black: 'var(--brand-black)',
          gray: 'var(--brand-dark-gray)',
          light: 'var(--brand-light-gray)',
          white: 'var(--brand-white)',
        },
        binance: {
          yellow: 'var(--binance-yellow)',
          yellowDark: 'var(--binance-yellow-dark)',
          yellowLight: 'var(--binance-yellow-light)',
          green: 'var(--binance-green)',
          red: 'var(--binance-red)',
        },
        surface: {
          background: 'var(--background)',
          elevated: 'var(--background-elevated)',
          panel: 'var(--panel-bg)',
          panelHover: 'var(--panel-bg-hover)',
          border: 'var(--panel-border)',
          borderHover: 'var(--panel-border-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
        },
        status: {
          profit: 'var(--binance-green)',
          loss: 'var(--binance-red)',
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
      },
    },
  },
};

export default preset;

