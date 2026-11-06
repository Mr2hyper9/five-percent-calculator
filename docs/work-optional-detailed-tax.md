# Work Optional Calculator: Detailed tax estimation

This feature adds an optional **Detailed** tax mode to the existing Work Optional Calculator, without changing Simple-mode formulas, the 5% monthly payout rule, investment compounding assumptions, or unrelated tabs.

## Annual tax-data coverage

- **Federal tax years 2025 and 2026**, all 5 federal filing statuses. Ordinary progressive brackets, basic and additional standard deductions for seniors/blind filers, enhanced senior deduction including MAGI phaseout, qualified dividends and long-term capital gains, nonrefundable Child Tax Credit and Other Dependent Credit with $50/$1,000 MAGI phaseout, payroll and self-employment taxes, additional Medicare and NIIT.
- **Arizona full-year resident income tax**, 2025 and 2026 modeled subset. Arizona starts from federal adjusted gross income rather than federal taxable income, uses its own standard/itemized deduction, 2.5% rate, qualifying senior/blind exemptions, charitable standard deduction enhancement where supported, and dependent credit with income phaseout.
- **No individual income tax in the supported estimator scope**: Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Wyoming. Other states and partial-year/nonresident cases are not supported. This does not imply the absence of local or other types of tax.
- Arizona tax year 2026 uses enacted Arizona law and the same inflation adjustment basis as IRS for standard deductions, but final Arizona Form 140 instructions for 2026 have not yet been issued. Review the updated state form when published.

## Payout and income classifications

The 5% payout is **not assumed** to be ordinary income, qualified dividends, capital gains, or return of capital. A user must explicitly choose its tax classification before a nonzero model principal can be calculated in Detailed mode.

Other gross passive income has its own classification, and additional household income uses separate **annual** fields. Fields for W-2 wages and self-employment profit default to **Stops after employment**, while the other source fields default to **Continues**. Only continuing income is included in the work-optional model. The same source must not be entered in both other passive income and the annual fields.

Amounts classified as **tax-exempt** are assumed exempt from both federal and selected state income tax. **Return of capital** assumes sufficient remaining basis and is treated as cash but not taxable income. The model does not check basis depletion.

Income classified as ordinary is not automatically treated as net investment income or self-employment income. Qualified dividends, taxable interest, and capital gains are assigned investment-income treatment where applicable.

## Deductions and credits

The calculator chooses **either** the standard deduction or the user-provided total federal itemized deductions, not both. Where Arizona itemization is selected, a separately entered state-allowable itemized deduction is required. The user is responsible for ensuring itemized totals include applicable limitations. Annual above-the-line adjustments can be entered, but the deduction for half of eligible self-employment tax is computed automatically and must not be entered again. Charitable contributions are entered separately for applicable nonitemizer provisions and must not also be included in itemized deduction totals for the same jurisdiction.

Children under 17 with the required Social Security numbers and other qualifying dependents are entered separately. Credits are nonrefundable in this model. Enhanced senior deductions assume the indicated individuals meet statutory eligibility, including identification and filing status.

## Principal solver

At principal P, annual model payouts are fixed at P × 0.05 × 12. Each candidate recomputes year-specific federal progressive tax, state tax, investment income tax, credits and payroll taxes. The target is the **minimum principal to the cent** with annual after-tax continuing household income at or above twelve times the monthly living-expense-plus-buffer target.

Federal/Arizona dependent-credit phaseout steps can make net income fall locally as gross income rises. The solver enumerates the modeled $1,000 AGI phaseout boundaries, divides the principal range into segments and searches whole cents within each segment, selecting the first verified feasible amount. It never relies on globally monotonic net income through a phaseout step. Calculations fail explicitly when they exceed the supported financial range or the cent-accurate solution cannot be established.

## Important limitations

This is a planning estimator, **not tax software**. The following are not calculated:

- Federal alternative minimum tax, QBI deduction, additional investment-specific adjustments, foreign income exclusions or specialized tax forms.
- Refundable child credit, EITC, other refundable credits, education credits, adoption or complex dependent-care credits.
- Some state income adjustments, Arizona capital-gain subtraction, Arizona family/excise/specialized tax credits, Arizona nonresident/part-year forms, multi-state allocation, city income taxes.
- Other non-income taxes, some filing-status eligibility rules, personal asset-basis exhaustion, and precise Social Security and retirement-distribution taxation.

Income and credit eligibility are assumed from user inputs. The annual federal tax **effective** rate is federal income tax (including modeled NIIT) divided by annual gross household cash receipts; state effective rate uses the same denominator. Payroll and self-employment taxes are reported separately and included in total estimated taxes. These effective rates are not marginal brackets.

Detailed form inputs and mode are saved only in the user's browser using local storage. Model principal progress is shown only after a principal value has been explicitly entered in the existing 5% Model tab in that session.

## Verified sources

- Federal brackets, deductions, preferential income and credits, 2025: https://www.irs.gov/irb/2024-45_IRB
- Federal brackets, deductions, preferential income and credits, 2026: https://www.irs.gov/irb/2025-45_IRB
- Subsequent federal law changes and enhanced senior deduction: https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers
- NIIT/Additional Medicare guidance: https://www.irs.gov/publications/p505
- Social Security wage base, 2026: https://www.ssa.gov/news/en/cola/factsheets/2026.html
- Arizona 2025 Form 140 instructions: https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140i.pdf
- Arizona standard deduction statute: https://www.azleg.gov/ars/43/01041.htm
- Arizona enacted tax changes for 2026: https://www.azleg.gov/legtext/57leg/2R/summary/H.HB4168_061726_SIGNED.DOCX.htm

## Verification

Run npm test and npm run build. The repository's GitHub Actions workflow also runs targeted ESLint checks for the Work Optional Calculator files.
