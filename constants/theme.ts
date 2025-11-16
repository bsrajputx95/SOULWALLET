import { COLORS, SHADOWS } from './colors';

export const SIZES = {
  xSmall: 10,
  small: 12,
  medium: 16,
  large: 20,
  xLarge: 24,
  xxLarge: 32,
};

export const FONTS = {
  // Phantom-style fonts
  phantomBold: {
    fontFamily: "System",
    fontWeight: "700" as const,
  },
  phantomSemiBold: {
    fontFamily: "System",
    fontWeight: "600" as const,
  },
  phantomMedium: {
    fontFamily: "System",
    fontWeight: "500" as const,
  },
  phantomRegular: {
    fontFamily: "System",
    fontWeight: "400" as const,
  },
  // Aliases for common font weights
  bold: "System",
  semiBold: "System", 
  medium: "System",
  regular: "System",
  mono: "monospace", // Added missing mono alias
  // Keep monospace for numbers
  monospace: {
    fontFamily: "monospace",
    fontWeight: "400" as const,
  },
  // Legacy support (will be replaced gradually)
  orbitronBold: {
    fontFamily: "System",
    fontWeight: "700" as const,
  },
  orbitronMedium: {
    fontFamily: "System",
    fontWeight: "600" as const,
  },
  orbitronRegular: {
    fontFamily: "System",
    fontWeight: "500" as const,
  },
  sfProBold: {
    fontFamily: "System",
    fontWeight: "700" as const,
  },
  sfProMedium: {
    fontFamily: "System",
    fontWeight: "500" as const,
  },
  sfProRegular: {
    fontFamily: "System",
    fontWeight: "400" as const,
  },
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  // Aliases for consistency
  sm: 8,  // Alias for s
  md: 16, // Alias for m
  lg: 24, // Alias for l
};

export const BORDER_RADIUS = {
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 24,
  full: 9999,
  // Aliases for consistency
  lg: 16, // Alias for large
  xl: 24, // Alias for extraLarge
  md: 12, // Alias for medium
};

export default { COLORS, SIZES, FONTS, SHADOWS, SPACING, BORDER_RADIUS };