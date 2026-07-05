import React, { useEffect, useMemo, useState } from "react";

const FEDERAL_RATES = [10, 12, 22, 24, 32, 35, 37];
const MINIMUM_NEW_CONTRACT = 10000;

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
  { id: "rent", name: "rent", mode: "fixed", amount: "" },
  { id: "utilities", name: "utilities", mode: "fixed", amount: "" },
  { id: "food", name: "food", mode: "fixed", amount: "" },
  { id: "transportation", name: "transportation", mode: "fixed", amount: "" },
  { id: "entertainment", name: "entertainment", mode: "fixed", amount: "" },
  { id: "other", name: "other", mode: "fixed", amount: "" }
];

function cloneDefaultExpenses() {
  return DEFAULT_EXPENSES.map((expense) => ({ ...expense }));
}

function toNum(value) {
  const number = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(number, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, number));
}

function dollars(number) {
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  });
}

function getMarginalTaxRate(taxableIncome, filingStatus) {
  const brackets = filingStatus === "married" ? marriedBrackets : singleBrackets;
  return brackets.find((bracket) => taxableIncome <= bracket.upTo)?.rate ?? 0.37;
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
  const taxableIncome = Math.max(
    0,
    annualWages + annualInvestmentGross - standardDeductionFor(filingStatus)
  );
  const marginal = useManualTaxRate
    ? clamp(manualTaxRatePct, 0, 100) / 100
    : getMarginalTaxRate(taxableIncome, filingStatus);
  const federalTax = monthlyPayoutGross * marginal;
  const stateTax = stateTaxEnabled
    ? monthlyPayoutGross * (clamp(stateTaxPct, 0, 100) / 100)
    : 0;

  return {
    monthlyPayoutGross,
    netAfterTax: monthlyPayoutGross - federalTax - stateTax,
    marginal,
    federalTax,
    stateTax
  };
}

function getPayoutUsedAmount(payoutMode, payoutDollarAmount, payoutPercent, netAfterTax) {
  if (payoutMode === "percent") {
    return Math.max(0, netAfterTax * (clamp(toNum(payoutPercent), 0, 100) / 100));
  }

  return Math.max(0, Math.min(toNum(payoutDollarAmount), Math.max(0, netAfterTax)));
}

function getExpenseAmount(expense, totalIncomeAfterTax) {
  if (expense.mode === "percent") {
    return (
      Math.max(0, totalIncomeAfterTax) *
      (clamp(toNum(expense.amount), 0, 100) / 100)
    );
  }

  return Math.max(0, toNum(expense.amount));
}

function getExpenseTotal(expenses, totalIncomeAfterTax) {
  return expenses.reduce(
    (sum, expense) => sum + getExpenseAmount(expense, totalIncomeAfterTax),
    0
  );
}

function createInitialLadderState(principal) {
  return {
    savedPool: 0,
    contracts: [
      {
        id: "c_0",
        slotMonth: 0,
        principal: Math.max(0, principal),
        monthsIntoTerm: 0
      }
    ],
    nextId: 1,
    elapsedMonths: 0
  };
}

function cloneLadderState(state) {
  if (!state) return null;
  return {
    savedPool: Math.max(0, state.savedPool || 0),
    contracts: state.contracts.map((contract) => ({ ...contract })),
    nextId: state.nextId || state.contracts.length,
    elapsedMonths: state.elapsedMonths || 0
  };
}

function deployedPrincipal(state) {
  return state.contracts.reduce((sum, contract) => sum + contract.principal, 0);
}

