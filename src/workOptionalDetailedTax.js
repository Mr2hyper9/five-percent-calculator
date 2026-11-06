import {
  ANNUAL_INCOME_FIELDS,
  ARIZONA_YEARS,
  FEDERAL_YEARS,
  FILING_STATUSES,
  INCOME_CLASSES,
  STATE_OPTIONS
} from "./workOptionalTaxData.js";

export const DETAILED_DISCLAIMER =
  "This detailed estimate uses your selected filing status, tax year, deductions, income classifications, and applicable tax rules to provide a more personalized financial projection. Actual tax liability may differ due to individual circumstances, tax-law changes, and information not included in this calculator. Results are for financial planning purposes and do not constitute financial or tax advice.";

export const SIMPLE_DISCLAIMER =
  "Your actual tax situation may differ. This mode provides a general ballpark estimate and does not account for individual deductions, credits, or progressive tax brackets.";

export const MAX_SAFE_FINANCIAL = Number.MAX_SAFE_INTEGER / 100;
const MONTHLY_RATE = 0.05;
const NUMERIC_INPUT = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const CONTINUING_DEFAULTS = Object.fromEntries(
  ANNUAL_INCOME_FIELDS.map(([name]) => [name, !(name === "w2Wages" || name === "selfEmploymentProfit")])
);

export const DEFAULT_DETAILED_INPUTS = Object.freeze({
  taxYear: "2026",
  filingStatus: "single",
  state: "AZ",
  modelIncomeClass: "",
  otherPassiveIncomeClass: "",
  deductionMethod: "standard",
  itemizedDeduction: "0",
  arizonaItemizedDeduction: "0",
  annualAdjustments: "0",
  charitableContributions: "0",
  seniorCount: "0",
  blindCount: "0",
  qualifyingChildren: "0",
  otherDependents: "0",
  spouseItemizes: false,
  annualIncome: Object.fromEntries(ANNUAL_INCOME_FIELDS.map(([name]) => [name, "0"])),
  continuing: CONTINUING_DEFAULTS
});

const isEligible = (value, min = 0, max = MAX_SAFE_FINANCIAL) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const centsUp = (amount) => Math.ceil(amount * 100) / 100;
const errResult = (errors) => ({ valid: false, errors });

