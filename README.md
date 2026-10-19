# Forma — plataforma de currículos

**Railway:** esta versão contém Dockerfile e inicialização automática de PostgreSQL/Prisma e Chromium. Siga [RAILWAY.md](RAILWAY.md) para publicar site e API no mesmo serviço. As variáveis do servidor substituem a necessidade de um arquivo `.env` em produção.

Monorepo React/Vite/Tailwind + Express/TypeScript + PostgreSQL/Prisma. Inclui oito modelos HTML/CSS, editor com prévia server-side, OAuth Google, Checkout Pro, webhooks assinados e geração PDF por Chromium. Não existe login de demonstração nem aprovação artificial de pagamento em produção.

## Executar

Requisitos: Node.js 22.12+, npm, Docker Compose (ou PostgreSQL 16 acessível). Na raiz deste projeto:

```sh
npm install --workspaces=false
cp .env.example .env
# No PowerShell: Copy-Item .env.example .env

docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npx playwright install chromium
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3001. O Vite encaminha `/api` à API. As dependências são instaladas na raiz para funcionar também em Windows sem permissão de links simbólicos. Os diretórios continuam separados em workspaces; os comandos usam `--prefix`.

Sem Google ou Mercado Pago configurados, a home, galeria e rascunho local funcionam. A API de prévia funciona sem autenticação. Salvar na nuvem exige login e banco. Comprar exige configuração real do provedor. Nunca informe credenciais reais no frontend.

## Arquitetura e diretórios

```text
apps/web/src/main.tsx          Rotas e estrutura principal
apps/web/src/pages/            Home, galeria, editor e conta
apps/web/src/components.tsx    Prévia de currículo e componentes comuns
apps/web/src/lib.ts            Cliente REST e contexto de autenticação
apps/web/src/styles.css        Interface responsiva e prévias locais
apps/api/src/server.ts         API, sessão, OAuth, checkout e administração
apps/api/src/config.ts         Validação de variáveis e domínio Railway
apps/api/src/web.ts            Frontend estático e rotas React em produção
scripts/start.mjs              Verificação do runtime, migrações, seed e inicialização
Dockerfile                    Imagem Linux com Chromium para Railway
apps/api/src/security.ts       Assinaturas, acesso e validação de transações
apps/api/src/pdf.ts            Templates HTML/CSS e geração A4
apps/api/prisma/schema.prisma  Modelo relacional
apps/api/prisma/migrations/    Migração inicial PostgreSQL
apps/api/prisma/seed.ts        Oito modelos, preço inicial de R$ 19,90
apps/api/test/                 Testes unitários e de integração
packages/shared/src/index.ts  Schemas Zod e tipos compartilhados
```

User possui Session, Resume e Order. Resume contém ResumeSection e referencia ResumeTemplate. Order contém um snapshot JSON imutável dos dados, revisão, preço em centavos e modelo; possui Payment e DownloadEntitlement. Payment usa identificador único do provedor e sua data de atualização, impedindo duplicação e retrocesso por notificações antigas. AuditLog registra eventos e identificadores, sem conteúdo de currículos. Índices cobrem usuário/data, sessões e pedidos. Relações de dados do usuário usam exclusão em cascata; o histórico financeiro no provedor é independente.

A compra é unitária: um arquivo de uma revisão e modelo. O PDF de um pedido usa seu snapshot, mesmo que o currículo original seja editado. Não há campanha de troca gratuita de modelo na configuração inicial.

## Google OAuth

1. Crie um cliente OAuth do tipo aplicação Web no Google Cloud e configure a tela de consentimento.
2. Cadastre a origem `http://localhost:5173` e o redirecionamento exato `http://localhost:3001/api/auth/google/callback`.
3. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` na `.env` do servidor.
4. Em produção use a URL HTTPS real. Em modo de testes do Google, cadastre os usuários permitidos.

O backend usa authorization code, PKCE S256, state e nonce. Verifica assinatura JWKS, issuer, audience, expiração, nonce e e-mail verificado do ID token. O banco recebe somente hash SHA-256 do token aleatório da sessão, com expiração de sete dias. Cookie HttpOnly, SameSite=Lax, Secure em produção; logout elimina a sessão. O frontend e `/api` devem ficar no mesmo domínio na implantação, através de proxy reverso.

Referência: https://developers.google.com/identity/openid-connect/openid-connect

## Mercado Pago

1. Crie uma aplicação no painel do Mercado Pago. Preencha `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` no servidor.
2. Configure uma URL HTTPS acessível para a API em `PUBLIC_API_URL`, sem barra final.
3. Cadastre o evento de **pagamentos** e URL `https://seu-dominio/api/webhooks/mercadopago` no painel. A preferência também envia essa URL em `notification_url`.
4. Configure `APP_URL` com a URL do frontend. As URLs de retorno são `/checkout/:orderId`, para sucesso, pendência e falha.
5. Use credenciais e contas de teste próprias do Mercado Pago para homologação; nunca use o cartão de um comprador real para simular uma venda. Não misture vendedor/comprador de ambientes diferentes.