function Card({ children }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, onClick, disabled = false, variant = "default" }) {
  const base =
    "rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const style =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      : variant === "secondary"
        ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
        : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <button type="button" className={`${base} ${style}`} onClick={onClick} disabled={disabled}>
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

function SelectBox({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ${className}`}
    >
      {children}
    </select>
  );
}

function runCalculatorTests() {
  const payout = monthlyPayoutAfterTax(10000, 0.05, "single", 0, 0, false, 0, true, 22);
  console.assert(Math.abs(payout.monthlyPayoutGross - 500) < 0.001, "Gross payout test failed");
  console.assert(Math.abs(payout.netAfterTax - 390) < 0.001, "Net payout test failed");

  const mixedExpenses = getExpenseTotal(
    [
      { id: "fixed", name: "fixed", mode: "fixed", amount: 500 },
      { id: "percent", name: "percent", mode: "percent", amount: 10 }
    ],
    4000
  );
  console.assert(Math.abs(mixedExpenses - 900) < 0.001, "Mixed expense test failed");

  const ladder = createInitialLadderState(10000);
  console.assert(deployedPrincipal(ladder) === 10000, "Initial ladder principal test failed");
}

runCalculatorTests();

export default function InvestmentCalculatorV2() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [simulationMode, setSimulationMode] = useState("yearly");

  const [principal, setPrincipal] = useState(10000);
  const [monthlyRatePct, setMonthlyRatePct] = useState(5);

  const [filingStatus, setFilingStatus] = useState("single");
  const [useManualTaxRate, setUseManualTaxRate] = useState(false);
  const [manualTaxRatePct, setManualTaxRatePct] = useState(22);
  const [stateTaxEnabled, setStateTaxEnabled] = useState(false);
  const [stateTaxPct, setStateTaxPct] = useState(0);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [otherIncome, setOtherIncome] = useState(0);
  const [expenses, setExpenses] = useState(cloneDefaultExpenses);

  const [payoutUsedMonthly, setPayoutUsedMonthly] = useState(0);
  const [payoutMode, setPayoutMode] = useState("dollar");
  const [payoutPercent, setPayoutPercent] = useState(50);
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

  const monthlyRate = monthlyRatePct / 100;

  function calculatePayout(activePrincipal) {
    return monthlyPayoutAfterTax(
      activePrincipal,
      monthlyRate,
      filingStatus,
      monthlyIncome,
      otherIncome,
      stateTaxEnabled,
      stateTaxPct,
      useManualTaxRate,
      manualTaxRatePct
    );
  }

  function calculateReinvestment(monthlyNetAfterTax) {
    const fixedTarget = Math.max(0, toNum(reinvestFixedStr));
    const percentageTarget = clamp(toNum(reinvestPctStr), 0, 100) / 100;
    const useFromPayout = getPayoutUsedAmount(
      payoutMode,
      payoutUsedMonthly,
      payoutPercent,
      monthlyNetAfterTax
    );
    const leftoverFromPayout = Math.max(0, monthlyNetAfterTax - useFromPayout);
    const totalIncomeAfterTax = monthlyIncome + otherIncome + monthlyNetAfterTax;
    const expenseTotal = getExpenseTotal(expenses, totalIncomeAfterTax);
    const availableTotalSurplus = Math.max(
      0,
      totalIncomeAfterTax - expenseTotal - useFromPayout
    );

    let toReinvest = 0;

    switch (reinvestMode) {
      case "reinvest_all_total":
        toReinvest = availableTotalSurplus;
        break;
      case "reinvest_net_only":
        toReinvest = Math.min(availableTotalSurplus, leftoverFromPayout);
        break;
      case "reinvest_fixed":
        toReinvest = Math.min(availableTotalSurplus, fixedTarget);
        break;
      case "reinvest_pct_of_payout":
        toReinvest = Math.min(
          availableTotalSurplus,
          leftoverFromPayout,
          Math.max(0, monthlyNetAfterTax * percentageTarget)
        );
        break;
      case "reinvest_pct_of_total_surplus":
        toReinvest = availableTotalSurplus * percentageTarget;
        break;
      default:
        toReinvest = 0;
    }

    return {
      useFromPayout,
      expenseTotal,
      availableTotalSurplus,
      toReinvest: Math.max(0, toReinvest),
      cashRemaining: Math.max(0, availableTotalSurplus - toReinvest)
    };
  }

  function simulateNonLadderMonth(currentPrincipal) {
    const payout = calculatePayout(currentPrincipal);
    const amounts = calculateReinvestment(payout.netAfterTax);
    const endingPrincipal = currentPrincipal + amounts.toReinvest;

    return {
      nextPrincipal: endingPrincipal,
      payout,
      amounts,
      activePrincipal: currentPrincipal,
      totalCapital: endingPrincipal,
      savedPool: 0,
      contracts: 1,
      newDeployment: amounts.toReinvest,
      renewalDeployment: 0
    };
  }

  function simulateLadderMonth(currentState) {
    const nextState = cloneLadderState(currentState);
    let renewalDeployment = 0;
    let renewedThisMonth = false;

    for (const contract of nextState.contracts) {
      if (contract.monthsIntoTerm >= 12) {
        if (nextState.savedPool > 0) {
          contract.principal += nextState.savedPool;
          renewalDeployment += nextState.savedPool;
          nextState.savedPool = 0;
        }
        contract.monthsIntoTerm = 0;
        renewedThisMonth = true;
      }
    }

    const activePrincipal = deployedPrincipal(nextState);
    const payout = calculatePayout(activePrincipal);
    const amounts = calculateReinvestment(payout.netAfterTax);
    nextState.savedPool += amounts.toReinvest;

    const calendarSlot = nextState.elapsedMonths % 12;
    const slotOccupied = nextState.contracts.some(
      (contract) => contract.slotMonth === calendarSlot
    );
    let newDeployment = 0;

    if (
      !renewedThisMonth &&
      !slotOccupied &&
      nextState.savedPool >= MINIMUM_NEW_CONTRACT
    ) {
      newDeployment = nextState.savedPool;
      nextState.contracts.push({
        id: `c_${nextState.nextId}`,
        slotMonth: calendarSlot,
        principal: newDeployment,
        monthsIntoTerm: 0
      });
      nextState.nextId += 1;
      nextState.savedPool = 0;
    }

    for (const contract of nextState.contracts) {
      contract.monthsIntoTerm += 1;
    }
    nextState.elapsedMonths += 1;

    const totalDeployedPrincipal = deployedPrincipal(nextState);
    const totalCapital = totalDeployedPrincipal + nextState.savedPool;

    return {
      nextState,
      nextPrincipal: totalCapital,
      payout,
      amounts,
      activePrincipal,
      totalCapital,
      savedPool: nextState.savedPool,
      contracts: nextState.contracts.length,
      newDeployment,
      renewalDeployment
    };
  }

  const payoutNow = useMemo(() => {
    const activePrincipal = ladderEnabled && ladderState
      ? deployedPrincipal(ladderState)
      : principal;
    return monthlyPayoutAfterTax(
      activePrincipal,
      monthlyRate,
      filingStatus,
      monthlyIncome,
      otherIncome,
      stateTaxEnabled,
      stateTaxPct,
      useManualTaxRate,
      manualTaxRatePct
    );
  }, [
    principal,
    monthlyRate,
    filingStatus,
    monthlyIncome,
    otherIncome,
    stateTaxEnabled,
    stateTaxPct,
    useManualTaxRate,
    manualTaxRatePct,
    ladderEnabled,
    ladderState
  ]);

  const payoutUsedInput = useMemo(
    () => getPayoutUsedAmount(payoutMode, payoutUsedMonthly, payoutPercent, payoutNow.netAfterTax),
    [payoutMode, payoutUsedMonthly, payoutPercent, payoutNow.netAfterTax]
  );

  const incomeWithoutPayout = monthlyIncome + otherIncome;
  const incomeWithPayoutAfterTax = incomeWithoutPayout + payoutNow.netAfterTax;
  const expensesWithoutPayout = useMemo(
    () => getExpenseTotal(expenses, incomeWithoutPayout),
    [expenses, incomeWithoutPayout]
  );
  const expensesWithPayout = useMemo(
    () => getExpenseTotal(expenses, incomeWithPayoutAfterTax),
    [expenses, incomeWithPayoutAfterTax]
  );
  const autoTaxesOwed = payoutNow.federalTax + payoutNow.stateTax;
  const totalExpensesAll = expensesWithPayout + autoTaxesOwed;
  const obligationsWithoutPayout = expensesWithPayout + autoTaxesOwed;
  const liveMonthlyLeftoverNoPayout =
    incomeWithoutPayout - expensesWithoutPayout - autoTaxesOwed;
  const liveMonthlyLeftover = incomeWithPayoutAfterTax - expensesWithPayout;

  const hourlyWageEquivalent = converterPrincipal * 0.000288461538;
  const principalRequired = converterHourly * 3466.6666667;
  const principalRequiredFromAnnualSalary = converterAnnualSalary / 0.6;
  const afterTaxTargetAnnualIncome =
    afterTaxIncomeMode === "monthly" ? afterTaxTargetIncome * 12 : afterTaxTargetIncome;
  const afterTaxCombinedRate = clamp(afterTaxFedPct + afterTaxStatePct, 0, 100) / 100;
  const afterTaxEffectiveAnnualYield = 0.6 * (1 - afterTaxCombinedRate);
  const afterTaxPrincipalRequired =
    afterTaxEffectiveAnnualYield > 0
      ? afterTaxTargetAnnualIncome / afterTaxEffectiveAnnualYield
      : 0;

  const ladderSummary = useMemo(() => {
    if (!ladderEnabled) return null;
    const state = ladderState || createInitialLadderState(principal);
    return {
      contracts: state.contracts.length,
      deployed: deployedPrincipal(state),
      savedPool: state.savedPool
    };
  }, [ladderEnabled, ladderState, principal]);

  useEffect(() => {
    if (!autoCoverShortfallEnabled) return;

    const shortfall = Math.max(0, obligationsWithoutPayout - incomeWithoutPayout);
    const amount = Math.min(shortfall, Math.max(0, payoutNow.netAfterTax));
    setPayoutUsedMonthly(Number(amount.toFixed(2)));
    setPayoutMode("dollar");
  }, [
    autoCoverShortfallEnabled,
    obligationsWithoutPayout,
    incomeWithoutPayout,
    payoutNow.netAfterTax
  ]);

  function changeSimulationMode(nextMode) {
    setSimulationMode(nextMode);
    setHistory([]);
    setMonthlyHistory([]);
    setManualBalance(null);
  }

  function addExpense() {
    const id = `exp_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    setExpenses((previous) => [
      ...previous,
      { id, name: "new expense", mode: "fixed", amount: "" }
    ]);
  }

  function updateExpense(id, patch) {
    setExpenses((previous) =>
      previous.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense))
    );
  }

  function removeExpense(id) {
    setExpenses((previous) => previous.filter((expense) => expense.id !== id));
  }

  function buildMonthlyRows(count) {
    const safeCount = Math.max(0, Math.floor(toNum(count)));
    if (safeCount <= 0) return;

    const rows = [];
    const startingMonth = monthlyHistory.length + 1;
    let currentPrincipal = principal;
    let currentLadderState = ladderEnabled
      ? cloneLadderState(ladderState) || createInitialLadderState(principal)
      : null;
    let cashBalance =
      monthlyHistory.length > 0
        ? monthlyHistory[monthlyHistory.length - 1].currentAvailableMoney
        : manualBalance ?? 0;

    for (let index = 0; index < safeCount; index += 1) {
      const result = ladderEnabled
        ? simulateLadderMonth(currentLadderState)
        : simulateNonLadderMonth(currentPrincipal);

      if (ladderEnabled) currentLadderState = result.nextState;
      currentPrincipal = result.nextPrincipal;
      cashBalance += result.amounts.cashRemaining;

      rows.push({
        month: startingMonth + index,
        activePrincipal: result.activePrincipal,
        totalCapital: result.totalCapital,
        payoutGross: result.payout.monthlyPayoutGross,
        taxes: result.payout.federalTax + result.payout.stateTax,
        payoutNet: result.payout.netAfterTax,
        payoutUsed: result.amounts.useFromPayout,
        expenses: result.amounts.expenseTotal,
        reinvested: result.amounts.toReinvest,
        newDeployment: result.newDeployment,
        renewalDeployment: result.renewalDeployment,
        savedPool: result.savedPool,
        contracts: result.contracts,
        monthlySurplus: result.amounts.cashRemaining,
        currentAvailableMoney: cashBalance
      });
    }

    setMonthlyHistory((previous) => [...previous, ...rows]);
    setPrincipal(currentPrincipal);
    if (ladderEnabled) setLadderState(currentLadderState);
  }

  function simulateNextYear() {
    const startPrincipal = principal;
    const startLadderState = ladderEnabled
      ? cloneLadderState(ladderState) || createInitialLadderState(principal)
      : null;
    let currentPrincipal = principal;
    let currentLadderState = startLadderState;
    let yearGross = 0;
    let yearTax = 0;
    let yearReinvest = 0;
    let yearPayoutUsed = 0;

    for (let month = 0; month < 12; month += 1) {
      const result = ladderEnabled
        ? simulateLadderMonth(currentLadderState)
        : simulateNonLadderMonth(currentPrincipal);
      if (ladderEnabled) currentLadderState = result.nextState;
      currentPrincipal = result.nextPrincipal;
      yearGross += result.payout.monthlyPayoutGross;
      yearTax += result.payout.federalTax + result.payout.stateTax;
      yearReinvest += result.amounts.toReinvest;
      yearPayoutUsed += result.amounts.useFromPayout;
    }

    setPrincipal(currentPrincipal);
    if (ladderEnabled) setLadderState(currentLadderState);
    setHistory((previous) => [
      ...previous,
      {
        year: previous.length + 1,
        startPrincipal,
        principal: currentPrincipal,
        gross: yearGross,
        tax: yearTax,
        reinvest: yearReinvest,
        payoutUsed: yearPayoutUsed,
        ladderEnabled,
        ladderStartState: startLadderState
      }
    ]);
  }

  function undoLastYear() {
    setHistory((previous) => {
      if (previous.length === 0) return previous;
      const last = previous[previous.length - 1];
      setPrincipal(last.startPrincipal);
      if (last.ladderEnabled) {
        setLadderEnabled(true);
        setLadderState(cloneLadderState(last.ladderStartState));
      } else {
        setLadderEnabled(false);
        setLadderState(null);
      }
      return previous.slice(0, -1);
    });
  }

  function resetCalculator() {
    setPrincipal(10000);
    setMonthlyRatePct(5);
    setFilingStatus("single");
    setUseManualTaxRate(false);
    setManualTaxRatePct(22);
    setStateTaxEnabled(false);
    setStateTaxPct(0);
    setMonthlyIncome(0);
    setOtherIncome(0);
    setExpenses(cloneDefaultExpenses());
    setPayoutUsedMonthly(0);
    setPayoutMode("dollar");
    setPayoutPercent(50);
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

  function coverShortfall() {
    const shortfall = Math.max(0, obligationsWithoutPayout - incomeWithoutPayout);
    const amount = Math.min(shortfall, Math.max(0, payoutNow.netAfterTax));
    setPayoutMode("dollar");
    setPayoutUsedMonthly(Number(amount.toFixed(2)));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Simple Interest Investment Calculator
        </h1>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === "calculator" ? "default" : "outline"}
            onClick={() => setActiveTab("calculator")}
          >
            Calculator
          </Button>
          <Button
            variant={activeTab === "wage" ? "default" : "outline"}
            onClick={() => setActiveTab("wage")}
          >
            Wage Converter
          </Button>
        </div>

        {activeTab === "calculator" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={simulationMode === "yearly" ? "default" : "outline"}
                onClick={() => changeSimulationMode("yearly")}
              >
                Yearly Mode
              </Button>
              <Button
                variant={simulationMode === "monthly" ? "default" : "outline"}
                onClick={() => changeSimulationMode("monthly")}
              >
                Monthly Mode
              </Button>
            </div>

            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Principal</Label>
                  <Input
                    type="number"
                    value={principal}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 0;
                      setPrincipal(value);
                      if (ladderEnabled && monthlyHistory.length === 0 && history.length === 0) {
                        setLadderState(createInitialLadderState(value));
                      }
                    }}
                  />

                  <Label>Monthly Rate, percent</Label>
                  <Input
                    type="number"
                    value={monthlyRatePct}
                    onChange={(event) => setMonthlyRatePct(Number(event.target.value) || 0)}
                  />

                  <Label>Filing status</Label>
                  <SelectBox value={filingStatus} onChange={setFilingStatus}>
                    <option value="single">Single</option>
                    <option value="married">Married Filing Jointly</option>
                  </SelectBox>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="manualTaxToggle"
                      type="checkbox"
                      checked={useManualTaxRate}
                      onChange={(event) => setUseManualTaxRate(event.target.checked)}
                    />
                    <Label htmlFor="manualTaxToggle">Use manual tax rate</Label>
                  </div>

                  {useManualTaxRate && (
                    <div>
                      <Label>Manual Federal Tax Rate</Label>
                      <SelectBox
                        value={manualTaxRatePct.toString()}
                        onChange={(value) => setManualTaxRatePct(Number(value))}
                      >
                        {FEDERAL_RATES.map((rate) => (
                          <option key={rate} value={rate.toString()}>{rate}%</option>
                        ))}
                      </SelectBox>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="stateTaxEnabled"
                      type="checkbox"
                      checked={stateTaxEnabled}
                      onChange={(event) => setStateTaxEnabled(event.target.checked)}
                    />
                    <Label htmlFor="stateTaxEnabled">Include state tax</Label>
                  </div>

                  {stateTaxEnabled && (
                    <div>
                      <Label>State tax rate, percent</Label>
                      <Input
                        type="number"
                        value={stateTaxPct}
                        onChange={(event) => setStateTaxPct(Number(event.target.value) || 0)}
                      />
                    </div>
                  )}

                  <div className="mt-4 space-y-1 text-sm">
                    <div className="text-slate-500">Monthly Payout Before Tax</div>
                    <div className="font-medium">{dollars(payoutNow.monthlyPayoutGross)}</div>
                    <div className="text-slate-500">Monthly Payout After Tax</div>
                    <div className="font-medium">{dollars(payoutNow.netAfterTax)}</div>
                    <div className="text-slate-500">Taxes owed from payout: {dollars(autoTaxesOwed)}</div>
                    <div className="text-slate-500">Federal rate used: {(payoutNow.marginal * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Income</Label>
                  <Input
                    type="number"
                    value={monthlyIncome}
                    onChange={(event) => setMonthlyIncome(Number(event.target.value) || 0)}
                  />

                  <Label>Other Income</Label>
                  <Input
                    type="number"
                    value={otherIncome}
                    onChange={(event) => setOtherIncome(Number(event.target.value) || 0)}
                  />

                  <Label>Expenses</Label>
                  <div className="flex items-center gap-2">
                    <Input type="text" className="w-1/2" value="Taxes Owed, auto" readOnly disabled />
                    <Input type="number" className="w-1/3" value={autoTaxesOwed} readOnly disabled />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    Percentage expenses use wages, other income, and investment payout after tax.
                  </div>

                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[1.4fr_0.9fr_0.8fr_auto] sm:items-center"
                    >
                      <Input
                        type="text"
                        value={expense.name}
                        onChange={(event) => updateExpense(expense.id, { name: event.target.value })}
                      />
                      <SelectBox
                        value={expense.mode}
                        onChange={(value) => updateExpense(expense.id, { mode: value })}
                      >
                        <option value="fixed">Fixed dollars</option>
                        <option value="percent">Percent of income</option>
                      </SelectBox>
                      <div>
                        <Input
                          type="number"
                          value={expense.amount}
                          min="0"
                          max={expense.mode === "percent" ? 100 : undefined}
                          placeholder={expense.mode === "percent" ? "0 to 100" : "0"}
                          onChange={(event) => updateExpense(expense.id, { amount: event.target.value })}
                        />
                        {expense.mode === "percent" && (
                          <div className="mt-1 text-xs text-slate-500">
                            {dollars(getExpenseAmount(expense, incomeWithPayoutAfterTax))} currently
                          </div>
                        )}
                      </div>
                      <Button variant="secondary" onClick={() => removeExpense(expense.id)}>Delete</Button>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addExpense}>Add expense</Button>
                </div>

                <div className="space-y-2">
                  <Label>Payout Mode</Label>
                  <SelectBox value={payoutMode} onChange={setPayoutMode}>
                    <option value="dollar">Dollar</option>
                    <option value="percent">Percent of payout</option>
                  </SelectBox>

                  {payoutMode === "percent" ? (
                    <div>
                      <Label>Percent of payout to use</Label>
                      <Input
                        type="number"
                        value={payoutPercent}
                        onChange={(event) => setPayoutPercent(Number(event.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label>Monthly Payout Used, dollars</Label>
                      <Input
                        type="number"
                        value={payoutUsedMonthly}
                        disabled={autoCoverShortfallEnabled}
                        onChange={(event) => setPayoutUsedMonthly(Number(event.target.value) || 0)}
                      />
                    </div>
                  )}

                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="text-slate-500">Calculated payout used</div>
                    <div className="font-medium">{dollars(payoutUsedInput)}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="autoCoverShortfall"
                      type="checkbox"
                      checked={autoCoverShortfallEnabled}
                      onChange={(event) => setAutoCoverShortfallEnabled(event.target.checked)}
                    />
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
                      <Input
                        type="number"
                        value={reinvestFixedStr}
                        onChange={(event) => setReinvestFixedStr(event.target.value)}
                      />
                    </div>
                  )}

                  {(reinvestMode === "reinvest_pct_of_payout" || reinvestMode === "reinvest_pct_of_total_surplus") && (
                    <div>
                      <Label>
                        {reinvestMode === "reinvest_pct_of_total_surplus"
                          ? "Percent of total surplus to reinvest"
                          : "Percent of payout to reinvest"}
                      </Label>
                      <Input
                        type="number"
                        value={reinvestPctStr}
                        onChange={(event) => setReinvestPctStr(event.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      id="ladderEnabled"
                      type="checkbox"
                      checked={ladderEnabled}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setLadderEnabled(enabled);
                        setLadderState(enabled ? createInitialLadderState(principal) : null);
                        setHistory([]);
                        setMonthlyHistory([]);
                      }}
                    />
                    <Label htmlFor="ladderEnabled">Enable contract laddering</Label>
                  </div>

                  {ladderSummary && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <div>Active contracts: {ladderSummary.contracts}</div>
                      <div>Deployed principal: {dollars(ladderSummary.deployed)}</div>
                      <div>Saved deployment pool: {dollars(ladderSummary.savedPool)}</div>
                      <div>New-contract threshold: {dollars(MINIMUM_NEW_CONTRACT)}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {simulationMode === "yearly" ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={simulateNextYear}>Simulate Next Year</Button>
                <Button onClick={undoLastYear} disabled={history.length === 0}>Undo Last Year</Button>
                <Button onClick={resetCalculator}>Reset</Button>
                <Button variant="secondary" onClick={coverShortfall}>Cover Shortfall with Payout</Button>
              </div>
            ) : (
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <Label>Manual Current Available Money, optional</Label>
                      <Input
                        type="number"
                        value={manualBalance ?? ""}
                        disabled={monthlyHistory.length > 0}
                        placeholder="Leave blank to begin at zero"
                        onChange={(event) => {
                          const value = event.target.value;
                          setManualBalance(value === "" ? null : Number(value));
                        }}
                      />
                    </div>
                    <div>
                      <Label>Months to simulate</Label>
                      <Input
                        type="number"
                        value={monthsToSimulate}
                        onChange={(event) => setMonthsToSimulate(Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={() => buildMonthlyRows(1)}>Simulate Next Month</Button>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={() => buildMonthlyRows(monthsToSimulate)}>Simulate X Months</Button>
                      <Button
                        variant="secondary"
                        disabled={monthlyHistory.length === 0}
                        onClick={() => {
                          setMonthlyHistory([]);
                          setManualBalance(null);
                        }}
                      >
                        Clear Table
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    Monthly mode now applies the selected reinvestment strategy every month. With contract laddering enabled, surplus enters the saved deployment pool, new contracts open when the pool reaches $10,000 in an available monthly slot, contracts age each month, and saved funds are added at renewal.
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Total Monthly Expenses</div>
                  <div className="text-xs text-slate-500">Fixed and percentage expenses plus payout taxes.</div>
                  <div className="text-xl font-semibold">{dollars(totalExpensesAll)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Monthly Surplus without payout</div>
                  <div className="text-xl font-semibold">{dollars(liveMonthlyLeftoverNoPayout)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-slate-500">Monthly Surplus with payout</div>
                  <div className="text-xl font-semibold">{dollars(liveMonthlyLeftover)}</div>
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
                        <th className="py-2 pr-4">Starting Capital</th>
                        <th className="py-2 pr-4">Ending Capital</th>
                        <th className="py-2 pr-4">Gross Payout</th>
                        <th className="py-2 pr-4">Tax</th>
                        <th className="py-2 pr-4">Reinvested</th>
                        <th className="py-2 pr-4">Payout Used</th>
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
                          <td className="py-2 pr-4">{dollars(row.reinvest)}</td>
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
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Month</th>
                        <th className="py-2 pr-4">Active Principal</th>
                        <th className="py-2 pr-4">Payout Gross</th>
                        <th className="py-2 pr-4">Taxes</th>
                        <th className="py-2 pr-4">Payout Net</th>
                        <th className="py-2 pr-4">Payout Used</th>
                        <th className="py-2 pr-4">Expenses</th>
                        <th className="py-2 pr-4">Reinvested</th>
                        <th className="py-2 pr-4">New Contract</th>
                        <th className="py-2 pr-4">Renewal Deployment</th>
                        <th className="py-2 pr-4">Saved Pool</th>
                        <th className="py-2 pr-4">Contracts</th>
                        <th className="py-2 pr-4">Ending Capital</th>
                        <th className="py-2 pr-4">Cash Remaining</th>
                        <th className="py-2 pr-4">Available Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHistory.map((row) => (
                        <tr key={row.month} className="border-t">
                          <td className="py-2 pr-4">M{row.month}</td>
                          <td className="py-2 pr-4">{dollars(row.activePrincipal)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutGross)}</td>
                          <td className="py-2 pr-4">{dollars(row.taxes)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutNet)}</td>
                          <td className="py-2 pr-4">{dollars(row.payoutUsed)}</td>
                          <td className="py-2 pr-4">{dollars(row.expenses)}</td>
                          <td className="py-2 pr-4">{dollars(row.reinvested)}</td>
                          <td className="py-2 pr-4">{dollars(row.newDeployment)}</td>
                          <td className="py-2 pr-4">{dollars(row.renewalDeployment)}</td>
                          <td className="py-2 pr-4">{dollars(row.savedPool)}</td>
                          <td className="py-2 pr-4">{row.contracts}</td>
                          <td className="py-2 pr-4">{dollars(row.totalCapital)}</td>
                          <td className="py-2 pr-4">{dollars(row.monthlySurplus)}</td>
                          <td className="py-2 pr-4">{dollars(row.currentAvailableMoney)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "wage" && (
          <Card>
            <CardContent className="space-y-6 p-4">
              <div>
                <div className="text-sm text-slate-500">Principal to hourly wage equivalent</div>
                <Label>Principal, dollars</Label>
                <Input
                  type="number"
                  value={converterPrincipal}
                  onChange={(event) => setConverterPrincipal(Number(event.target.value) || 0)}
                />
                <div className="mt-4 text-sm text-slate-500">Hourly wage equivalent</div>
                <div className="font-medium">{dollars(hourlyWageEquivalent)}</div>
              </div>

              <div className="border-t pt-6">
                <div className="text-sm text-slate-500">Principal required to replace an hourly wage</div>
                <Label>Hourly wage</Label>
                <Input
                  type="number"
                  value={converterHourly}
                  onChange={(event) => setConverterHourly(Number(event.target.value) || 0)}
                />
                <div className="mt-2 font-medium">{dollars(principalRequired)}</div>
              </div>

              <div className="border-t pt-6">
                <div className="text-sm text-slate-500">Annual salary to required principal</div>
                <Label>Annual salary</Label>
                <Input
                  type="number"
                  value={converterAnnualSalary}
                  onChange={(event) => setConverterAnnualSalary(Number(event.target.value) || 0)}
                />
                <div className="mt-2 font-medium">{dollars(principalRequiredFromAnnualSalary)}</div>
              </div>

              <div className="space-y-2 border-t pt-6">
                <div className="text-sm text-slate-500">After-tax income target to principal</div>
                <Label>Federal tax %</Label>
                <Input
                  type="number"
                  value={afterTaxFedPct}
                  onChange={(event) => setAfterTaxFedPct(Number(event.target.value) || 0)}
                />
                <Label>State tax %</Label>
                <Input
                  type="number"
                  value={afterTaxStatePct}
                  onChange={(event) => setAfterTaxStatePct(Number(event.target.value) || 0)}
                />
                <Label>Income mode</Label>
                <SelectBox value={afterTaxIncomeMode} onChange={setAfterTaxIncomeMode}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </SelectBox>
                <Label>Target income after taxes</Label>
                <Input
                  type="number"
                  value={afterTaxTargetIncome}
                  onChange={(event) => setAfterTaxTargetIncome(Number(event.target.value) || 0)}
                />
                <div className="mt-2 font-medium">{dollars(afterTaxPrincipalRequired)}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