function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !NUMERIC_INPUT.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateDetailedInputs(common, raw) {
  const errors = {};
  const input = raw || {};
  const values = {};
  for (const [key, max] of [["monthlyExpenses", MAX_SAFE_FINANCIAL], ["otherGrossPassiveIncome", MAX_SAFE_FINANCIAL], ["bufferPercent", 100]]) {
    const value = parseAmount(common?.[key]);
    if (!isEligible(value, 0, max)) errors[key] = "Enter a valid nonnegative " + key + (max === 100 ? " from 0% to 100%." : " amount.");
    else values[key] = value;
  }
  const taxYear = Number(input.taxYear);
  if (!Object.hasOwn(FEDERAL_YEARS, taxYear)) errors.taxYear = "That tax year is not supported.";
  const filingStatus = input.filingStatus;
  if (!Object.hasOwn(FILING_STATUSES, filingStatus)) errors.filingStatus = "Choose a supported federal filing status.";
  const state = input.state;
  if (!Object.hasOwn(STATE_OPTIONS, state)) errors.state = "This state is not supported in Detailed mode.";
  if (state === "AZ" && filingStatus === "qss") errors.state = "Arizona resident filing status does not support qualifying surviving spouse in this estimator. Choose another valid Arizona status or a state without income tax.";
  if (input.deductionMethod !== "standard" && input.deductionMethod !== "itemized") {
    errors.deductionMethod = "Choose standard or itemized deductions.";
  }
  if (filingStatus === "mfs" && input.deductionMethod === "standard" && input.spouseItemizes === true) {
    errors.deductionMethod = "Married filing separately cannot use a standard deduction when the spouse itemizes. Choose itemized deductions.";
  }

  for (const [key, max] of [
    ["itemizedDeduction", MAX_SAFE_FINANCIAL],
    ["arizonaItemizedDeduction", MAX_SAFE_FINANCIAL],
    ["annualAdjustments", MAX_SAFE_FINANCIAL],
    ["charitableContributions", MAX_SAFE_FINANCIAL],
    ["seniorCount", 2], ["blindCount", 2],
    ["qualifyingChildren", 20], ["otherDependents", 20]
  ]) {
    const value = parseAmount(input[key]);
    if (!isEligible(value, 0, max) || (["seniorCount", "blindCount", "qualifyingChildren", "otherDependents"].includes(key) && !Number.isInteger(value))) {
      errors[key] = "Enter a valid " + (max <= 20 ? "whole number" : "nonnegative amount") + " for " + key + ".";
    } else {
      values[key] = value;
    }
  }
  const maxAdults = filingStatus === "mfj" ? 2 : 1;
  if (values.seniorCount > maxAdults) errors.seniorCount = "The selected filing status supports at most " + maxAdults + " eligible adults.";
  if (values.blindCount > maxAdults) errors.blindCount = "The selected filing status supports at most " + maxAdults + " eligible adults.";
  if (filingStatus === "mfs" && values.seniorCount > 0) {
    // The extra $6,000 deduction is disallowed for MFS, but the standard age-based
    // adjustment still applies; this is handled in calculateFederalTax.
  }
  values.annualIncome = {};
  values.continuing = {};
  for (const [name] of ANNUAL_INCOME_FIELDS) {
    const number = parseAmount(input.annualIncome?.[name]);
    if (!isEligible(number)) errors[name] = "Enter a valid nonnegative annual amount.";
    else values.annualIncome[name] = number;
    if (typeof input.continuing?.[name] !== "boolean") errors[name + "Continuing"] = "Choose whether this income continues.";
    else values.continuing[name] = input.continuing[name];
  }

  const modelClass = input.modelIncomeClass;
  const passiveClass = input.otherPassiveIncomeClass;
  if (!Object.hasOwn(INCOME_CLASSES, modelClass)) {
    errors.modelIncomeClass = "Select the 5% Model payout tax classification. No default classification is assumed.";
  }
  if (values.otherGrossPassiveIncome > 0 && !Object.hasOwn(INCOME_CLASSES, passiveClass)) {
    errors.otherPassiveIncomeClass = "Select the other passive income tax classification.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: { ...values, taxYear, filingStatus, state, modelClass, passiveClass,
      deductionMethod: input.deductionMethod, spouseItemizes: input.spouseItemizes }
  };
}

function classifyAnnual(value, type, buckets) {
  if (!value) return;
  buckets.cash += value;
  if (type === "returnOfCapital" || type === "taxExempt") {
    if (type === "taxExempt") buckets.taxExempt += value;
    else buckets.returnOfCapital += value;
    return;
  }
  buckets.agi += value;
  if (type === "qualifiedDividends" || type === "longTermGains") {
    buckets.preferential += value;
    buckets.investmentIncome += value;
  } else {
    buckets.ordinary += value;
    if (type === "interest" || type === "shortTermGains") buckets.investmentIncome += value;
  }
}

export function progressiveTax(income, brackets) {
  let previous = 0;
  let total = 0;
  for (const { limit, rate } of brackets) {
    const layer = Math.max(0, Math.min(income, limit) - previous);
    total += layer * rate;
    if (income <= limit) break;
    previous = limit;
  }
  return total;
}

export function preferentialTax(ordinaryTaxable, preferenceTaxable, thresholds) {
  const first = Math.max(0, Math.min(preferenceTaxable, thresholds.zeroMax - ordinaryTaxable));
  const second = Math.max(0, Math.min(preferenceTaxable - first, thresholds.fifteenMax - ordinaryTaxable - first));
  return second * 0.15 + Math.max(0, preferenceTaxable - first - second) * 0.20;
}

