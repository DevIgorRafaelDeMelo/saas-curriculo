# Publicar a Forma no Railway

Esta versão reúne site React e API Express em um único serviço Node. O PostgreSQL fica em outro serviço do mesmo projeto. O Dockerfile instala Chromium e suas bibliotecas Linux; não é necessário instalar Docker no seu computador para fazer o deploy pelo GitHub.

## 1. Enviar o projeto

Extraia `forma-railway.zip`. Envie **o conteúdo da pasta curriculo** para a raiz de um repositório GitHub: `Dockerfile`, `package.json`, `package-lock.json`, `.npmrc`, `apps`, `packages`, `scripts` e `.github` devem ficar nessa raiz. Inclua também os arquivos ocultos; não envie `.env` nem `node_modules`.

Se preferir manter o projeto em uma subpasta de um repositório existente, configure **Root Directory** no Railway apontando para a pasta que contém o Dockerfile.

## 2. Criar os serviços no Railway

1. Crie um projeto e adicione **PostgreSQL**. Neste guia, o nome do serviço é `Postgres`.
2. Adicione o serviço da aplicação usando **GitHub Repo** e selecione o repositório.
3. O Railway detecta o `Dockerfile` automaticamente. O comando de início já está no Dockerfile; não defina `npm run dev` ou `vite` como Start Command.
4. Em **Settings → Networking**, gere um domínio público para a aplicação. Se pedir a porta de destino, use `3001` e defina `PORT=3001` nas variáveis; caso a plataforma já atribua uma porta, mantenha o valor atribuído.
5. Em **Deploy → Healthcheck Path**, informe `/api/health`, com timeout de `300` segundos. Comece com uma réplica da aplicação.

Não é necessário um serviço separado para o frontend, Nginx, volume na aplicação ou bucket para os PDFs. Os arquivos são gerados em memória; os dados e autorizações ficam no PostgreSQL.

## 3. Configurar as variáveis da aplicação

Na aba **Variables** do serviço da aplicação, abra **RAW Editor** e use:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
PDF_CONCURRENCY=1
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
ADMIN_EMAILS=
```

Se o serviço de banco tiver outro nome, substitua `Postgres` na referência. Use a conexão interna fornecida pelo Railway, sem copiar a senha manualmente. Não use a URL `localhost` de desenvolvimento no Railway.

Depois de gerar o domínio público, o aplicativo usa `RAILWAY_PUBLIC_DOMAIN` automaticamente para obter a origem HTTPS. Se usar domínio próprio, adicione:

```env
APP_URL=https://SEU-DOMINIO-REAL
```

O valor deve ser a origem HTTPS real, sem `/editor` ou outro caminho. `PUBLIC_API_URL` usa a mesma origem e `GOOGLE_REDIRECT_URI` é derivada como `/api/auth/google/callback`; não é preciso preencher essas duas variáveis no deploy de um único serviço.

Os campos vazios são intencionais. O servidor consegue iniciar com o banco e o domínio, mas não permite login ou compras enquanto seus respectivos pares de credenciais não forem configurados. Não preencha tokens inventados. Configure os dois valores de cada integração juntos e aplique as mudanças com um novo deploy.

## 4. Fazer o primeiro deploy

Aplique as alterações e acompanhe os logs. A inicialização executa, nesta ordem:

1. Verifica se o frontend está compilado.
2. Gera um PDF de teste em memória para verificar Chromium e fontes.
3. Executa `prisma migrate deploy` para criar/atualizar as tabelas.
4. Executa o seed, adicionando os modelos ausentes e preservando configurações existentes.
5. Inicia o Express em `0.0.0.0` e na variável `PORT` do Railway.

Se alguma dessas etapas falhar, o processo encerra com erro; não informa que está pronto. Você não precisa cadastrar Pre-Deploy Command: as migrações já são executadas pelo comando de início. Não adicione um segundo comando de migração apenas para repetir a mesma etapa.

Depois de o deploy ficar ativo, visite:

- `https://SEU-DOMINIO/` — site real.
- `https://SEU-DOMINIO/editor` — editor, inclusive acessando diretamente a URL.
- `https://SEU-DOMINIO/api/health` — deve retornar `{"ok":true}`.
- `https://SEU-DOMINIO/api/templates` — deve listar os oito modelos iniciais.
- `https://SEU-DOMINIO/api/config` — informa se Google e pagamentos estão configurados, sem expor segredos.

Também pode verificar pelo terminal na pasta do projeto:

```sh
npm run smoke -- https://SEU-DOMINIO-REAL
```

O comando verifica banco, modelos, página inicial, arquivos JavaScript, rota do editor e bloqueio de acesso sem login. Não realiza pagamentos ou altera currículos.

## 5. Habilitar o Google

No Google Cloud, crie um cliente OAuth de aplicação Web. Configure:

- Origem autorizada: a URL HTTPS real do site.
- URI de redirecionamento: a URL HTTPS real seguida de `/api/auth/google/callback`.

No Railway, preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, ambos no serviço da aplicação, e faça o redeploy. Se a aplicação Google estiver em testes, inclua os e-mails autorizados na tela de consentimento.

Abra o site, entre com Google, crie um currículo, salve e confirme que aparece no painel após recarregar. Adicione seu e-mail Google verificado em `ADMIN_EMAILS` para acessar a administração pelo perfil. Vários administradores podem ser separados por vírgula.

## 6. Habilitar o Mercado Pago

Cadastre a aplicação no Mercado Pago e configure o evento de **pagamentos** com a URL:

```text
https://SEU-DOMINIO-REAL/api/webhooks/mercadopago
```

Preencha `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` no Railway e faça o redeploy. As URLs de retorno ao comprador são geradas automaticamente por pedido em `/checkout/:id`.

Homologue com credenciais e contas de teste do próprio Mercado Pago antes de ativar vendas. Confirme compra aprovada, pendente, recusada, reembolso e bloqueio de download de outro usuário. A autorização sempre depende de confirmação no servidor; a volta do checkout, sozinha, não libera o PDF.

Para conferir se todos os campos das integrações estão completos, no shell do serviço:

```sh
npm run check:launch
```

Esse comando valida a configuração, mas não substitui o teste real de login e pagamento.

## Comandos do projeto

| Comando                | Uso                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm start`            | Verifica dependências de execução, prepara o banco e inicia o site/API |
| `npm run build`        | Verifica TypeScript e compila o frontend                               |
| `npm run db:generate`  | Gera o Prisma Client; não precisa conectar ao banco                    |
| `npm run db:migrate`   | Aplica migrações pendentes sem apagar dados                            |
| `npm run db:seed`      | Adiciona os modelos que faltarem                                       |
| `npm run db:deploy`    | Migrações e seed                                                       |
| `npm run check:config` | Confere variáveis sem mostrar segredos                                 |
| `npm run check:launch` | Exige os pares completos de Google e Mercado Pago                      |
| `npm run smoke -- URL` | Confere um servidor já publicado                                       |
| `npm test`             | Testes locais; integração completa exige banco \*\_test                |

## Quando ocorrer um erro

- **DATABASE_URL não definida / P1001:** confira a referência ao serviço Postgres e se os serviços estão no mesmo projeto e ambiente. A conexão interna não deve ser usada diretamente fora do Railway.
- **Gere o domínio público:** gere o domínio em Networking ou defina `APP_URL` com sua URL HTTPS real.
- **Configure os dois valores juntos:** uma integração foi preenchida pela metade. Complete o par ou deixe os dois vazios durante a instalação.
- **Frontend não compilado:** confirme que o deploy usa o Dockerfile da raiz do pacote, e não somente `apps/api`. A imagem faz o build automaticamente.
- **Chromium ausente:** confirme que o Dockerfile foi usado e que o diretório `PLAYWRIGHT_BROWSERS_PATH` não foi sobrescrito nas variáveis do Railway.
- **Google redirect_uri_mismatch:** use exatamente o callback exibido nas instruções, com o domínio atual. Atualize-o se trocar o domínio do site.
- **Pagamento continua pendente:** consulte os logs de entrega do webhook no Mercado Pago e confira o token, segredo e URL do evento. Não altere o status manualmente no navegador ou no banco.

## Testes Linux automatizados

O arquivo `.github/workflows/railway-ci.yml` contém um fluxo de GitHub Actions que provisiona PostgreSQL de teste, aplica migrações, compila, roda a integração com um provedor de pagamento local de teste, gera PDFs e constrói a imagem Docker. Depois inicia a imagem de produção e executa a verificação pública. Ele utiliza somente dados e credenciais de teste definidos no próprio fluxo, sem credenciais Google ou Mercado Pago reais.

A conta Railway não foi acessada durante esta preparação. O build Docker e o deploy real devem ser confirmados no Railway ou nesse fluxo Linux; Docker não está disponível neste computador. Os testes locais e as verificações de código executados nesta entrega são registrados no README.

## Antes de abrir vendas

Preencha identificação e contato do responsável na política de privacidade, ajuste os preços no painel e configure backups do PostgreSQL. A compra inicial libera uma versão e modelo de currículo; alterações posteriores exigem nova compra.

Referências oficiais consultadas:

- [Dockerfile no Railway](https://docs.railway.com/builds/dockerfiles)
- [PostgreSQL e variáveis de conexão](https://docs.railway.com/databases/postgresql)
- [Variáveis e referências entre serviços](https://docs.railway.com/variables)
- [Healthchecks e PORT](https://docs.railway.com/deployments/healthchecks)
- [Chromium e dependências em Docker](https://playwright.dev/docs/docker)

SEO para o Google

A versão atual entrega início e modelos pré-renderizados com o mesmo conteúdo React visível ao usuário, metadados por página, canonical sem parâmetros, Open Graph, dados estruturados WebSite, /robots.txt e /sitemap.xml. Páginas da conta/editor/checkout recebem noindex; URLs desconhecidas retornam HTTP 404. O sitemap inclui somente / e /modelos. A pré-renderização não contém dados de usuários nem preços fixos; preços ativos são obtidos pela API no navegador.

Após publicar: defina APP_URL com o domínio público definitivo (por exemplo https://seudominio.com.br), faça novo deploy, confirme /sitemap.xml e /robots.txt, verifique a propriedade desse domínio no Google Search Console pelo registro DNS indicado pelo Google e envie sitemap.xml. Ao mudar o domínio, atualize também as URLs de retorno Google/Mercado Pago. O domínio configurado é usado para canonical e sitemap; não é derivado do cabeçalho Host recebido.

As páginas públicas são pré-renderizadas durante npm run build. Não use somente o build do Vite para empacotar produção. O conteúdo inicial é substituído pela interface React interativa quando o JavaScript carrega. Robots/noindex não substituem autenticação: as APIs continuam protegendo os dados. Não há garantia de indexação ou posição nos resultados. A publicação e a verificação do Search Console dependem do seu domínio e da sua conta.
