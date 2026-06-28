import React, { useEffect, useMemo, useState } from "react";

const FEDERAL_RATES = [10, 12, 22, 24, 32, 35, 37];

const singleBrackets = [
  { upTo: 11600, rate: 0.1 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 }
];

const marriedBrackets = [
  { upTo: 23200, rate: 0.1 },
  { upTo: 94300, rate: 0.12 },
  { upTo: 201050, rate: 0.22 },
  { upTo: 383900, rate: 0.24 },
  { upTo: 487450, rate: 0.32 },
  { upTo: 731200, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 }
];

const DEFAULT_EXPENSES = [
  { id: "rent", name: "rent", amount: "" },
  { id: "utilities", name: "utilities", amount: "" },
  { id: "food", name: "food", amount: "" },
  { id: "transportation", name: "transportation", amount: "" },
  { id: "entertainment", name: "entertainment", amount: "" },
  { id: "other", name: "other", amount: "" }
];

function toNum(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dollars(n) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function getMarginalTaxRate(taxableIncome, filingStatus) {
  const brackets = filingStatus === "married" ? marriedBrackets : singleBrackets;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.upTo) return bracket.rate;
  }
  return 0.37;
}

function standardDeductionFor(filingStatus) {
  return filingStatus === "married" ? 29200 : 14600;
}

function monthlyPayoutAfterTax(
  principal,
  monthlyRate,
  filingStatus,
  monthlyIncome,
  otherIncome,
  stateTaxEnabled,
  stateTaxPct,
  useManualTaxRate,
  manualTaxRatePct
) {
  const monthlyPayoutGross = Math.max(0, principal) * monthlyRate;
  const annualWages = 12 * (monthlyIncome + otherIncome);
  const annualInvestmentGross = 12 * monthlyPayoutGross;
  const taxableIncome = Math.max(0, annualWages + annualInvestmentGross - standardDeductionFor(filingStatus));
  const marginal = useManualTaxRate ? manualTaxRatePct / 100 : getMarginalTaxRate(taxableIncome, filingStatus);
  const federalTax = monthlyPayoutGross * marginal;
  const stateTax = stateTaxEnabled ? monthlyPayoutGross * (stateTaxPct / 100) : 0;
  const netAfterTax = monthlyPayoutGross - federalTax - stateTax;

  return {
    monthlyPayoutGross,
    netAfterTax,
    marginal,
    federalTax,
    stateTax
  };
}

function getPayoutUsedAmount(payoutMode, payoutDollarAmount, payoutPercent, netAfterTax) {
  if (payoutMode === "percent") {
    const pct = clamp(toNum(payoutPercent), 0, 100) / 100;
    return Math.max(0, netAfterTax * pct);
  }

  return Math.max(0, Math.min(toNum(payoutDollarAmount), Math.max(0, netAfterTax)));
}

function getTithingAmount(enabled, payoutUsed) {
  return enabled ? Math.max(0, payoutUsed) * 0.1 : 0;
}

function getAvailableTotalSurplus(monthlyIncome, otherIncome, monthlyNetAfterTax, baseExpenses, payoutUsed, tithing) {
  return Math.max(0, monthlyIncome + otherIncome + monthlyNetAfterTax - baseExpenses - payoutUsed - tithing);
}

function getTotalSurplusReinvestment(availableTotalSurplus, percent) {
  const pct = clamp(toNum(percent), 0, 100) / 100;
  return Math.min(Math.max(0, availableTotalSurplus), Math.max(0, availableTotalSurplus) * pct);
}

