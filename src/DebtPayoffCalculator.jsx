import React, { useMemo, useState } from "react";

const federalTaxData = {
  single: {
    standardDeduction: 16100,
    brackets: [
      { upTo: 12400, rate: 0.1 },
      { upTo: 50400, rate: 0.12 },
      { upTo: 105700, rate: 0.22 },
      { upTo: 201775, rate: 0.24 },
      { upTo: 256225, rate: 0.32 },
      { upTo: 640600, rate: 0.35 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
    ]
  },
  marriedJoint: {
    standardDeduction: 32200,
    brackets: [
      { upTo: 24800, rate: 0.1 },
      { upTo: 100800, rate: 0.12 },
      { upTo: 211400, rate: 0.22 },
      { upTo: 403550, rate: 0.24 },
      { upTo: 512450, rate: 0.32 },
      { upTo: 768700, rate: 0.35 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
    ]
  },
  headOfHousehold: {
    standardDeduction: 24150,
    brackets: [
      { upTo: 17700, rate: 0.1 },
      { upTo: 67450, rate: 0.12 },
      { upTo: 105700, rate: 0.22 },
      { upTo: 201750, rate: 0.24 },
      { upTo: 256200, rate: 0.32 },
      { upTo: 640600, rate: 0.35 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
    ]
  }
};

const debtPresets = {
  auto: { loanBalance: 23300, loanApr: 11.52, minimumPayment: 546 },
  mortgage: { loanBalance: 350000, loanApr: 6.5, minimumPayment: 2300 },
  personal: { loanBalance: 10000, loanApr: 18, minimumPayment: 275 },
  student: { loanBalance: 30000, loanApr: 6.8, minimumPayment: 350 },
  business: { loanBalance: 50000, loanApr: 12, minimumPayment: 1200 },
  custom: {}
};

const defaultInputs = {
  mode: "fixedDebt",
  debtType: "auto",
  startingCapital: 15200,
  activationThreshold: 10000,
  monthlyReturnRate: 5,
  contributionMode: "surplus",
  monthlyContribution: 500,
  monthlyIncome: 2788,
  monthlyExpenses: 2005,
  loanBalance: 23300,
  loanApr: 11.52,
  minimumPayment: 546,
  dynamicModel: "equityShare",
  initialObligation: 50000,
  currentAssetValue: 400000,
  equitySharePercent: 15,
  assetAnnualAppreciationRate: 3,
  obligationAnnualGrowthRate: 8,
  payoffFloor: 0,
  payoffCap: 0,
  exitFee: 0,
  taxMode: "fixed",
  filingStatus: "marriedJoint",
  baseOrdinaryIncome: 48000,
  fixedTaxRate: 10,
  stateTaxRate: 2.5,
  includeStateTax: true,
  maxSwitchMonths: 360,
  maxSimulationMonths: 1000,
  timePenaltyPerMonth: 0.5
};

const panelStyle = {
  background: "white",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16
};

const fieldStyle = {
  display: "grid",
  gap: 6,
  marginBottom: 12
};

const inputStyle = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "10px 12px",
  fontSize: 16,
  boxSizing: "border-box",
  background: "white"
};

function cleanNumber(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  return value;
}

function dollars(value) {
  if (!Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function monthsText(value) {
  if (!Number.isFinite(value)) return "N/A";
  const years = Math.floor(value / 12);
  const months = value % 12;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

function calcFederalTax(taxableIncome, data) {
  let tax = 0;
  let previous = 0;
  const income = Math.max(0, taxableIncome);

  for (const bracket of data.brackets) {
    if (income <= previous) break;
    const amount = Math.min(income, bracket.upTo) - previous;
    tax += amount * bracket.rate;
    previous = bracket.upTo;
  }

  return tax;
}

function payoutTax(grossMonthlyPayout, inputs) {
  const gross = cleanNumber(grossMonthlyPayout, 0);
  if (gross <= 0) return 0;

  if (inputs.taxMode === "fixed") {
    const fixedRate = cleanNumber(inputs.fixedTaxRate, 0);
    const stateRate = inputs.includeStateTax ? cleanNumber(inputs.stateTaxRate, 0) : 0;
    return gross * ((fixedRate + stateRate) / 100);
  }

  const data = federalTaxData[inputs.filingStatus];
  const annualPayout = gross * 12;
  const baseIncome = cleanNumber(inputs.baseOrdinaryIncome, 0);
  const baseTaxable = Math.max(0, baseIncome - data.standardDeduction);
  const totalTaxable = Math.max(0, baseIncome + annualPayout - data.standardDeduction);
  const federalMonthly = Math.max(0, calcFederalTax(totalTaxable, data) - calcFederalTax(baseTaxable, data)) / 12;
  const stateMonthly = inputs.includeStateTax ? gross * (cleanNumber(inputs.stateTaxRate, 0) / 100) : 0;

  return Math.min(gross, federalMonthly + stateMonthly);
}

function contribution(inputs) {
  if (inputs.contributionMode === "fixed") {
    return cleanNumber(inputs.monthlyContribution, 0);
  }

  const income = cleanNumber(inputs.monthlyIncome, 0);
  const expenses = cleanNumber(inputs.monthlyExpenses, 0);
  return Math.max(0, income - expenses);
}

function monthlyPayout(capitalInput, inputs) {
  const capital = cleanNumber(capitalInput, 0);
  const threshold = Math.max(1, cleanNumber(inputs.activationThreshold, 10000));
  const rate = cleanNumber(inputs.monthlyReturnRate, 0) / 100;
  const activeCapital = capital >= threshold ? capital : 0;
  const gross = activeCapital * rate;
  const tax = payoutTax(gross, inputs);
  const net = Math.max(0, gross - tax);
  return { gross, net };
}

function applyLoanMonth(balanceInput, aprInput, paymentInput, extraInput) {
  const balance = cleanNumber(balanceInput, 0);
  if (balance <= 0) return 0;

  const apr = cleanNumber(aprInput, 0);
  const payment = cleanNumber(paymentInput, 0);
  const extra = cleanNumber(extraInput, 0);
  const interest = balance * (apr / 100 / 12);
  return Math.max(0, balance + interest - payment - extra);
}

function dynamicPayoff(month, inputs) {
  const assetGrowth = cleanNumber(inputs.assetAnnualAppreciationRate, 0) / 100 / 12;
  const obligationGrowth = cleanNumber(inputs.obligationAnnualGrowthRate, 0) / 100 / 12;
  const assetValue = cleanNumber(inputs.currentAssetValue, 0) * Math.pow(1 + assetGrowth, month);
  const equityPayoff = assetValue * (cleanNumber(inputs.equitySharePercent, 0) / 100);
  const growthPayoff = cleanNumber(inputs.initialObligation, 0) * Math.pow(1 + obligationGrowth, month);

  let payoff = cleanNumber(inputs.initialObligation, 0);
  if (inputs.dynamicModel === "equityShare") payoff = equityPayoff;
  if (inputs.dynamicModel === "compoundGrowth") payoff = growthPayoff;
  if (inputs.dynamicModel === "flatPayoff") payoff = cleanNumber(inputs.initialObligation, 0);
  if (inputs.dynamicModel === "hybridMax") {
    payoff = Math.max(equityPayoff, growthPayoff, cleanNumber(inputs.initialObligation, 0));
  }

  payoff += cleanNumber(inputs.exitFee, 0);
  if (inputs.payoffFloor > 0) payoff = Math.max(payoff, inputs.payoffFloor);
  if (inputs.payoffCap > 0) payoff = Math.min(payoff, inputs.payoffCap);

  return { payoff, assetValue };
}

function getSnapshot(timeline, switchMonth) {
  if (timeline.length === 0) return null;
  if (switchMonth <= 0) return timeline[0];
  const index = Math.min(timeline.length - 1, switchMonth - 1);
  return timeline[index];
}

function scoreScenario(payoutAtExit, totalMonths, inputs) {
  return payoutAtExit - totalMonths * cleanNumber(inputs.timePenaltyPerMonth, 0.5);
}

function invalidResult(switchMonth, timeline) {
  return {
    switchMonth,
    totalMonths: Number.POSITIVE_INFINITY,
    payoffMonthsAfterSwitch: Number.POSITIVE_INFINITY,
    capitalAtSwitch: 0,
    grossPayoutAtSwitch: 0,
    netPayoutAtSwitch: 0,
    payoffAmountAtSwitch: Number.POSITIVE_INFINITY,
    capitalAtExit: 0,
    finalPayoffAmount: Number.POSITIVE_INFINITY,
    payoutAtExit: 0,
    score: Number.NEGATIVE_INFINITY,
    valid: false,
    timeline
  };
}

function buildValidResult({ inputs, switchMonth, month, capital, timeline, finalPayoffAmount }) {
  const snap = getSnapshot(timeline, switchMonth) || timeline[0];
  const exitPayout = monthlyPayout(capital, inputs);
  const payoutAtExit = exitPayout.net;
  const score = scoreScenario(payoutAtExit, month, inputs);

  return {
    switchMonth,
    totalMonths: month,
    payoffMonthsAfterSwitch: month - switchMonth,
    capitalAtSwitch: snap.capital,
    grossPayoutAtSwitch: snap.grossPayout,
    netPayoutAtSwitch: snap.netPayout,
    payoffAmountAtSwitch: snap.debtBalance,
    capitalAtExit: capital,
    finalPayoffAmount,
    payoutAtExit,
    score,
    valid: true,
    timeline
  };
}

function simulateFixedDebt(inputs, switchMonth) {
  let capital = cleanNumber(inputs.startingCapital, 0);
  let balance = cleanNumber(inputs.loanBalance, 0);
  const timeline = [];
  const limit = Math.max(1, Math.floor(cleanNumber(inputs.maxSimulationMonths, 1000)));

  for (let month = 1; month <= limit; month += 1) {
    const payout = monthlyPayout(capital, inputs);
    const surplus = contribution(inputs);
    const isGrowth = month <= switchMonth;

    if (isGrowth) {
      capital = cleanNumber(capital + surplus, 0);
      balance = applyLoanMonth(balance, inputs.loanApr, inputs.minimumPayment, 0);
    } else {
      const extra = payout.net + surplus;
      balance = applyLoanMonth(balance, inputs.loanApr, inputs.minimumPayment, extra);
    }

    const point = {
      month,
      capital,
      grossPayout: payout.gross,
      netPayout: payout.net,
      debtBalance: balance,
      assetValue: 0,
      phase: isGrowth ? "Growth" : "Payoff"
    };

    timeline.push(point);

    if (!isGrowth && balance <= 0) {
      return buildValidResult({
        inputs,
        switchMonth,
        month,
        capital,
        timeline,
        finalPayoffAmount: cleanNumber(inputs.loanBalance, 0)
      });
    }
  }

  return invalidResult(switchMonth, timeline);
}

function simulateDynamic(inputs, switchMonth) {
  let capital = cleanNumber(inputs.startingCapital, 0);
  const timeline = [];
  const limit = Math.max(1, Math.floor(cleanNumber(inputs.maxSimulationMonths, 1000)));

  for (let month = 1; month <= limit; month += 1) {
    const payout = monthlyPayout(capital, inputs);
    const surplus = contribution(inputs);
    const obligation = dynamicPayoff(month, inputs);
    const isGrowth = month <= switchMonth;

    if (isGrowth) {
      capital = cleanNumber(capital + surplus, 0);
    } else {
      capital = cleanNumber(capital + payout.net + surplus, 0);
    }

    const canExit = !isGrowth && capital >= obligation.payoff;
    const point = {
      month,
      capital,
      grossPayout: payout.gross,
      netPayout: payout.net,
      debtBalance: obligation.payoff,
      assetValue: obligation.assetValue,
      phase: canExit ? "Exit" : isGrowth ? "Growth" : "Payoff"
    };

    timeline.push(point);

    if (canExit) {
      return buildValidResult({
        inputs,
        switchMonth,
        month,
        capital,
        timeline,
        finalPayoffAmount: obligation.payoff
      });
    }
  }

  return invalidResult(switchMonth, timeline);
}

function simulate(inputs, switchMonth) {
  if (inputs.mode === "dynamicObligation") return simulateDynamic(inputs, switchMonth);
  return simulateFixedDebt(inputs, switchMonth);
}

function optimize(inputs) {
  const results = [];
  const maxSwitch = Math.max(0, Math.floor(cleanNumber(inputs.maxSwitchMonths, 360)));

  for (let switchMonth = 0; switchMonth <= maxSwitch; switchMonth += 1) {
    const result = simulate(inputs, switchMonth);
    if (result.valid) results.push(result);
  }

  const byScore = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalMonths - b.totalMonths;
  });

  const bySpeed = [...results].sort((a, b) => {
    if (a.totalMonths !== b.totalMonths) return a.totalMonths - b.totalMonths;
    return b.payoutAtExit - a.payoutAtExit;
  });

  const byExitStrength = [...results].sort((a, b) => {
    if (b.payoutAtExit !== a.payoutAtExit) return b.payoutAtExit - a.payoutAtExit;
    return a.totalMonths - b.totalMonths;
  });

  return {
    best: byScore[0] || null,
    fastest: bySpeed[0] || null,
    strongestExit: byExitStrength[0] || null,
    topFive: byScore.slice(0, 5)
  };
}

function sensitivity(inputs) {
  const baseContribution = cleanNumber(inputs.monthlyContribution, 0);
  const baseTax = cleanNumber(inputs.fixedTaxRate, 0);
  const contributionValues = [Math.max(0, baseContribution - 250), baseContribution, baseContribution + 250];
  const taxValues = [Math.max(0, baseTax - 5), baseTax, baseTax + 5];
  const rows = [];

  for (const monthlyContribution of contributionValues) {
    for (const fixedTaxRate of taxValues) {
      const scenario = optimize({
        ...inputs,
        monthlyContribution,
        fixedTaxRate,
        taxMode: "fixed",
        contributionMode: "fixed"
      });

      rows.push({
        contribution: monthlyContribution,
        taxRate: fixedTaxRate,
        switchMonth: scenario.best ? scenario.best.switchMonth : null,
        totalMonths: scenario.best ? scenario.best.totalMonths : null,
        payoutAtExit: scenario.best ? scenario.best.payoutAtExit : null
      });
    }
  }

  return rows;
}

function NumberInput({ label, value, onChange, suffix }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={inputStyle}
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span>{suffix}</span> : null}
      </div>
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      <select style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function ResultCard({ label, value, detail }) {
  return (
    <div style={panelStyle}>
      <div style={{ color: "#64748b", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div>
      <div style={{ color: "#64748b", marginTop: 6 }}>{detail}</div>
    </div>
  );
}

function SimpleChart({ title, data }) {
  const width = 560;
  const height = 260;
  const padding = 42;
  const maxCapital = Math.max(1, ...data.map((point) => point.capital));
  const maxDebt = Math.max(1, ...data.map((point) => point.debtBalance));
  const maxValue = Math.max(maxCapital, maxDebt);
  const lastMonth = Math.max(1, data.length > 0 ? data[data.length - 1].month : 1);

  function x(month) {
    return padding + (month / lastMonth) * (width - padding * 2);
  }

  function y(value) {
    return height - padding - (value / maxValue) * (height - padding * 2);
  }

  function pathFor(key) {
    if (data.length === 0) return "";
    return data
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command} ${x(point.month)} ${y(point[key])}`;
      })
      .join(" ");
  }

  return (
    <div style={panelStyle}>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {data.length === 0 ? (
        <div className="text-sm text-slate-500">No valid payoff timeline is available for the current inputs.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 260 }} role="img" aria-label="Capital versus debt chart">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" />
          <path d={pathFor("capital")} fill="none" stroke="#2563eb" strokeWidth={3} />
          <path d={pathFor("debtBalance")} fill="none" stroke="#dc2626" strokeWidth={3} />
          <text x={padding} y={24} fontSize={14} fill="#2563eb">Capital</text>
          <text x={padding + 90} y={24} fontSize={14} fill="#dc2626">Debt or payoff</text>
        </svg>
      )}
    </div>
  );
}

function TableCell({ children, header = false, colSpan }) {
  const Tag = header ? "th" : "td";
  return (
    <Tag style={{ textAlign: "left", padding: 10, borderTop: header ? "none" : "1px solid #e2e8f0" }} colSpan={colSpan}>
      {children}
    </Tag>
  );
}

export default function DebtPayoffCalculator() {
  const [inputs, setInputs] = useState(defaultInputs);

  const update = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const setDebtType = (debtType) => {
    setInputs((current) => ({ ...current, debtType, ...debtPresets[debtType] }));
  };

  const optimized = useMemo(() => optimize(inputs), [inputs]);
  const sensitivityRows = useMemo(() => sensitivity(inputs), [inputs]);
  const best = optimized.best;
  const fastest = optimized.fastest;
  const strongestExit = optimized.strongestExit;
  const chartData = best
    ? best.timeline.filter((unused, index) => index % 3 === 0 || index === best.timeline.length - 1)
    : [];
  const isDynamic = inputs.mode === "dynamicObligation";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <section style={panelStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="m-0 text-3xl font-extrabold md:text-4xl">Debt Payoff Optimizer</h1>
              <p className="mt-3 max-w-4xl text-slate-600">
                All capital earns once the activation threshold is met. After the switch, surplus and payout are redirected toward payoff. Scoring favors higher payout at exit while penalizing long timelines.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50"
              onClick={() => setInputs(defaultInputs)}
            >
              Reset debt calculator
            </button>
          </div>
        </section>

        <section style={panelStyle} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 font-semibold ${inputs.mode === "fixedDebt" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => update("mode", "fixedDebt")}
          >
            Fixed Debt Mode
          </button>
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 font-semibold ${inputs.mode === "dynamicObligation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => update("mode", "dynamicObligation")}
          >
            Dynamic Obligation Mode
          </button>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <aside style={panelStyle}>
            <h2 className="mb-3 text-2xl font-bold">Inputs</h2>
            <h3 className="mb-2 mt-5 text-lg font-semibold">Investment model</h3>
            <NumberInput label="Starting capital" value={inputs.startingCapital} onChange={(value) => update("startingCapital", value)} />
            <NumberInput label="Activation threshold" value={inputs.activationThreshold} onChange={(value) => update("activationThreshold", value)} />
            <NumberInput label="Monthly return" value={inputs.monthlyReturnRate} onChange={(value) => update("monthlyReturnRate", value)} suffix="%" />
            <NumberInput label="Time penalty per month" value={inputs.timePenaltyPerMonth} onChange={(value) => update("timePenaltyPerMonth", value)} />
            <SelectInput label="Contribution mode" value={inputs.contributionMode} onChange={(value) => update("contributionMode", value)}>
              <option value="fixed">Fixed monthly contribution</option>
              <option value="surplus">Invest all surplus</option>
            </SelectInput>
            {inputs.contributionMode === "fixed" ? (
              <NumberInput label="Monthly contribution" value={inputs.monthlyContribution} onChange={(value) => update("monthlyContribution", value)} />
            ) : null}
            {inputs.contributionMode === "surplus" ? (
              <NumberInput label="Monthly income" value={inputs.monthlyIncome} onChange={(value) => update("monthlyIncome", value)} />
            ) : null}
            {inputs.contributionMode === "surplus" ? (
              <NumberInput label="Monthly expenses" value={inputs.monthlyExpenses} onChange={(value) => update("monthlyExpenses", value)} />
            ) : null}

            {isDynamic ? (
              <div>
                <h3 className="mb-2 mt-5 text-lg font-semibold">Dynamic obligation</h3>
                <SelectInput label="Model" value={inputs.dynamicModel} onChange={(value) => update("dynamicModel", value)}>
                  <option value="equityShare">Equity share</option>
                  <option value="compoundGrowth">Compound growth</option>
                  <option value="flatPayoff">Flat payoff</option>
                  <option value="hybridMax">Hybrid max</option>
                </SelectInput>
                <NumberInput label="Initial obligation" value={inputs.initialObligation} onChange={(value) => update("initialObligation", value)} />
                <NumberInput label="Current asset value" value={inputs.currentAssetValue} onChange={(value) => update("currentAssetValue", value)} />
                <NumberInput label="Equity share" value={inputs.equitySharePercent} onChange={(value) => update("equitySharePercent", value)} suffix="%" />
                <NumberInput label="Asset appreciation" value={inputs.assetAnnualAppreciationRate} onChange={(value) => update("assetAnnualAppreciationRate", value)} suffix="%" />
                <NumberInput label="Obligation growth" value={inputs.obligationAnnualGrowthRate} onChange={(value) => update("obligationAnnualGrowthRate", value)} suffix="%" />
                <NumberInput label="Payoff floor" value={inputs.payoffFloor} onChange={(value) => update("payoffFloor", value)} />
                <NumberInput label="Payoff cap" value={inputs.payoffCap} onChange={(value) => update("payoffCap", value)} />
                <NumberInput label="Exit fee" value={inputs.exitFee} onChange={(value) => update("exitFee", value)} />
              </div>
            ) : (
              <div>
                <h3 className="mb-2 mt-5 text-lg font-semibold">Fixed debt</h3>
                <SelectInput label="Debt type" value={inputs.debtType} onChange={setDebtType}>
                  <option value="auto">Auto loan</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="personal">Personal loan</option>
                  <option value="student">Student loan</option>
                  <option value="business">Business loan</option>
                  <option value="custom">Custom</option>
                </SelectInput>
                <NumberInput label="Debt balance" value={inputs.loanBalance} onChange={(value) => update("loanBalance", value)} />
                <NumberInput label="APR" value={inputs.loanApr} onChange={(value) => update("loanApr", value)} suffix="%" />
                <NumberInput label="Minimum payment" value={inputs.minimumPayment} onChange={(value) => update("minimumPayment", value)} />
              </div>
            )}

            <h3 className="mb-2 mt-5 text-lg font-semibold">Taxes</h3>
            <SelectInput label="Tax mode" value={inputs.taxMode} onChange={(value) => update("taxMode", value)}>
              <option value="fixed">Fixed tax rate</option>
              <option value="progressive">Progressive federal</option>
            </SelectInput>
            <SelectInput label="Filing status" value={inputs.filingStatus} onChange={(value) => update("filingStatus", value)}>
              <option value="single">Single</option>
              <option value="marriedJoint">Married filing jointly</option>
              <option value="headOfHousehold">Head of household</option>
            </SelectInput>
            <NumberInput label="Base ordinary income" value={inputs.baseOrdinaryIncome} onChange={(value) => update("baseOrdinaryIncome", value)} />
            {inputs.taxMode === "fixed" ? (
              <NumberInput label="Fixed tax rate" value={inputs.fixedTaxRate} onChange={(value) => update("fixedTaxRate", value)} suffix="%" />
            ) : null}
            <NumberInput label="State tax rate" value={inputs.stateTaxRate} onChange={(value) => update("stateTaxRate", value)} suffix="%" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={inputs.includeStateTax} onChange={(event) => update("includeStateTax", event.target.checked)} />
              Include state tax
            </label>

            <h3 className="mb-2 mt-5 text-lg font-semibold">Engine limits</h3>
            <NumberInput label="Max switch months" value={inputs.maxSwitchMonths} onChange={(value) => update("maxSwitchMonths", value)} />
            <NumberInput label="Max simulation months" value={inputs.maxSimulationMonths} onChange={(value) => update("maxSimulationMonths", value)} />
          </aside>

          <section className="grid gap-5">
            <div style={gridStyle}>
              <ResultCard label="Best scenario score" value={best ? String(Math.round(best.score)) : "N/A"} detail="Higher favors stronger exit payout with time penalty" />
              <ResultCard label="Turning point payout" value={best ? dollars(best.netPayoutAtSwitch) : "N/A"} detail="Monthly net payout at selected switch" />
              <ResultCard label="Exit payout" value={best ? dollars(best.payoutAtExit) : "N/A"} detail="Monthly net payout when debt is gone" />
              <ResultCard label="Switch timing" value={best ? monthsText(best.switchMonth) : "N/A"} detail={best ? `${best.switchMonth} months` : "No valid result"} />
              <ResultCard label="Total payoff time" value={best ? monthsText(best.totalMonths) : "N/A"} detail={best ? `${best.totalMonths} months total` : "No valid result"} />
              <ResultCard label="Capital at exit" value={best ? dollars(best.capitalAtExit) : "N/A"} detail="Capital still producing payout after payoff" />
            </div>

            <div style={gridStyle}>
              <ResultCard label="Fastest payoff" value={fastest ? monthsText(fastest.totalMonths) : "N/A"} detail={fastest ? `Exit payout ${dollars(fastest.payoutAtExit)}` : "No valid result"} />
              <ResultCard label="Strongest exit" value={strongestExit ? dollars(strongestExit.payoutAtExit) : "N/A"} detail={strongestExit ? `Total time ${monthsText(strongestExit.totalMonths)}` : "No valid result"} />
            </div>

            <SimpleChart title="Capital versus debt" data={chartData} />

            <div style={panelStyle}>
              <h2 className="mb-3 text-xl font-semibold">Top five scored switching points</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse">
                  <thead>
                    <tr>
                      <TableCell header>Switch</TableCell>
                      <TableCell header>Total time</TableCell>
                      <TableCell header>Payout at switch</TableCell>
                      <TableCell header>Payout at exit</TableCell>
                      <TableCell header>Capital at exit</TableCell>
                      <TableCell header>Score</TableCell>
                    </tr>
                  </thead>
                  <tbody>
                    {optimized.topFive.map((row, index) => (
                      <tr key={`${row.switchMonth}-${index}`}>
                        <TableCell>{row.switchMonth}</TableCell>
                        <TableCell>{monthsText(row.totalMonths)}</TableCell>
                        <TableCell>{dollars(row.netPayoutAtSwitch)}</TableCell>
                        <TableCell>{dollars(row.payoutAtExit)}</TableCell>
                        <TableCell>{dollars(row.capitalAtExit)}</TableCell>
                        <TableCell>{Math.round(row.score)}</TableCell>
                      </tr>
                    ))}
                    {optimized.topFive.length === 0 ? (
                      <tr>
                        <TableCell colSpan={6}>No valid payoff found within current limits.</TableCell>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={panelStyle}>
              <h2 className="mb-3 text-xl font-semibold">Sensitivity analysis</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr>
                      <TableCell header>Contribution</TableCell>
                      <TableCell header>Tax rate</TableCell>
                      <TableCell header>Switch</TableCell>
                      <TableCell header>Total time</TableCell>
                      <TableCell header>Exit payout</TableCell>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityRows.map((row, index) => (
                      <tr key={index}>
                        <TableCell>{dollars(row.contribution)}</TableCell>
                        <TableCell>{row.taxRate}%</TableCell>
                        <TableCell>{row.switchMonth === null ? "N/A" : row.switchMonth}</TableCell>
                        <TableCell>{row.totalMonths === null ? "N/A" : monthsText(row.totalMonths)}</TableCell>
                        <TableCell>{row.payoutAtExit === null ? "N/A" : dollars(row.payoutAtExit)}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
