class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function integer(value, label, min = 1, max = 2147483647) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new HttpError(400, `${label} inválido.`);
  }
  return Number(value);
}
function str(value, label, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${label} inválido.`);
  return value.trim();
}
function cents(value) {
  const text = String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new HttpError(400, 'Preço inválido. Use até duas casas decimais.');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (result < 1 || result > 999999999999) throw new HttpError(400, 'Preço fora do limite.');
  return result;
}
const money = value => (value / 100).toFixed(2);
const transitions = { pendente: ['preparo', 'cancelado'], preparo: ['enviado', 'cancelado'], enviado: ['entregue', 'cancelado'], entregue: [], cancelado: [] };
function items(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new HttpError(400, 'Adicione de 1 a 100 itens.');
  const unique = new Map();
  for (const row of input) {
    if (!row || typeof row !== 'object') throw new HttpError(400, 'Item inválido.');
    const id = integer(row.produto_id, 'Produto');
    const qty = integer(row.qtd, 'Quantidade', 1, 1000000) + (unique.get(id) || 0);
    if (qty > 1000000) throw new HttpError(400, 'Quantidade fora do limite.');
    unique.set(id, qty);
  }
  return [...unique].sort((a, b) => a[0] - b[0]);
}
module.exports = { HttpError, integer, str, cents, money, transitions, items };
