import React, { useState } from "react";
import InvestmentCalculator from "./InvestmentCalculatorV2.jsx";
import DebtPayoffCalculator from "./DebtPayoffCalculator.jsx";
import TaxCalculator from "./TaxCalculator.jsx";

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Root() {
  const [section, setSection] = useState("investment");

  let activeCalculator = <InvestmentCalculator />;
  if (section === "debt") activeCalculator = <DebtPayoffCalculator />;
  if (section === "tax") activeCalculator = <TaxCalculator />;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-bold text-slate-950">Financial Forecasting Suite</div>
            <div className="text-sm text-slate-500">Investment, debt, and tax forecasting</div>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Calculator sections">
            <TabButton active={section === "investment"} onClick={() => setSection("investment")}>
              5% Model
            </TabButton>
            <TabButton active={section === "debt"} onClick={() => setSection("debt")}>
              Debt Payoff
            </TabButton>
            <TabButton active={section === "tax"} onClick={() => setSection("tax")}>
              Tax Calculator
            </TabButton>
          </nav>
        </div>
      </header>

      {activeCalculator}
    </div>
  );
}