O servidor calcula preço a partir do modelo no banco, cria pedido e preferência, e retorna `init_point`. Recebe `data.id` na query, `x-request-id` e `x-signature`; confere HMAC-SHA256 em tempo constante e tolerância de cinco minutos. Consulta `/v1/payments/:id`, confere ID, external_reference, metadata.order_id, amount, BRL e collector_id obtido por `/users/me`. Só approved libera autorização. Repetições usam a mesma linha Payment e o mesmo entitlement. Uma transação PostgreSQL bloqueia o pedido durante a atualização; eventos com date_last_updated igual ou mais antiga são ignorados. Reembolso parcial também revoga acesso. Chargeback revoga o pedido inteiro. Nenhum status do navegador é usado como aprovação.

O endpoint de reconciliação autenticado consulta os pagamentos pelo pedido, e o download reconsulta o provedor antes de gerar o arquivo. Em indisponibilidade do provedor, não libera novo download. Notificações inválidas retornam 401; falhas transitórias retornam erro para o provedor tentar novamente. Em operação, monitore entregas no painel e faça reconciliação periódica de pedidos pendentes.

Referências:

- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-preference/post
- https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks

## API REST

Todos os corpos são JSON. Mutações do frontend exigem `Origin: APP_URL`; webhook usa assinatura própria. Erros seguem `{error, issues?}`. Sem sessão: 401; sem permissão: 403; currículo alheio/inexistente: 404; revisão desatualizada: 409; entrada inválida: 400. Limite de JSON: 1 MB.

| Método           | Rota `/api`            | Uso                                                |
| ---------------- | ---------------------- | -------------------------------------------------- |
| GET              | /health                | Verifica conexão PostgreSQL                        |
| GET              | /auth/google           | Inicia OAuth                                       |
| GET              | /auth/google/callback  | Valida identidade e cria sessão                    |
| POST             | /auth/logout           | Encerra sessão                                     |
| GET              | /me                    | Usuário autenticado                                |
| GET              | /me/export             | Exporta JSON com dados da conta                    |
| DELETE           | /me                    | Exige `{confirmation:"EXCLUIR"}`                   |
| GET              | /templates             | Modelos ativos e preços                            |
| POST             | /preview               | ResumeData validado; retorna HTML com marca d'água |
| GET, POST        | /resumes               | Lista ou cria currículo próprio                    |
| GET, PUT, DELETE | /resumes/:id           | PUT exige `{revision,data}`                        |
| POST             | /resumes/:id/duplicate | Duplica dados, sem transferir compras              |
| GET, POST        | /orders                | POST exige `{resumeId,requestKey:UUID}`            |
| GET              | /orders/:id            | Dados e estado do pedido próprio                   |
| POST             | /orders/:id/reconcile  | Consulta status no provedor                        |
| GET              | /orders/:id/download   | PDF após autenticação, propriedade e autorização   |
| POST             | /webhooks/mercadopago  | Notificação assinada                               |
| GET              | /admin                 | Até 200 usuários/pedidos, modelos e pagamentos     |
| PATCH            | /admin/templates/:id   | `{name?,priceCents?,active?}`                      |

