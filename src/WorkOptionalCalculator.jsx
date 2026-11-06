import { useEffect, useMemo, useState } from "react";
import { calculateWorkOptional } from "./workOptionalCalculations.js";
import DetailedTaxInputs from "./WorkOptionalDetailedTaxInputs.jsx";
import { DEFAULT_DETAILED_INPUTS, DETAILED_DISCLAIMER, SIMPLE_DISCLAIMER } from "./workOptionalDetailedTax.js";
import { TAX_SOURCES } from "./workOptionalTaxData.js";

const STARTING_INPUTS = {
  monthlyExpenses: "5000",
  federalTaxPercent: "20",
  stateTaxPercent: "0",
  otherGrossPassiveIncome: "0",
  bufferPercent: "25"
};

const PREFERENCES_KEY = "ffs.workOptional.advanced.v1";

function getSavedWorkOptional() {
  const defaults = { mode: "simple", inputs: STARTING_INPUTS, detailed: DEFAULT_DETAILED_INPUTS };
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaults;
    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || "null");
    if (!stored || typeof stored !== "object") return defaults;
    const inputs = { ...STARTING_INPUTS };
    for (const key of Object.keys(inputs)) {
      if (typeof stored.inputs?.[key] === "string") inputs[key] = stored.inputs[key];
    }
    const detailed = {
      ...DEFAULT_DETAILED_INPUTS,
      ...(stored.detailed && typeof stored.detailed === "object" ? stored.detailed : {}),
      annualIncome: { ...DEFAULT_DETAILED_INPUTS.annualIncome, ...stored.detailed?.annualIncome },
      continuing: { ...DEFAULT_DETAILED_INPUTS.continuing, ...stored.detailed?.continuing }
    };
    return { mode: stored.mode === "detailed" ? "detailed" : "simple", inputs, detailed };
  } catch {
    return defaults;
  }
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

function dollars(value) {
  return currencyFormatter.format(Math.abs(value) < 0.0000001 ? 0 : value);
}

function percent(value) {
  return percentFormatter.format(value) + "%";
}

