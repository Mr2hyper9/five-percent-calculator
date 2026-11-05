import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWorkOptional,
  roundUpToCent,
  validateWorkOptionalInputs
} from "./workOptionalCalculations.js";

const base = {
  monthlyExpenses: "5000",
  federalTaxPercent: "20",
  stateTaxPercent: "5",
  otherGrossPassiveIncome: "1000",
  bufferPercent: "25"
};

function calculate(patch = {}, current = null) {
  return calculateWorkOptional({ ...base, ...patch }, current);
}

function closeTo(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, "Expected " + actual + " to be approximately " + expected);
}

test("verification scenario returns all requested amounts using unrounded values", () => {
  const result = calculate();
  assert.equal(result.valid, true);
  closeTo(result.requiredNetIncome, 6250);
  closeTo(result.combinedTaxPercent, 25);
  closeTo(result.requiredGrossIncome, 8333.333333333334);
  closeTo(result.requiredModelPayout, 7333.333333333334);
  closeTo(result.requiredPrincipal, 146666.66666666666);
  assert.equal(result.actionableRequiredPrincipal, 146666.67);
  closeTo(result.annualModelPayout, 88000);
  closeTo(result.estimatedMonthlyTaxes, 2083.3333333333335);
  closeTo(result.actualNetIncome, 6250);
  closeTo(result.actualExtraIncome, 1250);
  closeTo(result.monthlySurplus, 0);
  closeTo(result.requiredBufferIncome, 1250);
  assert.equal(result.progress, null);
});

test("0%, 25%, and 100% buffers correctly change the required net target", () => {
  for (const [buffer, expectedNet] of [[0, 5000], [25, 6250], [100, 10000]]) {
    const result = calculate({ bufferPercent: String(buffer) });
    assert.equal(result.valid, true);
    closeTo(result.requiredNetIncome, expectedNet);
    closeTo(result.requiredBufferIncome, expectedNet - 5000);
  }
});

test("$0 living expenses and no other passive income require $0 model principal", () => {
  const result = calculate({ monthlyExpenses: "0", otherGrossPassiveIncome: "0" });
  assert.equal(result.valid, true);
  assert.equal(result.requiredPrincipal, 0);
  assert.equal(result.requiredModelPayout, 0);
  assert.equal(result.actualGrossIncome, 0);
  assert.equal(result.monthlySurplus, 0);
  assert.equal(result.requiresNoModelPrincipal, true);
});

test("$0 living expenses with other passive income show all after-tax income as extra", () => {
  const result = calculate({ monthlyExpenses: "0", otherGrossPassiveIncome: "4000" });
  assert.equal(result.requiredPrincipal, 0);
  closeTo(result.estimatedMonthlyTaxes, 1000);
  closeTo(result.actualNetIncome, 3000);
  closeTo(result.actualExtraIncome, 3000);
  closeTo(result.monthlySurplus, 3000);
});

test("$0 other passive income requires full gross income from the model", () => {
  const result = calculate({ otherGrossPassiveIncome: "0" });
  closeTo(result.requiredModelPayout, result.requiredGrossIncome);
  closeTo(result.requiredPrincipal, result.requiredGrossIncome / 0.05);
  closeTo(result.modelPayoutSharePercent, 100);
  closeTo(result.otherPassiveSharePercent, 0);
});

test("other passive income exactly meeting the gross target results in zero required principal", () => {
  const requiredGrossIncome = calculate().requiredGrossIncome;
  const result = calculate({ otherGrossPassiveIncome: requiredGrossIncome });
  assert.equal(result.valid, true);
  assert.equal(result.requiredPrincipal, 0);
  assert.equal(result.requiredModelPayout, 0);
  closeTo(result.monthlySurplus, 0);
  assert.equal(result.otherPassiveCoversTarget, true);
});

test("other passive income exceeding the target preserves its real taxes and surplus", () => {
  const result = calculate({ otherGrossPassiveIncome: "10000" });
  assert.equal(result.requiredPrincipal, 0);
  assert.equal(result.requiredModelPayout, 0);
  closeTo(result.actualGrossIncome, 10000);
  closeTo(result.estimatedMonthlyTaxes, 2500);
  closeTo(result.actualNetIncome, 7500);
  closeTo(result.actualExtraIncome, 2500);
  closeTo(result.monthlySurplus, 1250);
  closeTo(result.otherPassiveSharePercent, 100);
});

test("federal and state rates add, and rates close to 100% stay finite", () => {
  const result = calculate({ federalTaxPercent: "97.4", stateTaxPercent: "2.5" });
  assert.equal(result.valid, true);
  closeTo(result.combinedTaxPercent, 99.9);
  assert.ok(Number.isFinite(result.requiredPrincipal));
  assert.ok(result.requiredPrincipal > 0);
});

