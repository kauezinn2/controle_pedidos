# Publicar no Railway

O projeto inclui Dockerfile, detectado automaticamente pelo Railway. A aplicação atende em 0.0.0.0 na porta configurada. O Docker executa `npm run start:production`, que verifica as tabelas no banco configurado antes de iniciar o servidor. Nas configurações do serviço, defina Healthcheck Path como `/healthz`; essa rota só retorna 200 quando o MySQL está acessível.

Em outubro de 2026, o painel do Railway informa que novos serviços não podem ativar o antigo Config as Code (railway.json). Por isso, este projeto usa Dockerfile e configurações do painel, sem depender desse recurso descontinuado.

## Repositório

Repositório deste projeto: https://github.com/kauezinn2/controle_pedidos

Não envie `.env`. O `.gitignore` protege esse arquivo e outras variantes; a imagem Docker também os exclui. A imagem contém somente código, dependências e estrutura SQL, sem os dados do banco local.

## Serviços

No painel Railway, adicione o repositório como serviço da aplicação e adicione um serviço MySQL ao mesmo projeto. Se houver cobrança, escolha e aprove o plano antes de provisionar recursos. Este deploy usa PORT=3000 e domínio público apontando para a mesma porta.

No serviço da aplicação, use estas variáveis. As referências abaixo pressupõem que o serviço do banco se chama `MySQL`; ajuste o prefixo se houver outro nome.

```dotenv
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
TZ=America/Sao_Paulo
LOW_STOCK_LIMIT=5
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
```

Não use os textos `MYSQLHOST` ou `MYSQLPASSWORD` como valores literais. Use a referência do outro serviço ou seu valor resolvido no painel. A aplicação também aceita as variáveis MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD e MYSQLDATABASE diretamente, se forem fornecidas ao serviço da aplicação.

Gere SESSION_SECRET no painel ou localmente com:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Cole o resultado apenas na variável SESSION_SECRET do serviço. Não coloque o segredo no repositório. O banco também precisa usar o mesmo fuso do processo Node para os indicadores de hoje e do mês; defina `TZ=America/Sao_Paulo` no serviço MySQL antes da criação dos dados e confirme `SELECT NOW(), @@session.time_zone` na conexão. O fuso do driver usa o ambiente local do processo.

## Tabelas e primeiro acesso

`npm run db:setup` cria as cinco tabelas com `CREATE TABLE IF NOT EXISTS`. Ele usa o banco apontado em DB_NAME/MYSQLDATABASE, sem executar CREATE DATABASE ou USE do db.sql. Não remove registros. O bloqueio GET_LOCK evita duas preparações concorrentes.

Para criar o usuário de teste no primeiro deploy, adicione no painel:

- INITIAL_USER_EMAIL: o e-mail escolhido para o login.
- INITIAL_USER_PASSWORD: senha com pelo menos 12 caracteres e no máximo 72 bytes.

O cadastro inicial tem perfil operador, suficiente para testar cadastros e pedidos. Se o e-mail já existir, a preparação preserva senha e perfil. Remova as duas variáveis após o primeiro deploy para que a senha não precise permanecer na configuração.

Para um administrador, execute `npm run admin` em um terminal conectado ao banco desejado. O usuário de teste local não é transferido automaticamente: o banco remoto é separado.

## URL pública e validação

Depois de um deploy saudável, gere o domínio na seção de rede pública da aplicação. Verifique `/healthz`, entre em `/login`, cadastre um cliente/produto fictício e crie um pedido. Confira a baixa do estoque e o cancelamento. Somente depois use o endereço final no portfólio.

Use dados fictícios na demonstração. Os dados locais não são copiados por esse processo. Configuração oficial: https://docs.railway.com/deploy/healthchecks e https://docs.railway.com/databases/mysql
