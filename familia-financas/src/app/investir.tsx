import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Card, Chips, colors, Divider, Muted, Notice, ProgressBar, Row, Screen, Stat, Title, Toggle,
} from '../components/ui';
import { averageMonthly, futureValue, investmentPlan, monthSummary } from '../lib/finance';
import { formatEUR, monthKey } from '../lib/format';
import type { RiskProfile } from '../lib/types';
import { useData } from '../state/DataContext';

const PROFILE_OPTIONS: { value: RiskProfile; label: string; text: string }[] = [
  { value: 'conservative', label: '🛡️ Conservador', text: 'Não quero ver o meu dinheiro descer. Prefiro ganhar pouco mas com segurança.' },
  { value: 'moderate', label: '⚖️ Moderado', text: 'Aceito algumas descidas temporárias para ganhar mais a 5–10 anos.' },
  { value: 'aggressive', label: '🚀 Dinâmico', text: 'Invisto a longo prazo (10+ anos) e aguento quedas de 30% ou mais sem vender.' },
];

// Rentabilidades médias anuais apenas para ilustrar (não garantidas)
const ASSUMED_RETURN: Record<string, number> = { deposits: 2, bonds: 3, stocks: 6, crypto: 0 };

export default function InvestirScreen() {
  const { data, updateSettings } = useData();
  const [expensiveDebt, setExpensiveDebt] = useState(false);
  const month = monthKey(new Date());

  const { surplus, expenses, basis } = useMemo(() => {
    const avg = averageMonthly(data.transactions, month);
    if (avg) return { surplus: avg.income - avg.expenses, expenses: avg.expenses, basis: avg.months === 1 ? 'média do mês passado' : `média dos últimos ${avg.months} meses` };
    const s = monthSummary(data.transactions, month);
    return { surplus: s.balance, expenses: s.expenses, basis: 'este mês' };
  }, [data.transactions, month]);

  const emergencySaved = data.goals.filter((g) => /emerg/i.test(g.name)).reduce((a, g) => a + g.saved, 0);
  const profile = data.settings.riskProfile;
  const plan = investmentPlan({ monthlySurplus: surplus, monthlyExpenses: expenses, emergencySaved, profile, hasExpensiveDebt: expensiveDebt });

  const projection10 = plan.allocation.reduce((a, x) => a + futureValue(x.monthly, ASSUMED_RETURN[x.key], 10), 0);
  const invested10 = plan.monthlyAvailable * 120;

  return (
    <Screen>
      <Notice
        level="warning"
        title="Informação educativa, não é aconselhamento financeiro"
        message="Investir tem risco de perda. Antes de investir confirme que a entidade está registada na CMVM ou no Banco de Portugal."
      />

      <Card>
        <Title>O seu perfil de risco</Title>
        <Chips value={profile} onChange={(riskProfile) => updateSettings({ riskProfile })} options={PROFILE_OPTIONS} />
        <Muted>{PROFILE_OPTIONS.find((p) => p.value === profile)!.text}</Muted>
        <Toggle label="Tenho cartão de crédito ou crédito pessoal com juro alto" value={expensiveDebt} onChange={setExpensiveDebt} />
      </Card>

      <Card>
        <Title>Quanto pode investir</Title>
        <Row gap={12}>
          <Stat label={`Sobra por mês (${basis})`} value={formatEUR(plan.monthlyAvailable, 0)} color={colors.income} />
          <Stat label="Fundo de emergência" value={`${formatEUR(emergencySaved, 0)}`} />
        </Row>
        {plan.emergencyTarget > 0 ? (
          <>
            <ProgressBar pct={(emergencySaved / plan.emergencyTarget) * 100} color={colors.primary} />
            <Muted>
              Objetivo: 6 meses de despesas = {formatEUR(plan.emergencyTarget, 0)}
              {plan.emergencyMissing > 0 ? ` · faltam ${formatEUR(plan.emergencyMissing, 0)} (crie uma meta com "emergência" no nome)` : ' · completo ✅'}
            </Muted>
          </>
        ) : null}
      </Card>

      {!plan.canInvest ? (
        <Notice level="info" title="Ainda não é altura de investir" message={plan.reason ?? ''} />
      ) : (
        <Card>
          <Title>Sugestão de distribuição mensal</Title>
          {plan.emergencyMissing > 0 ? (
            <Muted>Enquanto o fundo de emergência não estiver completo, metade do excedente vai para depósitos.</Muted>
          ) : null}
          {plan.allocation.map((a) => (
            <View key={a.key} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>{a.label}</Text>
                <Text style={{ fontWeight: '700', color: colors.primary }}>
                  {formatEUR(a.monthly, 0)}/mês · {Math.round(a.pct)}%
                </Text>
              </Row>
              <ProgressBar pct={a.pct} color={a.key === 'crypto' ? colors.warning : colors.primary} />
              <Muted>{a.description}</Muted>
              <Divider />
            </View>
          ))}
          <Muted>
            Investindo {formatEUR(plan.monthlyAvailable, 0)}/mês durante 10 anos ({formatEUR(invested10, 0)} no total), com rentabilidades médias
            ilustrativas, poderia ter cerca de {formatEUR(projection10, 0)} (sem contar com a cripto, cujo valor é imprevisível).
          </Muted>
        </Card>
      )}

      <Card>
        <Title>📊 Bolsa: como começar</Title>
        <Tip text="Prefira ETFs de índice (ex.: MSCI World, S&P 500, FTSE All-World) em vez de escolher ações individuais — diversifica e custa menos." />
        <Tip text="Invista todos os meses o mesmo valor (custo médio) em vez de tentar adivinhar o melhor momento." />
        <Tip text="Compare comissões da corretora: custos de 1% ao ano comem uma grande parte do ganho a 20 anos." />
        <Tip text="Em Portugal as mais-valias são tributadas a 28% (ou englobamento no IRS). Guarde os comprovativos." />
        <Tip text="Para objetivos curtos (casa daqui a 2 anos) use depósitos ou Certificados de Aforro, não a bolsa." />
      </Card>

      <Card>
        <Title>₿ Criptomoedas: com cuidado</Title>
        <Tip text="Limite a cripto a uma pequena parte do património (0–10%) — só o que aceita perder." />
        <Tip text="Se investir, fique pelas maiores (Bitcoin, Ethereum). Evite moedas desconhecidas, promessas de lucros garantidos e 'influencers'." />
        <Tip text="Use plataformas autorizadas na UE ao abrigo do regulamento MiCA e ative a autenticação de dois fatores." />
        <Tip text="Nunca partilhe a seed phrase / chaves privadas. Ninguém legítimo as pede." />
        <Tip text="Fiscalidade em Portugal: ganhos em cripto detida há menos de 1 ano são tributados a 28%. Confirme as regras em vigor." />
      </Card>
    </Screen>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <Row gap={8}>
      <Text style={{ color: colors.primary }}>•</Text>
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </Row>
  );
}
