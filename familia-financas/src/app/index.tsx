import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FamilyCard } from '../components/FamilyCard';
import { Button, Card, colors, MonthPicker, Muted, Notice, ProgressBar, Row, Screen, Stat, Title } from '../components/ui';
import { categoryIcon } from '../lib/categories';
import { computeAlerts, computeInsights, monthSummary } from '../lib/finance';
import { formatEUR, formatPct, monthKey, todayISO } from '../lib/format';
import { useData } from '../state/DataContext';

export default function ResumoScreen() {
  const { data, monthlyLoanPayments } = useData();
  const [month, setMonth] = useState(monthKey(new Date()));

  const summary = useMemo(() => monthSummary(data.transactions, month), [data.transactions, month]);
  const alerts = useMemo(
    () =>
      computeAlerts({
        month, today: todayISO(), transactions: data.transactions,
        budgets: data.budgets, goals: data.goals, monthlyLoanPayments,
      }),
    [month, data, monthlyLoanPayments],
  );
  const insights = useMemo(() => computeInsights(data.transactions, month, data.goals), [data.transactions, month, data.goals]);
  const topCategories = Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = topCategories[0]?.[1] ?? 1;

  return (
    <Screen>
      <MonthPicker month={month} onChange={setMonth} />

      <Card>
        <Row gap={12}>
          <Stat label="Receitas" value={formatEUR(summary.income, 0)} color={colors.income} />
          <Stat label="Despesas" value={formatEUR(summary.expenses, 0)} color={colors.expense} />
          <Stat label="Saldo" value={formatEUR(summary.balance, 0)} color={summary.balance >= 0 ? colors.text : colors.expense} />
        </Row>
        {summary.income > 0 ? (
          <Muted>Taxa de poupança: {formatPct(Math.max(0, summary.savingsRate), 0)} do rendimento</Muted>
        ) : null}
        <Row>
          <View style={{ flex: 1 }}>
            <Button label="+ Receita" variant="secondary" onPress={() => router.push({ pathname: '/movimentos', params: { novo: 'income' } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="+ Despesa" onPress={() => router.push({ pathname: '/movimentos', params: { novo: 'expense' } })} />
          </View>
        </Row>
      </Card>

      <Card>
        <Title>Alertas</Title>
        {alerts.length === 0 ? (
          <Muted>Sem alertas. Defina orçamentos e metas no separador Orçamento para ser avisado.</Muted>
        ) : (
          alerts.map((a) => <Notice key={a.id} level={a.level} title={a.title} message={a.message} />)
        )}
      </Card>

      <Card>
        <Title>Ideias para a família</Title>
        {insights.length === 0 ? <Muted>Tudo em ordem este mês. 👍</Muted> : null}
        {insights.map((i) => (
          <Notice key={i.id} level="info" title={i.title} message={i.message} />
        ))}
      </Card>

      {topCategories.length > 0 ? (
        <Card>
          <Title>Para onde vai o dinheiro</Title>
          {topCategories.map(([cat, value]) => (
            <View key={cat} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text }}>
                  {categoryIcon(cat)} {cat}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{formatEUR(value)}</Text>
              </Row>
              <ProgressBar pct={(value / maxCat) * 100} color={colors.primary} />
            </View>
          ))}
        </Card>
      ) : null}

      <FamilyCard />
    </Screen>
  );
}