function calculateEmploymentTaxes(wages, profit, year, status) {
  const base = year.ssWageBase;
  const seEarnings = profit * 0.9235;
  const wagesSocialSecurity = Math.min(wages, base) * 0.062;
  const wagesMedicare = wages * 0.0145;
  const seSocialSecurity = Math.min(seEarnings, Math.max(0, base - wages)) * 0.124;
  const seMedicare = seEarnings * 0.029;
  const medicareThreshold = status === "mfj" ? 250000 : status === "mfs" ? 125000 : 200000;
  const additionalMedicare = Math.max(0, wages + seEarnings - medicareThreshold) * 0.009;
  return {
    employmentPayrollTax: wagesSocialSecurity + wagesMedicare,
    selfEmploymentTax: seSocialSecurity + seMedicare,
    additionalMedicare,
    deductibleHalfSeTax: (seSocialSecurity + seMedicare) / 2,
    total: wagesSocialSecurity + wagesMedicare + seSocialSecurity + seMedicare + additionalMedicare
  };
}

export function calculateFederalTax(buckets, inputs, employmentTaxes) {
  const year = FEDERAL_YEARS[inputs.taxYear];
  const status = inputs.filingStatus;
  const federalAGI = Math.max(0, buckets.agi - employmentTaxes.deductibleHalfSeTax - inputs.annualAdjustments);
  const adultCount = inputs.seniorCount + inputs.blindCount;
  const addedStandard = (status === "mfj" || status === "mfs" || status === "qss"
    ? year.additionalStandard.married
    : year.additionalStandard.unmarried) * adultCount;
  const federalBasicStandard = year.standard[status];
  const cap = status === "mfj" ? 2000 : 1000;
  const nonitemizerCharity = inputs.taxYear === 2026 && inputs.deductionMethod === "standard"
    ? Math.min(inputs.charitableContributions, cap)
    : 0;
  const standard = federalBasicStandard + addedStandard + nonitemizerCharity;
  const selectedDeduction = inputs.deductionMethod === "standard"
    ? standard
    : inputs.itemizedDeduction;
  // The enhanced 65+ deduction under section 151(d)(5)(C) is available in both
  // itemized and standard modes; MFS cannot claim it.
  const enhancedAllowed = status === "mfs" ? 0 : inputs.seniorCount * year.enhancedSeniorDeduction;
  const enhancedThreshold = status === "mfj" ? 150000 : 75000;
  const seniorEnhanced = Math.max(0, enhancedAllowed - 0.06 * Math.max(0, federalAGI - enhancedThreshold));

  const taxableIncome = Math.max(0, federalAGI - selectedDeduction - seniorEnhanced);
  const preferenceTaxable = Math.min(buckets.preferential, taxableIncome);
  const ordinaryTaxable = Math.max(0, taxableIncome - preferenceTaxable);
  const incomeTaxBeforeCredits = progressiveTax(ordinaryTaxable, year.ordinary[status]) +
    preferentialTax(ordinaryTaxable, preferenceTaxable, year.capitalGains[status]);

  const creditBeforePhaseout = inputs.qualifyingChildren * year.childCredit + inputs.otherDependents * year.otherDependentCredit;
  const phaseoutThreshold = status === "mfj" ? 400000 : 200000;
  const phaseoutSteps = Math.ceil(Math.max(0, federalAGI - phaseoutThreshold) / 1000);
  const availableCredits = Math.max(0, creditBeforePhaseout - phaseoutSteps * 50);
  const appliedCredits = Math.min(availableCredits, incomeTaxBeforeCredits);
  const regularIncomeTax = Math.max(0, incomeTaxBeforeCredits - appliedCredits);

  const niitThreshold = status === "mfj" || status === "qss"
    ? 250000 : status === "mfs" ? 125000 : 200000;
  // NIIT generally applies only to selected investment classes. No unstated
  // NIIT assumption is made for an "ordinary" business distribution.
  const niit = Math.min(buckets.investmentIncome, Math.max(0, federalAGI - niitThreshold)) * 0.038;
  const federalIncomeTax = regularIncomeTax + niit;
  return {
    federalIncomeTax, regularIncomeTax, niit, federalAGI,
    taxableIncome, selectedDeduction, seniorEnhanced, appliedCredits,
    federalTaxBeforeCredits: incomeTaxBeforeCredits,
    creditBeforePhaseout, phaseoutThreshold
  };
}

