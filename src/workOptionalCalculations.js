import { calculateDetailedWorkOptional } from "./workOptionalDetailedTax.js";

export const MONTHLY_MODEL_RATE = 0.05;

export const TAX_ASSUMPTION =
  "This calculator uses simplified effective federal and state income tax estimates. It assumes all included income is taxed at the same combined effective rate. Actual taxes may differ.";

const MAX_CENT_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER / 100;
const DECIMAL_INPUT = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

const FIELD_RULES = [
  ["monthlyExpenses", "Monthly recurring living expenses", 0, null],
  ["federalTaxPercent", "Federal effective tax rate", 0, 100],
  ["stateTaxPercent", "State effective tax rate", 0, 100],
  ["otherGrossPassiveIncome", "Other gross passive income", 0, null],
  ["bufferPercent", "Extra income buffer", 0, 100]
];

function parseNonnegativeDecimal(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!DECIMAL_INPUT.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateWorkOptionalInputs(rawInputs) {
  const values = {};
  const errors = {};

  for (const [key, label, minimum, maximum] of FIELD_RULES) {
    const value = parseNonnegativeDecimal(rawInputs?.[key]);

    if (value === null) {
      errors[key] = "Enter a valid, finite number for " + label.toLowerCase() + ".";
      continue;
    }
    if (value < minimum || (maximum !== null && value > maximum)) {
      errors[key] = maximum === null
        ? label + " must be $0 or greater."
        : label + " must be between 0% and 100%.";
      continue;
    }
    values[key] = value;
  }

  if (Object.keys(errors).length === 0 && values.federalTaxPercent + values.stateTaxPercent >= 100) {
    errors.combinedTaxRate = "The combined federal and state effective tax rate must be below 100%.";
  }

  return { valid: Object.keys(errors).length === 0, values, errors };
}

export function roundUpToCent(value) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_CENT_SAFE_AMOUNT) return null;
  if (value === 0) return 0;
  return Math.ceil(value * 100) / 100;
}

export function calculateWorkOptional(rawInputs, currentDeployedPrincipal = null, options = {}) {
  if (options.mode === "detailed") {
    return calculateDetailedWorkOptional(rawInputs, options.detailed, currentDeployedPrincipal);
  }
  const validation = validateWorkOptionalInputs(rawInputs);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  const {
    monthlyExpenses,
    federalTaxPercent,
    stateTaxPercent,
    otherGrossPassiveIncome,
    bufferPercent
  } = validation.values;

  const combinedTaxPercent = federalTaxPercent + stateTaxPercent;
  const combinedTaxRate = combinedTaxPercent / 100;
  const requiredBufferIncome = monthlyExpenses * bufferPercent / 100;
  const requiredNetIncome = monthlyExpenses * (1 + bufferPercent / 100);
  const requiredGrossIncome = requiredNetIncome / (1 - combinedTaxRate);
  const requiredModelPayout = Math.max(0, requiredGrossIncome - otherGrossPassiveIncome);
  const requiredPrincipal = requiredModelPayout / MONTHLY_MODEL_RATE;
  const annualModelPayout = requiredModelPayout * 12;
  const actualGrossIncome = requiredModelPayout + otherGrossPassiveIncome;
  const estimatedMonthlyTaxes = actualGrossIncome * combinedTaxRate;
  const actualNetIncome = actualGrossIncome - estimatedMonthlyTaxes;
  const monthlySurplus = Math.max(0, actualNetIncome - requiredNetIncome);
  const actualExtraIncome = actualNetIncome - monthlyExpenses;

  const financialAmounts = [
    requiredBufferIncome,
    requiredNetIncome,
    requiredGrossIncome,
    requiredModelPayout,
    requiredPrincipal,
    annualModelPayout,
    actualGrossIncome,
    estimatedMonthlyTaxes,
    actualNetIncome,
    monthlySurplus,
    actualExtraIncome
  ];

  if (financialAmounts.some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_CENT_SAFE_AMOUNT)) {
    return {
      valid: false,
      errors: { calculation: "These inputs produce amounts too large for reliable cent-accurate calculations. Reduce the amounts or tax rates." }
    };
  }

  const actionableRequiredPrincipal = roundUpToCent(requiredPrincipal);
  let progress = null;

  if (typeof currentDeployedPrincipal === "number" &&
    Number.isFinite(currentDeployedPrincipal) &&
    currentDeployedPrincipal >= 0 &&
    currentDeployedPrincipal <= MAX_CENT_SAFE_AMOUNT) {
    const currentModelPayout = currentDeployedPrincipal * MONTHLY_MODEL_RATE;
    const remainingPrincipal = Math.max(0, requiredPrincipal - currentDeployedPrincipal);
    const achievementPercent = requiredPrincipal > 0
      ? (currentDeployedPrincipal / requiredPrincipal) * 100
      : null;

    if (achievementPercent === null || Number.isFinite(achievementPercent)) {
      progress = {
        currentDeployedPrincipal,
        currentModelPayout,
        remainingPrincipal,
        actionableRemainingPrincipal: roundUpToCent(remainingPrincipal),
        achievementPercent,
        progressBarPercent: achievementPercent === null ? 100 : Math.min(100, achievementPercent),
        targetAlreadyCovered: requiredPrincipal === 0
      };
    }
  }

  return {
    valid: true,
    errors: {},
    monthlyExpenses,
    federalTaxPercent,
    stateTaxPercent,
    otherGrossPassiveIncome,
    bufferPercent,
    combinedTaxPercent,
    combinedTaxRate,
    requiredBufferIncome,
    requiredNetIncome,
    requiredGrossIncome,
    requiredModelPayout,
    requiredPrincipal,
    actionableRequiredPrincipal,
    annualModelPayout,
    actualGrossIncome,
    estimatedMonthlyTaxes,
    actualNetIncome,
    monthlySurplus,
    actualExtraIncome,
    requiresNoModelPrincipal: requiredPrincipal === 0,
    otherPassiveCoversTarget: requiredPrincipal === 0 && otherGrossPassiveIncome > 0,
    modelPayoutSharePercent: actualGrossIncome > 0 ? 100 * requiredModelPayout / actualGrossIncome : 0,
    otherPassiveSharePercent: actualGrossIncome > 0 ? 100 * otherGrossPassiveIncome / actualGrossIncome : 0,
    progress
  };
}
