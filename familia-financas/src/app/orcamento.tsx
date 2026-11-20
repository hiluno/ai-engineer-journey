import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  Button, Card, Chips, colors, Divider, Field, Muted, Notice, ProgressBar, Row, Screen, Title,
} from '../components/ui';
import { EXPENSE_CATEGORIES, categoryIcon } from '../lib/categories';
import { budgetStatuses, goalStatus, monthSummary } from '../lib/finance';
import { formatEUR, formatPct, isValidISODate, monthKey, monthLabel, parseAmount, todayISO } from '../lib/format';
import type { SavingsGoal } from '../lib/types';
import { useData } from '../state/DataContext';

export default function OrcamentoScreen() {
  const { data, setBudget, deleteBudget, saveGoal, deleteGoal } = useData();
  const month = monthKey(new Date());
  const summary = useMemo(() => monthSummary(data.transactions, month), [data.transactions, month]);
  const statuses = budgetStatuses(data.budgets, summary).sort((a, b) => b.pct - a.pct);

  // Formulário de orçamento
  const [bCategory, setBCategory] = useState(EXPENSE_CATEGORIES[1].name);
  const [bLimit, setBLimit] = useState('');
  const [bAlert, setBAlert] = useState('80');

  const saveBudget = () => {
    const limit = parseAmount(bLimit);
    const alertAt = parseAmount(bAlert);
    if (!(limit > 0)) return Alert.alert('Valor inválido', 'Indique o limite mensal.');
    if (!(alertAt > 0 && alertAt <= 100)) return Alert.alert('Percentagem inválida', 'Use um valor entre 1 e 100.');
    setBudget({ category: bCategory, monthlyLimit: limit, alertAt });
    setBLimit('');
  };

  // Formulário de meta
  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gDeadline, setGDeadline] = useState('');
  const [contrib, setContrib] = useState<Record<string, string>>({});

  const addGoal = () => {
    const target = parseAmount(gTarget);
    if (!gName.trim()) return Alert.alert('Falta o nome', 'Ex.: Fundo de emergência, Férias, Carro.');
    if (!(target > 0)) return Alert.alert('Valor inválido', 'Indique o objetivo em euros.');
    if (gDeadline && !isValidISODate(gDeadline)) return Alert.alert('Data inválida', 'Use AAAA-MM-DD.');
    saveGoal({ name: gName.trim(), target, saved: 0, deadline: gDeadline || undefined });
    setGName('');
    setGTarget('');
    setGDeadline('');
  };

  const addContribution = (g: SavingsGoal, sign: 1 | -1) => {
    const v = parseAmount(contrib[g.id] ?? '');
    if (!(v > 0)) return;
    saveGoal({ ...g, saved: Math.max(0, g.saved + sign * v) });
    setContrib({ ...contrib, [g.id]: '' });
  };

  return (
    <Screen>
      <Card>
        <Title>Orçamento de {monthLabel(month)}</Title>
        <Muted>Defina um limite por categoria. Recebe um alerta quando atingir a percentagem escolhida e outro ao ultrapassar.</Muted>
        {statuses.length === 0 ? <Notice level="info" title="Sem orçamentos" message="Comece por Supermercado e Restauração — são as categorias onde é mais fácil derrapar." /> : null}
        {statuses.map((b) => (
          <View key={b.category} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>
                {categoryIcon(b.category)} {b.category}
              </Text>
              <Text style={{ color: b.level === 'over' ? colors.expense : colors.text }}>
                {formatEUR(b.spent, 0)} / {formatEUR(b.monthlyLimit, 0)}
              </Text>
            </Row>
            <ProgressBar pct={b.pct} color={b.level === 'over' ? colors.expense : b.level === 'warning' ? colors.warning : colors.income} />
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Muted>
                {formatPct(b.pct, 0)} usado · alerta aos {b.alertAt}% ·{' '}
                {b.remaining >= 0 ? `restam ${formatEUR(b.remaining, 0)}` : `excedido em ${formatEUR(-b.remaining, 0)}`}
              </Muted>
              <Button small variant="danger" label="Remover" onPress={() => deleteBudget(b.category)} />
            </Row>
          </View>
        ))}
        <Divider />
        <Chips
          label="Categoria"
          value={bCategory}
          onChange={setBCategory}
          options={EXPENSE_CATEGORIES.map((c) => ({ value: c.name, label: `${c.icon} ${c.name}` }))}
        />
        <Row>
          <Field label="Limite mensal (€)" keyboardType="decimal-pad" placeholder="400" value={bLimit} onChangeText={setBLimit} />
          <Field label="Avisar aos (%)" keyboardType="number-pad" value={bAlert} onChangeText={setBAlert} />
        </Row>
        <Button label={data.budgets.some((b) => b.category === bCategory) ? 'Atualizar orçamento' : 'Definir orçamento'} onPress={saveBudget} />
      </Card>

      <Card>
        <Title>Metas de poupança</Title>
        {data.goals.length === 0 ? <Muted>Ainda não há metas. Sugestão: comece pelo fundo de emergência (3–6 meses de despesas).</Muted> : null}
        {data.goals.map((goal) => {
          const g = goalStatus(goal, todayISO());
          return (
            <View key={g.id} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                  {g.reached ? '🏆 ' : '🐷 '}
                  {g.name}
                </Text>
                <Text style={{ color: colors.text }}>
                  {formatEUR(g.saved, 0)} / {formatEUR(g.target, 0)}
                </Text>
              </Row>
              <ProgressBar pct={g.pct} color={g.reached ? colors.income : colors.primary} />
              <Muted>
                {g.reached
                  ? 'Meta atingida!'
                  : g.monthlyNeeded !== null
                    ? `Faltam ${formatEUR(g.remaining, 0)} · poupe ${formatEUR(g.monthlyNeeded)} por mês durante ${g.monthsLeft} meses`
                    : `Faltam ${formatEUR(g.remaining, 0)}`}
              </Muted>
              <Row style={{ alignItems: 'flex-end' }}>
                <Field
                  label="Valor"
                  keyboardType="decimal-pad"
                  placeholder="50"
                  value={contrib[g.id] ?? ''}
                  onChangeText={(v) => setContrib({ ...contrib, [g.id]: v })}
                />
                <Button small label="+ Pôr" onPress={() => addContribution(goal, 1)} />
                <Button small variant="secondary" label="− Tirar" onPress={() => addContribution(goal, -1)} />
                <Button small variant="danger" label="🗑" onPress={() => deleteGoal(g.id)} />
              </Row>
              <Divider />
            </View>
          );
        })}
        <Field label="Nome da meta" placeholder="Fundo de emergência" value={gName} onChangeText={setGName} />
        <Row>
          <Field label="Objetivo (€)" keyboardType="decimal-pad" placeholder="6000" value={gTarget} onChangeText={setGTarget} />
          <Field label="Prazo (opcional)" placeholder="AAAA-MM-DD" value={gDeadline} onChangeText={setGDeadline} />
        </Row>
        <Button label="Criar meta" onPress={addGoal} />
      </Card>
    </Screen>
  );
}