O schema completo de ResumeData está em `packages/shared/src/index.ts`. Exemplos de uso no frontend e nos testes de integração. `requestKey` deve ser reaproveitada em uma tentativa repetida do mesmo pedido; alterar a chave cria outra intenção de compra. Valor enviado pelo navegador é descartado. Um currículo com histórico de pedidos não pode ser excluído isoladamente, para preservar o acesso à compra; a exclusão da conta remove todos os registros locais.

## Administração

Configure `ADMIN_EMAILS` com e-mails Google separados por vírgula. O acesso é conferido no servidor em cada solicitação. Em Perfil, administradores veem o link de administração. Preços são inteiros em centavos; mudanças afetam novos pedidos, nunca snapshots existentes. Modelos podem ser renomeados, desativados e reprecificados. Criar um novo layout exige implementar seu HTML/CSS e adicionar ao catálogo/seed, não upload arbitrário de HTML.

## PDF

O Chromium renderiza HTML/CSS, nunca uma captura de tela. Links externos não são carregados; fotos são data URLs limitadas a PNG/JPEG/WebP. Dados são escapados. Templates têm regras de quebra de página e margens A4; entradas curtas evitam quebras internas. Conteúdo longo continua em páginas seguintes. O servidor precisa do Chromium e das bibliotecas do sistema: em Linux, `npx playwright install --with-deps chromium`.

## Testes

```sh
npm run build
npm test
# PowerShell: $env:RUN_PDF_TESTS='1'; npm test
RUN_PDF_TESTS=1 npm test
```

Integração usa PostgreSQL dedicado com nome terminado em `_test`. Jamais aponte para banco real. Migre e execute seed nesse banco antes de testar:

```sh
# Defina DATABASE_URL para o banco *_test no ambiente e aplique a migração.
RUN_INTEGRATION=1 RUN_PDF_TESTS=1 npm test
```

A suíte cobre acesso sem sessão/expirada, isolamento entre usuários, conflito de versão, origem, preço definido no servidor, idempotência do pedido e webhook, assinatura inválida, liberação e revogação de download, bloqueio administrativo e PDF real opcional. Usa um provedor HTTP local SOMENTE quando NODE_ENV=test. O servidor em produção sempre usa o domínio fixo oficial do Mercado Pago. OAuth real exige homologação com sua aplicação Google; não é substituído pelo provedor de teste.

## Implantação

1. Provisione PostgreSQL com backups e TLS; use uma senha própria. O Compose é apenas para desenvolvimento.
2. Configure segredos no servidor e `NODE_ENV=production`; faça build, migrações e seed. Seed preserva nomes, preços e estados existentes.
3. No Railway, use o Dockerfile e seu comando padrão, que executa o fluxo de preparação antes de abrir o servidor. Em um servidor Node gerenciado manualmente, use `npm start` após o build e a instalação do Chromium.
4. Sirva `apps/web/dist` por Nginx ou equivalente, com fallback para index.html. Encaminhe `/api` ao Node no mesmo domínio, preserve Origin e X-Forwarded-Proto e configure exatamente um proxy confiável.
5. Restrinja portas internas. Configure HTTPS, URLs de OAuth/webhook reais e `APP_URL` exata.
6. Homologue login, compra aprovada, pendente, recusada, reembolso, chargeback e download com as credenciais de teste do provedor antes de abrir vendas.

Sites/Cloudflare Workers não executa diretamente esta stack de PostgreSQL TCP e Chromium. Este projeto é destinado a um servidor Node, VPS ou plataforma de containers.

## Privacidade e operação