export function calculateStateTax(buckets, inputs, federal) {
  if (inputs.state !== "AZ") return { stateIncomeTax: 0, stateTaxableIncome: 0, stateDeduction: 0, stateCredits: 0, stateAGI: 0 };
  const year = ARIZONA_YEARS[inputs.taxYear];
  // The 2025/2026 Arizona resident starting point is federal AGI, not federal taxable income.
  // Additional state AGI adjustments not explicitly modeled are disclosed in the UI.
  const stateAGI = Math.max(0, federal.federalAGI - federal.seniorEnhanced);
  const standardCharity = inputs.taxYear === 2025
    ? inputs.charitableContributions * year.charitableStandardPercentage
    : Math.min(inputs.charitableContributions, inputs.filingStatus === "mfj" ? 2000 : 1000);
  const stateDeduction = inputs.deductionMethod === "standard"
    ? year.standard[inputs.filingStatus] + standardCharity
    : inputs.arizonaItemizedDeduction;
  const stateSeniorBlindExemptions = inputs.seniorCount * year.seniorExemption + inputs.blindCount * year.blindExemption;
  const stateTaxableIncome = Math.max(0, stateAGI - stateDeduction - stateSeniorBlindExemptions);
  const stateBeforeCredits = stateTaxableIncome * year.rate;

  const nominalCredit = inputs.qualifyingChildren * year.childCredit + inputs.otherDependents * year.otherDependentCredit;
  const creditThreshold = inputs.filingStatus === "mfj" ? 400000 : 200000;
  const steps = Math.ceil(Math.max(0, federal.federalAGI - creditThreshold) / 1000);
  const stateCredits = Math.min(stateBeforeCredits, nominalCredit * Math.max(0, 1 - steps * 0.05));
  return { stateIncomeTax: Math.max(0, stateBeforeCredits - stateCredits), stateTaxableIncome,
    stateDeduction, stateCredits, stateAGI };
}

