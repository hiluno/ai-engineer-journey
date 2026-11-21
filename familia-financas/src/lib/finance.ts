import { categoryKind } from './categories';
import { formatEUR, formatPct, monthKey, shiftMonth, uid } from './format';
import type {
  Budget, FinanceAlert, Insight, LoanInput, RiskProfile, SavingsGoal, Transaction,
} from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────── Resumo mensal ─────────────────────────

export interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number; // % do rendimento que sobrou
  expensesByCategory: Record<string, number>;
}

export function monthSummary(transactions: Transaction[], month: string): MonthSummary {
  let income = 0;
  let expenses = 0;
  const expensesByCategory: Record<string, number> = {};
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    else {
      expenses += t.amount;
      expensesByCategory[t.category] = (expensesByCategory[t.category] ?? 0) + t.amount;
    }
  }
  const balance = income - expenses;
  return {
    month,
    income: round2(income),
    expenses: round2(expenses),
    balance: round2(balance),
    savingsRate: income > 0 ? (balance / income) * 100 : 0,
    expensesByCategory,
  };
}

/** Médias dos últimos N meses (anteriores ao mês indicado) que tenham movimentos. */
export function averageMonthly(transactions: Transaction[], beforeMonth: string, months = 3) {
  const summaries: MonthSummary[] = [];
  for (let i = 1; i <= months; i++) {
    const s = monthSummary(transactions, shiftMonth(beforeMonth, -i));
    if (s.income > 0 || s.expenses > 0) summaries.push(s);
  }
  if (summaries.length === 0) return null;
  const avg = (f: (s: MonthSummary) => number) =>
    round2(summaries.reduce((a, s) => a + f(s), 0) / summaries.length);
  return { income: avg((s) => s.income), expenses: avg((s) => s.expenses), months: summaries.length };
}

// ───────────────────────── Movimentos recorrentes ─────────────────────────

/**
 * Para cada série recorrente ativa, cria a ocorrência do mês indicado se ainda não
 * existir. A série é "ativa" se a última ocorrência (anterior ao mês) estiver
 * marcada como recorrente.
 */
export function materializeRecurring(transactions: Transaction[], month: string): Transaction[] {
  const latestBySeries = new Map<string, Transaction>();
  const presentInMonth = new Set<string>();
  for (const t of transactions) {
    if (!t.seriesId) continue;
    const m = monthKey(t.date);
    if (m === month) presentInMonth.add(t.seriesId);
    if (m < month) {
      const cur = latestBySeries.get(t.seriesId);
      if (!cur || cur.date < t.date) latestBySeries.set(t.seriesId, t);
    }
  }
  const created: Transaction[] = [];
  for (const [seriesId, last] of latestBySeries) {
    if (!last.recurring || presentInMonth.has(seriesId)) continue;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = Math.min(Number(last.date.slice(8, 10)), lastDay);
    created.push({ ...last, id: uid(), date: `${month}-${String(day).padStart(2, '0')}` });
  }
  return created;
}

// ───────────────────────── Empréstimos ─────────────────────────

export function effectiveAnnualRate(input: Pick<LoanInput, 'rateType' | 'fixedRate' | 'euribor' | 'spread'>): number {
  return input.rateType === 'fixed' ? input.fixedRate : input.euribor + input.spread;
}

/** Prestação mensal pelo método francês (prestações constantes). */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function amortizationSchedule(principal: number, annualRatePct: number, months: number): AmortizationRow[] {
  const pmt = monthlyPayment(principal, annualRatePct, months);
  const r = annualRatePct / 100 / 12;
  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    let amort = pmt - interest;
    if (i === months) amort = balance; // acerta arredondamentos na última
    balance = Math.max(0, balance - amort);
    rows.push({ month: i, payment: interest + amort, interest, principal: amort, balance });
  }
  return rows;
}

export interface LoanResult {
  annualRate: number;
  months: number;
  payment: number; // prestação (capital + juros)
  monthlyTotal: number; // prestação + seguros
  totalInterest: number;
  totalInsurance: number;
  totalCost: number; // MTIC aproximado: tudo o que se paga ao banco
  firstYear: { interest: number; principal: number };
}