test("combined rates equal to or above 100% are rejected", () => {
  for (const [federal, state] of [[75, 25], [80, 30], [100, 0]]) {
    const result = calculate({ federalTaxPercent: String(federal), stateTaxPercent: String(state) });
    assert.equal(result.valid, false);
    assert.match(result.errors.combinedTaxRate, /below 100%/);
  }
});

test("individual tax rates and buffer cannot exceed their bounds", () => {
  for (const patch of [
    { federalTaxPercent: "101" },
    { stateTaxPercent: "-0.1" },
    { bufferPercent: "100.01" },
    { monthlyExpenses: "-1" },
    { otherGrossPassiveIncome: "-7" }
  ]) {
    const result = calculate(patch);
    assert.equal(result.valid, false);
    assert.ok(Object.values(result.errors).length > 0);
  }
});

test("malformed, blank and nonfinite values never produce financial results", () => {
  for (const value of ["", " ", "NaN", "Infinity", "1e309", "1e3", "abc", "1,000", "$500", undefined, NaN, Infinity, -Infinity]) {
    const result = calculate({ monthlyExpenses: value });
    assert.equal(result.valid, false);
    assert.ok(result.errors.monthlyExpenses);
    assert.equal(result.requiredPrincipal, undefined);
  }
});

test("other invalid inputs are validated independently", () => {
  for (const key of ["federalTaxPercent", "stateTaxPercent", "otherGrossPassiveIncome", "bufferPercent"]) {
    const result = calculate({ [key]: "" });
    assert.equal(result.valid, false);
    assert.ok(result.errors[key]);
  }
});

test("large finite values are rejected when cent precision cannot be maintained", () => {
  const result = calculate({ monthlyExpenses: "9".repeat(300) });
  assert.equal(result.valid, false);
  assert.match(result.errors.calculation, /too large/);
});

test("principal funding target is rounded upward without rounding intermediate math", () => {
  const result = calculate({
    monthlyExpenses: "0.5001",
    federalTaxPercent: "0",
    stateTaxPercent: "0",
    otherGrossPassiveIncome: "0",
    bufferPercent: "0"
  });
  assert.equal(result.valid, true);
  closeTo(result.requiredPrincipal, 10.002);
  assert.equal(result.actionableRequiredPrincipal, 10.01);
  closeTo(result.annualModelPayout, 6.0012);
  assert.equal(roundUpToCent(0), 0);
  assert.equal(roundUpToCent(10), 10);
});

test("progress below, exactly at and beyond target uses actual percentage and capped bar", () => {
  const inputs = {
    monthlyExpenses: "5000",
    federalTaxPercent: "0",
    stateTaxPercent: "0",
    otherGrossPassiveIncome: "0",
    bufferPercent: "25"
  };
  const below = calculateWorkOptional(inputs, 50000);
  closeTo(below.requiredPrincipal, 125000);
  closeTo(below.progress.currentModelPayout, 2500);
  closeTo(below.progress.remainingPrincipal, 75000);
  closeTo(below.progress.achievementPercent, 40);
  closeTo(below.progress.progressBarPercent, 40);

  const exact = calculateWorkOptional(inputs, 125000);
  closeTo(exact.progress.achievementPercent, 100);
  assert.equal(exact.progress.remainingPrincipal, 0);

  const above = calculateWorkOptional(inputs, 250000);
  closeTo(above.progress.achievementPercent, 200);
  assert.equal(above.progress.progressBarPercent, 100);
  assert.equal(above.progress.remainingPrincipal, 0);
});

test("explicit $0 principal is valid progress; missing or invalid principal is omitted", () => {
  const zero = calculate({}, 0);
  assert.equal(zero.progress.currentDeployedPrincipal, 0);
  assert.equal(zero.progress.achievementPercent, 0);
  assert.equal(calculate().progress, null);
  assert.equal(calculate({}, -50).progress, null);
  assert.equal(calculate({}, Infinity).progress, null);
});

test("zero required principal shows target already covered instead of division by zero", () => {
  const result = calculate({ otherGrossPassiveIncome: "10000" }, 10000);
  assert.equal(result.progress.targetAlreadyCovered, true);
  assert.equal(result.progress.achievementPercent, null);
  assert.equal(result.progress.remainingPrincipal, 0);
  assert.equal(result.progress.progressBarPercent, 100);
});

test("valid decimal input is accepted while invalid field syntax is rejected", () => {
  const accepted = validateWorkOptionalInputs({
    ...base,
    monthlyExpenses: ".50",
    bufferPercent: "12.5"
  });
  assert.equal(accepted.valid, true);
  closeTo(accepted.values.monthlyExpenses, 0.5);
  closeTo(accepted.values.bufferPercent, 12.5);
  assert.equal(validateWorkOptionalInputs({ ...base, bufferPercent: "x" }).valid, false);
});
