/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  safelist: [
    'bg-[#39E35D]', 'dark:bg-[#123B22]', 'text-[#123B22]', 'dark:text-[#4AFF7A]',
    'bg-[#FF3B3B]', 'dark:bg-[#3D1414]', 'text-[#FFFFFF]', 'dark:text-[#FF5C5C]',
    'bg-[#2E8BFF]', 'dark:bg-[#1E3A8A]', 'dark:text-[#4FA3FF]',
    'bg-[#FFB800]', 'dark:bg-[#3D2E05]', 'text-[#3D2E05]', 'dark:text-[#FFCB3D]',
    'bg-[#22D3EE]', 'dark:bg-[#053A44]', 'text-[#053A44]', 'dark:text-[#67E8F9]',
    'bg-[#00D0B6]', 'dark:bg-[#003B33]', 'text-[#003B33]', 'dark:text-[#33FFEB]',
    'bg-[#A855F7]', 'dark:bg-[#3B0764]', 'text-[#3B0764]', 'dark:text-[#D8B4FE]',
    'bg-[#EC4899]', 'dark:bg-[#500724]', 'text-[#500724]', 'dark:text-[#FBCFE8]',
    'bg-[#F97316]', 'dark:bg-[#431407]', 'text-[#431407]', 'dark:text-[#FDBA74]',
    'bg-[#6366F1]', 'dark:bg-[#1E1B4B]', 'text-[#1E1B4B]', 'dark:text-[#A5B4FC]',
    'bg-current'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
        'pill': '9999px',
      },
      colors: {
        fw: {
          green:  { DEFAULT: '#39E35D', dark: '#4AFF7A', deep: '#123B22' },
          pink:   { DEFAULT: '#FF3EA5', dark: '#FF5CB8', deep: '#3A1B2E' },
          purple: { DEFAULT: '#9B6BFF', dark: '#B388FF', deep: '#241B3D' },
          blue:   { DEFAULT: '#2E8BFF', dark: '#4FA3FF', deep: '#1E3A8A' },
          teal:   { DEFAULT: '#00D9C0', dark: '#1FF5DB', deep: '#0F3D38' },
          amber:  { DEFAULT: '#FFB800', dark: '#FFCB3D', deep: '#3D2E05' },
          red:    { DEFAULT: '#FF3B3B', dark: '#FF5C5C', deep: '#3D1414' },
          black:  { DEFAULT: '#0A0A0A', dark: '#000000' },
          white:  { DEFAULT: '#FFFFFF', dark: '#1A1A1A', off: '#F7F7F7' },
          grey:   { DEFAULT: '#EDEDED', dark: '#333333', muted: '#6B7280', mutedDark: '#9CA3AF' },
        },

        // AP AutoFlow Finewise-derived bright palette
        fw: {
          green:  { DEFAULT: '#39E35D', dark: '#4AFF7A', deep: '#123B22' },
          pink:   { DEFAULT: '#FF3EA5', dark: '#FF5CB8', deep: '#3A1B2E' },
          purple: { DEFAULT: '#9B6BFF', dark: '#B388FF', deep: '#241B3D' },
          blue:   { DEFAULT: '#2E8BFF', dark: '#4FA3FF', deep: '#1E3A8A' },
          teal:   { DEFAULT: '#00D9C0', dark: '#1FF5DB', deep: '#0F3D38' },
          amber:  { DEFAULT: '#FFB800', dark: '#FFCB3D', deep: '#3D2E05' },
          red:    { DEFAULT: '#FF3B3B', dark: '#FF5C5C', deep: '#3D1414' },
          black:  { DEFAULT: '#0A0A0A', dark: '#000000' },
          white:  { DEFAULT: '#FFFFFF', dark: '#1A1A1A', off: '#F7F7F7' },
          grey:   { DEFAULT: '#EDEDED', dark: '#333333', muted: '#6B7280', mutedDark: '#9CA3AF' },
        },
        status: {
          approved: 'var(--status-approved)',
          rejected: 'var(--status-rejected)',
          pending: 'var(--status-pending)',
          info: 'var(--status-info)',
        },
      
  safelist: [
    'bg-[#39E35D]', 'dark:bg-[#123B22]', 'text-[#123B22]', 'dark:text-[#4AFF7A]',
    'bg-[#FF3B3B]', 'dark:bg-[#3D1414]', 'text-[#FFFFFF]', 'dark:text-[#FF5C5C]',
    'bg-[#2E8BFF]', 'dark:bg-[#1E3A8A]', 'dark:text-[#4FA3FF]',
    'bg-[#FFB800]', 'dark:bg-[#3D2E05]', 'text-[#3D2E05]', 'dark:text-[#FFCB3D]',
    'bg-[#22D3EE]', 'dark:bg-[#053A44]', 'text-[#053A44]', 'dark:text-[#67E8F9]',
    'bg-[#00D0B6]', 'dark:bg-[#003B33]', 'text-[#003B33]', 'dark:text-[#33FFEB]',
    'bg-[#A855F7]', 'dark:bg-[#3B0764]', 'text-[#3B0764]', 'dark:text-[#D8B4FE]',
    'bg-[#EC4899]', 'dark:bg-[#500724]', 'text-[#500724]', 'dark:text-[#FBCFE8]',
    'bg-[#F97316]', 'dark:bg-[#431407]', 'text-[#431407]', 'dark:text-[#FDBA74]',
    'bg-[#6366F1]', 'dark:bg-[#1E1B4B]', 'text-[#1E1B4B]', 'dark:text-[#A5B4FC]',
    'bg-current'
  ],
  theme: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error: 'var(--color-error)',
          info: 'var(--color-info)',
          neutral: 'var(--color-neutral)',
        },
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
        },
      },
      animation: {
        'scan-sweep':     'scanSweep 6s infinite linear',
        'pulse-glow':     'pulseGlow 8s infinite ease-in-out',
        'float-gentle':   'floatGentle 5s infinite ease-in-out',

        'fade-in':        'fadeIn 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 220ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-out-right':'slideOutRight 180ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'fade-backdrop':  'fadeBackdrop 200ms ease forwards',
        'scale-in':       'scaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        scanSweep: {
          '0%, 100%': { top: '0%', opacity: '0.8' },
          '50%': { top: '100%', opacity: '0.8' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(1.05)' },
        },
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(1deg)' },
        },

        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          from: { opacity: '1', transform: 'translateX(0)' },
          to:   { opacity: '0', transform: 'translateX(100%)' },
        },
        fadeBackdrop: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
