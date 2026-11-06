import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFederalTax,
  calculateStateTax,
  calculateDetailedWorkOptional,
  DEFAULT_DETAILED_INPUTS,
  estimateDetailedAnnualTaxes,
  preferentialTax,
  progressiveTax,
  solveMinimumPrincipal,
  validateDetailedInputs
} from "./workOptionalDetailedTax.js";
import { FEDERAL_YEARS, ARIZONA_YEARS, FILING_STATUSES } from "./workOptionalTaxData.js";
import { calculateWorkOptional } from "./workOptionalCalculations.js";

const shared = {
  monthlyExpenses: "5000",
  federalTaxPercent: "20",
  stateTaxPercent: "5",
  otherGrossPassiveIncome: "1000",
  bufferPercent: "25"
};

const setup = (overrides = {}) => ({
  ...DEFAULT_DETAILED_INPUTS,
  modelIncomeClass: "ordinary",
  otherPassiveIncomeClass: "interest",
  ...overrides,
  annualIncome: { ...DEFAULT_DETAILED_INPUTS.annualIncome, ...overrides.annualIncome },
  continuing: { ...DEFAULT_DETAILED_INPUTS.continuing, ...overrides.continuing }
});

const calc = (detail = {}, common = shared, principal = null) =>
  calculateDetailedWorkOptional(common, setup(detail), principal);

function near(a, b, tolerance = 0.02) {
  assert.ok(Math.abs(a - b) <= tolerance, "Expected " + a + " ≈ " + b);
}

test("Simple results remain identical when tax mode is omitted or explicitly simple", () => {
  const original = calculateWorkOptional(shared);
  const simple = calculateWorkOptional(shared, null, { mode: "simple", detailed: setup() });
  assert.deepEqual(simple, original);
  near(original.actionableRequiredPrincipal, 146666.67);
});

test("tax mode switches reuse common values without modifying either input object", () => {
  const detail = setup();
  const common = { ...shared };
  const simple = calculateWorkOptional(common, null, { mode: "simple", detailed: detail });
  const detailed = calculateWorkOptional(common, null, { mode: "detailed", detailed: detail });
  const again = calculateWorkOptional(common, null, { mode: "simple", detailed: detail });
  assert.ok(detailed.valid);
  assert.equal(detailed.taxMode, "detailed");
  assert.deepEqual(simple, again);
  assert.deepEqual(common, shared);
  assert.equal(detail.modelIncomeClass, "ordinary");
});

test("all 5 federal filing statuses are supported with annual 2026 rules", () => {
  for (const status of Object.keys(FILING_STATUSES)) {
    const result = calc({ filingStatus: status, state: "TX" });
    assert.equal(result.valid, true, status + JSON.stringify(result.errors));
    assert.ok(result.actionableRequiredPrincipal >= 0);
    assert.ok(result.annualFederalIncomeTax >= 0);
  }
});

test("2025 and 2026 federal progressive ordinary bracket boundaries match IRS", () => {
  near(progressiveTax(11925, FEDERAL_YEARS[2025].ordinary.single), 1192.50, 1e-8);
  near(progressiveTax(12025, FEDERAL_YEARS[2025].ordinary.single), 1204.50, 1e-8);
  near(progressiveTax(12400, FEDERAL_YEARS[2026].ordinary.single), 1240, 1e-8);
  near(progressiveTax(50400, FEDERAL_YEARS[2026].ordinary.single), 5800, 1e-8);
  near(progressiveTax(100800, FEDERAL_YEARS[2026].ordinary.mfj), 11600, 1e-8);
  assert.equal(FEDERAL_YEARS[2026].ordinary.hoh[1].limit, 67450);
});

test("2025 OBBB-adjusted and 2026 standard deductions are year and filing specific", () => {
  assert.equal(FEDERAL_YEARS[2025].standard.mfj, 31500);
  assert.equal(FEDERAL_YEARS[2026].standard.single, 16100);
  assert.equal(FEDERAL_YEARS[2026].standard.hoh, 24150);
  assert.equal(FEDERAL_YEARS[2026].standard.qss, 32200);
});

