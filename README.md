# Controle de pedidos

Aplicação em Node.js, Express, MySQL 8, HTML, CSS e JavaScript puro. Interface em português, responsiva, com login, dashboard, clientes, produtos, carrinho, filtros de pedidos e impressão.

Demonstração publicada: [controlepedidos-production.up.railway.app](https://controlepedidos-production.up.railway.app). O ambiente público usa um banco MySQL separado do desenvolvimento local. A disponibilidade depende do plano e dos créditos da conta Railway.

## Instalação

Requisitos: Node.js 20 ou superior e MySQL 8. O MySQL deve usar o mesmo fuso horário local do processo Node para que os indicadores de hoje e do mês sejam consistentes. No Brasil, configure ambos para America/Sao_Paulo ou UTC−03:00.

1. Instale as dependências: `npm install`.
2. Importe `db.sql` no MySQL Workbench ou execute `mysql -u root -p < db.sql` em um terminal com redirecionamento de entrada (cmd/bash).
3. Copie `.env.example` para `.env` (`Copy-Item .env.example .env` no PowerShell).
4. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` no `.env`.
5. Gere um segredo com `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` e coloque o resultado em `SESSION_SECRET` no `.env`.
6. Execute `npm run admin` e informe nome, e-mail e senha. A senha fica oculta, precisa ter no mínimo 12 caracteres e no máximo 72 bytes. O comando cria um administrador sem alterar usuários existentes.
7. Execute `npm start` e abra [http://localhost:3000](http://localhost:3000). Para reiniciar automaticamente em desenvolvimento: `npm run dev`.

Não há senha padrão nem registros de demonstração. Cadastre um cliente e um produto para criar o primeiro pedido. As credenciais do banco são locais e não devem ser enviadas ao navegador. O usuário do banco precisa de acesso às tabelas da aplicação e permissão CREATE para a tabela automática de sessões. Em produção, crie essa tabela no provisionamento e restrinja permissões conforme a operação.

## Operação

- **Login:** bcrypt com custo 12, sessão persistida no MySQL por até 8 horas, cookie HttpOnly/SameSite, proteção CSRF, regeneração da sessão e limite de 15 tentativas por IP a cada 15 minutos. Erros de credencial retornam sempre `acesso inválido`.
- **Dashboard:** faturamento de pedidos criados no mês, excluindo cancelados; pedidos criados hoje, incluindo cancelados; pedidos pendentes de qualquer data; produtos ativos com estoque menor ou igual a `LOW_STOCK_LIMIT` (padrão 5). Não representa recebimentos financeiros efetivos. Valores consultados ao abrir ou atualizar a tela.
- **Cadastros:** edição, busca e desativação reversível. Não há exclusão física. Até 500 resultados por busca, incluindo inativos; use o campo de pesquisa para refinar.
- **Pedido:** o navegador calcula a prévia. O servidor consulta preços e estoque atuais, agrupa produtos repetidos, bloqueia linhas em ordem de ID e grava pedido, itens e baixa de estoque em uma única transação InnoDB. Falhas desfazem todas as alterações. Até 100 linhas e 1 milhão de unidades por produto, respeitando estoque e limites monetários.
- **Histórico:** nome, SKU e preço do produto, além dos dados de entrega do cliente, ficam registrados no pedido. Edições futuras dos cadastros não reescrevem pedidos anteriores.
- **Status:** Pendente → Em preparo → Enviado → Entregue. O cancelamento é permitido antes de entregue e devolve o estoque uma única vez, inclusive com solicitações simultâneas. Entregue e cancelado são estados finais. O botão Cancelar pede confirmação na própria tela.
- **Estoque:** editar o campo estoque define o saldo absoluto atual. A edição bloqueia o produto em transação e compara o saldo anterior: se uma venda ou cancelamento tiver alterado o estoque enquanto o formulário estava aberto, a gravação é recusada e pede atualização. Pedidos e cancelamentos também aplicam suas movimentações sob transação.
- **Impressão:** abra o pedido e clique em Imprimir. A folha contém apenas os detalhes, cliente, itens e total. O navegador permite imprimir ou salvar como PDF.
- **Perfis:** `admin` e `operador` têm acesso às mesmas funções de pedidos e cadastros nesta versão. A criação de usuários acontece pelo comando local `npm run admin`.

## Publicação

O projeto está preparado para Railway com Dockerfile, criação automática de tabelas e verificação de saúde. Veja [docs/DEPLOY.md](docs/DEPLOY.md) para as referências corretas das variáveis MySQL e o primeiro acesso.

Use HTTPS e `NODE_ENV=production` para habilitar cookies seguros. Se houver exatamente um proxy reverso confiável à frente do Express, configure `TRUST_PROXY=1`; caso contrário mantenha `0`. Não exponha o MySQL à internet. O processo falha ao iniciar se faltar segredo de sessão ou conexão ao banco.

## Verificação

```powershell
npm run check
npm test
```

Os testes de domínio cobrem validação monetária, quantidades, agrupamento e fluxo de status. O teste de integração é opcional e usa um MySQL real, criando um banco isolado com prefixo `controle_pedidos_test_` e removendo esse banco ao terminar. O usuário de teste precisa ter permissão para criar e remover bancos. Não use credenciais de produção.

```powershell
$env:INTEGRATION_TESTS='1'
$env:TEST_DB_HOST='127.0.0.1'
$env:TEST_DB_PORT='3307'
$env:TEST_DB_USER='root'
$env:TEST_DB_PASSWORD=''
node --test test/integration.test.js
```

O teste verifica login e CSRF, criação e edição, rollback, disputa por estoque, cancelamento concorrente sem devolução duplicada, estados finais, histórico, filtros, dashboard e logout. O servidor de teste usa a porta 3197; `TEST_APP_PORT` pode alterá-la.

## Estrutura

```text
package.json / package-lock.json
db.sql / .env.example
src/server.js          servidor, autenticação e rotas
src/db.js              pool mysql2
src/domain.js          validações e regras compartilhadas
src/create-admin.js    criação segura de usuário
views/*.html           seis páginas
public/css/style.css   layout responsivo e impressão
public/js/main.js      interface e chamadas fetch
test/*.test.js         testes de domínio e integração real
```
