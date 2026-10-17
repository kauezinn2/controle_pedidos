const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cents, money, integer, items, transitions } = require('../src/domain');

test('valores monetários são convertidos sem arredondamento de ponto flutuante', () => {
  assert.equal(cents('19.90'), 1990);
  assert.equal(cents('0.01'), 1);
  assert.equal(money(cents('19.90') * 3), '59.70');
  for (const value of ['0', '-1', '1.999', 'NaN', '1e3', '10000000000']) assert.throws(() => cents(value));
});
test('quantidades inválidas são recusadas e itens repetidos são somados e ordenados', () => {
  assert.deepEqual(items([{ produto_id: 9, qtd: 2 }, { produto_id: 2, qtd: 1 }, { produto_id: 9, qtd: 3 }]), [[2, 1], [9, 5]]);
  for (const value of [0, -1, 1.5, '1 OR 1=1', undefined]) assert.throws(() => integer(value, 'Quantidade'));
  assert.throws(() => items([]));
  assert.throws(() => items([null]));
  assert.throws(() => items([{ produto_id: 1, qtd: 1000000 }, { produto_id: 1, qtd: 1 }]));
});
test('fluxo de status é progressivo e estados finais são imutáveis', () => {
  assert.deepEqual(transitions.pendente, ['preparo', 'cancelado']);
  assert.deepEqual(transitions.preparo, ['enviado', 'cancelado']);
  assert.deepEqual(transitions.enviado, ['entregue', 'cancelado']);
  assert.deepEqual(transitions.entregue, []);
  assert.deepEqual(transitions.cancelado, []);
});
