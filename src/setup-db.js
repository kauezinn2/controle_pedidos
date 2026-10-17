const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');

function schemaStatements(sql) {
  // db.sql contém somente DDL simples; não possui procedures nem literais com ponto e vírgula.
  return sql.replace(/^\s*--.*$/gm, '').split(';').map(value => value.trim()).filter(Boolean)
    .filter(value => !/^(?:CREATE\s+DATABASE\b|USE\s+)/i.test(value));
}

async function setup() {
  const pool = require('./db');
  let connection;
  try {
    const email = process.env.INITIAL_USER_EMAIL?.trim().toLowerCase();
    const password = process.env.INITIAL_USER_PASSWORD;
    if (Boolean(email) !== Boolean(password)) throw new Error('Informe INITIAL_USER_EMAIL e INITIAL_USER_PASSWORD juntos.');
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190)) throw new Error('INITIAL_USER_EMAIL inválido.');
    if (password && (password.length < 12 || Buffer.byteLength(password) > 72)) throw new Error('INITIAL_USER_PASSWORD deve ter pelo menos 12 caracteres e no máximo 72 bytes.');
    const statements = schemaStatements(await fs.readFile(path.join(__dirname, '../db.sql'), 'utf8'));
    connection = await pool.getConnection();
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', ['controle_pedidos_schema_setup']);
    if (Number(lock.acquired) !== 1) throw new Error('Outro processo está preparando o banco. Tente novamente.');
    for (const statement of statements) await connection.query(statement);
    console.log('Tabelas verificadas no banco configurado.');
    if (email) {
      const [[existing]] = await connection.execute('SELECT id FROM usuarios WHERE email=?', [email]);
      if (!existing) {
        const hash = await bcrypt.hash(password, 12);
        await connection.execute('INSERT INTO usuarios (nome,email,senha_hash,perfil) VALUES (?,?,?,?)', ['Kaue', email, hash, 'operador']);
        console.log('Usuário inicial criado como operador.');
      } else console.log('Usuário inicial já existe; cadastro preservado.');
    }
  } finally {
    if (connection) {
      try { await connection.execute('SELECT RELEASE_LOCK(?)', ['controle_pedidos_schema_setup']); }
      finally { connection.release(); }
    }
    await pool.end();
  }
}

if (require.main === module) setup().catch(error => { console.error('Falha ao preparar banco:', error.message); process.exitCode = 1; });
module.exports = { schemaStatements };
