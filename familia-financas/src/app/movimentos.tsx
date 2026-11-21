import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import {
  Button, Card, Chips, colors, Divider, Field, MonthPicker, Muted, Row, Screen, Title, Toggle,
} from '../components/ui';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryIcon } from '../lib/categories';
import { monthSummary } from '../lib/finance';
import { formatEUR, isValidISODate, monthKey, parseAmount, todayISO } from '../lib/format';
import type { Transaction, TxType } from '../lib/types';
import { useData } from '../state/DataContext';

type Draft = Omit<Transaction, 'id' | 'amount'> & { id?: string; amountText: string };

const emptyDraft = (type: TxType, member: string): Draft => ({
  type,
  amountText: '',
  category: type === 'income' ? 'Salário' : 'Supermercado',
  description: '',
  date: todayISO(),
  member,
  recurring: false,
});

export default function MovimentosScreen() {
  const { data, addTransaction, updateTransaction, deleteTransaction } = useData();
  const params = useLocalSearchParams<{ novo?: string }>();
  const [month, setMonth] = useState(monthKey(new Date()));
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const [draft, setDraft] = useState<Draft | null>(null);

  // Aberto a partir dos botões "+ Receita / + Despesa" do Resumo
  useEffect(() => {
    if (params.novo === 'income' || params.novo === 'expense') {
      setDraft(emptyDraft(params.novo, data.settings.members[0]));
      router.setParams({ novo: undefined });
    }
  }, [params.novo, data.settings.members]);

  const list = useMemo(
    () =>
      data.transactions
        .filter((t) => monthKey(t.date) === month && (filter === 'all' || t.type === filter))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.transactions, month, filter],
  );
  const summary = monthSummary(data.transactions, month);

  const save = () => {
    if (!draft) return;
    const amount = parseAmount(draft.amountText);
    if (!(amount > 0)) return Alert.alert('Valor inválido', 'Indique um valor maior que zero.');
    if (!isValidISODate(draft.date)) return Alert.alert('Data inválida', 'Use o formato AAAA-MM-DD.');
    const { amountText, id, ...rest } = draft;
    if (id) {
      const original = data.transactions.find((t) => t.id === id)!;
      updateTransaction({ ...original, ...rest, amount });
    } else {
      addTransaction({ ...rest, amount });
    }
    setMonth(monthKey(draft.date));
    setDraft(null);
  };

  const edit = (t: Transaction) =>
    setDraft({ ...t, amountText: String(t.amount).replace('.', ',') });

  const remove = (t: Transaction) => {
    const doIt = () => deleteTransaction(t.id);
    if (Platform.OS === 'web') return doIt();
    Alert.alert('Apagar movimento?', `${t.description || t.category} — ${formatEUR(t.amount)}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: doIt },
    ]);
  };

  const categories = draft?.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <>
      <Screen>
        <MonthPicker month={month} onChange={setMonth} />
        <Row>
          <View style={{ flex: 1 }}>
            <Button label="+ Receita" variant="secondary" onPress={() => setDraft(emptyDraft('income', data.settings.members[0]))} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="+ Despesa" onPress={() => setDraft(emptyDraft('expense', data.settings.members[0]))} />
          </View>
        </Row>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: colors.income, fontWeight: '700' }}>+ {formatEUR(summary.income)}</Text>
            <Text style={{ color: colors.expense, fontWeight: '700' }}>− {formatEUR(summary.expenses)}</Text>
          </Row>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'income', label: 'Receitas' },
              { value: 'expense', label: 'Despesas' },
            ]}
          />
          <Divider />
          {list.length === 0 ? <Muted>Sem movimentos neste mês.</Muted> : null}
          {list.map((t) => (
            <Pressable key={t.id} onPress={() => edit(t)} onLongPress={() => remove(t)}>
              <Row gap={10} style={{ alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontSize: 22 }}>{categoryIcon(t.category, t.type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                    {t.description || t.category}
                    {t.recurring ? '  🔁' : ''}
                  </Text>
                  <Muted>
                    {t.date.slice(8, 10)}/{t.date.slice(5, 7)} · {t.category} · {t.member}
                  </Muted>
                </View>
                <Text style={{ fontWeight: '700', color: t.type === 'income' ? colors.income : colors.expense }}>
                  {t.type === 'income' ? '+' : '−'}
                  {formatEUR(t.amount)}
                </Text>
              </Row>
            </Pressable>
          ))}
          {list.length > 0 ? <Muted>Toque para editar · mantenha premido para apagar · 🔁 = repete todos os meses</Muted> : null}
        </Card>
      </Screen>

      <Modal visible={draft !== null} animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {draft ? (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
              <Title>{draft.id ? 'Editar movimento' : draft.type === 'income' ? 'Nova receita' : 'Nova despesa'}</Title>
              <Chips
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type, category: type === 'income' ? 'Salário' : 'Supermercado' })}
                options={[
                  { value: 'expense', label: '💸 Despesa' },
                  { value: 'income', label: '💰 Receita' },
                ]}
              />
              <Field
                label="Valor (€)"
                keyboardType="decimal-pad"
                placeholder="0,00"
                value={draft.amountText}
                onChangeText={(amountText) => setDraft({ ...draft, amountText })}
                autoFocus={!draft.id}
              />
              <Chips
                label="Categoria"
                value={draft.category}
                onChange={(category) => setDraft({ ...draft, category })}
                options={categories.map((c) => ({ value: c.name, label: `${c.icon} ${c.name}` }))}
              />
              <Field
                label="Descrição"
                placeholder="Ex.: Continente, renda, ordenado…"
                value={draft.description}
                onChangeText={(description) => setDraft({ ...draft, description })}
              />
              <Field
                label="Data"
                placeholder="AAAA-MM-DD"
                value={draft.date}
                onChangeText={(date) => setDraft({ ...draft, date })}
              />
              <Chips
                label="Quem"
                value={draft.member}
                onChange={(member) => setDraft({ ...draft, member })}
                options={data.settings.members.map((m) => ({ value: m, label: m }))}
              />
              <Toggle
                label="Repete todos os meses (renda, salário, luz…)"
                value={draft.recurring}
                onChange={(recurring) => setDraft({ ...draft, recurring })}
              />
              <Button label="Guardar" onPress={save} />
              <Button label="Cancelar" variant="secondary" onPress={() => setDraft(null)} />
              {draft.id ? (
                <Button
                  label="Apagar"
                  variant="danger"
                  onPress={() => {
                    deleteTransaction(draft.id!);
                    setDraft(null);
                  }}
                />
              ) : null}
            </ScrollView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