test("standard and itemized deductions never stack", () => {
  const values = validateDetailedInputs(shared, setup({ state: "TX", deductionMethod: "standard" })).values;
  const base = { agi: 50000, ordinary: 50000, preferential: 0, investmentIncome: 0 };
  const payroll = { deductibleHalfSeTax: 0 };
  const std = calculateFederalTax(base, values, payroll);
  near(std.taxableIncome, 33900, 1e-8);
  near(std.federalIncomeTax, 3820, 1e-8);
  const item = calculateFederalTax(base, { ...values, deductionMethod: "itemized", itemizedDeduction: 20000 }, payroll);
  near(item.taxableIncome, 30000, 1e-8);
  near(item.federalIncomeTax, 3352, 1e-8);
});

test("2026 federal enhanced age 65 deduction is available and phases out", () => {
  const values = validateDetailedInputs(shared, setup({ state: "TX", seniorCount: "1" })).values;
  const payroll = { deductibleHalfSeTax: 0 };
  near(calculateFederalTax({ agi: 75000, ordinary: 75000, preferential: 0, investmentIncome: 0 }, values, payroll).seniorEnhanced, 6000, 1e-8);
  near(calculateFederalTax({ agi: 150000, ordinary: 150000, preferential: 0, investmentIncome: 0 }, values, payroll).seniorEnhanced, 1500, 1e-8);
  const mfs = { ...values, filingStatus: "mfs" };
  assert.equal(calculateFederalTax({ agi: 75000, ordinary: 75000, preferential: 0, investmentIncome: 0 }, mfs, payroll).seniorEnhanced, 0);
});

test("federal preferential brackets stack gains above ordinary taxable income", () => {
  near(preferentialTax(50000, 50000, FEDERAL_YEARS[2026].capitalGains.single), 7500, 1e-8);
  near(preferentialTax(0, 49450, FEDERAL_YEARS[2026].capitalGains.single), 0, 1e-8);
  near(preferentialTax(0, 50000, FEDERAL_YEARS[2026].capitalGains.single), 82.50, 1e-8);
});

test("model payout qualified dividends and long-term gains receive federal preferential rates", () => {
  const plain = calc({ state: "TX", modelIncomeClass: "ordinary" }, { ...shared, otherGrossPassiveIncome: "0" });
  const qualified = calc({ state: "TX", modelIncomeClass: "qualifiedDividends" }, { ...shared, otherGrossPassiveIncome: "0" });
  const gains = calc({ state: "TX", modelIncomeClass: "longTermGains" }, { ...shared, otherGrossPassiveIncome: "0" });
  assert.equal(plain.valid, true);
  assert.equal(qualified.valid, true);
  assert.equal(gains.valid, true);
  assert.ok(qualified.requiredPrincipal < plain.requiredPrincipal);
  near(gains.requiredPrincipal, qualified.requiredPrincipal);
});

test("2025 and 2026 Arizona standard deductions and flat 2.5% tax reflect state-specific AGI", () => {
  for (const year of [2025, 2026]) {
    const values = validateDetailedInputs(shared, setup({ taxYear: String(year) })).values;
    const standard = ARIZONA_YEARS[year].standard.single;
    const federal = { federalAGI: 50000, seniorEnhanced: 0 };
    const result = calculateStateTax({}, values, federal);
    near(result.stateTaxableIncome, 50000 - standard, 1e-8);
    near(result.stateIncomeTax, (50000 - standard) * 0.025, 1e-8);
  }
});

test("Arizona resident 2026 dependent credit increases for children under 17", () => {
  const normal = calc({ state: "AZ" });
  const child = calc({ state: "AZ", qualifyingChildren: "1" });
  assert.ok(child.annualStateIncomeTax <= normal.annualStateIncomeTax);
  const stateInputs = validateDetailedInputs(shared, setup({ state: "AZ", qualifyingChildren: "1" })).values;
  const state = calculateStateTax({}, stateInputs, { federalAGI: 50000, seniorEnhanced: 0 });
  near(state.stateCredits, 125, 1e-8);
});

test("non-taxing selected states do not add unsupported state tax", () => {
  for (const state of ["TX", "FL", "NV", "WY", "SD", "AK", "TN", "NH"]) {
    const result = calc({ state });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.annualStateIncomeTax, 0);
  }
});

