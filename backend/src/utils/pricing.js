export const calculatePumpPrice = (capacity) => {
  const base = 199;
  const variable = Number(capacity) * 0.03;
  return Number((base + variable).toFixed(2));
};

export const toUsdCents = (amountUsd) => Math.round(Number(amountUsd) * 100);
