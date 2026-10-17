const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

test('API com MySQL real: autenticação, cadastros, estoque concorrente e cancelamento', { skip: process.env.INTEGRATION_TESTS !== '1', timeout: 60000 }, async t => {
  const mysql = require('mysql2/promise'), bcrypt = require('bcrypt');
  const database = `controle_pedidos_test_${process.pid}_${Date.now()}`;
  const config = { host: process.env.TEST_DB_HOST || '127.0.0.1', port: Number(process.env.TEST_DB_PORT || 3307), user: process.env.TEST_DB_USER || 'root', password: process.env.TEST_DB_PASSWORD || '', multipleStatements: true };
  const db = await mysql.createConnection(config);
  let child;
  t.after(async () => {
    if (child && child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; }
    await db.query(`DROP DATABASE IF EXISTS \`${database}\``); await db.end();
  });
  await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`USE \`${database}\``);
  const setupEnv = { ...process.env, DB_HOST: config.host, DB_PORT: String(config.port), DB_USER: config.user, DB_PASSWORD: config.password, DB_NAME: database, NODE_ENV: 'test', INITIAL_USER_EMAIL: 'operator@teste.local', INITIAL_USER_PASSWORD: 'senha-inicial-teste-123' };
  for (const password of ['senha-inicial-teste-123', 'outra-senha-segura-456']) {
    const setup = spawnSync(process.execPath, ['src/setup-db.js'], { cwd: path.join(__dirname, '..'), env: { ...setupEnv, INITIAL_USER_PASSWORD: password }, encoding: 'utf8', timeout: 15000 });
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  }
  const [[initial]] = await db.execute('SELECT senha_hash,perfil FROM usuarios WHERE email=?', ['operator@teste.local']);
  assert.equal(initial.perfil, 'operador');
  assert.ok(await bcrypt.compare('senha-inicial-teste-123', initial.senha_hash), 'O segundo deploy não deve reescrever a senha existente.');
  await db.execute('INSERT INTO usuarios (nome,email,senha_hash,perfil) VALUES (?,?,?,?)', ['Admin Teste', 'admin@teste.local', await bcrypt.hash('senha-segura-123', 12), 'admin']);
  const port = Number(process.env.TEST_APP_PORT || 3197), base = `http://127.0.0.1:${port}/api`;
  child = spawn(process.execPath, ['src/server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, DB_HOST: config.host, DB_PORT: String(config.port), DB_USER: config.user, DB_PASSWORD: config.password, DB_NAME: database, PORT: String(port), NODE_ENV: 'test', TRUST_PROXY: '0', SESSION_SECRET: randomBytes(40).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { await fetch(`${base}/session`); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, logs || 'Servidor não iniciou.');
  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('set-cookie'), null);
  assert.deepEqual(await health.json(), { status: 'ok' });
  let cookie = '', csrf = '';
  async function request(url, method = 'GET', body, token = csrf) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await request('/clientes')).status, 401);
  const session = await request('/session'); csrf = session.data.csrf;
  assert.equal((await request('/login', 'POST', { email: 'admin@teste.local', senha: 'senha-segura-123' }, '')).status, 403);
  const wrong = await request('/login', 'POST', { email: 'admin@teste.local', senha: 'errada' }); assert.equal(wrong.data.error, 'acesso inválido');
  const missing = await request('/login', 'POST', { email: 'nao@teste.local', senha: 'errada' }); assert.equal(missing.data.error, wrong.data.error);
  const oldCookie = cookie;
  const login = await request('/login', 'POST', { email: 'admin@teste.local', senha: 'senha-segura-123' }); assert.equal(login.status, 200); csrf = login.data.csrf; assert.notEqual(cookie, oldCookie);
  const client = await request('/clientes', 'POST', { nome: 'Cliente teste', tel: '11999999999', endereco: 'Rua dos testes, 42' }); assert.equal(client.status, 201);
  const first = await request('/produtos', 'POST', { nome: 'Café', sku: 'CAFE-01', preco: '19.90', estoque: 3 }); assert.equal(first.status, 201);
  const second = await request('/produtos', 'POST', { nome: 'Bolo', sku: 'BOLO-01', preco: '10.00', estoque: 0 }); assert.equal(second.status, 201);
  assert.equal((await request('/produtos', 'POST', { nome: 'Café', sku: 'CAFE-01', preco: '19.90', estoque: 3 })).status, 409);
  const payload = { cliente_id: client.data.id, itens: [{ produto_id: first.data.id, qtd: 2 }] };
  const failed = await request('/pedidos', 'POST', { cliente_id: client.data.id, itens: [{ produto_id: first.data.id, qtd: 1 }, { produto_id: second.data.id, qtd: 1 }] }); assert.equal(failed.status, 409);
  assert.equal((await request('/produtos')).data.find(row => row.id === first.data.id).estoque, 3);
  const concurrent = await Promise.all([request('/pedidos', 'POST', payload), request('/pedidos', 'POST', payload)]);
  assert.deepEqual(concurrent.map(row => row.status).sort(), [201, 409]);
  const order = concurrent.find(row => row.status === 201).data;
  assert.equal(order.total, '39.80');
  assert.equal((await request('/produtos')).data.find(row => row.id === first.data.id).estoque, 1);
  assert.equal((await request(`/produtos/${first.data.id}`, 'PUT', { nome: 'Café editado', sku: 'CAFE-01', preco: '21.00', estoque: 5, estoque_anterior: 3 })).status, 409);
  assert.equal((await request('/produtos')).data.find(row => row.id === first.data.id).estoque, 1);
  assert.equal((await request(`/produtos/${first.data.id}`, 'PUT', { nome: 'Café editado', sku: 'CAFE-01', preco: '19.90', estoque: 1, estoque_anterior: 1 })).status, 200);
  assert.equal((await request(`/pedidos/${order.id}`)).data.itens[0].nome, 'Café');
  assert.equal((await request(`/pedidos/${order.id}/status`, 'PATCH', { status: 'entregue' })).status, 409);
  assert.equal((await request(`/pedidos/${order.id}/status`, 'PATCH', { status: 'preparo' })).status, 200);
  const cancels = await Promise.all([request(`/pedidos/${order.id}/status`, 'PATCH', { status: 'cancelado' }), request(`/pedidos/${order.id}/status`, 'PATCH', { status: 'cancelado' })]);
  assert.ok(cancels.every(row => row.status === 200));
  assert.equal((await request('/produtos')).data.find(row => row.id === first.data.id).estoque, 3);
  await request(`/clientes/${client.data.id}`, 'PUT', { nome: 'Nome atualizado', tel: '11888888888', endereco: 'Novo endereço' });
  assert.equal((await request(`/pedidos/${order.id}`)).data.cliente_nome, 'Cliente teste');
  const delivered = await request('/pedidos', 'POST', payload); assert.equal(delivered.status, 201);
  for (const status of ['preparo', 'enviado', 'entregue']) assert.equal((await request(`/pedidos/${delivered.data.id}/status`, 'PATCH', { status })).status, 200);
  assert.equal((await request(`/pedidos/${delivered.data.id}/status`, 'PATCH', { status: 'cancelado' })).status, 409);
  assert.equal(Number((await request('/dashboard')).data.faturamento_mes), 39.8);
  assert.equal((await request('/pedidos?status=entregue')).data.total, 1);
  assert.equal((await request('/pedidos?de=2026-02-30')).status, 400);
  assert.equal((await request('/pedidos?status=invalid')).status, 400);
  await request(`/clientes/${client.data.id}/ativo`, 'PATCH', { ativo: false });
  assert.equal((await request('/pedidos', 'POST', payload)).status, 400);
  await request(`/produtos/${first.data.id}/ativo`, 'PATCH', { ativo: false });
  assert.equal((await request('/produtos?ativo=1')).data.length, 1);
  assert.equal((await request('/clientes?q=%27%20OR%201%3D1')).data.length, 0);
  const page = await fetch(`http://127.0.0.1:${port}/`, { headers: { Cookie: cookie } }); assert.equal(page.status, 200); assert.match(await page.text(), /data-page="dashboard"/);
  assert.equal((await request('/logout', 'POST')).status, 200);
  assert.equal((await request('/pedidos')).status, 401);
});
