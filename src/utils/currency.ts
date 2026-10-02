const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function currency(cents: number): string {
  return formatter.format(cents / 100);
}
// Inteiros evitam diferenças de arredondamento entre cadastro e total semanal.
export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '');
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= 100000000 ? cents : null;
}
export function moneyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
