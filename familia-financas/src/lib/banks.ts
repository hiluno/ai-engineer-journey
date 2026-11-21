/**
 * Bancos com simulador de crédito no próprio site. Os bancos não disponibilizam
 * uma API pública de simulação, por isso a app abre o site oficial do banco
 * (onde o utilizador procura "Simulador") e, em paralelo, faz a simulação local
 * com as taxas que o utilizador indicar.
 *
 * Usamos a página inicial de cada banco porque os endereços diretos dos
 * simuladores mudam com frequência.
 */
export interface Bank {
  id: string;
  name: string;
  url: string;
}

export const BANKS: Bank[] = [
  { id: 'cgd', name: 'Caixa Geral de Depósitos', url: 'https://www.cgd.pt' },
  { id: 'bcp', name: 'Millennium bcp', url: 'https://ind.millenniumbcp.pt' },
  { id: 'novobanco', name: 'Novo Banco', url: 'https://www.novobanco.pt' },
  { id: 'santander', name: 'Santander', url: 'https://www.santander.pt' },
  { id: 'bpi', name: 'BPI', url: 'https://www.bancobpi.pt' },
  { id: 'ca', name: 'Crédito Agrícola', url: 'https://www.creditoagricola.pt' },
  { id: 'montepio', name: 'Banco Montepio', url: 'https://www.bancomontepio.pt' },
  { id: 'bankinter', name: 'Bankinter', url: 'https://www.bankinter.pt' },
  { id: 'activobank', name: 'ActivoBank', url: 'https://www.activobank.pt' },
];

/** Portal do Cliente Bancário (Banco de Portugal) — simuladores neutros e comparação de comissões. */
export const BANCO_PORTUGAL_PORTAL = 'https://clientebancario.bportugal.pt';

export const OTHER_BANK_ID = 'outro';