export function estimateDetailedAnnualTaxes(inputs, principal) {
  if (!isEligible(principal)) throw new Error("Invalid principal in detailed tax evaluation.");
  const annualModelPayout = principal * MONTHLY_RATE * 12;
  const annualOtherPassive = inputs.otherGrossPassiveIncome * 12;
  const buckets = {
    cash: 0, agi: 0, ordinary: 0, preferential: 0,
    investmentIncome: 0, taxExempt: 0, returnOfCapital: 0
  };
  classifyAnnual(annualModelPayout, inputs.modelClass, buckets);
  classifyAnnual(annualOtherPassive, inputs.passiveClass, buckets);
  let annualOtherContinuingIncome = 0;
  for (const [field] of ANNUAL_INCOME_FIELDS) {
    const amount = inputs.continuing[field] ? inputs.annualIncome[field] : 0;
    annualOtherContinuingIncome += amount;
    let type = field;
    if (field === "w2Wages" || field === "selfEmploymentProfit" || field === "ordinaryIncome") type = "ordinary";
    if (field === "taxableInterest") type = "interest";
    if (field === "otherTaxableIncome") type = "otherTaxable";
    classifyAnnual(amount, type, buckets);
  }

  const wages = inputs.continuing.w2Wages ? inputs.annualIncome.w2Wages : 0;
  const selfEmploymentProfit = inputs.continuing.selfEmploymentProfit ? inputs.annualIncome.selfEmploymentProfit : 0;
  const employmentTaxes = calculateEmploymentTaxes(wages, selfEmploymentProfit, FEDERAL_YEARS[inputs.taxYear], inputs.filingStatus);
  const federal = calculateFederalTax(buckets, inputs, employmentTaxes);
  const state = calculateStateTax(buckets, inputs, federal);
  const federalIncomeTax = federal.federalIncomeTax;
  const stateIncomeTax = state.stateIncomeTax;
  const annualPayrollTaxes = employmentTaxes.total;
  const totalAnnualTaxes = federalIncomeTax + stateIncomeTax + annualPayrollTaxes;
  const projectedAnnualNetIncome = buckets.cash - totalAnnualTaxes;
  if (![buckets.cash, federal.federalAGI, federal.taxableIncome,
    federalIncomeTax, stateIncomeTax, annualPayrollTaxes, totalAnnualTaxes, projectedAnnualNetIncome]
    .every((n) => Number.isFinite(n) && Math.abs(n) <= MAX_SAFE_FINANCIAL)) {
    throw new Error("Detailed calculation exceeded the reliable numeric range.");
  }

  return {
    annualModelPayout,
    annualOtherPassive,
    annualOtherContinuingIncome,
    annualGrossIncome: buckets.cash,
    federalIncomeTax,
    stateIncomeTax,
    annualPayrollTaxes,
    employmentPayrollTax: employmentTaxes.employmentPayrollTax,
    selfEmploymentTax: employmentTaxes.selfEmploymentTax,
    additionalMedicareTax: employmentTaxes.additionalMedicare,
    totalAnnualTaxes,
    projectedAnnualNetIncome,
    annualTaxableIncome: federal.taxableIncome,
    annualStateTaxableIncome: state.stateTaxableIncome,
    federalAGI: federal.federalAGI,
    federalSelectedDeduction: federal.selectedDeduction,
    seniorEnhancedDeduction: federal.seniorEnhanced,
    federalCreditsUsed: federal.appliedCredits,
    stateCreditsUsed: state.stateCredits,
    niit: federal.niit
  };
}

