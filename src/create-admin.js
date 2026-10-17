const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { str } = require('./domain');
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
const rl = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
(async () => {
  try {
    const nome = str(await rl.question('Nome: '), 'Nome', 120);
    const email = str(await rl.question('E-mail: '), 'E-mail', 190).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
    process.stdout.write('Senha (mínimo 12 caracteres; entrada oculta): ');
    muted = true;
    const senha = await rl.question('');
    muted = false;
    process.stdout.write('\n');
    if (senha.length < 12 || Buffer.byteLength(senha) > 72) throw new Error('Use pelo menos 12 caracteres e no máximo 72 bytes na senha.');
    const hash = await bcrypt.hash(senha, 12);
    await pool.execute('INSERT INTO usuarios (nome,email,senha_hash,perfil) VALUES (?,?,?,?)', [nome, email, hash, 'admin']);
    console.log('Administrador criado. Faça login no sistema.');
  } catch (error) {
    console.error(error.code === 'ER_DUP_ENTRY' ? 'Este e-mail já está cadastrado.' : error.message);
    process.exitCode = 1;
  } finally { muted = false; rl.close(); await pool.end(); }
})();