export function simulateLoan(input: LoanInput): LoanResult {
  const months = Math.round(input.years * 12);
  const annualRate = effectiveAnnualRate(input);
  const schedule = amortizationSchedule(input.principal, annualRate, months);
  const payment = monthlyPayment(input.principal, annualRate, months);
  const totalInterest = schedule.reduce((a, r) => a + r.interest, 0);
  const totalInsurance = input.monthlyInsurance * months;
  const firstYearRows = schedule.slice(0, 12);
  return {
    annualRate,
    months,
    payment: round2(payment),
    monthlyTotal: round2(payment + input.monthlyInsurance),
    totalInterest: round2(totalInterest),
    totalInsurance: round2(totalInsurance),
    totalCost: round2(input.principal + totalInterest + totalInsurance + input.upfrontFees),
    firstYear: {
      interest: round2(firstYearRows.reduce((a, r) => a + r.interest, 0)),
      principal: round2(firstYearRows.reduce((a, r) => a + r.principal, 0)),
    },
  };
}

/**
 * Taxa de esforço = encargos mensais com crédito / rendimento líquido mensal.
 * O Banco de Portugal recomenda que não ultrapasse 50% (idealmente abaixo de ~35%).
 */
export function effortRate(monthlyDebt: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return Infinity;
  return (monthlyDebt / monthlyIncome) * 100;
}

export function effortLevel(rate: number): 'ok' | 'warning' | 'danger' {
  if (rate > 50) return 'danger';
  if (rate > 35) return 'warning';
  return 'ok';
}

// ───────────────────────── Orçamentos e metas ─────────────────────────

export interface BudgetStatus extends Budget {
  spent: number;
  pct: number;
  remaining: number;
  level: 'ok' | 'warning' | 'over';
}

export function budgetStatuses(budgets: Budget[], summary: MonthSummary): BudgetStatus[] {
  return budgets.map((b) => {
    const spent = round2(summary.expensesByCategory[b.category] ?? 0);
    const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
    const level = pct >= 100 ? 'over' : pct >= b.alertAt ? 'warning' : 'ok';
    return { ...b, spent, pct, remaining: round2(b.monthlyLimit - spent), level };
  });
}

export function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm] = fromISO.split('-').map(Number);
  const [ty, tm] = toISO.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export interface GoalStatus extends SavingsGoal {
  pct: number;
  remaining: number;
  reached: boolean;
  monthsLeft: number | null;
  monthlyNeeded: number | null; // quanto poupar por mês para cumprir o prazo
}

export function goalStatus(goal: SavingsGoal, todayISO: string): GoalStatus {
  const remaining = Math.max(0, goal.target - goal.saved);
  const reached = goal.saved >= goal.target && goal.target > 0;
  let monthsLeft: number | null = null;
  let monthlyNeeded: number | null = null;
  if (goal.deadline) {
    monthsLeft = Math.max(0, monthsBetween(todayISO, goal.deadline));
    monthlyNeeded = reached ? 0 : round2(remaining / Math.max(1, monthsLeft));
  }
  return {
    ...goal,
    pct: goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0,
    remaining: round2(remaining),
    reached,
    monthsLeft,
    monthlyNeeded,
  };
}

// ───────────────────────── Alertas ─────────────────────────

export interface AlertContext {
  month: string;
  today: string;
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  monthlyLoanPayments: number;
}

export function computeAlerts(ctx: AlertContext): FinanceAlert[] {
  const summary = monthSummary(ctx.transactions, ctx.month);
  const alerts: FinanceAlert[] = [];

  for (const b of budgetStatuses(ctx.budgets, summary)) {
    if (b.level === 'over') {
      alerts.push({
        id: `budget-over:${ctx.month}:${b.category}`,
        level: 'danger',
        title: `Orçamento de ${b.category} ultrapassado`,
        message: `Gastou ${formatEUR(b.spent)} de ${formatEUR(b.monthlyLimit)} (${formatPct(b.pct, 0)}).`,
      });
    } else if (b.level === 'warning') {
      alerts.push({
        id: `budget-warn:${ctx.month}:${b.category}`,
        level: 'warning',
        title: `${b.category}: ${formatPct(b.pct, 0)} do orçamento`,
        message: `Restam ${formatEUR(b.remaining)} para o resto do mês.`,
      });
    }
  }

  for (const g of ctx.goals.map((g) => goalStatus(g, ctx.today))) {
    if (g.reached) {
      alerts.push({
        id: `goal-reached:${g.id}`,
        level: 'success',
        title: `Meta "${g.name}" atingida! 🎉`,
        message: `Juntou ${formatEUR(g.saved)}. Parabéns à família!`,
      });
    } else if (g.monthsLeft !== null && g.monthsLeft <= 1 && g.pct < 90) {
      alerts.push({
        id: `goal-late:${ctx.month}:${g.id}`,
        level: 'warning',
        title: `Meta "${g.name}" em risco`,
        message: `Faltam ${formatEUR(g.remaining)} e o prazo está a terminar.`,
      });
    }
  }

  if (summary.income > 0 && summary.balance < 0) {
    alerts.push({
      id: `negative:${ctx.month}`,
      level: 'danger',
      title: 'Gastos acima das receitas',
      message: `Este mês gastou mais ${formatEUR(-summary.balance)} do que recebeu.`,
    });
  }

  if (ctx.monthlyLoanPayments > 0) {
    const avg = averageMonthly(ctx.transactions, ctx.month);
    const income = Math.max(summary.income, avg?.income ?? 0);
    const rate = effortRate(ctx.monthlyLoanPayments, income);
    if (income > 0 && effortLevel(rate) !== 'ok') {
      alerts.push({
        id: `effort:${ctx.month}`,
        level: effortLevel(rate) === 'danger' ? 'danger' : 'warning',
        title: `Taxa de esforço de ${formatPct(rate, 0)}`,
        message: 'As prestações pesam muito no rendimento. O recomendado é ficar abaixo de 35–50%.',
      });
    }
  }
  return alerts;
}

