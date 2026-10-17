const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { schemaStatements } = require('../src/setup-db');

test('preparação hospedada usa o banco configurado e preserva todas as cinco tabelas', () => {
  const statements = schemaStatements(fs.readFileSync(path.join(__dirname, '../db.sql'), 'utf8'));
  assert.equal(statements.length, 5);
  assert.ok(statements.every(statement => /^CREATE TABLE IF NOT EXISTS /i.test(statement)));
  assert.ok(statements.every(statement => !/\b(?:CREATE DATABASE|USE controle_pedidos)\b/i.test(statement)));
  for (const table of ['usuarios', 'clientes', 'produtos', 'pedidos', 'pedidos_itens']) {
    assert.ok(statements.some(statement => new RegExp(`^CREATE TABLE IF NOT EXISTS ${table} \\(`, 'i').test(statement)));
  }
});