test("unsupported state/year/status and Arizona QSS fail clearly rather than estimating", () => {
  for (const patch of [
    { state: "CA" }, { taxYear: "2024" }, { taxYear: "2027" },
    { filingStatus: "unsupported" }, { state: "AZ", filingStatus: "qss" }
  ]) {
    const result = calc(patch);
    assert.equal(result.valid, false);
    assert.ok(Object.keys(result.errors).length > 0);
  }
});

test("qualified children and other dependents get distinct credits with stepped federal phaseouts", () => {
  const values = validateDetailedInputs(shared, setup({ state: "TX", qualifyingChildren: "1", otherDependents: "1" })).values;
  const payroll = { deductibleHalfSeTax: 0 };
  const base = (income) => calculateFederalTax({ agi: income, ordinary: income, preferential: 0, investmentIncome: 0 }, values, payroll);
  assert.equal(base(200000).creditBeforePhaseout, 2700);
  assert.equal(base(200001).appliedCredits, 2650);
  assert.equal(base(201000).appliedCredits, 2650);
  assert.equal(base(201001).appliedCredits, 2600);
  assert.equal(base(300000).appliedCredits, 0);
});

test("tax-exempt income and return of capital are not treated as federal or state taxable", () => {
  for (const modelIncomeClass of ["returnOfCapital", "taxExempt"]) {
    const result = calc({ modelIncomeClass, state: "AZ" }, { ...shared, otherGrossPassiveIncome: "0" });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    near(result.requiredPrincipal, 125000, 0.02);
    assert.equal(result.annualFederalIncomeTax, 0);
    assert.equal(result.annualStateIncomeTax, 0);
  }
});

test("other continuing income lowers principal while stopped wages do not", () => {
  const base = calc({ state: "TX" }, { ...shared, otherGrossPassiveIncome: "0" });
  const withStopped = calc({ state: "TX", annualIncome: { w2Wages: "60000" }, continuing: { w2Wages: false } },
    { ...shared, otherGrossPassiveIncome: "0" });
  const withContinuing = calc({ state: "TX", annualIncome: { w2Wages: "60000" }, continuing: { w2Wages: true } },
    { ...shared, otherGrossPassiveIncome: "0" });
  assert.equal(withStopped.requiredPrincipal, base.requiredPrincipal);
  assert.ok(withContinuing.requiredPrincipal < base.requiredPrincipal);
  near(withContinuing.otherContinuingMonthlyIncome, 5000);
  assert.ok(withContinuing.annualPayrollTaxes > 0);
});

test("other passive income is not double-counted with other annual sources", () => {
  const result = calc({ state: "TX", modelIncomeClass: "returnOfCapital", otherPassiveIncomeClass: "returnOfCapital", annualIncome: { taxExemptIncome: "12000" } });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  near(result.otherContinuingMonthlyIncome, 1000);
  near(result.actualGrossIncome, result.requiredModelPayout + 1000 + 1000);
});

test("2026 wages and self-employment taxes use confirmed social security wage base", () => {
  const result = calc({ state: "TX", annualIncome: { w2Wages: "100000", selfEmploymentProfit: "20000" },
    continuing: { w2Wages: true, selfEmploymentProfit: true } });
  assert.ok(result.valid);
  assert.ok(result.annualPayrollTaxes > 7650);
  assert.ok(result.annualFederalIncomeTax > 0);
});

test("extra Medicare and NIIT are included in applicable high-income cases", () => {
  const result = calc({ state: "TX", annualIncome: { w2Wages: "300000", taxableInterest: "40000" },
    continuing: { w2Wages: true }, modelIncomeClass: "interest" });
  assert.ok(result.valid);
  assert.ok(result.niit > 0);
  assert.ok(result.annualPayrollTaxes > 0);
});

test("cent-accurate solver satisfies the target and previous cent does not", () => {
  const common = { ...shared, otherGrossPassiveIncome: "0" };
  const detailed = setup({ state: "TX" });
  const result = calculateDetailedWorkOptional(common, detailed);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  const values = validateDetailedInputs(common, detailed).values;
  const netAt = estimateDetailedAnnualTaxes(values, result.requiredPrincipal).projectedAnnualNetIncome;
  assert.ok(netAt >= result.requiredNetIncome * 12 - 1e-6);
  if (result.requiredPrincipal >= 0.01) {
    const previous = estimateDetailedAnnualTaxes(values, result.requiredPrincipal - 0.01).projectedAnnualNetIncome;
    assert.ok(previous < result.requiredNetIncome * 12 + 1e-6);
  }
});

