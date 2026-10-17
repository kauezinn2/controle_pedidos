const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const pool = require('./db');
const { HttpError, integer, str, cents, money, transitions, items } = require('./domain');
const app = express();
const production = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Configure SESSION_SECRET no .env com pelo menos 32 caracteres aleatórios.');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], upgradeInsecureRequests: production ? [] : null } }, strictTransportSecurity: production ? undefined : false }));
app.use(express.json({ limit: '64kb' }));
app.use('/public', express.static(path.join(__dirname, '../public')));
const sessionStore = new MySQLStore({ expiration: 8 * 60 * 60 * 1000, clearExpired: true, endConnectionOnClose: false }, pool);
app.use(session({ name: 'pedidos.sid', secret: process.env.SESSION_SECRET, store: sessionStore, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 8 * 60 * 60 * 1000 } }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const auth = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'Faça login para continuar.' });
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = req.session.csrf;
  const actual = req.get('X-CSRF-Token');
  if (!expected || typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual) || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return res.status(403).json({ error: 'Sessão inválida. Atualize a página.' });
  next();
});
app.get('/api/session', (req, res) => {
  req.session.csrf ||= crypto.randomBytes(32).toString('hex');
  res.json({ user: req.session.user || null, csrf: req.session.csrf });
});
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' } });
const dummyHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 12);
app.post('/api/login', loginLimit, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 190) : '';
  const password = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const [rows] = await pool.execute('SELECT id,nome,email,senha_hash,perfil FROM usuarios WHERE email = ?', [email]);
  const user = rows[0];
  const valid = await bcrypt.compare(Buffer.byteLength(password) <= 72 ? password : '', user?.senha_hash || dummyHash);
  if (!user || !valid || !password || Buffer.byteLength(password) > 72) throw new HttpError(401, 'acesso inválido');
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.user = { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil };
  req.session.csrf = crypto.randomBytes(32).toString('hex');
  res.json({ user: req.session.user, csrf: req.session.csrf });
});
app.post('/api/logout', auth, async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
  res.clearCookie('pedidos.sid', { httpOnly: true, sameSite: 'lax', secure: production });
  res.json({ ok: true });
});
app.use('/api', auth);
const lowLimit = integer(process.env.LOW_STOCK_LIMIT || 5, 'Limite de estoque', 0, 1000000);
app.get('/api/dashboard', async (req, res) => {
  const [metrics] = await pool.query(`SELECT
    COALESCE(SUM(CASE WHEN criado_em >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND status <> 'cancelado' THEN total ELSE 0 END),0) faturamento_mes,
    SUM(DATE(criado_em) = CURRENT_DATE()) pedidos_hoje,
    SUM(status = 'pendente') pendentes FROM pedidos`);
  const [[stock]] = await pool.execute('SELECT COUNT(*) total FROM produtos WHERE ativo=1 AND estoque <= ?', [lowLimit]);
  const [recent] = await pool.query('SELECT id,cliente_nome,total,status,criado_em FROM pedidos ORDER BY id DESC LIMIT 8');
  res.json({ ...metrics[0], pedidos_hoje: Number(metrics[0].pedidos_hoje || 0), pendentes: Number(metrics[0].pendentes || 0), estoque_baixo: stock.total, limite_estoque: lowLimit, ultimos: recent });
});
function clientData(body) {
  return [str(body.nome, 'Nome', 120), str(body.tel, 'Telefone', 25, 8), str(body.endereco, 'Endereço', 500)];
}
function productData(body) {
  return [str(body.nome, 'Nome', 160), str(body.sku, 'SKU', 60).toUpperCase(), money(cents(body.preco)), integer(body.estoque, 'Estoque', 0)];
}
for (const [entity, validate, columns] of [['clientes', clientData, ['nome', 'tel', 'endereco']], ['produtos', productData, ['nome', 'sku', 'preco', 'estoque']]]) {
  app.get(`/api/${entity}`, async (req, res) => {
    const q = String(req.query.q || '').slice(0, 120);
    const active = req.query.ativo === '1' ? ' AND ativo=1' : req.query.ativo === '0' ? ' AND ativo=0' : '';
    const secondary = entity === 'clientes' ? 'tel' : 'sku';
    const [rows] = await pool.execute(`SELECT * FROM ${entity} WHERE (nome LIKE ? OR ${secondary} LIKE ?)${active} ORDER BY ativo DESC,nome LIMIT 500`, [`%${q}%`, `%${q}%`]);
    res.json(rows);
  });
  app.post(`/api/${entity}`, async (req, res) => {
    const values = validate(req.body || {});
    const [result] = await pool.execute(`INSERT INTO ${entity} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
    res.status(201).json({ id: result.insertId });
  });
  app.put(`/api/${entity}/:id`, async (req, res) => {
    const values = validate(req.body || {});
    const id = integer(req.params.id, 'Código');
    await transaction(async connection => {
      const [[row]] = await connection.execute(`SELECT * FROM ${entity} WHERE id=? FOR UPDATE`, [id]);
      if (!row) throw new HttpError(404, 'Registro não encontrado.');
      if (entity === 'produtos' && row.estoque !== integer(req.body.estoque_anterior, 'Estoque anterior', 0)) throw new HttpError(409, 'O estoque mudou desde que este cadastro foi aberto. Feche, atualize a lista e edite novamente.');
      await connection.execute(`UPDATE ${entity} SET ${columns.map(column => `${column}=?`).join(',')} WHERE id=?`, [...values, id]);
    });
    res.json({ ok: true });
  });
  app.patch(`/api/${entity}/:id/ativo`, async (req, res) => {
    if (typeof req.body?.ativo !== 'boolean') throw new HttpError(400, 'Situação inválida.');
    const [result] = await pool.execute(`UPDATE ${entity} SET ativo=? WHERE id=?`, [req.body.ativo, integer(req.params.id, 'Código')]);
    if (!result.affectedRows) throw new HttpError(404, 'Registro não encontrado.');
    res.json({ ok: true });
  });
}
function dateFilter(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Data inválida.');
  return value;
}
app.get('/api/pedidos', async (req, res) => {
  const where = [], values = [];
  if (req.query.status) {
    if (!Object.hasOwn(transitions, req.query.status)) throw new HttpError(400, 'Status inválido.');
    where.push('status=?'); values.push(req.query.status);
  }
  const from = dateFilter(req.query.de), to = dateFilter(req.query.ate);
  if (from && to && from > to) throw new HttpError(400, 'O início deve ser anterior ao fim.');
  if (from) { where.push('criado_em >= ?'); values.push(from); }
  if (to) { where.push('criado_em < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(to); }
  const page = integer(req.query.page || 1, 'Página', 1, 1000000);
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[count]] = await pool.execute(`SELECT COUNT(*) total FROM pedidos ${sqlWhere}`, values);
  const [rows] = await pool.query(`SELECT id,cliente_nome,total,status,criado_em FROM pedidos ${sqlWhere} ORDER BY id DESC LIMIT 30 OFFSET ?`, [...values, (page - 1) * 30]);
  res.json({ rows, total: count.total, page, pages: Math.max(1, Math.ceil(count.total / 30)) });
});
app.get('/api/pedidos/:id', async (req, res) => {
  const id = integer(req.params.id, 'Pedido');
  const [[order]] = await pool.execute('SELECT * FROM pedidos WHERE id=?', [id]);
  if (!order) throw new HttpError(404, 'Pedido não encontrado.');
  const [rows] = await pool.execute('SELECT produto_id,nome,sku,qtd,preco FROM pedidos_itens WHERE pedido_id=? ORDER BY id', [id]);
  res.json({ ...order, itens: rows });
});
async function transaction(work) {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
app.post('/api/pedidos', async (req, res) => {
  const clientId = integer(req.body?.cliente_id, 'Cliente');
  const normalized = items(req.body?.itens);
  const result = await transaction(async connection => {
    const [[client]] = await connection.execute('SELECT * FROM clientes WHERE id=? FOR UPDATE', [clientId]);
    if (!client?.ativo) throw new HttpError(400, 'Selecione um cliente ativo.');
    let total = 0;
    const cart = [];
    for (const [id, qty] of normalized) {
      const [[product]] = await connection.execute('SELECT * FROM produtos WHERE id=? FOR UPDATE', [id]);
      if (!product?.ativo) throw new HttpError(400, 'Um produto está indisponível. Atualize o carrinho.');
      if (product.estoque < qty) throw new HttpError(409, `Estoque insuficiente: ${product.nome}. Disponível: ${product.estoque}.`);
      total += cents(product.preco) * qty;
      if (!Number.isSafeInteger(total) || total > 999999999999) throw new HttpError(400, 'Total do pedido acima do limite.');
      cart.push({ ...product, qty });
    }
    const [order] = await connection.execute('INSERT INTO pedidos (cliente_id,total,cliente_nome,cliente_tel,cliente_endereco) VALUES (?,?,?,?,?)', [clientId, money(total), client.nome, client.tel, client.endereco]);
    for (const product of cart) {
      await connection.execute('INSERT INTO pedidos_itens (pedido_id,produto_id,nome,sku,qtd,preco) VALUES (?,?,?,?,?,?)', [order.insertId, product.id, product.nome, product.sku, product.qty, product.preco]);
      await connection.execute('UPDATE produtos SET estoque=estoque-? WHERE id=?', [product.qty, product.id]);
    }
    return { id: order.insertId, total: money(total) };
  });
  res.status(201).json(result);
});
app.patch('/api/pedidos/:id/status', async (req, res) => {
  const id = integer(req.params.id, 'Pedido'), status = req.body?.status;
  if (!Object.hasOwn(transitions, status || '')) throw new HttpError(400, 'Status inválido.');
  await transaction(async connection => {
    const [[order]] = await connection.execute('SELECT status FROM pedidos WHERE id=? FOR UPDATE', [id]);
    if (!order) throw new HttpError(404, 'Pedido não encontrado.');
    if (order.status === status) return;
    if (!transitions[order.status].includes(status)) throw new HttpError(409, 'Esta mudança de status não é permitida. Atualize o pedido.');
    if (status === 'cancelado') {
      const [rows] = await connection.execute('SELECT produto_id,qtd FROM pedidos_itens WHERE pedido_id=? ORDER BY produto_id', [id]);
      for (const item of rows) await connection.execute('UPDATE produtos SET estoque=estoque+? WHERE id=?', [item.qtd, item.produto_id]);
    }
    await connection.execute('UPDATE pedidos SET status=? WHERE id=?', [status, id]);
  });
  res.json({ ok: true });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.get('/login', (req, res) => req.session.user ? res.redirect('/') : res.sendFile(path.join(__dirname, '../views/login.html')));
for (const [url, file] of [['/', 'dashboard'], ['/pedidos', 'pedidos'], ['/novo-pedido', 'novo-pedido'], ['/clientes', 'clientes'], ['/produtos', 'produtos']]) {
  app.get(url, (req, res) => req.session.user ? res.sendFile(path.join(__dirname, `../views/${file}.html`)) : res.redirect('/login'));
}
app.use((req, res) => res.status(404).send('Página não encontrada.'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Este SKU ou e-mail já está cadastrado.' });
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) return res.status(409).json({ error: 'Outro usuário está alterando estes dados. Tente novamente.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande.' });
  if (!error.status) console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível concluir a operação.' });
});
async function start() {
  await pool.query('SELECT 1');
  await sessionStore.onReady();
  const server = app.listen(Number(process.env.PORT || 3000), () => console.log(`Controle de pedidos: http://localhost:${process.env.PORT || 3000}`));
  const stop = () => server.close(async () => { await sessionStore.close(); await pool.end(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
if (require.main === module) start().catch(error => { console.error('Falha ao iniciar:', error.message); process.exit(1); });
module.exports = app;