function Card({ children }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, onClick, disabled = false, variant = "default" }) {
  const base = "rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      : variant === "secondary"
        ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
        : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <button type="button" className={`${base} ${styles}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Label({ children, htmlFor, className = "" }) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 ${className}`}>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 ${props.className || ""}`}
    />
  );
}

function SelectBox({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
    >
      {children}
    </select>
  );
}

function runCalculatorTests() {
  const testOne = monthlyPayoutAfterTax(10000, 0.05, "single", 0, 0, false, 0, true, 22);
  console.assert(Math.abs(testOne.monthlyPayoutGross - 500) < 0.001, "Test failed: gross payout should be 500");
  console.assert(Math.abs(testOne.netAfterTax - 390) < 0.001, "Test failed: net payout should be 390 with 22 percent manual federal tax");

  const testTwo = standardDeductionFor("married");
  console.assert(testTwo === 29200, "Test failed: married standard deduction should be 29200");

  const testThree = clamp(125, 0, 100);
  console.assert(testThree === 100, "Test failed: clamp should cap at max value");

  const testFour = getPayoutUsedAmount("percent", 0, 50, 1000);
  console.assert(Math.abs(testFour - 500) < 0.001, "Test failed: percent payout mode should use 50 percent of net payout");

  const testFive = getPayoutUsedAmount("dollar", 1500, 0, 1000);
  console.assert(Math.abs(testFive - 1000) < 0.001, "Test failed: dollar payout mode should cap at net payout");

  const testSix = getTithingAmount(true, 500);
  console.assert(Math.abs(testSix - 50) < 0.001, "Test failed: tithing should be 10 percent of payout used");

  const testSeven = getTithingAmount(false, 500);
  console.assert(Math.abs(testSeven) < 0.001, "Test failed: disabled tithing should be zero");

  const exampleAAvailable = getAvailableTotalSurplus(3000, 0, 500, 2000, 200, 20);
  console.assert(Math.abs(exampleAAvailable - 1280) < 0.001, "Test failed: Example A available surplus should be 1280");

  const exampleAReinvest = getTotalSurplusReinvestment(exampleAAvailable, 50);
  console.assert(Math.abs(exampleAReinvest - 640) < 0.001, "Test failed: Example A reinvestment should be 640");

  const exampleBNegative = getAvailableTotalSurplus(1000, 0, 100, 2000, 50, 5);
  console.assert(Math.abs(exampleBNegative) < 0.001, "Test failed: Example B negative surplus should be clamped to 0");

  const exampleCReinvest = getTotalSurplusReinvestment(1280, 150);
  console.assert(Math.abs(exampleCReinvest - 1280) < 0.001, "Test failed: Example C percentage above 100 should be treated as 100");
}

runCalculatorTests();

export default function FinancialOverview() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [simulationMode, setSimulationMode] = useState("yearly");

  const [principal, setPrincipal] = useState(10000);
  const [monthlyRatePct, setMonthlyRatePct] = useState(5);
  const monthlyRate = monthlyRatePct / 100;

  const [filingStatus, setFilingStatus] = useState("single");
  const [useManualTaxRate, setUseManualTaxRate] = useState(false);
  const [manualTaxRatePct, setManualTaxRatePct] = useState(22);
  const [stateTaxEnabled, setStateTaxEnabled] = useState(false);
  const [stateTaxPct, setStateTaxPct] = useState(0);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);

  const [payoutUsedMonthly, setPayoutUsedMonthly] = useState(0);
  const [payoutMode, setPayoutMode] = useState("dollar");
  const [payoutPercent, setPayoutPercent] = useState(50);
  const [tithingEnabled, setTithingEnabled] = useState(true);
  const [autoCoverShortfallEnabled, setAutoCoverShortfallEnabled] = useState(false);
  const [reinvestMode, setReinvestMode] = useState("reinvest_net_only");
  const [reinvestFixedStr, setReinvestFixedStr] = useState("");
  const [reinvestPctStr, setReinvestPctStr] = useState("50");

  const [ladderEnabled, setLadderEnabled] = useState(false);
  const [ladderState, setLadderState] = useState(null);
  const [history, setHistory] = useState([]);
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [manualBalance, setManualBalance] = useState(null);
  const [monthsToSimulate, setMonthsToSimulate] = useState(12);

  const [converterPrincipal, setConverterPrincipal] = useState(0);
  const [converterHourly, setConverterHourly] = useState(0);
  const [converterAnnualSalary, setConverterAnnualSalary] = useState(0);
  const [afterTaxFedPct, setAfterTaxFedPct] = useState(22);
  const [afterTaxStatePct, setAfterTaxStatePct] = useState(0);
  const [afterTaxIncomeMode, setAfterTaxIncomeMode] = useState("yearly");
  const [afterTaxTargetIncome, setAfterTaxTargetIncome] = useState(0);

  const baseExpenses = useMemo(() => expenses.reduce((sum, e) => sum + toNum(e.amount), 0), [expenses]);

  const payoutNow = useMemo(
    () => monthlyPayoutAfterTax(principal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct),
    [principal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct]
  );

  const payoutUsedInput = useMemo(
    () => getPayoutUsedAmount(payoutMode, payoutUsedMonthly, payoutPercent, payoutNow.netAfterTax),
    [payoutMode, payoutUsedMonthly, payoutPercent, payoutNow.netAfterTax]
  );

  const tithing = getTithingAmount(tithingEnabled, payoutUsedInput);
  const autoTaxesOwed = payoutNow.federalTax + payoutNow.stateTax;
  const totalExpensesAll = baseExpenses + autoTaxesOwed + tithing;
  const obligationsWithoutPayout = baseExpenses + autoTaxesOwed;
  const liveMonthlyLeftoverNoPayout = monthlyIncome + otherIncome - obligationsWithoutPayout;
  const liveMonthlyLeftover = monthlyIncome + otherIncome + payoutNow.monthlyPayoutGross - totalExpensesAll;

  const hourlyWageEquivalent = converterPrincipal * 0.000288461538;
  const principalRequired = converterHourly * 3466.6666667;
  const principalRequiredFromAnnualSalary = converterAnnualSalary / 0.6;
  const afterTaxTargetAnnualIncome = afterTaxIncomeMode === "monthly" ? afterTaxTargetIncome * 12 : afterTaxTargetIncome;
  const afterTaxCombinedRate = clamp(afterTaxFedPct + afterTaxStatePct, 0, 100) / 100;
  const afterTaxEffectiveAnnualYield = 0.6 * (1 - afterTaxCombinedRate);
  const afterTaxPrincipalRequired = afterTaxEffectiveAnnualYield > 0 ? afterTaxTargetAnnualIncome / afterTaxEffectiveAnnualYield : 0;

  const ladderSummary = useMemo(() => {
    if (!ladderEnabled) return null;
    if (!ladderState) return { contracts: 1, savedPool: 0 };
    return { contracts: ladderState.contracts.length, savedPool: ladderState.savedPool };
  }, [ladderEnabled, ladderState]);

  useEffect(() => {
    if (!autoCoverShortfallEnabled) return;

    const nonPayoutIncome = monthlyIncome + otherIncome;
    const shortfall = Math.max(0, obligationsWithoutPayout - nonPayoutIncome);
    const availablePayoutAfterTax = Math.max(0, payoutNow.netAfterTax);
    const nextValue = Math.min(shortfall, availablePayoutAfterTax);
    const rounded = Number.isFinite(nextValue) ? Math.max(0, Number(nextValue.toFixed(2))) : 0;

    setPayoutUsedMonthly(rounded);
    setPayoutMode("dollar");
  }, [autoCoverShortfallEnabled, monthlyIncome, otherIncome, obligationsWithoutPayout, payoutNow.netAfterTax]);

  function changeSimulationMode(nextMode) {
    setSimulationMode(nextMode);
    setHistory([]);
    setMonthlyHistory([]);
  }

  function addExpense() {
    const id = `exp_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    setExpenses((prev) => [...prev, { id, name: "new expense", amount: "" }]);
  }

  function removeExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function setExpenseName(id, name) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  function setExpenseAmount(id, amount) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, amount } : e)));
  }

  function getReinvestmentAmounts(monthlyNetAfterTax) {
    const fixedTarget = Math.max(0, toNum(reinvestFixedStr));
    const pctTarget = clamp(toNum(reinvestPctStr), 0, 100) / 100;
    const useFromPayout = getPayoutUsedAmount(payoutMode, payoutUsedMonthly, payoutPercent, monthlyNetAfterTax);
    const leftoverFromPayout = Math.max(0, monthlyNetAfterTax - useFromPayout);
    const incomeSurplus = Math.max(0, monthlyIncome + otherIncome - baseExpenses);
    const availableSurplus = leftoverFromPayout + incomeSurplus;

    switch (reinvestMode) {
      case "reinvest_all_total":
        return { toReinvest: availableSurplus, useFromPayout };
      case "reinvest_net_only":
        return { toReinvest: leftoverFromPayout, useFromPayout };
      case "reinvest_fixed":
        return { toReinvest: Math.min(availableSurplus, fixedTarget), useFromPayout };
      case "reinvest_pct_of_payout": {
        const targetFromPayout = monthlyNetAfterTax * pctTarget;
        return { toReinvest: Math.min(leftoverFromPayout, Math.max(0, targetFromPayout)), useFromPayout };
      }
      case "reinvest_pct_of_total_surplus": {
        const payoutTithing = getTithingAmount(tithingEnabled, useFromPayout);
        const availableTotalSurplus = getAvailableTotalSurplus(monthlyIncome, otherIncome, monthlyNetAfterTax, baseExpenses, useFromPayout, payoutTithing);
        return { toReinvest: getTotalSurplusReinvestment(availableTotalSurplus, pctTarget * 100), useFromPayout };
      }
      default:
        return { toReinvest: 0, useFromPayout };
    }
  }

  function simulateOneYear(startPrincipal) {
    const snapshot = monthlyPayoutAfterTax(startPrincipal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct);
    const amounts = getReinvestmentAmounts(snapshot.netAfterTax);

    const yearGross = snapshot.monthlyPayoutGross * 12;
    const yearTax = (snapshot.federalTax + snapshot.stateTax) * 12;
    const yearReinvest = amounts.toReinvest * 12;
    const yearPayoutUsed = amounts.useFromPayout * 12;
    const endPrincipal = startPrincipal + yearReinvest;
    const endSnapshot = monthlyPayoutAfterTax(endPrincipal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct);

    return {
      endPrincipal,
      yearGross,
      yearTax,
      yearNet: endSnapshot.netAfterTax * 12,
      yearCash: yearPayoutUsed,
      yearReinvest,
      monthlyNetEnd: endSnapshot.netAfterTax,
      yearPayoutUsed
    };
  }

  function simulateOneYearLadder(current) {
    let yearGross = 0;
    let yearTax = 0;
    let yearReinvest = 0;
    let yearPayoutUsed = 0;

    let savedPool = Math.max(0, current.savedPool || 0);
    const contracts = current.contracts.map((c) => ({ ...c }));
    let nextId = current.nextId;

    for (let month = 0; month < 12; month++) {
      let renewedThisMonth = false;

      for (let i = 0; i < contracts.length; i++) {
        const contract = contracts[i];
        if (contract.monthsIntoTerm >= 12) {
          contract.principal += savedPool;
          yearReinvest += savedPool;
          savedPool = 0;
          contract.monthsIntoTerm = 0;
          renewedThisMonth = true;
        }
      }

      const activePrincipal = contracts.reduce((sum, c) => sum + c.principal, 0);
      const payout = monthlyPayoutAfterTax(activePrincipal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct);
      const amounts = getReinvestmentAmounts(payout.netAfterTax);

      yearGross += payout.monthlyPayoutGross;
      yearTax += payout.federalTax + payout.stateTax;
      yearPayoutUsed += amounts.useFromPayout;
      savedPool += amounts.toReinvest;

      if (!renewedThisMonth) {
        const slotOccupied = contracts.some((c) => c.slotMonth === month);
        if (!slotOccupied && savedPool >= 10000) {
          contracts.push({
            id: `c_${nextId}`,
            slotMonth: month,
            principal: savedPool,
            monthsIntoTerm: 0
          });
          nextId += 1;
          yearReinvest += savedPool;
          savedPool = 0;
        }
      }

      for (let i = 0; i < contracts.length; i++) {
        contracts[i].monthsIntoTerm += 1;
      }
    }

    const contractPrincipal = contracts.reduce((sum, c) => sum + c.principal, 0);
    const endPrincipal = contractPrincipal + savedPool;
    const endSnapshot = monthlyPayoutAfterTax(endPrincipal, monthlyRate, filingStatus, monthlyIncome, otherIncome, stateTaxEnabled, stateTaxPct, useManualTaxRate, manualTaxRatePct);

    return {
      endPrincipal,
      yearGross,
      yearTax,
      yearNet: endSnapshot.netAfterTax * 12,
      yearCash: yearPayoutUsed,
      yearReinvest,
      monthlyNetEnd: endSnapshot.netAfterTax,
      yearPayoutUsed,
      next: { savedPool, contracts, nextId }
    };
  }

  function buildMonthlyRows(count) {
    const safeCount = Math.max(0, Math.floor(toNum(count)));
    if (safeCount <= 0) return;

    const payout = monthlyPayoutAfterTax(
      principal,
      monthlyRate,
      filingStatus,
      monthlyIncome,
      otherIncome,
      stateTaxEnabled,
      stateTaxPct,
      useManualTaxRate,
      manualTaxRatePct
    );

    const monthlyTaxes = payout.federalTax + payout.stateTax;
    const payoutUsed = getPayoutUsedAmount(payoutMode, payoutUsedMonthly, payoutPercent, payout.netAfterTax);
    const monthlyTithing = getTithingAmount(tithingEnabled, payoutUsed);
    const monthlySurplus = monthlyIncome + otherIncome + payout.monthlyPayoutGross - baseExpenses - monthlyTaxes - monthlyTithing;

    setMonthlyHistory((prev) => {
      const rows = [];
      const startingMonth = prev.length + 1;
      const startingBalance = manualBalance !== null ? manualBalance : prev.length > 0 ? prev[prev.length - 1].currentAvailableMoney : 0;

      for (let i = 0; i < safeCount; i++) {
        rows.push({
          month: startingMonth + i,
          principal,
          payoutGross: payout.monthlyPayoutGross,
          payoutNet: payout.netAfterTax,
          taxes: monthlyTaxes,
          payoutUsed,
          tithing: monthlyTithing,
          monthlySurplus,
          currentAvailableMoney: startingBalance + monthlySurplus * (i + 1)
        });
      }

      return [...prev, ...rows];
    });
  }

  function onSimulateNextMonth() {
    buildMonthlyRows(1);
  }

  function onSimulateXMonths() {
    buildMonthlyRows(monthsToSimulate);
  }

  function onClearMonthlyHistory() {
    setMonthlyHistory([]);
    setManualBalance(null);
  }

  function onSimulateNextYear() {
    const startPrincipal = principal;

    if (ladderEnabled) {
      const startState = ladderState
        ? {
            savedPool: ladderState.savedPool,
            contracts: ladderState.contracts.map((c) => ({ ...c })),
            nextId: ladderState.nextId
          }
        : {
            savedPool: 0,
            contracts: [{ id: "c_0", slotMonth: 0, principal: startPrincipal, monthsIntoTerm: 0 }],
            nextId: 1
          };

      const result = simulateOneYearLadder(startState);
      setPrincipal(result.endPrincipal);
      setLadderState(result.next);
      setHistory((prev) => [
        ...prev,
        {
          year: prev.length + 1,
          startPrincipal,
          principal: result.endPrincipal,
          gross: result.yearGross,
          tax: result.yearTax,
          net: result.yearNet,
          cash: result.yearCash,
          reinvest: result.yearReinvest,
          monthlyNet: result.monthlyNetEnd,
          payoutUsed: result.yearPayoutUsed,
          ladderEnabled: true,
          ladderStartState: startState
        }
      ]);
      return;
    }

    const result = simulateOneYear(startPrincipal);
    setPrincipal(result.endPrincipal);
    setHistory((prev) => [
      ...prev,
      {
        year: prev.length + 1,
        startPrincipal,
        principal: result.endPrincipal,
        gross: result.yearGross,
        tax: result.yearTax,
        net: result.yearNet,
        cash: result.yearCash,
        reinvest: result.yearReinvest,
        monthlyNet: result.monthlyNetEnd,
        payoutUsed: result.yearPayoutUsed
      }
    ]);
  }

  function onUndoLastYear() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPrincipal(last.startPrincipal);

      if (last.ladderEnabled) {
        setLadderEnabled(true);
        setLadderState(last.ladderStartState || null);
      } else {
        setLadderEnabled(false);
        setLadderState(null);
      }

      return prev.slice(0, -1);
    });
  }

  function onReset() {
    setPrincipal(10000);
    setMonthlyRatePct(5);
    setFilingStatus("single");
    setUseManualTaxRate(false);
    setManualTaxRatePct(22);
    setStateTaxEnabled(false);
    setStateTaxPct(0);
    setMonthlyIncome(0);
    setOtherIncome(0);
    setExpenses(DEFAULT_EXPENSES);
    setPayoutUsedMonthly(0);
    setPayoutMode("dollar");
    setPayoutPercent(50);
    setTithingEnabled(true);
    setAutoCoverShortfallEnabled(false);
    setReinvestMode("reinvest_net_only");
    setReinvestFixedStr("");
    setReinvestPctStr("50");
    setLadderEnabled(false);
    setLadderState(null);
    setHistory([]);
    setMonthlyHistory([]);
    setManualBalance(null);
    setMonthsToSimulate(12);
    setSimulationMode("yearly");
    setConverterPrincipal(0);
    setConverterHourly(0);
    setConverterAnnualSalary(0);
    setAfterTaxFedPct(22);
    setAfterTaxStatePct(0);
    setAfterTaxIncomeMode("yearly");
    setAfterTaxTargetIncome(0);
  }

  function onCoverShortfall() {
    const shortfall = Math.max(0, obligationsWithoutPayout - (monthlyIncome + otherIncome));
    const availablePayout = Math.max(0, payoutNow.netAfterTax);
    const toUse = Math.min(shortfall, availablePayout);
    setPayoutMode("dollar");
    setPayoutUsedMonthly(Number.isFinite(toUse) ? Math.max(0, Number(toUse.toFixed(2))) : 0);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Simple Interest Investment Calculator</h1>

        <div className="flex flex-wrap gap-2">
          <Button variant={activeTab === "calculator" ? "default" : "outline"} onClick={() => setActiveTab("calculator")}>
            Calculator
          </Button>
          <Button variant={activeTab === "wage" ? "default" : "outline"} onClick={() => setActiveTab("wage")}>
            Wage Converter
          </Button>
        </div>

        {activeTab === "calculator" && (
          <React.Fragment>
            <div className="flex flex-wrap gap-2">
              <Button variant={simulationMode === "yearly" ? "default" : "outline"} onClick={() => changeSimulationMode("yearly")}>
                Yearly Mode
              </Button>
              <Button variant={simulationMode === "monthly" ? "default" : "outline"} onClick={() => changeSimulationMode("monthly")}>
                Monthly Mode
              </Button>
            </div>

            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Principal</Label>
                  <Input type="number" value={principal} placeholder="0" onChange={(e) => setPrincipal(Number(e.target.value) || 0)} />

                  <Label>Monthly Rate, percent</Label>
                  <Input type="number" value={monthlyRatePct} placeholder="0" onChange={(e) => setMonthlyRatePct(Number(e.target.value) || 0)} />

                  <Label>Filing status</Label>
                  <SelectBox value={filingStatus} onChange={setFilingStatus}>
                    <option value="single">Single</option>
                    <option value="married">Married Filing Jointly</option>
                  </SelectBox>

                  <div className="flex items-center gap-2 pt-2">
                    <input id="manualTaxToggle" type="checkbox" checked={useManualTaxRate} onChange={(e) => setUseManualTaxRate(e.target.checked)} />
                    <Label htmlFor="manualTaxToggle">Use manual tax rate</Label>
                  </div>

                  {useManualTaxRate && (
                    <div>
                      <Label>Manual Federal Tax Rate</Label>
                      <SelectBox value={manualTaxRatePct.toString()} onChange={(v) => setManualTaxRatePct(Number(v))}>
                        {FEDERAL_RATES.map((rate) => (
                          <option key={rate} value={rate.toString()}>
                            {rate}%
                          </option>
                        ))}
                      </SelectBox>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <input id="stateTaxEnabled" type="checkbox" checked={stateTaxEnabled} onChange={(e) => setStateTaxEnabled(e.target.checked)} />
                    <Label htmlFor="stateTaxEnabled">Include state tax</Label>
                  </div>

                  {stateTaxEnabled && (
                    <div>
                      <Label>State tax rate, percent</Label>
                      <Input type="number" value={stateTaxPct} placeholder="0" onChange={(e) => setStateTaxPct(Number(e.target.value) || 0)} />
                    </div>
                  )}

                  <div className="mt-4 space-y-1 text-sm">
                    <div className="text-slate-500">Monthly Payout Before Tax</div>
                    <div className="font-medium">{dollars(payoutNow.monthlyPayoutGross)}</div>
                    <div className="text-slate-500">Monthly Payout After Tax</div>
                    <div className="font-medium">{dollars(payoutNow.netAfterTax)}</div>
                    <div className="text-slate-500">Taxes Owed, auto from payout: {dollars(autoTaxesOwed)}</div>
                    <div className="text-slate-500">Federal rate used: {(payoutNow.marginal * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Income</Label>
                  <Input type="number" value={monthlyIncome} placeholder="0" onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)} />

                  <Label>Other Income</Label>
                  <Input type="number" value={otherIncome} placeholder="0" onChange={(e) => setOtherIncome(Number(e.target.value) || 0)} />

                  <Label>Expenses</Label>
                  <div className="flex items-center gap-2">
                    <Input type="text" className="w-1/2" value="Taxes Owed, auto" readOnly disabled />
                    <Input type="number" className="w-1/3" value={Number.isFinite(autoTaxesOwed) ? autoTaxesOwed : 0} readOnly disabled />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="text" className="w-1/2" value="Tithing, auto" readOnly disabled />
                    <Input type="number" className="w-1/3" value={Number.isFinite(tithing) ? tithing : 0} readOnly disabled />
                  </div>

                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center gap-2">
                      <Input type="text" className="w-1/2" value={expense.name} onChange={(e) => setExpenseName(expense.id, e.target.value)} />
                      <Input type="number" className="w-1/3" value={expense.amount} placeholder="0" onChange={(e) => setExpenseAmount(expense.id, e.target.value)} />
                      <Button variant="secondary" onClick={() => removeExpense(expense.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addExpense}>
                    Add expense
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Payout Mode</Label>
                  <SelectBox value={payoutMode} onChange={setPayoutMode}>
                    <option value="dollar">Dollar</option>
                    <option value="percent">Percent of payout</option>
                  </SelectBox>

                  {payoutMode === "percent" && (
                    <div>
                      <Label>Percent of payout to use</Label>
                      <Input type="number" value={payoutPercent} placeholder="0 to 100" onChange={(e) => setPayoutPercent(Number(e.target.value) || 0)} />
                    </div>
                  )}

                  {payoutMode === "dollar" && (
                    <div>
                      <Label>Monthly Payout Used, dollars</Label>
                      <Input
                        type="number"
                        value={payoutUsedMonthly}
                        placeholder="0"
                        disabled={autoCoverShortfallEnabled}
                        onChange={(e) => setPayoutUsedMonthly(Number(e.target.value) || 0)}
                      />
                    </div>
                  )}

                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="text-slate-500">Calculated payout used</div>
                    <div className="font-medium">{dollars(payoutUsedInput)}</div>
                    <div className="text-slate-500">Calculated tithing</div>
                    <div className="font-medium">{dollars(tithing)}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input id="tithingEnabled" type="checkbox" checked={tithingEnabled} onChange={(e) => setTithingEnabled(e.target.checked)} />
                    <Label htmlFor="tithingEnabled">Enable tithing, 10% of payout used</Label>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input id="autoCoverShortfall" type="checkbox" checked={autoCoverShortfallEnabled} onChange={(e) => setAutoCoverShortfallEnabled(e.target.checked)} />
                    <Label htmlFor="autoCoverShortfall">Auto cover shortfall with payout</Label>
                  </div>

                  <Label>Reinvestment strategy</Label>
                  <SelectBox value={reinvestMode} onChange={setReinvestMode}>
                    <option value="reinvest_net_only">Reinvest only unused payout</option>
                    <option value="reinvest_all_total">Reinvest all surplus, payout and income</option>
                    <option value="reinvest_fixed">Reinvest fixed amount each month</option>
                    <option value="reinvest_pct_of_payout">Reinvest percentage of payout</option>
                    <option value="reinvest_pct_of_total_surplus">Reinvest X% of all total surplus</option>
                  </SelectBox>

                  {reinvestMode === "reinvest_fixed" && (
                    <div>
                      <Label>Fixed reinvest per month, dollars</Label>
                      <Input type="number" value={reinvestFixedStr} placeholder="0" onChange={(e) => setReinvestFixedStr(e.target.value)} />
                    </div>
                  )}

                  {(reinvestMode === "reinvest_pct_of_payout" || reinvestMode === "reinvest_pct_of_total_surplus") && (
                    <div>
                      <Label>{reinvestMode === "reinvest_pct_of_total_surplus" ? "Percent of total surplus to reinvest" : "Percent of payout to reinvest"}</Label>
                      <Input type="number" value={reinvestPctStr} placeholder="0 to 100" onChange={(e) => setReinvestPctStr(e.target.value)} />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="ladderEnabled"
                      type="checkbox"
                      checked={ladderEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setLadderEnabled(enabled);
                        if (enabled) {
                          setLadderState((prev) => prev || { savedPool: 0, contracts: [{ id: "c_0", slotMonth: 0, principal, monthsIntoTerm: 0 }], nextId: 1 });
                        } else {
                          setLadderState(null);
                        }
                      }}
                    />
                    <Label htmlFor="ladderEnabled">Enable contract laddering</Label>
                  </div>
                  {ladderSummary && <div className="text-xs text-slate-500">Active contracts: {ladderSummary.contracts}, Saved pool: {dollars(ladderSummary.savedPool)}</div>}
                </div>
              </CardContent>
            </Card>

            {simulationMode === "yearly" && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={onSimulateNextYear}>Simulate Next Year</Button>
                <Button onClick={onUndoLastYear} disabled={history.length === 0}>
                  Undo Last Year
                </Button>
                <Button onClick={onReset}>Reset</Button>
                <Button variant="secondary" onClick={onCoverShortfall}>
                  Cover Shortfall with Payout
                </Button>
              </div>
            )}

            {simulationMode === "monthly" && (
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <Label>Manual Current Available Money, optional</Label>
                      <Input
                        type="number"
                        value={manualBalance ?? ""}
                        placeholder="Leave blank to auto-track"
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualBalance(val === "" ? null : Number(val));
                        }}
                      />
                    </div>
                    <div>
                      <Label>Months to simulate</Label>
                      <Input type="number" value={monthsToSimulate} placeholder="12" onChange={(e) => setMonthsToSimulate(Number(e.target.value) || 0)} />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={onSimulateNextMonth}>Simulate Next Month</Button>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={onSimulateXMonths}>Simulate X Months</Button>
                      <Button variant="secondary" onClick={onClearMonthlyHistory} disabled={monthlyHistory.length === 0}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Monthly mode uses the current principal when you simulate. It does not automatically reinvest or change principal month by month. You can manually override your available cash to simulate deploying capital.
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Total Monthly Expenses</div>
                  <div className="text-xs text-slate-500">Includes tithing: {dollars(tithing)}</div>
                  <div className="text-xl font-semibold">{dollars(totalExpensesAll)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Monthly Surplus without payout</div>
                  <div className="text-xl font-semibold">{dollars(liveMonthlyLeftoverNoPayout)}</div>
                  <div className="mt-2 text-xs text-slate-500">Wages and other income minus base expenses and taxes.</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Monthly Surplus with payout</div>
                  <div className="text-xl font-semibold">{dollars(liveMonthlyLeftover)}</div>
                  <div className="mt-2 text-xs text-slate-500">Wages, other income, and payout before tax minus all expenses and taxes.</div>
                </CardContent>
              </Card>
            </div>

            {simulationMode === "yearly" && history.length > 0 && (
              <Card>
                <CardContent className="overflow-x-auto p-4">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Year</th>
                        <th className="py-2 pr-4">Starting Principal</th>
                        <th className="py-2 pr-4">End Principal</th>
                        <th className="py-2 pr-4">Gross</th>
                        <th className="py-2 pr-4">Tax</th>
                        <th className="py-2 pr-4">Payout Used Monthly</th>
                        <th className="py-2 pr-4">Principal growth</th>
                        <th className="py-2 pr-4">Payout Used Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.year} className="border-t">
                          <td className="py-2 pr-4">Y{row.year}</td>
                          <td className="py-2 pr-4">{dollars(row.startPrincipal)}</td>
                          <td className="py-2 pr-4">{dollars(row.principal)}</td>
                          <td className="py-2 pr-4">{dollars(row.gross)}</td>
                          <td className="py-2 pr-4">{dollars(row.tax)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutUsed / 12)}</td>
                          <td className="py-2 pr-4">{dollars(row.principal - row.startPrincipal)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutUsed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {simulationMode === "monthly" && monthlyHistory.length > 0 && (
              <Card>
                <CardContent className="overflow-x-auto p-4">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Month</th>
                        <th className="py-2 pr-4">Principal Used</th>
                        <th className="py-2 pr-4">Payout Gross</th>
                        <th className="py-2 pr-4">Taxes</th>
                        <th className="py-2 pr-4">Payout Net</th>
                        <th className="py-2 pr-4">Payout Used</th>
                        <th className="py-2 pr-4">Tithing</th>
                        <th className="py-2 pr-4">Monthly Surplus</th>
                        <th className="py-2 pr-4">Current Available Money</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHistory.map((row) => (
                        <tr key={row.month} className="border-t">
                          <td className="py-2 pr-4">M{row.month}</td>
                          <td className="py-2 pr-4">{dollars(row.principal)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutGross)}</td>
                          <td className="py-2 pr-4">{dollars(row.taxes)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutNet)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutUsed)}</td>
                          <td className="py-2 pr-4">{dollars(row.tithing)}</td>
                          <td className="py-2 pr-4">{dollars(row.monthlySurplus)}</td>
                          <td className="py-2 pr-4">{dollars(row.currentAvailableMoney)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </React.Fragment>
        )}

        {activeTab === "wage" && (
          <Card>
            <CardContent className="space-y-6 p-4">
              <div>
                <div className="text-sm text-slate-500">Principal to hourly wage equivalent</div>
                <Label>Principal, dollars</Label>
                <Input type="number" value={converterPrincipal} placeholder="0" onChange={(e) => setConverterPrincipal(Number(e.target.value) || 0)} />
                <div className="mt-4 text-sm text-slate-500">Hourly wage equivalent</div>
                <div className="font-medium">{dollars(hourlyWageEquivalent)}</div>
                <div className="mt-1 text-xs text-slate-500">Hourly wage equivalent = Principal x 0.000288461538</div>
              </div>

              <div className="border-t pt-6">
                <div className="text-sm text-slate-500">Principal required to replace a specified hourly wage</div>
                <Label>Hourly wage</Label>
                <Input type="number" value={converterHourly} placeholder="0" onChange={(e) => setConverterHourly(Number(e.target.value) || 0)} />
                <div className="mt-2 font-medium">{dollars(principalRequired)}</div>
                <div className="mt-1 text-xs text-slate-500">Principal required = Hourly wage x 3,466.6666667</div>
              </div>

              <div className="border-t pt-6">
                <div className="text-sm text-slate-500">Annual salary to required principal</div>
                <Label>Annual salary</Label>
                <Input type="number" value={converterAnnualSalary} placeholder="0" onChange={(e) => setConverterAnnualSalary(Number(e.target.value) || 0)} />
                <div className="mt-2 font-medium">{dollars(principalRequiredFromAnnualSalary)}</div>
                <div className="mt-1 text-xs text-slate-500">Principal required = Annual salary / 0.6</div>
              </div>

              <div className="space-y-2 border-t pt-6">
                <div className="text-sm text-slate-500">After-tax income target to principal</div>
                <Label>Federal tax %</Label>
                <Input type="number" value={afterTaxFedPct} onChange={(e) => setAfterTaxFedPct(Number(e.target.value) || 0)} />
                <Label>State tax %</Label>
                <Input type="number" value={afterTaxStatePct} onChange={(e) => setAfterTaxStatePct(Number(e.target.value) || 0)} />
                <Label>Income mode</Label>
                <SelectBox value={afterTaxIncomeMode} onChange={setAfterTaxIncomeMode}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </SelectBox>
                <Label>Target income after taxes</Label>
                <Input type="number" value={afterTaxTargetIncome} onChange={(e) => setAfterTaxTargetIncome(Number(e.target.value) || 0)} />
                <div className="mt-2 font-medium">{dollars(afterTaxPrincipalRequired)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Required principal = target annual after-tax income / (0.6 x (1 - combined tax rate))
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}