// ───────────────────────── Ideias / sugestões ─────────────────────────

export function computeInsights(transactions: Transaction[], month: string, goals: SavingsGoal[]): Insight[] {
  const s = monthSummary(transactions, month);
  const prev = monthSummary(transactions, shiftMonth(month, -1));
  const insights: Insight[] = [];

  if (s.income === 0 && s.expenses === 0) {
    insights.push({
      id: 'empty',
      title: 'Comece por registar o salário e as despesas fixas',
      message: 'Marque renda, luz, internet e prestações como "recorrente" para não ter de as repetir todos os meses.',
    });
    return insights;
  }

  if (s.income > 0) {
    if (s.savingsRate < 10) {
      insights.push({
        id: 'savings-low',
        title: `Está a poupar ${formatPct(Math.max(0, s.savingsRate), 0)} do rendimento`,
        message: `Tente chegar aos 20% (${formatEUR(s.income * 0.2)}/mês). Uma transferência automática para a poupança no dia do salário ajuda muito.`,
      });
    } else if (s.savingsRate >= 20) {
      insights.push({
        id: 'savings-good',
        title: `Excelente: poupou ${formatPct(s.savingsRate, 0)} este mês`,
        message: 'Considere pôr parte do excedente a render — veja o separador Investir.',
      });
    }

    // Regra 50/30/20
    let needs = 0;
    let wants = 0;
    for (const [cat, v] of Object.entries(s.expensesByCategory)) {
      const k = categoryKind(cat);
      if (k === 'needs') needs += v;
      else if (k === 'wants') wants += v;
    }
    const wantsPct = (wants / s.income) * 100;
    const needsPct = (needs / s.income) * 100;
    if (wantsPct > 30) {
      insights.push({
        id: 'wants-high',
        title: `Gastos "desejos" em ${formatPct(wantsPct, 0)} do rendimento`,
        message: `A regra 50/30/20 sugere até 30%. Reduzir ${formatEUR(wants - s.income * 0.3)} em restauração, lazer ou subscrições libertava dinheiro para poupar.`,
      });
    }
    if (needsPct > 60) {
      insights.push({
        id: 'needs-high',
        title: `Despesas essenciais em ${formatPct(needsPct, 0)} do rendimento`,
        message: 'Reveja contratos de energia, telecomunicações e seguros — mudar de tarifário costuma poupar dezenas de euros por mês.',
      });
    }
  }

  // Categoria que mais subiu face ao mês anterior
  let worst: { cat: string; diff: number } | null = null;
  for (const [cat, v] of Object.entries(s.expensesByCategory)) {
    const before = prev.expensesByCategory[cat] ?? 0;
    if (before > 0 && v > before * 1.15 && v - before > 20) {
      const diff = v - before;
      if (!worst || diff > worst.diff) worst = { cat, diff };
    }
  }
  if (worst) {
    insights.push({
      id: `rise:${worst.cat}`,
      title: `${worst.cat} subiu ${formatEUR(worst.diff)} face ao mês passado`,
      message: 'Defina um orçamento para esta categoria para receber alertas antes de passar o limite.',
    });
  }

  // Fundo de emergência
  const hasEmergency = goals.some((g) => /emerg/i.test(g.name));
  if (!hasEmergency && s.expenses > 0) {
    insights.push({
      id: 'emergency',
      title: 'Crie um fundo de emergência',
      message: `Recomenda-se 3 a 6 meses de despesas: entre ${formatEUR(s.expenses * 3, 0)} e ${formatEUR(s.expenses * 6, 0)}. Crie uma meta "Fundo de emergência".`,
    });
  }
  return insights;
}

