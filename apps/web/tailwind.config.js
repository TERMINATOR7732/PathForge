/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'pf-bg-app': 'var(--pf-bg-app)',
        'pf-bg-canvas': 'var(--pf-bg-canvas)',
        'pf-bg-panel': 'var(--pf-bg-panel)',
        'pf-bg-panel-raised': 'var(--pf-bg-panel-raised)',
        'pf-border-subtle': 'var(--pf-border-subtle)',
        'pf-border-default': 'var(--pf-border-default)',
        'pf-border-strong': 'var(--pf-border-strong)',
        'pf-text-primary': 'var(--pf-text-primary)',
        'pf-text-secondary': 'var(--pf-text-secondary)',
        'pf-text-muted': 'var(--pf-text-muted)',
        'pf-accent': 'var(--pf-accent)',
        'pf-success': 'var(--pf-success)',
        'pf-warning': 'var(--pf-warning)',
        'pf-danger': 'var(--pf-danger)',
        'pf-info': 'var(--pf-info)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          '"Roboto Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
