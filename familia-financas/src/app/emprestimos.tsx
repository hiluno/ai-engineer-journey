import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import {
  Button, Card, Chips, colors, Divider, Field, Muted, Notice, Row, Screen, Stat, Title,
} from '../components/ui';
import { BANCO_PORTUGAL_PORTAL, BANKS, OTHER_BANK_ID } from '../lib/banks';
import { amortizationSchedule, averageMonthly, effortLevel, effortRate, monthSummary, simulateLoan } from '../lib/finance';
import { formatEUR, formatPct, monthKey, parseAmount, todayISO } from '../lib/format';
import type { LoanInput, RateType } from '../lib/types';
import { useData } from '../state/DataContext';

const LOAN_TYPES = [
  { value: 'habitacao', label: '🏠 Habitação', years: '30', principal: '150000' },
  { value: 'automovel', label: '🚗 Automóvel', years: '7', principal: '15000' },
  { value: 'pessoal', label: '👛 Pessoal', years: '5', principal: '5000' },
] as const;
type LoanKind = (typeof LOAN_TYPES)[number]['value'];

const num = (s: string) => {
  const v = parseAmount(s);
  return Number.isFinite(v) ? v : 0;
};

export default function EmprestimosScreen() {
  const { data, saveLoan, deleteLoan, addTransaction, monthlyLoanPayments } = useData();

  const [kind, setKind] = useState<LoanKind>('habitacao');
  const [bankId, setBankId] = useState<string>(BANKS[0].id);
  const [otherBank, setOtherBank] = useState('');
  const [principal, setPrincipal] = useState('150000');
  const [years, setYears] = useState('30');
  const [rateType, setRateType] = useState<RateType>('variable');
  const [fixedRate, setFixedRate] = useState('3,5');
  const [euribor, setEuribor] = useState('2,2');
  const [spread, setSpread] = useState('1');
  const [insurance, setInsurance] = useState('35');
  const [fees, setFees] = useState('800');
  const [showTable, setShowTable] = useState(false);

  const bank = BANKS.find((b) => b.id === bankId);
  const bankName = bankId === OTHER_BANK_ID ? otherBank.trim() || 'Outro banco' : bank!.name;

  const input: LoanInput = {
    principal: num(principal),
    years: num(years),
    rateType,
    fixedRate: num(fixedRate),
    euribor: num(euribor),
    spread: num(spread),
    monthlyInsurance: num(insurance),
    upfrontFees: num(fees),
  };
  const valid = input.principal > 0 && input.years > 0;
  const result = valid ? simulateLoan(input) : null;

  // Rendimento de referência para a taxa de esforço: média dos últimos meses ou o mês atual
  const month = monthKey(new Date());
  const income = useMemo(() => {
    const avg = averageMonthly(data.transactions, month);
    return Math.max(avg?.income ?? 0, monthSummary(data.transactions, month).income);
  }, [data.transactions, month]);
  const effort = result ? effortRate(result.monthlyTotal + monthlyLoanPayments, income) : 0;
  const level = effortLevel(effort);

  const yearly = useMemo(() => {
    if (!result || !showTable) return [];
    const rows = amortizationSchedule(input.principal, result.annualRate, result.months);
    const out: { year: number; interest: number; principal: number; balance: number }[] = [];
    rows.forEach((r, i) => {
      const y = Math.floor(i / 12);
      out[y] ??= { year: y + 1, interest: 0, principal: 0, balance: 0 };
      out[y].interest += r.interest;
      out[y].principal += r.principal;
      out[y].balance = r.balance;
    });
    return out;
  }, [result, showTable, input.principal]);

  const pickKind = (k: LoanKind) => {
    const t = LOAN_TYPES.find((x) => x.value === k)!;
    setKind(k);
    setYears(t.years);
    setPrincipal(t.principal);
    if (k !== 'habitacao') setRateType('fixed');
  };

  const openBankSimulator = () => {
    if (bankId === OTHER_BANK_ID) return WebBrowser.openBrowserAsync(BANCO_PORTUGAL_PORTAL);
    WebBrowser.openBrowserAsync(bank!.url);
  };

  const save = () => {
    if (!result) return;
    const typeLabel = LOAN_TYPES.find((t) => t.value === kind)!.label.slice(2).trim();
    saveLoan({ ...input, name: `Crédito ${typeLabel}`, bank: bankName });
    Alert.alert('Crédito guardado', 'A prestação passa a contar na taxa de esforço e nos alertas.');
  };

  const addAsExpense = () => {
    if (!result) return;
    addTransaction({
      type: 'expense',
      amount: result.monthlyTotal,
      category: 'Prestações',
      description: `Prestação ${bankName}`,
      date: todayISO(),
      member: data.settings.members[0],
      recurring: true,
    });
    Alert.alert('Adicionado', 'A prestação foi adicionada como despesa recorrente mensal.');
  };

  return (
    <Screen>
      <Card>
        <Title>1. Tipo de crédito e banco</Title>
        <Chips value={kind} onChange={pickKind} options={LOAN_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Chips
          label="Banco"
          value={bankId}
          onChange={setBankId}
          options={[...BANKS.map((b) => ({ value: b.id, label: b.name })), { value: OTHER_BANK_ID, label: '➕ Outro' }]}
        />
        {bankId === OTHER_BANK_ID ? (
          <Field label="Nome do banco" placeholder="Ex.: Banco CTT" value={otherBank} onChangeText={setOtherBank} />
        ) : null}
        <Button
          variant="secondary"
          label={bankId === OTHER_BANK_ID ? 'Abrir simuladores do Banco de Portugal ↗' : `Abrir simulador ${bank!.name} ↗`}
          onPress={openBankSimulator}
        />
        <Muted>
          O site do banco abre no navegador — procure "Simulador de crédito". Depois copie para aqui a TAN, o spread e os seguros que o banco lhe indicar, para comparar propostas lado a lado.
        </Muted>
      </Card>

      <Card>
        <Title>2. Valores e taxas</Title>
        <Row>
          <Field label="Montante (€)" keyboardType="decimal-pad" value={principal} onChangeText={setPrincipal} />
          <Field label="Prazo (anos)" keyboardType="decimal-pad" value={years} onChangeText={setYears} />
        </Row>
        <Chips
          label="Tipo de taxa"
          value={rateType}
          onChange={setRateType}
          options={[
            { value: 'variable', label: 'Variável (Euribor + spread)' },
            { value: 'fixed', label: 'Fixa (TAN)' },
          ]}
        />
        {rateType === 'fixed' ? (
          <Field label="TAN (%)" keyboardType="decimal-pad" value={fixedRate} onChangeText={setFixedRate} hint="Taxa anual nominal indicada pelo banco." />
        ) : (
          <Row>
            <Field label="Euribor (%)" keyboardType="decimal-pad" value={euribor} onChangeText={setEuribor} hint="Ex.: Euribor a 6 ou 12 meses atual." />
            <Field label="Spread (%)" keyboardType="decimal-pad" value={spread} onChangeText={setSpread} hint="Margem do banco." />
          </Row>
        )}
        <Row>
          <Field label="Seguros / mês (€)" keyboardType="decimal-pad" value={insurance} onChangeText={setInsurance} />
          <Field label="Comissões e custos iniciais (€)" keyboardType="decimal-pad" value={fees} onChangeText={setFees} />
        </Row>
      </Card>

      {result ? (
        <Card>
          <Title>3. Resultado — {bankName}</Title>
          <Row gap={12}>
            <Stat label="Prestação" value={formatEUR(result.payment)} color={colors.primary} />
            <Stat label="Com seguros" value={formatEUR(result.monthlyTotal)} />
          </Row>
          <Row gap={12}>
            <Stat label="Total de juros" value={formatEUR(result.totalInterest, 0)} color={colors.expense} />
            <Stat label="Custo total (aprox. MTIC)" value={formatEUR(result.totalCost, 0)} />
          </Row>
          <Muted>
            Taxa aplicada: {formatPct(result.annualRate, 2)} · {result.months} prestações · no 1.º ano paga {formatEUR(result.firstYear.interest, 0)} de juros e amortiza {formatEUR(result.firstYear.principal, 0)} de capital.
          </Muted>
          {income > 0 ? (
            <Notice
              level={level === 'ok' ? 'success' : level === 'warning' ? 'warning' : 'danger'}
              title={`Taxa de esforço: ${formatPct(effort, 0)}`}
              message={
                level === 'ok'
                  ? `Com um rendimento de ${formatEUR(income, 0)}/mês, as prestações ficam num nível confortável.`
                  : level === 'warning'
                    ? 'Acima de 35% o orçamento fica apertado. Considere um prazo maior, entrada maior ou outro banco.'
                    : 'Acima de 50% — o Banco de Portugal recomenda não ultrapassar este limite. É provável que o banco recuse.'
              }
            />
          ) : (
            <Notice level="info" title="Registe o rendimento da família" message="Com as receitas registadas, a app calcula a taxa de esforço deste crédito." />
          )}
          <Row>
            <View style={{ flex: 1 }}>
              <Button label="Guardar crédito" onPress={save} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Pôr nas despesas fixas" variant="secondary" onPress={addAsExpense} />
            </View>
          </Row>
          <Button small variant="secondary" label={showTable ? 'Esconder plano de pagamentos' : 'Ver plano de pagamentos por ano'} onPress={() => setShowTable(!showTable)} />
          {yearly.length > 0 ? (
            <View style={{ gap: 2 }}>
              <Row>
                <Text style={[cell, { flex: 0.5, fontWeight: '700' }]}>Ano</Text>
                <Text style={[cell, { fontWeight: '700' }]}>Juros</Text>
                <Text style={[cell, { fontWeight: '700' }]}>Capital</Text>
                <Text style={[cell, { fontWeight: '700' }]}>Em dívida</Text>
              </Row>
              {yearly.map((y) => (
                <Row key={y.year}>
                  <Text style={[cell, { flex: 0.5 }]}>{y.year}</Text>
                  <Text style={cell}>{formatEUR(y.interest, 0)}</Text>
                  <Text style={cell}>{formatEUR(y.principal, 0)}</Text>
                  <Text style={cell}>{formatEUR(y.balance, 0)}</Text>
                </Row>
              ))}
            </View>
          ) : null}
        </Card>
      ) : (
        <Notice level="info" title="Indique o montante e o prazo" message="O resultado aparece aqui." />
      )}

      {data.loans.length > 0 ? (
        <Card>
          <Title>Créditos guardados</Title>
          {data.loans.map((l) => {
            const r = simulateLoan(l);
            return (
              <View key={l.id} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {l.name} · {l.bank}
                    </Text>
                    <Muted>
                      {formatEUR(l.principal, 0)} · {l.years} anos · {formatPct(r.annualRate, 2)} → {formatEUR(r.monthlyTotal)}/mês · juros {formatEUR(r.totalInterest, 0)}
                    </Muted>
                  </View>
                  <Button small variant="danger" label="🗑" onPress={() => deleteLoan(l.id)} />
                </Row>
                <Divider />
              </View>
            );
          })}
          <Muted>Guarde várias simulações (bancos diferentes) para comparar o total de juros.</Muted>
        </Card>
      ) : null}

      <Muted style={{ textAlign: 'center' }}>
        Simulação indicativa (método francês, prestações constantes). A proposta oficial do banco (FINE) e a TAEG podem diferir.
      </Muted>
    </Screen>
  );
}

const cell = { flex: 1, fontSize: 12, color: colors.text } as const;
