export interface FeatureFlags {
  sendEnabled: boolean;
  swapEnabled: boolean;
  simulationMode: boolean;
  copyTradingEnabled: boolean;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getFeatureFlags(): FeatureFlags {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultEnabled = !isProd; // enable by default in dev

  const sendEnabled = parseBool(process.env.FEATURE_SEND_ENABLED, defaultEnabled);
  const swapEnabled = parseBool(process.env.FEATURE_SWAP_ENABLED, defaultEnabled);
  const simulationMode = parseBool(process.env.FEATURE_SIMULATION_MODE, true);
  const copyTradingEnabled = parseBool(process.env.FEATURE_COPY_TRADING_ENABLED, defaultEnabled);

  return { sendEnabled, swapEnabled, simulationMode, copyTradingEnabled };
}

export function isSendEnabled() {
  return getFeatureFlags().sendEnabled;
}

export function isSwapEnabled() {
  return getFeatureFlags().swapEnabled;
}
