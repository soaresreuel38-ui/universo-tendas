# Universo Tendas — Sistema de estoque, locação e vendas

Sistema interno da **Universo Tendas** (Sinop - MT) para saber, a qualquer momento, o que está
disponível, reservado, alugado, em manutenção, pendente ou vendido — e para quem, quando sai e
quando volta.

```
ESTOQUE → RESERVA → SAÍDA → LOCAÇÃO → RETORNO → CONFERÊNCIA → ESTOQUE
```

- **Next.js 16** (App Router, Server Actions) · **TypeScript** · **React 19** · **Tailwind CSS 4**
- **PostgreSQL** (Supabase recomendado) + **Prisma 6** · validação com **Zod**
- Login próprio: senha com bcrypt, sessão JWT em cookie `httpOnly`, papéis Administrador/Funcionário
- Testes das regras críticas com **Vitest** contra um PostgreSQL real

> O sistema começa **vazio**: nenhum produto, preço, cliente ou locação é inventado. O único dado
> pré-gravado é o da empresa (nome, cidade, telefones e Instagram), editável em *Configurações*.

---

## Rodar localmente

Requisitos: Node.js 20.9+ e PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL, DIRECT_URL e AUTH_SECRET
npm run db:deploy             # cria as tabelas
npm run db:seed               # grava os dados da empresa
ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='senha-forte-aqui' ADMIN_NAME='Seu nome' npm run admin:create
npm run dev                   # http://localhost:3000
```

Verificações:

```bash
npm run typecheck
npm run lint
TEST_DATABASE_URL=postgresql://…/banco_de_teste npm test   # banco descartável!
npm run build
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | PostgreSQL. No Supabase, a *Transaction pooler* (porta 6543) com `?pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | Sim | Conexão direta/sessão (porta 5432), usada pelas migrations. Sem pooler, repita a `DATABASE_URL`. |
| `AUTH_SECRET` | Sim | Segredo com 32+ caracteres (`openssl rand -base64 48`). Trocar derruba todas as sessões. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Só no `admin:create` | Criação do primeiro administrador. Não precisam ficar salvas. |
| `TEST_DATABASE_URL` | Só nos testes | Banco **descartável** — os testes apagam os dados dele. |
| `SITE_URL` | Recomendada | Endereço público do site (canonical, Open Graph, `sitemap.xml`, `robots.txt` e link de assinatura de contrato). Produção: `https://universotendas.app.br` (também é o padrão). |

**Ambientes separados:** desenvolvimento (`.env` local → banco de desenvolvimento), teste (`TEST_DATABASE_URL` →
banco descartável, onde rodam os testes de concorrência) e produção (variáveis só no painel da Vercel).

Segredos ficam apenas no `.env` (ignorado pelo git) ou no painel da Vercel. Nada sensível vai para o navegador.

## Deploy (GitHub + Vercel + Supabase)

1. **Supabase** → crie o projeto → *Project Settings → Database → Connection string*: copie a
   *Transaction pooler* (6543) e a *Session pooler / Direct* (5432).
2. Crie as tabelas e o administrador a partir do seu computador (uma vez):
   ```bash
   DATABASE_URL="…5432…" DIRECT_URL="…5432…" npm run db:deploy
   DATABASE_URL="…5432…" DIRECT_URL="…5432…" npm run db:seed
   DATABASE_URL="…5432…" ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_NAME=… npm run admin:create
   ```
3. **Vercel** → *Add New Project* → importe este repositório → **Build Command** `npm run vercel-build` → cadastre `DATABASE_URL`, `DIRECT_URL` e `AUTH_SECRET` → *Deploy*.
   O build roda `prisma generate && next build`.
4. A cada mudança de schema, rode `npm run db:deploy` apontando para o banco de produção.

---

## Como usar no dia a dia

A navegação segue as perguntas do dia a dia:

| Pergunta | Onde |
| --- | --- |
| O que temos? | **Estoque** (`/admin/produtos`) |
| O que está reservado? | **Locações → Reservas** |
| O que vai sair? | **Locações → A sair** / Painel "Saídas de hoje" |
| O que está fora? | **Locações → Em andamento** |
| O que deveria voltar? | **Retornos** (`/admin/retorno`) |
| O que voltou com problema? | **Manutenção e pendências** |
| O que foi vendido? | **Vendas** |

### Cadastrar produtos (administrador)
*Estoque → Novo produto*. Informe nome, código/SKU, categoria (tendas, estruturas, mesas, cadeiras,
acessórios, peças…), tipo (Locação, Venda ou ambos), preços, unidade, estoque mínimo para alerta,
foto e a **quantidade inicial**. Escolha o controle:
- **Por quantidade** — ex.: "Cadeira plástica: 200".
- **Por unidade (numeradas)** — cada peça recebe um número (#001, #002…) e o sistema registra
  qual unidade foi para cada evento e em que estado voltou.

Quantidades nunca são digitadas na edição do produto: mudam só por Entrada, Saída, Locação, Venda
ou Ajuste de inventário — assim o histórico fica completo.

### Registrar uma locação
*Nova locação* → cliente (ou "+ Cliente novo"), evento, endereço, datas de saída e de retorno previsto
(montagem e data do evento são opcionais) → produtos e quantidades. A disponibilidade no período
aparece na hora; se faltar estoque, o botão é bloqueado com a mensagem
"Estoque insuficiente para esta data. Disponibilidade atual: X unidades.". Escolha a situação:
*Orçamento* (não reserva), *Reservada*, *Confirmada* ou *Saída agora*.
Na tela da locação há o botão **Enviar confirmação pelo WhatsApp** (mostra a mensagem e abre o
WhatsApp — nada é enviado sozinho).

### Registrar uma saída
- **Locação**: na locação, *Registrar saída* → confira os itens (e as unidades numeradas) → informe
  quem está retirando → *Confirmar*. Disponível diminui e Alugado aumenta automaticamente.
- **Outras saídas**: *− Saída* → Manutenção, Perda, Transferência ou Outro. Venda e Locação abrem
  os formulários completos.

### Registrar um retorno
*Retornos* → escolha a locação → **Conferência**: para cada produto, informe quantas voltaram OK,
danificadas e faltantes (em produtos numerados, marque cada unidade). Diferenças exigem justificativa.
Anexe fotos pelo celular. Ao **Finalizar conferência**: OK → Disponível, danificadas → Manutenção
(com registro aberto), faltantes → Pendência (resolvível depois como "encontrado" ou "perda").

### Registrar uma venda
*Nova venda* → cliente (opcional) → produtos, quantidades e valores → *Registrar venda*.
O produto sai do estoque **definitivamente** (o total diminui). Só o administrador cancela vendas.

### Acompanhar o estoque
- **Painel**: disponíveis, alugados, reservados, manutenção, pendências, estoque baixo, saídas e
  retornos de hoje, atrasadas, próximas saídas e alertas.
- **Produto**: barra de situação, disponibilidade por período, locações ligadas, unidades e histórico.
- **Calendário**: dia/semana/mês; filtrando um produto mostra quantos ficam livres a cada dia.
- **Movimentações** e **Relatórios** (com exportação CSV que abre no Excel).

---

## Regras de estoque (resumo técnico)

Contadores por produto (`prisma/schema.prisma`): `qtyAvailable` (no depósito), `qtyRented` (fora),
`qtyMaintenance`, `qtyPending` (faltantes), mais `qtySold` e `qtyLost` acumulados.
**Total = depósito + alugado + manutenção + pendente.**

Disponibilidade em um período = (depósito + alugados que voltam) − **pico** de ocupação simultânea
das locações ativas no período. Locações fora com retorno vencido continuam ocupando até voltarem.
Itens em manutenção não contam.

Proteções contra erro e concorrência:
1. Validação no navegador (aviso imediato);
2. Validação no servidor (Zod + regras de negócio);
3. Revalidação **dentro da transação**, com `SELECT … FOR UPDATE` nos produtos envolvidos — duas
   pessoas reservando o último estoque ao mesmo tempo são atendidas uma de cada vez;
4. Restrições `CHECK` no PostgreSQL impedem qualquer saldo negativo.

Status "Atrasada" é calculado automaticamente (saiu e passou do retorno previsto) — não depende de
tarefa agendada.

## Site público (reservas online)

```
SITE (/, /tendas, /tendas/<slug>, /reservar, /minha-reserva)
  → /api/public/*  (sem login; validação Zod, limite por IP, preços lidos do cadastro)
  → src/server/public-booking.ts → insertRentalInTx() + availabilityForPeriod()   ← as MESMAS do painel
  → mesmo PostgreSQL → /admin/locacoes (aba "Do site")
```

- **Uma única regra de disponibilidade.** O site não calcula estoque: usa `availabilityForPeriod()` e cria a
  reserva por `insertRentalInTx()` — o mesmo núcleo de `createRental()` do painel, com `lockProducts()`
  (`SELECT … FOR UPDATE`) e `assertBookable()` dentro da transação.
- **Período bloqueado** = do início do evento − margem até o fim do evento + margem (padrão 1 dia antes e 1 depois,
  em *Configurações → Reservas pelo site*). Ex.: evento 10/10 a 12/10 → estoque ocupado de 09/10 a 13/10.
  São os campos `departureAt`/`expectedReturnAt` de sempre; o admin pode ajustá-los em cada locação (*Editar*).
- **Aprovação:** por padrão a reserva nasce `RESERVADA` (segura o estoque) com origem `SITE` e aparece em
  *Locações → Do site* e no alerta "Novas reservas online". *Aprovar* → `CONFIRMADA`; *Recusar* → `CANCELADA`
  (libera o estoque). O modo automático (já nasce `CONFIRMADA`) é uma opção em Configurações.
- **Sem preço cadastrado:** a solicitação é aceita com "Valor a consultar" (`pricePending`); o admin define o valor em *Editar*.
- **Cancelamento:** o cliente só *solicita* em `/minha-reserva`; o pedido aparece em *Locações → Pedidos de
  cancelamento*. O estoque só é liberado quando a empresa cancela de fato.
- **Contrato:** o mesmo fluxo de sempre (*Gerar contrato* na locação).
- **Consulta do cliente:** link pessoal com token (só o hash fica no banco) ou número + telefone.
- **Produtos:** aparecem no site os ativos de locação com *Mostrar no site* marcado. *Destaque* coloca o produto na
  página inicial (a foto do primeiro destaque vira a capa). O endereço da página (`slug`) é gerado pelo nome.
- **Analytics:** eventos em `src/lib/analytics.ts` (`window.dataLayer`), prontos para ligar GA4/GTM.

## Segurança

- Senhas com bcrypt (custo 12); sessão JWT HS256 em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção;
- Usuário, papel e versão de sessão relidos do banco a cada requisição (desativar usuário ou trocar
  senha derruba as sessões abertas);
- Proteção em camadas: `proxy.ts` + checagem em cada página, server action e rota de API;
- Permissões verificadas nos serviços do servidor (não só na interface);
- Rate limit de login persistido no banco (funciona em serverless);
- Prisma (consultas parametrizadas) contra SQL injection; React escapa a saída (XSS); CSP estrita,
  `X-Frame-Options`, HSTS, `noindex`;
- Upload de fotos só para usuários logados, com verificação da assinatura real do arquivo (JPG/PNG/WebP),
  limite de tamanho e compressão no próprio celular;
- CSV com proteção contra injeção de fórmulas.

## Estrutura

```
prisma/            schema, migration (com travas CHECK) e seed da empresa
scripts/           create-admin.ts
src/lib/           domínio (status, permissões), datas no fuso de Sinop, formatação, validação
src/server/        regras de negócio: availability, stock, rentals, sales, products, users, reports
src/app/admin/     telas do painel e server actions
src/app/api/       fotos, disponibilidade (consulta rápida), exportação CSV
tests/             testes das partes críticas (inclui concorrência)
```
