import {
  amortizationSchedule, budgetStatuses, computeAlerts, computeInsights, effortLevel, effortRate,
  futureValue, goalStatus, investmentPlan, materializeRecurring, monthSummary, monthlyPayment, simulateLoan,
} from '../finance';
import { formatEUR, parseAmount, shiftMonth } from '../format';
import type { Transaction } from '../types';

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: 'expense',
  amount: 0,
  category: 'Outros',
  description: '',
  date: '2026-11-10',
  member: 'Família',
  recurring: false,
  ...p,
});

describe('formatação', () => {
  it('formata euros em pt-PT', () => {
    expect(formatEUR(1234.5)).toBe('1 234,50 €');
    expect(formatEUR(-5)).toBe('-5,00 €');
  });
  it('interpreta valores com vírgula ou ponto', () => {
    expect(parseAmount('1234,56')).toBe(1234.56);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('12 €')).toBe(12);
    expect(parseAmount('abc')).toBeNaN();
  });
  it('avança e recua meses', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('empréstimos', () => {
  it('calcula a prestação pelo método francês', () => {
    // 150 000 € a 30 anos, 3,5% → ~673,57 €
    expect(monthlyPayment(150000, 3.5, 360)).toBeCloseTo(673.57, 2);
  });
  it('taxa zero divide o capital', () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });
  it('o plano de amortização liquida a dívida', () => {
    const rows = amortizationSchedule(10000, 5, 24);
    expect(rows).toHaveLength(24);
    expect(rows[23].balance).toBeCloseTo(0, 6);
    const paidPrincipal = rows.reduce((a, r) => a + r.principal, 0);
    expect(paidPrincipal).toBeCloseTo(10000, 6);
  });
  it('simula taxa variável = Euribor + spread, com seguros e comissões', () => {
    const r = simulateLoan({
      principal: 150000, years: 30, rateType: 'variable', fixedRate: 0,
      euribor: 2.5, spread: 1, monthlyInsurance: 30, upfrontFees: 1000,
    });
    expect(r.annualRate).toBe(3.5);
    expect(r.payment).toBeCloseTo(673.57, 2);
    expect(r.monthlyTotal).toBeCloseTo(703.57, 2);
    expect(r.totalInsurance).toBe(10800);
    expect(r.totalCost).toBeCloseTo(150000 + r.totalInterest + 10800 + 1000, 2);
  });
  it('classifica a taxa de esforço', () => {
    expect(effortRate(700, 2000)).toBe(35);
    expect(effortLevel(30)).toBe('ok');
    expect(effortLevel(40)).toBe('warning');
    expect(effortLevel(55)).toBe('danger');
  });
});

describe('resumo, orçamentos e alertas', () => {
  const data = [
    tx({ type: 'income', category: 'Salário', amount: 2000 }),
    tx({ category: 'Supermercado', amount: 450 }),
    tx({ category: 'Restauração', amount: 260 }),
    tx({ category: 'Supermercado', amount: 999, date: '2026-10-05' }), // outro mês
  ];

  it('soma só o mês pedido', () => {
    const s = monthSummary(data, '2026-11');
    expect(s.income).toBe(2000);
    expect(s.expenses).toBe(710);
    expect(s.balance).toBe(1290);
    expect(s.expensesByCategory.Supermercado).toBe(450);
  });

  it('avisa ao atingir a percentagem definida e ao ultrapassar', () => {
    const budgets = [
      { category: 'Supermercado', monthlyLimit: 500, alertAt: 80 },
      { category: 'Restauração', monthlyLimit: 200, alertAt: 80 },
      { category: 'Lazer', monthlyLimit: 100, alertAt: 80 },
    ];
    const st = budgetStatuses(budgets, monthSummary(data, '2026-11'));
    expect(st.map((b) => b.level)).toEqual(['warning', 'over', 'ok']);

    const alerts = computeAlerts({
      month: '2026-11', today: '2026-11-20', transactions: data, budgets, goals: [], monthlyLoanPayments: 0,
    });
    expect(alerts.map((a) => a.level)).toEqual(['warning', 'danger']);
    expect(alerts[1].title).toContain('Restauração');
  });

  it('avisa quando uma meta é atingida e quando a taxa de esforço é alta', () => {
    const alerts = computeAlerts({
      month: '2026-11', today: '2026-11-20', transactions: data, budgets: [],
      goals: [{ id: 'g1', name: 'Férias', target: 1000, saved: 1000 }],
      monthlyLoanPayments: 1100,
    });
    expect(alerts.find((a) => a.id === 'goal-reached:g1')?.level).toBe('success');
    expect(alerts.find((a) => a.id.startsWith('effort'))?.level).toBe('danger');
  });

  it('calcula quanto poupar por mês para cumprir o prazo', () => {
    const g = goalStatus({ id: 'g', name: 'Carro', target: 6000, saved: 1200, deadline: '2027-11-01' }, '2026-11-20');
    expect(g.monthsLeft).toBe(12);
    expect(g.monthlyNeeded).toBe(400);
    expect(g.pct).toBe(20);
  });

  it('gera ideias de poupança', () => {
    const ids = computeInsights(data, '2026-11', []).map((i) => i.id);
    expect(ids).toContain('savings-good');
    expect(ids).toContain('emergency');
  });
});

describe('recorrentes', () => {
  it('cria a ocorrência do mês para séries ativas, ajustando o dia', () => {
    const list = [
      tx({ seriesId: 's1', recurring: true, amount: 700, category: 'Habitação', date: '2026-01-31' }),
      tx({ seriesId: 's2', recurring: false, amount: 40, date: '2026-01-10' }), // série parada
      tx({ seriesId: 's3', recurring: true, amount: 30, date: '2026-01-05' }),
      tx({ seriesId: 's3', recurring: true, amount: 30, date: '2026-02-05' }), // já existe
    ];
    const created = materializeRecurring(list, '2026-02');
    expect(created).toHaveLength(1);
    expect(created[0].seriesId).toBe('s1');
    expect(created[0].date).toBe('2026-02-28');
  });
});

describe('investimento', () => {
  it('não sugere investir sem excedente', () => {
    const p = investmentPlan({ monthlySurplus: -50, monthlyExpenses: 1500, emergencySaved: 0, profile: 'moderate' });
    expect(p.canInvest).toBe(false);
  });
  it('prioriza o fundo de emergência e a alocação soma 100%', () => {
    const p = investmentPlan({ monthlySurplus: 400, monthlyExpenses: 1500, emergencySaved: 2000, profile: 'aggressive' });
    expect(p.emergencyMissing).toBe(7000);
    expect(p.allocation.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100);
    expect(p.allocation.find((a) => a.key === 'deposits')!.pct).toBe(55);
    expect(p.allocation.find((a) => a.key === 'crypto')!.pct).toBe(5);
  });
  it('perfil conservador não inclui cripto', () => {
    const p = investmentPlan({ monthlySurplus: 400, monthlyExpenses: 1000, emergencySaved: 6000, profile: 'conservative' });
    expect(p.allocation.some((a) => a.key === 'crypto')).toBe(false);
  });
  it('valor futuro de entregas mensais', () => {
    expect(futureValue(100, 0, 10)).toBe(12000);
    expect(futureValue(100, 5, 10)).toBeCloseTo(15528.23, 0);
  });
});
