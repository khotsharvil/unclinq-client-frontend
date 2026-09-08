/**
 * CLIENT DESIGN TOKENS (ported from the B2C app — design values only).
 * Feature/philosophy-specific tokens (rescue, plant, phases) intentionally omitted.
 * Prefer the CSS vars + tailwind classes; use these for inline-style parity.
 *
 *   import { color, shadow, radius, type } from '../design-system/tokens'
 */

export const color = {
  surface: { page: '#FDF9F5', card: '#FFFAF7', elevated: '#FFFAF7', subtle: '#EBE0D5', cream2: '#F5EDE2' },
  text: {
    primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)',
    inverse: '#F5EDE2', inverseDim: 'rgba(245,237,226,0.7)',
  },
  terra: { DEFAULT: '#C05B3A', hover: '#A84E30', light: '#C4856B', soft: '#F5EDE6',
    faint: 'rgba(192,91,58,0.1)', glow: 'rgba(192,91,58,0.3)' },
  sage: { DEFAULT: '#8F9779', light: '#A4AC86', dark: '#6B7860' },
  gold: { DEFAULT: '#D4AF37', light: '#F0D49A' },
  state: { stable: '#4E7A3A', stableBg: 'rgba(78,122,58,0.08)', activated: '#C06C54', crisis: '#A02828' },
  border: { DEFAULT: '#E8DDD7', hover: '#D4C5B5', strong: '#D4C5B5' },
  dark: { DEFAULT: '#1E1C16', card: '#252820', text: '#F5EDE2' },
}

export const shadow = {
  card: '0 4px 8px rgba(0,0,0,0.06)',
  cardHover: '0 6px 16px rgba(0,0,0,0.08)',
  btn: '0 1px 2px rgba(28,23,19,0.12), 0 2px 8px rgba(192,91,58,0.18)',
  dark: '0 6px 10px rgba(0,0,0,0.18)',
}

export const radius = { sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '16px', '3xl': '24px', full: '9999px' }

export const type = {
  family: { serif: '"Newsreader", "Lora", Georgia, serif', sans: '"Satoshi", "Nunito", system-ui, sans-serif' },
  scale: {
    hero:      { fontSize: '2.25rem',  fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 },
    cardTitle: { fontSize: '1.5rem',   fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.3 },
    h2:        { fontSize: '1.25rem',  fontWeight: 700, letterSpacing: '-0.018em', lineHeight: 1.25 },
    body:      { fontSize: '0.9375rem',fontWeight: 400, lineHeight: 1.6 },
    bodySm:    { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.55 },
    label:     { fontSize: '0.6875rem',fontWeight: 700, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase' },
  },
}

export const space = { pagePx: '24px', cardPad: '24px', cardPadMd: '20px', cardPadSm: '16px', navClear: '128px' }

export const motion = {
  press: { card: 'active:scale-[0.98]', button: 'active:scale-[0.97]', cardSm: 'active:scale-[0.99]' },
}