// A stepwise child/dependent-credit phaseout can make after-tax income nonmonotonic.
// Enumerate every material credit discontinuity, then binary-search CENT amounts
// only within segments where liability is continuous and net cash is increasing.
// This does not assume net income increases globally through phaseout jumps.
export function solveMinimumPrincipal(inputs, requiredAnnualNetIncome) {
  let evaluations = 0;
  const evaluate = (principal) => {
    evaluations += 1;
    return estimateDetailedAnnualTaxes(inputs, principal);
  };
  let zero = evaluate(0);
  if (zero.projectedAnnualNetIncome >= requiredAnnualNetIncome - 1e-7) {
    return { principal: 0, scenario: zero, evaluations, strategy: "zero-income-target" };
  }
  const maximumPrincipal = Math.floor(MAX_SAFE_FINANCIAL * 100) / 100;
  let high = 10000;
  let upper = null;
  for (let i = 0; i < 45; i += 1) {
    upper = evaluate(high);
    if (upper.projectedAnnualNetIncome >= requiredAnnualNetIncome) break;
    high *= 2;
    if (high >= maximumPrincipal) return { error: "The principal solver exceeded the supported financial range.", evaluations };
  }
  if (!upper || upper.projectedAnnualNetIncome < requiredAnnualNetIncome) {
    return { error: "The principal solver did not establish a feasible upper bound.", evaluations };
  }

  const events = [0, high];
  const payoutIsTaxable = inputs.modelClass !== "returnOfCapital" && inputs.modelClass !== "taxExempt";
  const hasChildCredit = inputs.qualifyingChildren > 0 || inputs.otherDependents > 0;
  if (payoutIsTaxable && hasChildCredit) {
    const baseAGI = zero.federalAGI;
    const threshold = inputs.filingStatus === "mfj" ? 400000 : 200000;
    const potentialCredits = inputs.qualifyingChildren * FEDERAL_YEARS[inputs.taxYear].childCredit +
      inputs.otherDependents * FEDERAL_YEARS[inputs.taxYear].otherDependentCredit;
    const maxFederalSteps = Math.ceil(potentialCredits / 50) + 1;
    for (let k = 0; k <= maxFederalSteps; k += 1) {
      const principal = (threshold + k * 1000 - baseAGI) / 0.6;
      if (principal > 0 && principal < high) events.push(principal);
    }
    if (inputs.state === "AZ") {
      for (let k = 0; k <= 20; k += 1) {
        const principal = (threshold + k * 1000 - baseAGI) / 0.6;
        if (principal > 0 && principal < high) events.push(principal);
      }
    }
  }
  events.sort((a, b) => a - b);
  const sorted = events.filter((value, index) => index === 0 || value - events[index - 1] > 1e-7);
  // All tests and comparisons below are on the actual spendable cent grid.
  for (let i = 1; i < sorted.length; i += 1) {
    const firstCent = Math.max(0, Math.ceil(sorted[i - 1] * 100 - 1e-7));
    const lastCent = Math.min(Math.floor(high * 100), Math.floor(sorted[i] * 100 + 1e-7));
    if (firstCent > lastCent) continue;
    const firstValue = evaluate(firstCent / 100);
    if (firstValue.projectedAnnualNetIncome >= requiredAnnualNetIncome - 1e-7) {
      return { principal: firstCent / 100, scenario: firstValue, evaluations, strategy: "segmented-cent-search" };
    }
    const lastValue = evaluate(lastCent / 100);
    if (lastValue.projectedAnnualNetIncome < requiredAnnualNetIncome - 1e-7) continue;

    let lo = firstCent + 1;
    let hi = lastCent;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      const midScenario = evaluate(mid / 100);
      if (midScenario.projectedAnnualNetIncome >= requiredAnnualNetIncome - 1e-7) hi = mid;
      else lo = mid + 1;
    }
    const scenario = evaluate(lo / 100);
    if (scenario.projectedAnnualNetIncome >= requiredAnnualNetIncome - 1e-7) {
      return { principal: lo / 100, scenario, evaluations, strategy: "segmented-cent-search" };
    }
  }
  return { error: "The detailed tax solver could not verify a cent-accurate target. Review income classifications and tax assumptions.", evaluations };
}