A página `/privacidade` descreve tratamento, fornecedores, cookies essenciais, rascunho local, exportação e exclusão. **Antes da abertura ao público**, preencha identificação do controlador, contato de privacidade, política de retenção, atendimento e condições de reembolso segundo sua operação. Não há analytics ou cookies publicitários. Não alegamos que uma implementação técnica, sozinha, certifica conformidade LGPD.

A aplicação não registra conteúdo de currículos em logs. Não habilite logs de corpos de requisição no proxy. Planeje política de backups e expurgo; exclusão em banco não remove cópias antigas de backup instantaneamente. Sessões expiradas podem ser removidas por rotina operacional. Use limites de CPU/memória e concorrência na infraestrutura para geração PDF; para alto volume, mova a geração para uma fila. Segredos `.env` nunca devem ser versionados.

## Validação desta entrega

- Schemas Prisma validados e Prisma Client gerado.
- TypeScript verificado em shared, API e frontend; build Vite de produção concluído.
- A versão inicial teve oito testes aprovados. A atualização para Railway adiciona verificações de configuração, frontend em produção e falhas durante a inicialização; veja o registro de validação abaixo. O teste de integração completa com PostgreSQL por TCP ficou desativado neste ambiente.
- Migração executada separadamente em PostgreSQL WebAssembly (PGlite): unicidade de pedido/autorização, snapshot e cascatas conferidos. Isso não substitui a homologação no PostgreSQL 16 de destino.
- Oito modelos renderizados em PDF A4, com texto selecionável e revisão visual. Um currículo longo gerou quatro páginas e manteve os itens finais.
- Auditoria npm sem vulnerabilidades na instalação verificada.
- OAuth Google e pagamentos reais precisam de credenciais e homologação no seu ambiente. Nenhuma venda foi realizada e nenhum pagamento real foi simulado.
- Revisão visual da interface no navegador pendente: o servidor local iniciou, mas o isolamento de rede deste ambiente impediu o navegador de acessá-lo. Não há implantação pública nesta entrega.

As verificações locais precisaram de um ajuste temporário no acesso a arquivos do runtime Windows. Esse ajuste ficou apenas em arquivos de trabalho e não integra a aplicação ou o pacote distribuído.

## Atualização para Railway

- Site e API passam a ser servidos pelo mesmo Express em produção; URLs diretas como `/editor` funcionam com fallback React e rotas `/api` inexistentes continuam retornando JSON 404.
- `DATABASE_URL` vem das variáveis do serviço; os comandos do banco não exigem `.env` e não apagam dados.
- `npm start` verifica os arquivos compilados e o Chromium, aplica migrações, insere modelos ausentes e então inicia a aplicação.
- O domínio público Railway permite derivar APP_URL, PUBLIC_API_URL e callback Google. PORT é respeitada e o servidor escuta em 0.0.0.0.
- O servidor pode iniciar durante a instalação com Google e Mercado Pago desabilitados; operações protegidas não são liberadas sem autenticação ou aprovação real. Pares de credenciais incompletos são rejeitados.
- `.env.railway.example` contém referências para o RAW Editor. `.env` e `node_modules` ficam fora da imagem e do pacote.
- O fluxo GitHub Actions incluído verifica a integração com PostgreSQL de teste e a imagem Docker em Linux quando executado no repositório. Sua execução remota ainda depende de enviar o projeto ao GitHub.

A revisão local desta atualização inclui TypeScript, frontend, testes de configuração, regras de acesso, arquivos estáticos e geração real de PDF. O computador não tem Docker; o build da imagem e a implantação efetiva não foram executados localmente. A suíte que usa PostgreSQL por TCP permanece opcional neste ambiente. Não foram usados tokens reais ou acesso à conta Railway.

Resultado local da atualização Railway: 14 testes aprovados, nenhum teste com falha e um teste integrado por TCP desativado; TypeScript da API/shared/frontend e build Vite aprovados.

Resultado local da atualização Railway: 14 testes aprovados, nenhum teste com falha e um teste integrado por TCP desativado; TypeScript da API/shared/frontend e build Vite aprovados.
