export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // sempre positivo, em euros
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  member: string; // quem registou / a quem diz respeito
  recurring: boolean; // repete todos os meses (gasto/receita fixa)
  seriesId?: string; // liga as ocorrências de um movimento recorrente
}

export interface Budget {
  category: string;
  monthlyLimit: number;
  alertAt: number; // percentagem (ex.: 80) a partir da qual se avisa
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string; // YYYY-MM-DD
}

export type RateType = 'fixed' | 'variable';

export interface LoanInput {
  principal: number;
  years: number;
  rateType: RateType;
  fixedRate: number; // TAN % (taxa fixa)
  euribor: number; // % (taxa variável)
  spread: number; // % (taxa variável)
  monthlyInsurance: number; // seguros mensais (vida/multirriscos)
  upfrontFees: number; // comissões de abertura, avaliação, impostos...
}

export interface Loan extends LoanInput {
  id: string;
  name: string;
  bank: string;
  createdAt: string;
}

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export interface Settings {
  members: string[];
  riskProfile: RiskProfile;
}

export interface AppData {
  version: 1;
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  loans: Loan[];
  settings: Settings;
  notifiedAlertIds: string[]; // alertas já enviados como notificação
}

export type AlertLevel = 'info' | 'warning' | 'danger' | 'success';

export interface FinanceAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
}

export interface Insight {
  id: string;
  title: string;
  message: string;
}
