/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Surfaces — warm sand paper (Figma redesign, June 2026) ─────────────
        surface: {
          DEFAULT: 'var(--app-bg)',   // palette-aware app background (warm, cool for slate)
          subtle:  'var(--surface-subtle)',   // palette-aware — tags / section separators
          card:    'var(--surface)',  // palette-aware cards
          elevated:'var(--surface)',  // palette-aware near-white for inputs
          border:  '#EBE2D6',   // soft warm border (kept static — has an alpha modifier usage)
          strong:  '#D4C5B5',   // stronger dividers
        },

        // ── Text — palette-aware hierarchy (warm sand / cool slate via --text-*) ─
        text: {
          primary:   'var(--text-primary)',    // headings
          secondary: 'var(--text-secondary)',  // body
          muted:     'var(--text-muted)',       // captions / inactive icons
          faint:     '#C4B5A8',   // faint stone — inactive (rare; kept static)
          inverse:   '#F5EDE2',   // warm cream — text on dark tiles
        },

        // ── Accent — palette-aware (follows the user's style color via --sp) ──
        accent: {
          DEFAULT: 'rgb(var(--sp-rgb) / <alpha-value>)',
          hover:   'var(--sp-hover)',
          dim:     'rgb(var(--sp-rgb) / <alpha-value>)',
          faint:   'var(--sp-light)',
        },

        // ── Ink — near-black tiles (Figma quick-action cards) ─────────────────
        ink: {
          DEFAULT: '#1E1C16',   // near-black warm — dark tiles
          hover:   '#252820',
        },

        // ── Terra — palette-aware (follows the user's style color via --sp) ───
        terra: {
          DEFAULT: 'rgb(var(--sp-rgb) / <alpha-value>)',
          light:   'rgb(var(--sp-rgb) / <alpha-value>)',
          faint:   'var(--sp-light)',
        },

        // ── Gold — dusty gold (Stitch accent for milestones) ─────────────────
        gold: {
          DEFAULT: '#D4A355',
          light:   '#F0D49A',
        },

        // ── Calm — soft periwinkle (Emora / AI moments) ─────────────────────
        calm: {
          DEFAULT: '#6B6FB4',
          dim:     '#5458A0',
          faint:   '#EEEEF8',
        },

        // ── Emotional states ─────────────────────────────────────────────────
        state: {
          stable:    '#4E7A3A',   // darker sage
          activated: '#C06C54',   // terracotta — matches Stitch palette
          crisis:    '#A02828',   // muted red
        },
      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['"Satoshi"', '"Nunito"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', '"Lora"', 'Georgia', 'serif'],
      },

      fontSize: {
        'display':  ['2rem',      { lineHeight: '1.15', letterSpacing: '-0.03em',  fontWeight: '800' }],
        'h1':       ['1.625rem',  { lineHeight: '1.2',  letterSpacing: '-0.025em', fontWeight: '700' }],
        'h2':       ['1.25rem',   { lineHeight: '1.25', letterSpacing: '-0.018em', fontWeight: '700' }],
        'h3':       ['1.0625rem', { lineHeight: '1.35', letterSpacing: '-0.01em',  fontWeight: '600' }],
        'body-lg':  ['1rem',      { lineHeight: '1.65', letterSpacing: '0',        fontWeight: '400' }],
        'body':     ['0.9375rem', { lineHeight: '1.6',  letterSpacing: '0',        fontWeight: '400' }],
        'body-sm':  ['0.875rem',  { lineHeight: '1.55', letterSpacing: '0.005em',  fontWeight: '400' }],
        'caption':  ['0.75rem',   { lineHeight: '1.4',  letterSpacing: '0.01em',   fontWeight: '500' }],
        'label':    ['0.6875rem', { lineHeight: '1.2',  letterSpacing: '0.08em',   fontWeight: '700' }],
        '2xs':      ['0.65rem',   { lineHeight: '1rem' }],
      },

      boxShadow: {
        'card':    '0 1px 3px rgba(44,55,40,0.06), 0 4px 16px rgba(44,55,40,0.05)',
        'card-md': '0 4px 20px rgba(74,55,40,0.08), 0 2px 8px rgba(44,55,40,0.05)',
        'elevated':'0 8px 32px rgba(74,55,40,0.12), 0 2px 8px rgba(44,55,40,0.08)',
        'glow':    '0 0 24px rgba(74,103,65,0.22)',
        'glow-sm': '0 0 12px rgba(74,103,65,0.14)',
        'glass':   '0 8px 32px 0 rgba(192,108,84,0.15)',
        'coral':   '0 8px 24px -4px rgba(192,108,84,0.3)',
        'clay':    '0 4px 12px -2px rgba(93,64,55,0.1)',
      },

      animation: {
        'fade-in':   'fadeIn 0.42s ease-out both',
        'slide-up':  'slideUp 0.42s ease-out both',
        'slide-down':'slideDown 0.38s ease-out both',
        'scale-in':  'scaleIn 0.32s ease-out both',
        'spring-in': 'springIn 0.52s cubic-bezier(0.34,1.38,0.64,1) both',
        'pulse-slow':'pulse 3s ease-in-out infinite',
        'shimmer':   'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from:{ opacity:'0' },                               to:{ opacity:'1' } },
        slideUp:  { from:{ opacity:'0', transform:'translateY(12px)' },  to:{ opacity:'1', transform:'none' } },
        slideDown:{ from:{ opacity:'0', transform:'translateY(-8px)' },   to:{ opacity:'1', transform:'none' } },
        scaleIn:  { from:{ opacity:'0', transform:'scale(0.95)' },       to:{ opacity:'1', transform:'scale(1)' } },
        springIn: { from:{ opacity:'0', transform:'scale(0.88)' },       to:{ opacity:'1', transform:'scale(1)' } },
        shimmer:  {
          '0%':   { backgroundPosition:'-200% 0' },
          '100%': { backgroundPosition:'200% 0'  },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34,1.4,0.64,1)',
        'snappy': 'cubic-bezier(0.25,0.46,0.45,0.94)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        'organic': '255px 15px 225px 15px / 15px 225px 15px 255px',
        'leaf':    '16px 4px 16px 4px',
        'stone':   '24px 20px 28px 22px',
      },
    },
  },
  plugins: [],
}
