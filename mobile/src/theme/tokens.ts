import type { TextStyle, ViewStyle } from 'react-native';
import { colors } from './colors';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  input: 14,
  card: 16,
  dialog: 18,
  floating: 24,
  pill: 999,
} as const;

export const sizes = {
  touchTarget: 44,
  compactTouchTarget: 40,
  floatingNavigationHeight: 68,
  contentMaxWidth: 720,
} as const;

/**
 * Typography intentionally relies on the platform sans-serif stack. It keeps
 * Chinese glyph coverage reliable while weight, spacing, and rounded surfaces
 * carry the friendly Fredoka-like character used by the web app.
 */
export const typography = {
  logo: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
} satisfies Record<string, TextStyle>;

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  floating: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },
  dialog: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
} satisfies Record<string, ViewStyle>;
