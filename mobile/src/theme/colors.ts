/**
 * Lycoris' shared colour language.
 *
 * The named brand colours mirror the web CSS variables. Semantic aliases keep
 * screens readable and make it possible to evolve the palette without hunting
 * for individual hex values throughout the app.
 */
export const brandColors = {
  ink: '#5a3850',
  lilac: '#d0bcff',
  blush: '#fcddec',
  pin: '#eca7ce',
} as const;

export const colors = {
  // Foundations
  background: '#f6f6f6',
  backgroundTint: '#f8ebff',
  surface: '#ffffff',
  surfaceMuted: '#fbf8fb',
  surfacePressed: '#f5eff5',

  // Content
  textPrimary: '#1d1b20',
  textSecondary: 'rgba(90, 56, 80, 0.76)',
  textMuted: 'rgba(90, 56, 80, 0.76)',
  onPrimary: '#ffffff',

  // Structure
  border: 'rgba(122, 75, 143, 0.12)',
  borderStrong: 'rgba(122, 75, 143, 0.36)',
  divider: 'rgba(90, 56, 80, 0.10)',

  // Brand and interactive states
  primary: brandColors.ink,
  primaryHover: '#472c3f',
  secondary: brandColors.lilac,
  accent: '#7a4b8f',
  lilac: brandColors.lilac,
  blush: brandColors.blush,
  pin: brandColors.pin,
  primarySoft: '#efe8ff',
  blushSoft: '#fff0f7',
  pinSoft: '#f9dced',

  // Navigation and elevation
  navSurface: 'rgba(255, 255, 255, 0.96)',
  navIndicator: brandColors.lilac,
  shadow: 'rgba(70, 40, 84, 0.14)',
  scrim: 'rgba(37, 20, 32, 0.34)',

  // Feedback
  success: '#2f7652',
  danger: '#b3261e',
  warning: '#9a5d00',
} as const;
