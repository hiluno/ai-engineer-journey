import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { computeAlerts, materializeRecurring, simulateLoan } from '../lib/finance';
import { monthKey, todayISO, uid } from '../lib/format';
import type { AppData, Budget, FinanceAlert, Loan, SavingsGoal, Settings, Transaction } from '../lib/types';
import { notifyAlerts } from './notifications';

const STORAGE_KEY = 'familia-financas:v1';

export const initialData: AppData = {
  version: 1,
  transactions: [],
  budgets: [],
  goals: [],
  loans: [],
  settings: { members: ['Família', 'Pai', 'Mãe', 'Filhos'], riskProfile: 'moderate' },
  notifiedAlertIds: [],
};

type Action =
  | { type: 'load'; data: AppData }
  | { type: 'addTransactions'; items: Transaction[] }
  | { type: 'updateTransaction'; item: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'setBudget'; budget: Budget }
  | { type: 'deleteBudget'; category: string }
  | { type: 'saveGoal'; goal: SavingsGoal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'saveLoan'; loan: Loan }
  | { type: 'deleteLoan'; id: string }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'markNotified'; ids: string[] }
  | { type: 'reset' };

function reducer(state: AppData, a: Action): AppData {
  switch (a.type) {
    case 'load':
      return a.data;
    case 'addTransactions':
      return { ...state, transactions: [...state.transactions, ...a.items] };
    case 'updateTransaction':
      return { ...state, transactions: state.transactions.map((t) => (t.id === a.item.id ? a.item : t)) };
    case 'deleteTransaction':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== a.id) };
    case 'setBudget':
      return { ...state, budgets: [...state.budgets.filter((b) => b.category !== a.budget.category), a.budget] };
    case 'deleteBudget':
      return { ...state, budgets: state.budgets.filter((b) => b.category !== a.category) };
    case 'saveGoal':
      return { ...state, goals: [...state.goals.filter((g) => g.id !== a.goal.id), a.goal] };
    case 'deleteGoal':
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id) };
    case 'saveLoan':
      return { ...state, loans: [...state.loans.filter((l) => l.id !== a.loan.id), a.loan] };
    case 'deleteLoan':
      return { ...state, loans: state.loans.filter((l) => l.id !== a.id) };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...a.settings } };
    case 'markNotified':
      return { ...state, notifiedAlertIds: [...new Set([...state.notifiedAlertIds, ...a.ids])].slice(-500) };
    case 'reset':
      return initialData;
  }
}

interface DataApi {
  data: AppData;
  loaded: boolean;
  alerts: FinanceAlert[]; // alertas do mês corrente
  monthlyLoanPayments: number;
  addTransaction: (t: Omit<Transaction, 'id' | 'seriesId'>) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (b: Budget) => void;
  deleteBudget: (category: string) => void;
  saveGoal: (g: Omit<SavingsGoal, 'id'> & { id?: string }) => void;
  deleteGoal: (id: string) => void;
  saveLoan: (l: Omit<Loan, 'id' | 'createdAt'> & { id?: string }) => void;
  deleteLoan: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  reset: () => void;
}

const Ctx = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initialData);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = React.useState(false);

  // Carregar do armazenamento local e criar os movimentos recorrentes do mês
  useEffect(() => {
    (async () => {
      let stored = initialData;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) stored = { ...initialData, ...(JSON.parse(raw) as AppData) };
      } catch (e) {
        console.warn('Não foi possível ler os dados guardados', e);
      }
      const recurring = materializeRecurring(stored.transactions, monthKey(new Date()));
      dispatch({ type: 'load', data: { ...stored, transactions: [...stored.transactions, ...recurring] } });
      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  // Guardar sempre que os dados mudam
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
      console.warn('Não foi possível guardar os dados', e),
    );
  }, [data]);

  const monthlyLoanPayments = useMemo(
    () => data.loans.reduce((a, l) => a + simulateLoan(l).monthlyTotal, 0),
    [data.loans],
  );

  const alerts = useMemo(
    () =>
      computeAlerts({
        month: monthKey(new Date()),
        today: todayISO(),
        transactions: data.transactions,
        budgets: data.budgets,
        goals: data.goals,
        monthlyLoanPayments,
      }),
    [data.transactions, data.budgets, data.goals, monthlyLoanPayments],
  );

  // Enviar notificação para cada alerta novo (uma vez por alerta)
  useEffect(() => {
    if (!loaded) return;
    const fresh = alerts.filter((a) => a.level !== 'info' && !data.notifiedAlertIds.includes(a.id));
    if (fresh.length === 0) return;
    dispatch({ type: 'markNotified', ids: fresh.map((a) => a.id) });
    notifyAlerts(fresh);
  }, [alerts, loaded, data.notifiedAlertIds]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id' | 'seriesId'>) => {
    dispatch({ type: 'addTransactions', items: [{ ...t, id: uid(), seriesId: t.recurring ? uid() : undefined }] });
  }, []);

  const api: DataApi = {
    data,
    loaded,
    alerts,
    monthlyLoanPayments,
    addTransaction,
    updateTransaction: (item) =>
      dispatch({ type: 'updateTransaction', item: item.recurring && !item.seriesId ? { ...item, seriesId: uid() } : item }),
    deleteTransaction: (id) => dispatch({ type: 'deleteTransaction', id }),
    setBudget: (budget) => dispatch({ type: 'setBudget', budget }),
    deleteBudget: (category) => dispatch({ type: 'deleteBudget', category }),
    saveGoal: (g) => dispatch({ type: 'saveGoal', goal: { ...g, id: g.id ?? uid() } }),
    deleteGoal: (id) => dispatch({ type: 'deleteGoal', id }),
    saveLoan: (l) => dispatch({ type: 'saveLoan', loan: { ...l, id: l.id ?? uid(), createdAt: todayISO() } }),
    deleteLoan: (id) => dispatch({ type: 'deleteLoan', id }),
    updateSettings: (settings) => dispatch({ type: 'updateSettings', settings }),
    reset: () => dispatch({ type: 'reset' }),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useData(): DataApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData tem de ser usado dentro de <DataProvider>');
  return v;
}
