import React, { useMemo, useState } from "react";

function brackets(thresholds, rates) {
  return rates.map((rate, index) => ({ upTo: thresholds[index] ?? Infinity, rate }));
}

const federalTaxData = {
  2025: {
    year: 2025,
    sourceLabel: "IRS 2025 rates and OBBB-adjusted standard deduction, manually entered from official IRS pages",
    standardDeduction: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 },
    ordinaryBrackets: {
      single: brackets([11925, 48475, 103350, 197300, 250525, 626350], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      mfj: brackets([23850, 96950, 206700, 394600, 501050, 751600], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      qss: brackets([23850, 96950, 206700, 394600, 501050, 751600], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      mfs: brackets([11925, 48475, 103350, 197300, 250525, 375800], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      hoh: brackets([17000, 64850, 103350, 197300, 250500, 626350], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37])
    },
    ltcgBrackets: {
      single: brackets([48350, 533400], [0, 0.15, 0.2]),
      mfj: brackets([96700, 600050], [0, 0.15, 0.2]),
      qss: brackets([96700, 600050], [0, 0.15, 0.2]),
      mfs: brackets([48350, 300000], [0, 0.15, 0.2]),
      hoh: brackets([64750, 566700], [0, 0.15, 0.2])
    },
    socialSecurityWageBase: 176100,
    childTaxCreditPerChild: 2200,
    otherDependentCredit: 500,
    saltCap: 10000
  },
  2026: {
    year: 2026,
    sourceLabel: "IRS 2026 rates, manually entered from official IRS OBBB inflation-adjustment release. Long-term capital gain brackets are carried forward as placeholder data until verified.",
    standardDeduction: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 },
    ordinaryBrackets: {
      single: brackets([12400, 50400, 105700, 201775, 256225, 640600], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      mfj: brackets([24800, 100800, 211400, 403550, 512450, 768700], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      qss: brackets([24800, 100800, 211400, 403550, 512450, 768700], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      mfs: brackets([12400, 50400, 105700, 201775, 256225, 384350], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]),
      hoh: brackets([17700, 67550, 105700, 201750, 256200, 640600], [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37])
    },
    ltcgBrackets: {
      single: brackets([48350, 533400], [0, 0.15, 0.2]),
      mfj: brackets([96700, 600050], [0, 0.15, 0.2]),
      qss: brackets([96700, 600050], [0, 0.15, 0.2]),
      mfs: brackets([48350, 300000], [0, 0.15, 0.2]),
      hoh: brackets([64750, 566700], [0, 0.15, 0.2])
    },
    socialSecurityWageBase: 184500,
    childTaxCreditPerChild: 2200,
    otherDependentCredit: 500,
    saltCap: 10000
  }
};

function currency(value) {
  if (!Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function pct(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function progressiveTax(income, taxBrackets) {
  let tax = 0;
  let previous = 0;
  const safeIncome = Math.max(0, income);

  for (const bracket of taxBrackets) {
    const taxableLayer = Math.max(0, Math.min(safeIncome, bracket.upTo) - previous);
    tax += taxableLayer * bracket.rate;
    previous = bracket.upTo;
    if (safeIncome <= bracket.upTo) break;
  }

  return tax;
}

function marginalRate(income, taxBrackets) {
  const safeIncome = Math.max(0, income);
  return taxBrackets.find((bracket) => safeIncome <= bracket.upTo)?.rate ?? taxBrackets[taxBrackets.length - 1].rate;
}

function capitalGainTax(totalTaxableIncome, preferentialIncome, taxBrackets) {
  const preferential = Math.max(0, preferentialIncome);
  const ordinary = Math.max(0, totalTaxableIncome - preferential);
  const taxWithPreferentialIncome = progressiveTax(ordinary + preferential, taxBrackets);
  const taxUsingOrdinarySpace = progressiveTax(ordinary, taxBrackets);
  return Math.max(0, taxWithPreferentialIncome - taxUsingOrdinarySpace);
}

function stateRule(inputs) {
  if (inputs.state === "AZ") {
    return {
      label: "Arizona",
      sourceLabel: "Arizona DOR 2025 flat 2.5% rate and 2025 standard deductions. 2026 is treated as pending unless updated.",
      flatRate: 0.025,
      standardDeduction: {
        single: 15750,
        mfs: 15750,
        mfj: 31500,
        qss: 31500,
        hoh: 23625
      }
    };
  }

  return {
    label: "Manual state estimate",
    sourceLabel: "Manual flat state rate entered by user. Not official state tax law.",
    manualRate: inputs.manualStateRate / 100,
    standardDeduction: federalTaxData[inputs.year].standardDeduction
  };
}

function calculate(inputs) {
  const fed = federalTaxData[inputs.year];
  const state = stateRule(inputs);
  const status = inputs.filingStatus;

  const netSEProfit = Math.max(0, inputs.seGrossIncome - inputs.seBusinessExpenses);
  const seTaxableEarnings = netSEProfit * 0.9235;
  const socialSecurityRoom = Math.max(0, fed.socialSecurityWageBase - inputs.w2Wages);
  const seSocialSecurityTax = Math.min(seTaxableEarnings, socialSecurityRoom) * 0.124;
  const seMedicareTax = seTaxableEarnings * 0.029;
  const seTax = seSocialSecurityTax + seMedicareTax;
  const deductibleHalfSETax = seTax / 2;

  const payrollSocialSecurity = Math.min(inputs.w2Wages, fed.socialSecurityWageBase) * 0.062;
  const payrollMedicare = inputs.w2Wages * 0.0145;
  const payrollTaxEstimate = payrollSocialSecurity + payrollMedicare;

  const grossIncome =
    inputs.w2Wages +
    netSEProfit +
    inputs.interestIncome +
    inputs.ordinaryDividends +
    inputs.qualifiedDividends +
    inputs.shortTermCapitalGains +
    inputs.longTermCapitalGains +
    inputs.rentalIncome +
    inputs.retirementIncome +
    inputs.otherTaxableIncome;

  const aboveLineDeductions =
    inputs.traditional401k +
    inputs.traditionalIra +
    inputs.hsa +
    inputs.healthInsurancePremiums +
    inputs.sepSolo401k +
    deductibleHalfSETax;

  const agi = Math.max(0, grossIncome - aboveLineDeductions);

  const saltDeduction = Math.min(fed.saltCap, inputs.stateLocalIncomeTaxesPaid + inputs.propertyTaxes);
  const medicalAllowed = Math.max(0, inputs.medicalExpenses - agi * 0.075);
  const itemized =
    inputs.mortgageInterest +
    saltDeduction +
    inputs.charitableDonations +
    medicalAllowed +
    inputs.otherItemizedDeductions;
  const standard = fed.standardDeduction[status];
  const federalDeductionUsed = inputs.forceItemize ? itemized : Math.max(standard, itemized);

  const taxableIncome = Math.max(0, agi - federalDeductionUsed);
  const taxablePreferentialIncome = Math.min(
    taxableIncome,
    Math.max(0, inputs.qualifiedDividends + inputs.longTermCapitalGains)
  );
  const taxableOrdinaryIncome = Math.max(0, taxableIncome - taxablePreferentialIncome);

  const regularOrdinaryTax = progressiveTax(taxableOrdinaryIncome, fed.ordinaryBrackets[status]);
  const capitalGainsTax = capitalGainTax(taxableIncome, taxablePreferentialIncome, fed.ltcgBrackets[status]);
  const federalIncomeTaxBeforeCredits = regularOrdinaryTax + capitalGainsTax;

  const childTaxCredit = inputs.qualifyingChildren * fed.childTaxCreditPerChild;
  const otherDependentCredit = inputs.otherDependents * fed.otherDependentCredit;
  const dependentCareLimit =
    inputs.qualifyingChildren > 1 ? 6000 : inputs.qualifyingChildren === 1 ? 3000 : 0;
  const dependentCareCredit = Math.min(inputs.dependentCareExpenses, dependentCareLimit) * 0.2;
  const federalCredits =
    childTaxCredit +
    otherDependentCredit +
    dependentCareCredit +
    inputs.educationCreditEstimate +
    inputs.eitcEstimate;
  const federalIncomeTax = Math.max(0, federalIncomeTaxBeforeCredits - federalCredits);

  const stateDeduction = state.standardDeduction[status] ?? standard;
  const stateTaxableIncome = Math.max(0, agi - stateDeduction);
  const stateRate = state.flatRate ?? state.manualRate ?? 0;
  const stateTax = stateTaxableIncome * stateRate;

  const totalTaxBurden = federalIncomeTax + stateTax + seTax + payrollTaxEstimate;
  const federalPayments =
    inputs.federalWithholding + inputs.federalEstimatedPayments + inputs.otherFederalPayments;
  const statePayments = inputs.stateWithholding + inputs.stateEstimatedPayments + inputs.otherStatePayments;
  const totalPayments = federalPayments + statePayments;
  const refundOrOwed = totalPayments - totalTaxBurden;
  const effectiveTaxRate = grossIncome > 0 ? totalTaxBurden / grossIncome : 0;

  const quarterlyFederalEstimate = Math.max(0, federalIncomeTax + seTax - federalPayments) / 4;
  const quarterlyStateEstimate = Math.max(0, stateTax - statePayments) / 4;

  return {
    grossIncome,
    netSEProfit,
    seTax,
    deductibleHalfSETax,
    payrollTaxEstimate,
    agi,
    federalDeductionUsed,
    taxableOrdinaryIncome,
    taxablePreferentialIncome,
    taxableIncome,
    regularOrdinaryTax,
    capitalGainsTax,
    federalIncomeTaxBeforeCredits,
    federalCredits,
    federalIncomeTax,
    stateTax,
    totalTaxBurden,
    federalPayments,
    statePayments,
    totalPayments,
    refundOrOwed,
    effectiveTaxRate,
    marginalFederalRate: marginalRate(taxableOrdinaryIncome, fed.ordinaryBrackets[status]),
    marginalStateRate: stateRate,
    monthlyReserve: Math.max(0, totalTaxBurden - totalPayments) / 12,
    quarterlyFederalEstimate,
    quarterlyStateEstimate
  };
}

const defaultInputs = {
  year: 2025,
  filingStatus: "single",
  state: "AZ",
  manualStateRate: 5,
  w2Wages: 60000,
  federalWithholding: 6500,
  stateWithholding: 1500,
  seGrossIncome: 0,
  seBusinessExpenses: 0,
  interestIncome: 0,
  ordinaryDividends: 0,
  qualifiedDividends: 0,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  rentalIncome: 0,
  retirementIncome: 0,
  otherTaxableIncome: 0,
  traditional401k: 0,
  traditionalIra: 0,
  hsa: 0,
  healthInsurancePremiums: 0,
  sepSolo401k: 0,
  mortgageInterest: 0,
  stateLocalIncomeTaxesPaid: 0,
  propertyTaxes: 0,
  charitableDonations: 0,
  medicalExpenses: 0,
  otherItemizedDeductions: 0,
  forceItemize: false,
  qualifyingChildren: 0,
  otherDependents: 0,
  dependentCareExpenses: 0,
  educationCreditEstimate: 0,
  eitcEstimate: 0,
  federalEstimatedPayments: 0,
  stateEstimatedPayments: 0,
  otherFederalPayments: 0,
  otherStatePayments: 0
};

function Field({ label, value, onChange, help }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(num(event.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
      />
      {help ? <span className="text-xs text-slate-500">{help}</span> : null}
    </label>
  );
}

function Section({ title, children, defaultOpen = true, warning }) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer select-none text-base font-semibold text-slate-900">{title}</summary>
      {warning ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{warning}</p> : null}
      <div className="mt-4 grid gap-4">{children}</div>
    </details>
  );
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-slate-100 py-2 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className="text-right text-slate-950">{value}</span>
    </div>
  );
}

export default function TaxCalculator() {
  const [inputs, setInputs] = useState(defaultInputs);
  const results = useMemo(() => calculate(inputs), [inputs]);
  const fed = federalTaxData[inputs.year];
  const state = stateRule(inputs);

  const set = (key, value) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4">
          <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h1 className="text-2xl font-bold">Tax Burden Estimator</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Borderline tax-software-style estimator for federal and state income tax, payroll tax, self-employment tax, credits, payments, refund, amount owed, and reserves.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                onClick={() => setInputs(defaultInputs)}
              >
                Reset tax calculator
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-slate-800 p-3 text-xs text-slate-300">
              Estimation only. Not tax, legal, accounting, or CPA advice. Simplified sections are labeled. Built-in data is manually entered from official sources and should be reviewed before production use.
            </p>
          </header>

          <Section title="1. Filing setup">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Tax year</span>
                <select
                  value={inputs.year}
                  onChange={(event) => set("year", Number(event.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Filing status</span>
                <select
                  value={inputs.filingStatus}
                  onChange={(event) => set("filingStatus", event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="single">Single</option>
                  <option value="mfj">Married filing jointly</option>
                  <option value="mfs">Married filing separately</option>
                  <option value="hoh">Head of household</option>
                  <option value="qss">Qualifying surviving spouse</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">State</span>
                <select
                  value={inputs.state}
                  onChange={(event) => set("state", event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="AZ">Arizona</option>
                  <option value="MANUAL">Manual flat state estimate</option>
                </select>
              </label>
              {inputs.state === "MANUAL" ? (
                <Field label="Manual state tax rate %" value={inputs.manualStateRate} onChange={(value) => set("manualStateRate", value)} />
              ) : null}
            </div>
            <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
              Federal data source note: {fed.sourceLabel}
              <br />
              State data source note: {state.sourceLabel}
            </div>
          </Section>

          <Section title="2. Income">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="W-2 wages" value={inputs.w2Wages} onChange={(value) => set("w2Wages", value)} />
              <Field label="Interest income" value={inputs.interestIncome} onChange={(value) => set("interestIncome", value)} />
              <Field label="Ordinary dividends" value={inputs.ordinaryDividends} onChange={(value) => set("ordinaryDividends", value)} />
              <Field label="Qualified dividends" value={inputs.qualifiedDividends} onChange={(value) => set("qualifiedDividends", value)} />
              <Field label="Short-term capital gains" value={inputs.shortTermCapitalGains} onChange={(value) => set("shortTermCapitalGains", value)} />
              <Field label="Long-term capital gains" value={inputs.longTermCapitalGains} onChange={(value) => set("longTermCapitalGains", value)} />
              <Field
                label="Rental income, simplified net"
                value={inputs.rentalIncome}
                onChange={(value) => set("rentalIncome", value)}
                help="Enter net taxable rental income after expenses and depreciation, if known."
              />
              <Field label="Retirement income, simplified" value={inputs.retirementIncome} onChange={(value) => set("retirementIncome", value)} />
              <Field label="Other taxable income" value={inputs.otherTaxableIncome} onChange={(value) => set("otherTaxableIncome", value)} />
            </div>
          </Section>

          <Section
            title="3. Self-employment"
            warning="Simplified. Does not replace Schedule C, Schedule SE, QBI, depreciation, home office, vehicle, inventory, or entity-specific rules."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Self-employment gross income" value={inputs.seGrossIncome} onChange={(value) => set("seGrossIncome", value)} />
              <Field label="Business expenses" value={inputs.seBusinessExpenses} onChange={(value) => set("seBusinessExpenses", value)} />
            </div>
          </Section>

          <Section
            title="4. Deductions"
            defaultOpen={false}
            warning="Itemized deductions are simplified. SALT cap and 7.5% AGI medical threshold are included. Full Schedule A limitations are not fully modeled."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Traditional 401(k)" value={inputs.traditional401k} onChange={(value) => set("traditional401k", value)} />
              <Field
                label="Traditional IRA"
                value={inputs.traditionalIra}
                onChange={(value) => set("traditionalIra", value)}
                help="Deductibility may phase out. This estimator treats the entered amount as deductible."
              />
              <Field label="HSA" value={inputs.hsa} onChange={(value) => set("hsa", value)} />
              <Field
                label="Health insurance premiums"
                value={inputs.healthInsurancePremiums}
                onChange={(value) => set("healthInsurancePremiums", value)}
                help="Use only if deductible in your situation."
              />
              <Field label="SEP IRA / Solo 401(k), simplified" value={inputs.sepSolo401k} onChange={(value) => set("sepSolo401k", value)} />
              <Field label="Mortgage interest" value={inputs.mortgageInterest} onChange={(value) => set("mortgageInterest", value)} />
              <Field label="State and local income taxes paid" value={inputs.stateLocalIncomeTaxesPaid} onChange={(value) => set("stateLocalIncomeTaxesPaid", value)} />
              <Field label="Property taxes" value={inputs.propertyTaxes} onChange={(value) => set("propertyTaxes", value)} />
              <Field label="Charitable donations" value={inputs.charitableDonations} onChange={(value) => set("charitableDonations", value)} />
              <Field label="Medical expenses" value={inputs.medicalExpenses} onChange={(value) => set("medicalExpenses", value)} />
              <Field label="Other itemized deductions" value={inputs.otherItemizedDeductions} onChange={(value) => set("otherItemizedDeductions", value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inputs.forceItemize}
                onChange={(event) => set("forceItemize", event.target.checked)}
              />
              Force itemized deduction instead of automatic best choice
            </label>
          </Section>

          <Section
            title="5. Credits and dependents"
            defaultOpen={false}
            warning="Credits are simplified. Child tax credit phaseouts, refundable portions, EITC complexity, and education credit eligibility are not fully modeled."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Qualifying children" value={inputs.qualifyingChildren} onChange={(value) => set("qualifyingChildren", value)} />
              <Field label="Other dependents" value={inputs.otherDependents} onChange={(value) => set("otherDependents", value)} />
              <Field
                label="Child and dependent care expenses"
                value={inputs.dependentCareExpenses}
                onChange={(value) => set("dependentCareExpenses", value)}
                help="Simplified at 20% of allowed expenses."
              />
              <Field label="Education credit estimate" value={inputs.educationCreditEstimate} onChange={(value) => set("educationCreditEstimate", value)} />
              <Field
                label="EITC estimate"
                value={inputs.eitcEstimate}
                onChange={(value) => set("eitcEstimate", value)}
                help="Manual advanced placeholder due to complex eligibility rules."
              />
            </div>
          </Section>

          <Section title="6. Withholding and payments">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Federal W-2 withholding" value={inputs.federalWithholding} onChange={(value) => set("federalWithholding", value)} />
              <Field label="State W-2 withholding" value={inputs.stateWithholding} onChange={(value) => set("stateWithholding", value)} />
              <Field label="Federal estimated payments" value={inputs.federalEstimatedPayments} onChange={(value) => set("federalEstimatedPayments", value)} />
              <Field label="State estimated payments" value={inputs.stateEstimatedPayments} onChange={(value) => set("stateEstimatedPayments", value)} />
              <Field label="Other federal payments" value={inputs.otherFederalPayments} onChange={(value) => set("otherFederalPayments", value)} />
              <Field label="Other state payments" value={inputs.otherStatePayments} onChange={(value) => set("otherStatePayments", value)} />
            </div>
          </Section>
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-6">
          <Section title="7. Results">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <SummaryRow
                label="Estimated refund / amount owed"
                value={
                  results.refundOrOwed >= 0
                    ? `${currency(results.refundOrOwed)} refund`
                    : `${currency(Math.abs(results.refundOrOwed))} owed`
                }
                highlight
              />
              <SummaryRow label="Total tax burden" value={currency(results.totalTaxBurden)} />
              <SummaryRow label="Total payments and withholding" value={currency(results.totalPayments)} />
              <SummaryRow label="Effective tax rate" value={pct(results.effectiveTaxRate)} />
              <SummaryRow label="Marginal federal bracket" value={pct(results.marginalFederalRate)} />
              <SummaryRow label="Marginal state bracket" value={pct(results.marginalStateRate)} />
              <SummaryRow label="Monthly reserve recommendation" value={currency(results.monthlyReserve)} highlight />
              <SummaryRow label="Quarterly federal estimate" value={currency(results.quarterlyFederalEstimate)} />
              <SummaryRow label="Quarterly state estimate" value={currency(results.quarterlyStateEstimate)} />
            </div>
          </Section>

          <Section title="8. Detailed breakdown">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-2 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                <span>Metric</span>
                <span className="text-right">Amount</span>
              </div>
              {[
                ["Gross income", results.grossIncome],
                ["Net Schedule C profit", results.netSEProfit],
                ["Adjusted gross income", results.agi],
                ["Deduction used", results.federalDeductionUsed],
                ["Taxable income", results.taxableIncome],
                ["Taxable ordinary income", results.taxableOrdinaryIncome],
                ["Taxable qualified dividends / LTCG", results.taxablePreferentialIncome],
                ["Ordinary federal tax", results.regularOrdinaryTax],
                ["Capital gains tax", results.capitalGainsTax],
                ["Federal income tax before credits", results.federalIncomeTaxBeforeCredits],
                ["Credits applied", results.federalCredits],
                ["Federal income tax", results.federalIncomeTax],
                ["State income tax", results.stateTax],
                ["Self-employment tax", results.seTax],
                ["Deductible half of SE tax", results.deductibleHalfSETax],
                ["Payroll tax estimate", results.payrollTaxEstimate]
              ].map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-2 border-t border-slate-200 px-4 py-2 text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="text-right font-medium">{currency(Number(value))}</span>
                </div>
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