// ───────────────────────── Investimento ─────────────────────────

export interface AllocationItem {
  key: 'deposits' | 'bonds' | 'stocks' | 'crypto';
  label: string;
  pct: number;
  monthly: number;
  description: string;
}

export interface InvestmentPlan {
  canInvest: boolean;
  reason?: string;
  monthlyAvailable: number;
  emergencyTarget: number;
  emergencyMissing: number;
  allocation: AllocationItem[];
}

const PROFILES: Record<RiskProfile, Record<AllocationItem['key'], number>> = {
  conservative: { deposits: 50, bonds: 30, stocks: 20, crypto: 0 },
  moderate: { deposits: 20, bonds: 25, stocks: 50, crypto: 5 },
  aggressive: { deposits: 10, bonds: 10, stocks: 70, crypto: 10 },
};

const ALLOCATION_INFO: Record<AllocationItem['key'], { label: string; description: string }> = {
  deposits: {
    label: 'Depósitos / Certificados de Aforro',
    description: 'Capital garantido e baixo risco. Bom para objetivos a menos de 3 anos.',
  },
  bonds: {
    label: 'Obrigações (ETF ou dívida pública)',
    description: 'Risco moderado, rendimento mais estável que ações. Amortece as quedas da bolsa.',
  },
  stocks: {
    label: 'Bolsa: ETFs de ações globais',
    description: 'Ex.: ETFs que replicam o MSCI World ou S&P 500. Diversificação em milhares de empresas, custos baixos. Horizonte de 5+ anos.',
  },
  crypto: {
    label: 'Criptomoedas (Bitcoin / Ethereum)',
    description: 'Muito volátil — pode perder 50–80% num ano. Só um valor que aceite perder, numa plataforma autorizada na UE (regulamento MiCA).',
  },
};

/**
 * Sugestão educativa (não é aconselhamento financeiro): primeiro fundo de
 * emergência, depois distribuição do excedente mensal segundo o perfil de risco.
 */
export function investmentPlan(params: {
  monthlySurplus: number;
  monthlyExpenses: number;
  emergencySaved: number;
  profile: RiskProfile;
  hasExpensiveDebt?: boolean;
}): InvestmentPlan {
  const emergencyTarget = round2(params.monthlyExpenses * 6);
  const emergencyMissing = round2(Math.max(0, emergencyTarget - params.emergencySaved));
  const monthlyAvailable = round2(Math.max(0, params.monthlySurplus));
  const base: Omit<InvestmentPlan, 'allocation' | 'canInvest'> = { monthlyAvailable, emergencyTarget, emergencyMissing };

  if (monthlyAvailable <= 0) {
    return { ...base, canInvest: false, allocation: [], reason: 'Ainda não sobra dinheiro ao fim do mês. Primeiro equilibre o orçamento.' };
  }
  if (params.hasExpensiveDebt) {
    return { ...base, canInvest: false, allocation: [], reason: 'Tem crédito com juro alto (cartão/crédito pessoal). Amortizar essa dívida rende mais do que qualquer investimento.' };
  }

  const weights = { ...PROFILES[params.profile] };
  if (emergencyMissing > 0) {
    // Enquanto o fundo de emergência não está completo, metade do excedente vai para lá.
    weights.deposits = 50 + weights.deposits / 2;
    weights.bonds /= 2;
    weights.stocks /= 2;
    weights.crypto /= 2;
  }
  const allocation = (Object.keys(weights) as AllocationItem['key'][])
    .filter((k) => weights[k] > 0)
    .map((k) => ({
      key: k,
      ...ALLOCATION_INFO[k],
      pct: weights[k],
      monthly: round2((monthlyAvailable * weights[k]) / 100),
    }));
  return { ...base, canInvest: true, allocation };
}

/** Valor futuro de entregas mensais com uma rentabilidade anual média. */
export function futureValue(monthly: number, annualReturnPct: number, years: number): number {
  const r = annualReturnPct / 100 / 12;
  const n = years * 12;
  if (r === 0) return round2(monthly * n);
  return round2(monthly * ((Math.pow(1 + r, n) - 1) / r));
}
