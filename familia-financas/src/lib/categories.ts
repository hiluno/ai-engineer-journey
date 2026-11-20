export type Need = 'needs' | 'wants' | 'savings';

export interface Category {
  name: string;
  icon: string;
  kind: Need; // usado na regra 50/30/20
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Habitação', icon: '🏠', kind: 'needs' },
  { name: 'Supermercado', icon: '🛒', kind: 'needs' },
  { name: 'Água/Luz/Gás', icon: '💡', kind: 'needs' },
  { name: 'Telecomunicações', icon: '📱', kind: 'needs' },
  { name: 'Transportes', icon: '🚗', kind: 'needs' },
  { name: 'Saúde', icon: '💊', kind: 'needs' },
  { name: 'Educação', icon: '🎓', kind: 'needs' },
  { name: 'Prestações', icon: '🏦', kind: 'needs' },
  { name: 'Restauração', icon: '🍽️', kind: 'wants' },
  { name: 'Lazer', icon: '🎉', kind: 'wants' },
  { name: 'Roupa', icon: '👕', kind: 'wants' },
  { name: 'Subscrições', icon: '📺', kind: 'wants' },
  { name: 'Poupança', icon: '🐷', kind: 'savings' },
  { name: 'Outros', icon: '📦', kind: 'wants' },
];

export const INCOME_CATEGORIES: Category[] = [
  { name: 'Salário', icon: '💼', kind: 'needs' },
  { name: 'Subsídios', icon: '🎁', kind: 'needs' },
  { name: 'Rendas', icon: '🏘️', kind: 'needs' },
  { name: 'Freelance', icon: '🧑‍💻', kind: 'needs' },
  { name: 'Investimentos', icon: '📈', kind: 'needs' },
  { name: 'Outros', icon: '💶', kind: 'needs' },
];

export function categoryIcon(name: string, type: 'income' | 'expense' = 'expense'): string {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return list.find((c) => c.name === name)?.icon ?? '📦';
}

export function categoryKind(name: string): Need {
  return EXPENSE_CATEGORIES.find((c) => c.name === name)?.kind ?? 'wants';
}
