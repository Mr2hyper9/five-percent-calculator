// Verified year-specific parameters, kept separate from all tax algorithms.
// Federal: IRS Rev. Proc. 2024-40 and 2025-32, as amended by P.L. 119-21.
// Arizona: Form 140 (2025); A.R.S. 43-1041 and HB 4168 (2026).
export const TAX_SOURCES = Object.freeze({
  federal2025: "https://www.irs.gov/irb/2024-45_IRB",
  federal2026: "https://www.irs.gov/irb/2025-45_IRB",
  federalUpdates: "https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers",
  arizona2025: "https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140i.pdf",
  arizona2026: "https://www.azleg.gov/ars/43/01041.htm",
  arizona2026Law: "https://www.azleg.gov/legtext/57leg/2R/summary/H.HB4168_061726_SIGNED.DOCX.htm",
  payroll2026: "https://www.ssa.gov/news/en/cola/factsheets/2026.html"
});

export const FILING_STATUSES = Object.freeze({
  single: "Single",
  mfj: "Married Filing Jointly",
  mfs: "Married Filing Separately",
  hoh: "Head of Household",
  qss: "Qualifying Surviving Spouse"
});

export const INCOME_CLASSES = Object.freeze({
  ordinary: "Ordinary taxable income",
  interest: "Taxable interest",
  qualifiedDividends: "Qualified dividends",
  longTermGains: "Long-term capital gains",
  shortTermGains: "Short-term capital gains",
  taxExempt: "Tax-exempt income (federal and state)",
  returnOfCapital: "Return of capital (non-taxable, basis available)",
  otherTaxable: "Other ordinary taxable income"
});

export const STATE_OPTIONS = Object.freeze({
  AZ: "Arizona (resident, supported subset)",
  AK: "Alaska (no individual income tax)",
  FL: "Florida (no individual income tax)",
  NV: "Nevada (no individual income tax)",
  NH: "New Hampshire (no individual income tax)",
  SD: "South Dakota (no individual income tax)",
  TN: "Tennessee (no individual income tax)",
  TX: "Texas (no individual income tax)",
  WY: "Wyoming (no individual income tax)"
});

const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const bracket = (limits) => Object.freeze(limits.map((max, i) => Object.freeze({ limit: max, rate: rates[i] })));
const preferential = (zeroMax, fifteenMax) => Object.freeze({ zeroMax, fifteenMax });

export const FEDERAL_YEARS = Object.freeze({
  2025: Object.freeze({
    year: 2025,
    standard: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625, qss: 31500 },
    ordinary: {
      single: bracket([11925, 48475, 103350, 197300, 250525, 626350, Infinity]),
      mfj: bracket([23850, 96950, 206700, 394600, 501050, 751600, Infinity]),
      mfs: bracket([11925, 48475, 103350, 197300, 250525, 375800, Infinity]),
      hoh: bracket([17000, 64850, 103350, 197300, 250500, 626350, Infinity]),
      qss: bracket([23850, 96950, 206700, 394600, 501050, 751600, Infinity])
    },
    capitalGains: {
      single: preferential(48350, 533400),
      mfj: preferential(96700, 600050),
      mfs: preferential(48350, 300000),
      hoh: preferential(64750, 566700),
      qss: preferential(96700, 600050)
    },
    additionalStandard: { married: 1600, unmarried: 2000 },
    ssWageBase: 176100,
    childCredit: 2200,
    otherDependentCredit: 500,
    enhancedSeniorDeduction: 6000
  }),
  2026: Object.freeze({
    year: 2026,
    standard: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 },
    ordinary: {
      single: bracket([12400, 50400, 105700, 201775, 256225, 640600, Infinity]),
      mfj: bracket([24800, 100800, 211400, 403550, 512450, 768700, Infinity]),
      mfs: bracket([12400, 50400, 105700, 201775, 256225, 384350, Infinity]),
      hoh: bracket([17700, 67450, 105700, 201750, 256200, 640600, Infinity]),
      qss: bracket([24800, 100800, 211400, 403550, 512450, 768700, Infinity])
    },
    capitalGains: {
      single: preferential(49450, 545500),
      mfj: preferential(98900, 613700),
      mfs: preferential(49450, 306850),
      hoh: preferential(66200, 579600),
      qss: preferential(98900, 613700)
    },
    additionalStandard: { married: 1650, unmarried: 2050 },
    ssWageBase: 184500,
    childCredit: 2200,
    otherDependentCredit: 500,
    enhancedSeniorDeduction: 6000
  })
});

// Arizona's 2026 basic standard deduction adjusts in the same manner as IRC
// basic standard deduction under A.R.S. 43-1041(H). Final 2026 Form 140 is
// not yet published: show this limitation alongside 2026 calculations.
export const ARIZONA_YEARS = Object.freeze({
  2025: Object.freeze({
    standard: { single: 15750, mfj: 31500, mfs: 15750, hoh: 23625 },
    rate: 0.025,
    childCredit: 100,
    otherDependentCredit: 25,
    charitableStandardPercentage: 0.34,
    seniorExemption: 2100,
    blindExemption: 1500
  }),
  2026: Object.freeze({
    standard: { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150 },
    rate: 0.025,
    childCredit: 125,
    otherDependentCredit: 25,
    charitableStandardPercentage: null,
    seniorExemption: 2100,
    blindExemption: 1500
  })
});

export const ANNUAL_INCOME_FIELDS = Object.freeze([
  ["w2Wages", "W-2 employment wages"],
  ["selfEmploymentProfit", "Self-employment profit (after business expenses)"],
  ["ordinaryIncome", "Other ordinary income"],
  ["taxableInterest", "Taxable interest"],
  ["qualifiedDividends", "Qualified dividends"],
  ["longTermGains", "Long-term capital gains"],
  ["shortTermGains", "Short-term capital gains"],
  ["taxExemptIncome", "Tax-exempt income"],
  ["returnOfCapital", "Return of capital"],
  ["otherTaxableIncome", "Other taxable income"]
]);