export function calculateDetailedWorkOptional(common, rawDetailed, currentDeployedPrincipal = null) {
  const validated = validateDetailedInputs(common, rawDetailed);
  if (!validated.valid) return errResult(validated.errors);
  const v = validated.values;
  try {
    const requiredNetIncome = v.monthlyExpenses * (1 + v.bufferPercent / 100);
    const requiredBufferIncome = v.monthlyExpenses * (v.bufferPercent / 100);
    const solution = solveMinimumPrincipal(v, requiredNetIncome * 12);
    if (solution.error) return errResult({ calculation: solution.error });

    const requiredPrincipal = solution.principal;
    const actual = solution.scenario;
    const actualGrossIncome = actual.annualGrossIncome / 12;
    const estimatedMonthlyTaxes = actual.totalAnnualTaxes / 12;
    const actualNetIncome = actual.projectedAnnualNetIncome / 12;
    const monthlySurplus = Math.max(0, actualNetIncome - requiredNetIncome);
    const actualExtraIncome = actualNetIncome - v.monthlyExpenses;
    const requiredModelPayout = actual.annualModelPayout / 12;
    const otherContinuingMonthlyIncome = actual.annualOtherContinuingIncome / 12;
    const annualModelPayout = actual.annualModelPayout;
    const grossDenominator = actual.annualGrossIncome;
    const effectiveFederalPercent = grossDenominator > 0 ? 100 * actual.federalIncomeTax / grossDenominator : 0;
    const effectiveStatePercent = grossDenominator > 0 ? 100 * actual.stateIncomeTax / grossDenominator : 0;
    const effectiveCombinedPercent = effectiveFederalPercent + effectiveStatePercent;
    const achievementPercent = requiredPrincipal > 0 &&
      typeof currentDeployedPrincipal === "number" && Number.isFinite(currentDeployedPrincipal) &&
      currentDeployedPrincipal >= 0 ? 100 * currentDeployedPrincipal / requiredPrincipal : null;
    const progress = isEligible(currentDeployedPrincipal)
      ? {
          currentDeployedPrincipal,
          currentModelPayout: currentDeployedPrincipal * MONTHLY_RATE,
          remainingPrincipal: Math.max(0, requiredPrincipal - currentDeployedPrincipal),
          actionableRemainingPrincipal: centsUp(Math.max(0, requiredPrincipal - currentDeployedPrincipal)),
          achievementPercent,
          progressBarPercent: requiredPrincipal === 0 ? 100 : Math.min(100, achievementPercent),
          targetAlreadyCovered: requiredPrincipal === 0
        }
      : null;
    const result = {
      valid: true,
      errors: {},
      taxMode: "detailed",
      monthlyExpenses: v.monthlyExpenses,
      bufferPercent: v.bufferPercent,
      otherGrossPassiveIncome: v.otherGrossPassiveIncome,
      otherContinuingMonthlyIncome,
      requiredBufferIncome,
      requiredNetIncome,
      requiredGrossIncome: actualGrossIncome,
      requiredModelPayout,
      requiredPrincipal,
      actionableRequiredPrincipal: requiredPrincipal,
      annualModelPayout,
      actualGrossIncome,
      estimatedMonthlyTaxes,
      actualNetIncome,
      monthlySurplus,
      actualExtraIncome,
      annualGrossHouseholdIncome: actual.annualGrossIncome,
      annualFederalIncomeTax: actual.federalIncomeTax,
      annualStateIncomeTax: actual.stateIncomeTax,
      annualPayrollTaxes: actual.annualPayrollTaxes,
      totalAnnualTaxes: actual.totalAnnualTaxes,
      annualTaxableIncome: actual.annualTaxableIncome,
      annualStateTaxableIncome: actual.annualStateTaxableIncome,
      federalEffectivePercent: effectiveFederalPercent,
      stateEffectivePercent: effectiveStatePercent,
      combinedTaxPercent: effectiveCombinedPercent,
      combinedTaxRate: effectiveCombinedPercent / 100,
      effectiveRateDenominator: "Annual gross cash household income (includes non-taxable receipts)",
      federalCreditsUsed: actual.federalCreditsUsed,
      stateCreditsUsed: actual.stateCreditsUsed,
      niit: actual.niit,
      seniorEnhancedDeduction: actual.seniorEnhancedDeduction,
      solverEvaluations: solution.evaluations,
      requiresNoModelPrincipal: requiredPrincipal === 0,
      otherPassiveCoversTarget: requiredPrincipal === 0 && actual.annualGrossIncome > 0,
      modelPayoutSharePercent: actualGrossIncome > 0 ? 100 * requiredModelPayout / actualGrossIncome : 0,
      otherPassiveSharePercent: actualGrossIncome > 0 ? 100 * v.otherGrossPassiveIncome / actualGrossIncome : 0,
      otherContinuingSharePercent: actualGrossIncome > 0 ? 100 * otherContinuingMonthlyIncome / actualGrossIncome : 0,
      progress
    };
    if (Object.values(result).some((n) => typeof n === "number" && !Number.isFinite(n))) {
      return errResult({ calculation: "Detailed calculation produced an invalid numeric result." });
    }
    return result;
  } catch (error) {
    return errResult({ calculation: error instanceof Error ? error.message : "Detailed tax calculation could not be completed." });
  }
}
