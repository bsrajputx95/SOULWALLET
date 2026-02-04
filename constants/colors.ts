export const COLORS = {
  // Core background
  background: "#0B0F1F",
  
  // Text colors
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B7C3",
  text: "#FFFFFF", // Alias for textPrimary
  primary: "#9945FF", // Primary brand color
  
  // Chain-specific colors
  solana: "#9945FF", // Neon Purple/Violet
  ethereum: "#F0F0F0", // Glowing White
  binance: "#F0B90B", // Golden Yellow/Bronze
  usdc: "#2775CA", // Electric Blue
  wif: "#00FF7F", // Fluorescent Green
  

  
  // UI elements
  cardBackground: "#131A35",
  inputBackground: "#1A2332", // Added missing inputBackground
  border: "#2A3441",
  success: "#00FF7F", // Fluorescent Green
  error: "#FF3D71",
  warning: "#FFAA00",
  white: "#FFFFFF",
  
  // Gradients
  gradientPurple: ["#9945FF", "#14F195"] as const,
  gradientBlue: ["#2775CA", "#14F195"] as const,
  gradientPink: ["#FF3D71", "#9945FF"] as const,
  gradientGold: ["#FFD700", "#FFA500"] as const,
  
  // Neon glows
  glowPurple: "#9945FF80",
  glowGreen: "#14F19580",
  glowBlue: "#2775CA80",
  glowGold: "#FFD70080",
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.glowPurple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.glowPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.glowPurple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 13.97,
    elevation: 10,
  },
};