function NumericField({ id, label, description, value, onChange, kind = "money", error }) {
  const isMoney = kind === "money";

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <p id={id + "-hint"} className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
      <div className="relative mt-2">
        <span
          aria-hidden="true"
          className={"pointer-events-none absolute inset-y-0 flex items-center text-sm font-medium text-slate-500 " + (isMoney ? "left-3" : "right-3")}
        >
          {isMoney ? "$" : "%"}
        </span>
        <input
          id={id}
          name={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={id + "-hint" + (error ? " " + id + "-error" : "")}
          className={
            "w-full rounded-xl border bg-white px-3 py-2.5 text-base text-slate-950 outline-none transition focus:ring-2 " +
            (isMoney ? "pl-8 " : "pr-9 ") +
            (error
              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
              : "border-slate-300 focus:border-slate-700 focus:ring-slate-100")
          }
        />
      </div>
      {error && (
        <p id={id + "-error"} className="mt-1 text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium leading-5 text-slate-600">{label}</div>
      <div className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-950">{value}</div>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function BreakdownRow({ label, value, important = false }) {
  return (
    <div className={"flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm " + (important ? "font-semibold text-slate-950" : "text-slate-700")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ProgressSection({ progress }) {
  if (!progress) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="work-progress-heading">
      <h2 id="work-progress-heading" className="text-lg font-semibold text-slate-950">
        Progress toward the target
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Based on the last principal you explicitly entered in the 5% Model during this session, not a verified account balance.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Current deployed principal" value={dollars(progress.currentDeployedPrincipal)} />
        <Stat label="Current gross monthly 5% payout" value={dollars(progress.currentModelPayout)} />
        <Stat label="Remaining principal required" value={dollars(progress.actionableRemainingPrincipal)} />
      </div>
      {progress.targetAlreadyCovered ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          Target Already Covered
        </p>
      ) : (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-700">Principal target achievement</span>
            <span className="font-semibold tabular-nums text-slate-950">{percent(progress.achievementPercent)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Principal target achievement"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progressBarPercent}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: String(progress.progressBarPercent) + "%" }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function IncomeBreakdown({ result }) {
  const hasGrossIncome = result.actualGrossIncome > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="income-breakdown-heading">
      <h2 id="income-breakdown-heading" className="text-lg font-semibold text-slate-950">
        Projected monthly income breakdown
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Gross income sources and the amount available after estimated taxes.
      </p>

      <div
        className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={
          "Gross monthly payout from the 5% model: " + dollars(result.requiredModelPayout) +
          ". Other gross passive income: " + dollars(result.otherGrossPassiveIncome) +
          ". Additional continuing household income: " + dollars(result.otherContinuingMonthlyIncome || 0) + "."
        }
      >
        {hasGrossIncome && result.requiredModelPayout > 0 && (
          <div
            className="h-full bg-indigo-600"
            style={{ width: String(result.modelPayoutSharePercent) + "%" }}
          />
        )}
        {hasGrossIncome && result.otherGrossPassiveIncome > 0 && (
          <div
            className="h-full bg-teal-500"
            style={{ width: String(result.otherPassiveSharePercent) + "%" }}
          />
        )}
        {hasGrossIncome && (result.otherContinuingMonthlyIncome || 0) > 0 && (
          <div
            className="h-full bg-amber-500"
            style={{ width: String(result.otherContinuingSharePercent) + "%" }}
          />
        )}
      </div>
      {!hasGrossIncome && <p className="mt-2 text-xs text-slate-500">No projected gross income for these inputs.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-indigo-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
            Gross 5% Model payout
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-indigo-950">{dollars(result.requiredModelPayout)}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
            Other gross passive income
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums text-teal-950">{dollars(result.otherGrossPassiveIncome)}</p>
        </div>
        {result.taxMode === "detailed" && (
          <div className="rounded-xl bg-amber-50 p-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              Additional continuing household income (monthly equivalent)
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-950">
              {dollars(result.otherContinuingMonthlyIncome)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 divide-y divide-slate-100 border-t border-slate-200">
        <BreakdownRow label="Total projected gross monthly income" value={dollars(result.actualGrossIncome)} important />
        <BreakdownRow label={result.taxMode === "detailed" ? "Estimated total monthly federal, state, and payroll taxes" : "Estimated combined federal and state taxes"} value={"−" + dollars(result.estimatedMonthlyTaxes)} />
        <BreakdownRow label="Total projected after-tax income" value={dollars(result.actualNetIncome)} important />
        <BreakdownRow label="Monthly recurring living expenses" value={"−" + dollars(result.monthlyExpenses)} />
        <BreakdownRow label="Required extra income buffer" value={dollars(result.requiredBufferIncome)} />
        <BreakdownRow label="Additional surplus above target" value={dollars(result.monthlySurplus)} />
        <BreakdownRow label="Total monthly extra income above living expenses" value={dollars(result.actualExtraIncome)} important />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        The required buffer is part of the income target. Additional surplus is the income above that target and is not counted again as buffer.
      </p>
    </section>
  );
}

export default function WorkOptionalCalculator({ currentDeployedPrincipal = null }) {
  const [saved] = useState(getSavedWorkOptional);
  const [inputs, setInputs] = useState(saved.inputs);
  const [taxMode, setTaxMode] = useState(saved.mode);
  const [detailedInputs, setDetailedInputs] = useState(saved.detailed);
  const initialBuffer = Number(saved.inputs.bufferPercent);
  const [lastValidBufferPercent, setLastValidBufferPercent] = useState(
    Number.isFinite(initialBuffer) && initialBuffer >= 0 && initialBuffer <= 100 ? initialBuffer : 25
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
        mode: taxMode, inputs, detailed: detailedInputs
      }));
    } catch {
      // Browsers that block local storage still have a working in-session form.
    }
  }, [taxMode, inputs, detailedInputs]);

  const result = useMemo(
    () => calculateWorkOptional(inputs, currentDeployedPrincipal, { mode: taxMode, detailed: detailedInputs }),
    [inputs, currentDeployedPrincipal, taxMode, detailedInputs]
  );

  function updateInput(key, value) {
    setInputs((previous) => ({ ...previous, [key]: value }));
    if (key === "bufferPercent") {
      const trimmed = value.trim();
      const number = Number(trimmed);
      if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) && Number.isFinite(number) && number >= 0 && number <= 100) {
        setLastValidBufferPercent(number);
      }
    }
  }

  function updateBufferSlider(value) {
    setInputs((previous) => ({ ...previous, bufferPercent: value }));
    setLastValidBufferPercent(Number(value));
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm md:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">5% Model planning</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Work Optional Calculator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Estimate the principal needed to cover recurring household expenses, estimated income taxes, and an optional income buffer.
            The model pays 5% of original deployed principal each month, without automatically compounding payouts.
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby="work-inputs-heading">
              <h2 id="work-inputs-heading" className="text-lg font-semibold">Your monthly assumptions</h2>
              <div className="mt-4" role="group" aria-label="Tax estimation mode">
                <div className="mb-2 text-sm font-semibold text-slate-700">Tax calculation mode</div>
                <div className="flex w-full max-w-md gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    aria-pressed={taxMode === "simple"}
                    onClick={() => setTaxMode("simple")}
                    className={"min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                      (taxMode === "simple" ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200")}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    aria-pressed={taxMode === "detailed"}
                    onClick={() => setTaxMode("detailed")}
                    className={"min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                      (taxMode === "detailed" ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-200")}
                  >
                    Detailed
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Change any value to immediately update the funding target. Starting amounts are examples, not saved account data.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <NumericField
                  id="monthlyExpenses"
                  label="Monthly recurring living expenses"
                  description="Total expected household expenses each month."
                  value={inputs.monthlyExpenses}
                  onChange={(value) => updateInput("monthlyExpenses", value)}
                  error={result.errors.monthlyExpenses}
                />
                {taxMode === "simple" && (
                  <>
                    <NumericField
                  id="federalTaxPercent"
                  label="Federal effective tax rate"
                  description="Estimated effective federal income tax percentage, not your marginal bracket."
                  kind="percent"
                  value={inputs.federalTaxPercent}
                  onChange={(value) => updateInput("federalTaxPercent", value)}
                  error={result.errors.federalTaxPercent}
                />
                <NumericField
                  id="stateTaxPercent"
                  label="State effective tax rate"
                  description="Estimated effective state income tax percentage. Defaults to 0%."
                  kind="percent"
                  value={inputs.stateTaxPercent}
                  onChange={(value) => updateInput("stateTaxPercent", value)}
                  error={result.errors.stateTaxPercent}
                />
                {result.errors.combinedTaxRate && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2 lg:col-span-1">
                    {result.errors.combinedTaxRate}
                  </p>
                )}
                  </>
                )}
                <NumericField
                  id="otherGrossPassiveIncome"
                  label="Other passive income (gross monthly)"
                  description="Income before taxes, excluding all 5% Model payouts to prevent double-counting."
                  value={inputs.otherGrossPassiveIncome}
                  onChange={(value) => updateInput("otherGrossPassiveIncome", value)}
                  error={result.errors.otherGrossPassiveIncome}
                />
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <NumericField
                  id="bufferPercent"
                  label="Extra income buffer"
                  description="Additional after-tax income above monthly living expenses."
                  kind="percent"
                  value={inputs.bufferPercent}
                  onChange={(value) => updateInput("bufferPercent", value)}
                  error={result.errors.bufferPercent}
                />
                <input
                  type="range"
                  aria-label="Extra income buffer slider"
                  min="0"
                  max="100"
                  step="0.01"
                  value={lastValidBufferPercent}
                  onChange={(event) => updateBufferSlider(event.target.value)}
                  className="mt-4 w-full cursor-pointer accent-slate-900"
                />
                <div className="flex justify-between text-xs font-medium text-slate-500">
                  <span>0%</span>
                  <span>{percent(lastValidBufferPercent)} buffer</span>
                  <span>100%</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  0% covers 100% of expenses. 25% targets 125%. 100% targets 200%.
                </p>
              </div>
              {taxMode === "detailed" && (
                <DetailedTaxInputs
                  inputs={detailedInputs}
                  onChange={setDetailedInputs}
                  errors={result.errors}
                  otherPassiveAmount={inputs.otherGrossPassiveIncome}
                />
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Work Optional assumptions and tax mode are saved in this browser only. 5% Model
                principal progress still uses explicitly entered principal for this session.
              </p>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-sm leading-6 text-slate-700">
              <h2 className="font-semibold text-slate-900">Tax assumptions</h2>
              <p className="mt-2">{taxMode === "simple" ? SIMPLE_DISCLAIMER : DETAILED_DISCLAIMER}</p>
              {taxMode === "detailed" && (
                <p className="mt-3 text-xs leading-5">
                  Verified sources: <a className="underline" href={detailedInputs.taxYear === "2025" ? TAX_SOURCES.federal2025 : TAX_SOURCES.federal2026} target="_blank" rel="noreferrer">IRS federal tax data</a>
                  {detailedInputs.state === "AZ" && (
                    <>{" | "}<a className="underline" href={detailedInputs.taxYear === "2025" ? TAX_SOURCES.arizona2025 : TAX_SOURCES.arizona2026Law} target="_blank" rel="noreferrer">Arizona tax rules</a></>
                  )}.
                </p>
              )}
            </aside>
          </div>

          <div className="min-w-0 space-y-6">
            {!result.valid ? (
              <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm" role="status">
                <h2 className="text-lg font-semibold text-rose-900">Results unavailable</h2>
                <p className="mt-2 text-sm leading-6 text-rose-800">
                  Correct the highlighted input values to display an accurate funding target.
                </p>
                {result.errors.calculation && <p className="mt-2 text-sm text-rose-800">{result.errors.calculation}</p>}
              </section>
            ) : (
              <>
                <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm" aria-labelledby="principal-result-heading">
                  <p id="principal-result-heading" className="text-sm font-semibold text-slate-300">
                    Required 5% Model Principal
                  </p>
                  <div className="mt-2 break-words text-3xl font-bold tracking-tight tabular-nums md:text-4xl" aria-live="polite">
                    {dollars(result.actionableRequiredPrincipal)}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    The actionable principal target is rounded up to the nearest cent. Gross monthly payouts are calculated at 5% of the original deployed principal, with no automatic compounding.
                  </p>
                  {result.requiresNoModelPrincipal && (
                    <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-900/40 p-3 text-sm text-emerald-50">
                      <strong>Target Already Covered.</strong>{" "}
                      {result.otherPassiveCoversTarget
                        ? "Your other passive income already covers your required after-tax target without additional 5% Model principal."
                        : "No 5% Model principal is needed for the current income target."}
                      {result.monthlySurplus > 0 && (
                        <span className="mt-1 block">Additional monthly after-tax surplus: {dollars(result.monthlySurplus)}.</span>
                      )}
                    </div>
                  )}
                </section>

                <section className="grid gap-3 sm:grid-cols-2" aria-label="Work optional calculation results">
                  <Stat label="Required monthly after-tax household income" value={dollars(result.requiredNetIncome)} />
                  <Stat label="Required total gross monthly income" value={dollars(result.requiredGrossIncome)} />
                  <Stat label="Other gross passive income contribution" value={dollars(result.otherGrossPassiveIncome)} />
                  <Stat label="Required gross monthly 5% Model payout" value={dollars(result.requiredModelPayout)} />
                  <Stat label="Required annual gross 5% Model payout" value={dollars(result.annualModelPayout)} />
                  <Stat label="Combined effective tax rate" value={percent(result.combinedTaxPercent)} />
                  <Stat label="Estimated monthly taxes on actual projected income" value={dollars(result.estimatedMonthlyTaxes)} />
                  <Stat label="Actual projected monthly after-tax income" value={dollars(result.actualNetIncome)} />
                  <Stat label="Extra monthly income above living expenses" value={dollars(result.actualExtraIncome)} />
                  <Stat label="Additional monthly surplus above target" value={dollars(result.monthlySurplus)} />
                  {taxMode === "detailed" && (
                    <>
                      <Stat label="Required annual gross household income" value={dollars(result.annualGrossHouseholdIncome)} />
                      <Stat label="Annual federal income tax (includes NIIT)" value={dollars(result.annualFederalIncomeTax)} />
                      <Stat label="Annual state income tax" value={dollars(result.annualStateIncomeTax)} />
                      <Stat label="Annual payroll and self-employment taxes" value={dollars(result.annualPayrollTaxes)} />
                      <Stat label="Total estimated annual taxes" value={dollars(result.totalAnnualTaxes)} />
                      <Stat label="Effective federal income tax rate" value={percent(result.federalEffectivePercent)} />
                      <Stat label="Effective state income tax rate" value={percent(result.stateEffectivePercent)} />
                      <Stat label="Federal taxable income (annual)" value={dollars(result.annualTaxableIncome)} />
                      <Stat label="Arizona taxable income (annual)" value={dollars(result.annualStateTaxableIncome)} />
                    </>
                  )}
                </section>
                {taxMode === "detailed" && (
                  <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                    Effective federal and state tax rates are their respective estimated annual income-tax
                    liabilities divided by <strong>{result.effectiveRateDenominator.toLowerCase()}</strong>.
                    Payroll and self-employment taxes appear separately and are included in total taxes.
                    Annual tax liability is recalculated for each potential 5% Model principal.
                  </p>
                )}

                <ProgressSection progress={result.progress} />
                <IncomeBreakdown result={result} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