test("solver handles discontinuous credit phaseouts via segmented cent search", () => {
  const inputs = setup({ state: "TX", qualifyingChildren: "1" });
  const values = validateDetailedInputs(shared, inputs).values;
  const before = estimateDetailedAnnualTaxes(values, 333333.33);
  const after = estimateDetailedAnnualTaxes(values, 333333.34);
  assert.ok(after.projectedAnnualNetIncome < before.projectedAnnualNetIncome);
  const solved = solveMinimumPrincipal(values, before.projectedAnnualNetIncome - 10);
  assert.ok(!solved.error, solved.error);
  assert.ok(solved.principal <= 333333.33);
  assert.ok(solved.scenario.projectedAnnualNetIncome >= before.projectedAnnualNetIncome - 10);
});

test("$0 principal and passive surplus work with detailed taxes rather than flat tax", () => {
  const result = calc({ state: "TX", otherPassiveIncomeClass: "returnOfCapital", modelIncomeClass: "returnOfCapital" },
    { ...shared, otherGrossPassiveIncome: "10000" }, 10000);
  assert.equal(result.valid, true);
  assert.equal(result.requiredPrincipal, 0);
  assert.equal(result.progress.targetAlreadyCovered, true);
  assert.equal(result.progress.achievementPercent, null);
  near(result.monthlySurplus, 3750);
});

test("progress is capped visually but exact achievement can exceed 100%", () => {
  const without = calc({ state: "TX" });
  assert.equal(without.progress, null);
  const withPrincipal = calc({ state: "TX" }, shared, 999999);
  assert.ok(withPrincipal.progress.achievementPercent > 100);
  assert.equal(withPrincipal.progress.progressBarPercent, 100);
  assert.equal(withPrincipal.progress.remainingPrincipal, 0);
});

test("no invalid or negative inputs silently become $0", () => {
  for (const key of ["monthlyExpenses", "otherGrossPassiveIncome", "bufferPercent"]) {
    const invalid = calc({}, { ...shared, [key]: "-1" });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors[key]);
  }
  for (const key of ["itemizedDeduction", "arizonaItemizedDeduction", "annualAdjustments", "charitableContributions",
    "seniorCount", "blindCount", "qualifyingChildren", "otherDependents"]) {
    const invalid = calc({ [key]: "Infinity" });
    assert.equal(invalid.valid, false, key);
    assert.ok(invalid.errors[key]);
  }
  for (const key of ["w2Wages", "selfEmploymentProfit", "ordinaryIncome", "taxableInterest",
    "qualifiedDividends", "longTermGains", "shortTermGains", "taxExemptIncome",
    "returnOfCapital", "otherTaxableIncome"]) {
    const invalid = calc({ annualIncome: { [key]: "" } });
    assert.equal(invalid.valid, false, key);
    assert.ok(invalid.errors[key]);
  }
});

test("unknown payout classification is not automatically treated as ordinary income", () => {
  const result = calculateDetailedWorkOptional(shared, { ...DEFAULT_DETAILED_INPUTS });
  assert.equal(result.valid, false);
  assert.ok(result.errors.modelIncomeClass);
});

test("itemizing MFS when spouse itemizes is required", () => {
  const invalid = calc({ state: "TX", filingStatus: "mfs", spouseItemizes: true });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.deductionMethod);
  const valid = calc({ state: "TX", filingStatus: "mfs", spouseItemizes: true, deductionMethod: "itemized" });
  assert.equal(valid.valid, true);
});

test("zero expenses and no other income have zero principal and finite taxes", () => {
  const zero = calc({ state: "TX", modelIncomeClass: "returnOfCapital" },
    { ...shared, monthlyExpenses: "0", otherGrossPassiveIncome: "0" });
  assert.equal(zero.requiredPrincipal, 0);
  assert.equal(zero.totalAnnualTaxes, 0);
  assert.equal(zero.actualNetIncome, 0);
});

test("extreme and malformed amounts never yield NaN or Infinity to the UI", () => {
  const error = calc({ state: "TX", annualIncome: { ordinaryIncome: "9".repeat(200) } });
  assert.equal(error.valid, false);
  assert.ok(error.errors.ordinaryIncome);
});
