import {
  ANNUAL_INCOME_FIELDS,
  FILING_STATUSES,
  INCOME_CLASSES,
  STATE_OPTIONS
} from "./workOptionalTaxData.js";

const inputClass = "mt-1.5 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-100";
const labelClass = "block text-sm font-medium text-slate-800";

function ErrorMessage({ error }) {
  return error ? <p role="alert" className="mt-1 text-xs leading-5 text-rose-700">{error}</p> : null;
}

function SelectInput({ label, value, onChange, options, error, prompt, description }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {description && <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={inputClass + (error ? " border-rose-400" : "")}
      >
        {prompt && <option value="">{prompt}</option>}
        {Object.entries(options).map(([key, name]) => (
          <option key={key} value={key}>{name}</option>
        ))}
      </select>
      <ErrorMessage error={error} />
    </label>
  );
}

function MoneyInput({ label, value, onChange, error, hint = "" }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={inputClass + (error ? " border-rose-400" : "")}
      />
      <ErrorMessage error={error} />
    </label>
  );
}

function CountInput({ label, value, onChange, error, max }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={inputClass + (error ? " border-rose-400" : "")}
      />
      <ErrorMessage error={error} />
    </label>
  );
}

export default function DetailedTaxInputs({ inputs, onChange, errors, otherPassiveAmount }) {
  const update = (key, value) => onChange({ ...inputs, [key]: value });
  const updateAnnualAmount = (key, value) => onChange({
    ...inputs,
    annualIncome: { ...inputs.annualIncome, [key]: value }
  });
  const updateContinuing = (key, value) => onChange({
    ...inputs,
    continuing: { ...inputs.continuing, [key]: value }
  });

  return (
    <section className="mt-6 border-t border-slate-200 pt-5" aria-labelledby="detailed-tax-inputs-heading">
      <h3 id="detailed-tax-inputs-heading" className="text-base font-semibold text-slate-950">
        Detailed tax assumptions
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Annual amounts are entered for the selected tax year. Use estimated continuing
        household income after you stop working. The classifications chosen here affect the tax engine,
        including whether a 5% Model payout is taxable at all.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <SelectInput
          label="Tax year"
          value={inputs.taxYear}
          onChange={(v) => update("taxYear", v)}
          options={{ 2026: "2026 (current tax year)", 2025: "2025" }}
          error={errors.taxYear}
        />
        <SelectInput
          label="Filing status"
          value={inputs.filingStatus}
          onChange={(v) => update("filingStatus", v)}
          options={FILING_STATUSES}
          error={errors.filingStatus}
        />
        <SelectInput
          label="State of residence"
          value={inputs.state}
          onChange={(v) => update("state", v)}
          options={STATE_OPTIONS}
          error={errors.state}
          description="Only full-year Arizona resident rules and listed states without individual income tax are supported."
        />
        <SelectInput
          label="5% Model payout tax classification"
          value={inputs.modelIncomeClass}
          onChange={(v) => update("modelIncomeClass", v)}
          options={INCOME_CLASSES}
          prompt="Choose the actual tax treatment"
          error={errors.modelIncomeClass}
          description="Required. No tax characterization is assumed for the 5% payout."
        />
        <SelectInput
          label="Other monthly passive income classification"
          value={inputs.otherPassiveIncomeClass}
          onChange={(v) => update("otherPassiveIncomeClass", v)}
          options={INCOME_CLASSES}
          prompt={Number(otherPassiveAmount) > 0 ? "Choose the actual tax treatment" : "No other passive income entered"}
          error={errors.otherPassiveIncomeClass}
          description="Choose when other passive income is above $0. Do not enter the model payout here."
        />
        <SelectInput
          label="Federal deduction method"
          value={inputs.deductionMethod}
          onChange={(v) => update("deductionMethod", v)}
          options={{ standard: "Standard deduction", itemized: "Itemized deductions" }}
          error={errors.deductionMethod}
        />
        {inputs.filingStatus === "mfs" && (
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded accent-slate-900"
              checked={inputs.spouseItemizes}
              onChange={(event) => update("spouseItemizes", event.target.checked)}
            />
            My spouse itemizes deductions (MFS)
          </label>
        )}
        {inputs.deductionMethod === "itemized" && (
          <>
            <MoneyInput
              label="Annual federal itemized deductions"
              value={inputs.itemizedDeduction}
              onChange={(v) => update("itemizedDeduction", v)}
              error={errors.itemizedDeduction}
              hint="Enter the allowable Schedule A total after applicable caps and limits."
            />
            {inputs.state === "AZ" && (
              <MoneyInput
                label="Annual Arizona itemized deductions"
                value={inputs.arizonaItemizedDeduction}
                onChange={(v) => update("arizonaItemizedDeduction", v)}
                error={errors.arizonaItemizedDeduction}
                hint="Enter a separate Arizona-qualified amount, after state adjustments and limits."
              />
            )}
          </>
        )}
        <MoneyInput
          label="Annual eligible above-the-line adjustments"
          value={inputs.annualAdjustments}
          onChange={(v) => update("annualAdjustments", v)}
          error={errors.annualAdjustments}
          hint="Enter only adjustments allowed under federal law, excluding the half self-employment tax deduction computed automatically."
        />
        <MoneyInput
          label="Annual eligible charitable contributions"
          value={inputs.charitableContributions}
          onChange={(v) => update("charitableContributions", v)}
          error={errors.charitableContributions}
          hint="For standard deduction enhancements. If itemizing, include qualifying charity in itemized totals instead. No duplicate deduction."
        />
        <CountInput
          label="Eligible age 65+ taxpayers"
          max="2"
          value={inputs.seniorCount}
          onChange={(v) => update("seniorCount", v)}
          error={errors.seniorCount}
        />
        <CountInput
          label="Eligible blind taxpayers"
          max="2"
          value={inputs.blindCount}
          onChange={(v) => update("blindCount", v)}
          error={errors.blindCount}
        />
        <CountInput
          label="Qualified children under 17 (valid SSN)"
          max="20"
          value={inputs.qualifyingChildren}
          onChange={(v) => update("qualifyingChildren", v)}
          error={errors.qualifyingChildren}
        />
        <CountInput
          label="Other credit-eligible dependents"
          max="20"
          value={inputs.otherDependents}
          onChange={(v) => update("otherDependents", v)}
          error={errors.otherDependents}
        />
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h4 className="text-sm font-semibold text-slate-900">Additional annual household income</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          These sources are in addition to the monthly Other Passive Income amount above. Do not
          enter any income twice. A source marked Stops is excluded from both the work-optional
          income target and the future tax estimate. Employment and self-employment default to Stops.
          Annual wages and self-employment amounts use 1 individual for Social Security wage-base coordination.
        </p>
        <div className="mt-4 space-y-4">
          {ANNUAL_INCOME_FIELDS.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <MoneyInput
                label={label + " (annual $)"}
                value={inputs.annualIncome[key]}
                onChange={(v) => updateAnnualAmount(key, v)}
                error={errors[key]}
              />
              <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={inputs.continuing[key]}
                  onChange={(event) => updateContinuing(key, event.target.checked)}
                />
                Continues after employment ends
              </label>
              {!inputs.continuing[key] && <p className="mt-1 text-xs text-slate-500">Not counted toward the work-optional target.</p>}
              <ErrorMessage error={errors[key + "Continuing"]} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
        <strong>Scope and assumptions.</strong> Qualified dividends and long-term gains use federal
        preferential brackets; interest and short-term gains use ordinary brackets. Tax-exempt
        means exempt federally and in the selected state. Return of capital assumes adequate
        basis and excludes future basis exhaustion. This is a supported subset, not a complete
        federal or state return. AMT, QBI, refundable credits (including ACTC/EITC),
        filing-specific eligibility, tax-exempt bond state variations, and unentered
        adjustments or credits are not calculated. Income classified as ordinary is treated
        as non-NIIT income and is not assumed to owe self-employment taxes. Arizona family,
        excise, and specialized credits are not modeled. For Arizona 2026, statutory rates
        and deductions are used, but the final resident return instructions have not been published.
      </div>
    </section>
  );
}
