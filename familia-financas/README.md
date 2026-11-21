# Finanças da Família 📱

Aplicação Android (React Native + Expo) para gerir as contas da família num só sítio.

## O que faz

| Separador | Funcionalidades |
|---|---|
| 🏠 **Resumo** | Receitas, despesas e saldo do mês · taxa de poupança · **alertas** · **ideias** de poupança · para onde vai o dinheiro · membros da família |
| 💶 **Movimentos** | Registar receitas e despesas por categoria e por membro · movimentos **recorrentes** (renda, salário, luz) criados automaticamente todos os meses |
| 🎯 **Orçamento** | Limite mensal por categoria com alerta à percentagem escolhida (ex.: 80%) e ao ultrapassar · **metas de poupança** com prazo e quanto poupar por mês |
| 🏦 **Crédito** | Simulador de empréstimo (habitação, automóvel, pessoal): escolher o banco e abrir o **simulador do próprio banco**, ou introduzir TAN / Euribor + spread, seguros e comissões · prestação, total de juros, custo total, plano por ano · **taxa de esforço** · guardar e comparar propostas |
| 📈 **Investir** | Perfil de risco · fundo de emergência primeiro · sugestão de distribuição do excedente por depósitos, obrigações, **bolsa (ETFs)** e **criptomoedas** · dicas de segurança e fiscalidade |

### Alertas
São calculados automaticamente e enviados como **notificação no telemóvel** (uma vez cada):
- orçamento de uma categoria atingiu a percentagem definida / foi ultrapassado
- meta de poupança atingida 🎉 ou em risco de não cumprir o prazo
- gastos do mês acima das receitas
- taxa de esforço dos créditos acima de 35% / 50%

### Ideias
- taxa de poupança abaixo de 10% ou acima de 20%
- regra 50/30/20 (essenciais / desejos / poupança)
- categoria que mais subiu face ao mês anterior
- falta de fundo de emergência (3–6 meses de despesas)

> Os bancos portugueses não têm uma API pública de simulação, por isso a app abre o site oficial do banco
> (ou os simuladores do Portal do Cliente Bancário do Banco de Portugal) e faz em paralelo a simulação local com as taxas que indicar.
> As sugestões de investimento são educativas e **não são aconselhamento financeiro**.

Os dados ficam guardados **apenas no telemóvel** (AsyncStorage). Não há contas nem servidores.

## Experimentar no telemóvel Android (mais rápido)

1. Instale a app **Expo Go** a partir da Play Store.
2. No computador (Node.js 20+):
   ```bash
   cd familia-financas
   npm install
   npx expo start
   ```
3. Leia o código QR com a Expo Go. O telemóvel e o computador têm de estar na mesma rede Wi-Fi.

## Gerar o ficheiro APK para instalar

```bash
npm install -g eas-cli
eas login            # conta gratuita em expo.dev
eas build -p android --profile preview
```
No fim, a EAS dá um link para descarregar o `.apk` e instalar no telemóvel. Não é preciso o Android Studio.
Para publicar na Play Store use `--profile production` (gera `.aab`).

## Desenvolvimento

```bash
npm test             # testes da lógica financeira (Jest)
npm run typecheck    # TypeScript
npm run web          # pré-visualizar no navegador
```

```
src/
  app/            ecrãs (Expo Router): index, movimentos, orcamento, emprestimos, investir
  components/     componentes de interface
  lib/            lógica pura e testada: finance.ts (crédito, orçamentos, alertas, ideias, investimento)
  state/          dados persistentes (DataContext) e notificações
```

## Próximos passos possíveis
- Exportar/importar dados (CSV / cópia de segurança) e sincronizar entre os telemóveis da família
- Cotações em tempo real de ETFs e criptomoedas
- Gráficos de evolução mensal
- Leitura automática de extratos bancários
