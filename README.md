# 💎 garimpo ⛏️

Bot que **garimpa vagas remotas no LinkedIn**, passa cada uma por uma **malha fina** de filtros e manda só as boas direto no seu **Telegram**. Roda sozinho 24/7 — numa VPS, ou de graça no Azure.

Cansou de perder horas garimpando vaga na mão, caindo em anúncio patrocinado, vaga "falsa remota" ou fora da sua stack? O `garimpo` faz esse trabalho pra você.

## ✨ O que ele faz

- 🔎 Busca vagas das **últimas 24h** na sua stack (configurável)
- 🇧🇷 Foca em vagas **do Brasil** e **remotas de verdade**
- ❌ Ignora vagas **Promovidas** (anúncios pagos)
- ❌ Bloqueia stacks que você **não trabalha** (PHP, Laravel, Ruby, .NET, C#…)
- ❌ Descarta **Sênior / Especialista / Lead / Staff** (foco Júnior + Pleno)
- ❌ Rejeita **falsas remotas** (híbrido/presencial disfarçado)
- ✅ Guarda o ID de cada vaga no **SQLite** — você **nunca** recebe repetida
- 📱 Manda as aprovadas no seu **Telegram**, com limite por rodada pra não floodar

Tudo é configurável em [`src/config.ts`](src/config.ts).

## 🛠️ Stack

TypeScript · Node 22.5+ · Playwright (Chromium) · SQLite nativo (`node:sqlite`) · Telegram Bot API · Docker

---

## ✅ Pré-requisitos

- **Node 22.5 ou superior** (o projeto usa o SQLite nativo `node:sqlite`, sem dependência pra compilar). Confira com `node -v`.
- Uma conta no **Telegram** (pra criar o bot).
- **Docker** (só se for rodar em container / fazer deploy).

---

## 1️⃣ Conecte no seu Telegram (passo a passo detalhado)

Você vai precisar de duas coisas: um **token** (a "senha" do bot) e o seu **chat id** (pra onde as vagas vão). Leva uns 3 minutos.

```bash
cp .env.example .env
```

### 1.1 — Criar o bot e pegar o TOKEN

1. Abra o Telegram (app ou [web](https://web.telegram.org)) e, na busca no topo, procure por **`@BotFather`**. É o bot oficial do Telegram (tem o selo azul de verificado). Abra a conversa com ele.
2. Mande **`/start`** e depois **`/newbot`**.
3. O BotFather vai perguntar duas coisas, uma de cada vez:
   - **Nome do bot** (`name`): é o nome de exibição, pode ser qualquer um. Ex.: `Garimpo Vagas`.
   - **Username do bot**: precisa ser único no Telegram e **terminar em `bot`**. Ex.: `garimpo_vagas_bot`. Se já existir, ele pede outro.
4. Deu certo? Ele responde com uma mensagem de "Done!" contendo o **token**, mais ou menos assim:

   ```
   Use this token to access the HTTP API:
   8123456789:AAH1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P
   ```

   👉 **Esse número comprido (com os dois-pontos no meio) é o seu `TELEGRAM_BOT_TOKEN`.** Copie e guarde.

   > 🔒 Trate o token como senha. Se vazar, mande `/revoke` pro BotFather que ele gera um novo.

### 1.2 — Iniciar a conversa com o SEU bot

⚠️ **Passo que quase todo mundo esquece** e faz o bot "não funcionar": o Telegram só deixa um bot te mandar mensagem **depois que você mandar a primeira** pra ele.

1. Na busca do Telegram, procure pelo **username que você acabou de criar** (ex.: `@garimpo_vagas_bot`) e abra a conversa.
2. Mande qualquer mensagem, tipo **`/start`** ou um `oi`. (O bot não vai responder ainda — normal. Isso só "abre" o canal.)

### 1.3 — Pegar o seu CHAT ID

O jeito mais fácil:

1. Na busca, procure por **`@userinfobot`** e abra a conversa.
2. Mande **`/start`**. Ele responde na hora com seus dados, incluindo:

   ```
   Id: 987654321
   ```

   👉 **Esse `Id` é o seu `TELEGRAM_CHAT_ID`.**

<details>
<summary>🔧 Método alternativo (se o @userinfobot não funcionar)</summary>

Com o token em mãos, e **depois** de ter mandado uma mensagem pro seu bot (passo 1.2), abra no navegador (troque `SEU_TOKEN`):

```
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

Procure no JSON por `"chat":{"id":987654321,...}` — esse número é o seu chat id.

</details>

### 1.4 — Colar tudo no `.env`

```env
TELEGRAM_BOT_TOKEN=8123456789:AAH1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P
TELEGRAM_CHAT_ID=987654321
```

**Pronto!** Pra testar se conectou, rode `npm run run:once` (ver seção 2) — se cair vaga no seu Telegram, tá tudo certo. ✅

---

## 2️⃣ Rodar localmente

### Direto com Node (dev)

```bash
npm install
npx playwright install chromium   # baixa o navegador (~1x só)

npm run run:once    # roda UM ciclo e sai — ótimo pra testar
npm run dev         # roda em loop contínuo, com hot-reload
```

- `npm run run:once` faz uma varredura completa e manda as vagas no seu Telegram na hora.
- Sem o `.env` preenchido, ele **não envia** nada — só lista as vagas aprovadas no terminal (modo teste seguro).

### Com Docker (igual vai rodar em produção)

```bash
docker compose up -d --build   # sobe em background (loop 24/7)
docker compose logs -f         # acompanha os logs
docker compose down            # para
```

O banco fica em `./data/garimpo.db` (volume montado, persiste entre reinícios).

---

## 3️⃣ Deploy de graça no Azure (Container Apps Job)

A ideia: em vez de deixar o bot ligado 24/7 (que custa), rodamos ele em modo `RUN_ONCE` **a cada 30 min** como um *job* agendado. Entre as execuções o container **escala a zero**, então o consumo cabe no [grant mensal gratuito](https://azure.microsoft.com/pricing/details/container-apps/) do Container Apps.

> 💡 Playwright leva o Chromium junto, então precisa de um container de verdade (nada de Function serverless pura).

### Passo 1 — Publicar a imagem (grátis no GitHub Container Registry)

Vamos usar o `ghcr.io`, que é gratuito. Precisa do [`gh` CLI](https://cli.github.com/) logado (`gh auth login`).

```bash
# Libera a permissão de publicar pacotes (abre o navegador pra autorizar)
gh auth refresh -h github.com -s write:packages

# Login no registry usando o token do gh (troque SEU_USER pelo seu usuário do GitHub)
gh auth token | docker login ghcr.io -u SEU_USER --password-stdin

# Build e push
docker build -t ghcr.io/SEU_USER/garimpo:v1 .
docker push ghcr.io/SEU_USER/garimpo:v1
```

### Passo 2 — Criar a infra base

```bash
RG=rg-garimpo
LOC=brazilsouth
ST=stgarimpo$RANDOM      # nome do storage tem que ser único no mundo

az group create -n $RG -l $LOC

# Storage + File Share (persiste o SQLite entre execuções → sem vaga repetida)
az storage account create -n $ST -g $RG -l $LOC --sku Standard_LRS --kind StorageV2
az storage share-rm create --storage-account $ST -g $RG -n garimpo-data --quota 1

# Ambiente do Container Apps (sem Log Analytics pra economizar)
az extension add -n containerapp --upgrade
az containerapp env create -n garimpo-env -g $RG -l $LOC --logs-destination none

# Liga o File Share no ambiente
KEY=$(az storage account keys list -n $ST -g $RG --query "[0].value" -o tsv)
az containerapp env storage set -g $RG -n garimpo-env \
  --storage-name garimpodata \
  --azure-file-account-name $ST --azure-file-account-key "$KEY" \
  --azure-file-share-name garimpo-data --access-mode ReadWrite
```

### Passo 3 — Criar o Job (via YAML, porque volume precisa de YAML)

> ⚠️ **Detalhe importante:** SQLite **não funciona direto sobre Azure Files (SMB)**, porque depende de *file locking* que o mount de rede não suporta. Por isso o [`entrypoint.sh`](entrypoint.sh) faz uma dança: copia o banco do File Share pro disco local, roda o app ali, e copia de volta no fim. Isso é ligado pela env `SYNC_DB_TO_SHARE=true`.

Crie um `job.yaml` (troque `SEU_USER`, o `environmentId` e os valores dos secrets):

```yaml
location: brazilsouth
properties:
  # pegue o id com: az containerapp env show -n garimpo-env -g rg-garimpo --query id -o tsv
  environmentId: /subscriptions/<SUB>/resourceGroups/rg-garimpo/providers/Microsoft.App/managedEnvironments/garimpo-env
  configuration:
    triggerType: Schedule
    replicaTimeout: 600
    replicaRetryLimit: 1
    scheduleTriggerConfig:
      cronExpression: "*/30 * * * *"   # a cada 30 min
      parallelism: 1
      replicaCompletionCount: 1
    registries:
      - server: ghcr.io
        username: SEU_USER
        passwordSecretRef: ghcr-pass
    secrets:
      - name: ghcr-pass
        value: "<TOKEN_DO_GH>"          # gh auth token
      - name: tg-token
        value: "<TELEGRAM_BOT_TOKEN>"
  template:
    containers:
      - name: garimpo
        image: ghcr.io/SEU_USER/garimpo:v1
        resources:
          cpu: 0.5
          memory: 1.0Gi
        env:
          - name: RUN_ONCE
            value: "true"
          - name: SYNC_DB_TO_SHARE
            value: "true"
          - name: SQLITE_JOURNAL_MODE
            value: "DELETE"
          - name: TELEGRAM_CHAT_ID
            value: "<TELEGRAM_CHAT_ID>"
          - name: TELEGRAM_BOT_TOKEN
            secretRef: tg-token
        volumeMounts:
          - volumeName: data
            mountPath: /app/data
    volumes:
      - name: data
        storageType: AzureFile
        storageName: garimpodata
```

Crie e dispare um teste:

```bash
az containerapp job create -n garimpo -g rg-garimpo --yaml job.yaml

# Roda agora (sem esperar os 30 min) pra testar
az containerapp job start -n garimpo -g rg-garimpo
```

Pronto — daqui pra frente ele roda sozinho a cada 30 min. 🎉

---

## 🧰 Gerenciando o deploy

```bash
# Rodar agora, sob demanda
az containerapp job start -n garimpo -g rg-garimpo

# Ver histórico de execuções
az containerapp job execution list -n garimpo -g rg-garimpo -o table

# Publicar uma versão nova do código (nova tag) e apontar o job pra ela
docker build -t ghcr.io/SEU_USER/garimpo:v2 . && docker push ghcr.io/SEU_USER/garimpo:v2
az containerapp job update -n garimpo -g rg-garimpo --image ghcr.io/SEU_USER/garimpo:v2

# Desligar e apagar tudo
az group delete -n rg-garimpo
```

---

## 🎯 Personalize para o SEU perfil

Os filtros vêm preenchidos para um perfil **Full Stack Java/Vue/React/TS**. Pra adaptar pro seu, mexa só no arquivo [`src/config.ts`](src/config.ts) — todo comentado. Três ajustes resolvem 90% dos casos:

### a) O que ele BUSCA — `searches`

Troque pelos cargos/tecnologias que você quer receber. Cada item vira uma busca no LinkedIn:

```ts
searches: [
  { keywords: "Desenvolvedor Python Django", label: "Python" },
  { keywords: "Engenheiro de Dados", label: "Dados" },
  { keywords: "Desenvolvedor Golang", label: "Go" },
],
```

> 💡 `label` é só um apelido que aparece no log. Quanto mais específico o `keywords`, mais certeiras as vagas.

### b) Stacks que você NÃO quer — `filters.blockedStacks`

Se o título tiver alguma dessas palavras, a vaga é descartada. **Remova** o que você trabalha e **adicione** o que não quer:

```ts
// exemplo: sou dev Python e não quero front-end
blockedStacks: ["react", "angular", "vue", "frontend", "php"],
```

### c) Nível de senioridade — `filters.blockedSeniority`

Descarta vagas com esses termos no título. O padrão foca **Júnior + Pleno** (bloqueia Sênior pra cima). Se você já é Sênior, por exemplo, tire `senior` da lista e adicione `junior`/`estagio`:

```ts
blockedSeniority: ["junior", "júnior", "estagio", "estágio", "trainee"],
```

### Outros ajustes (opcionais)

| Config | O que faz |
|---|---|
| `location` + `geoId` | País da busca. Fora do Brasil? Troque o texto e o [geoId do país](https://www.linkedin.com/jobs/search) |
| `filters.onlyBrazil` | Deixe `false` se não quiser filtrar por Brasil |
| `timePosted` | Janela de tempo (`r86400` = 24h · `r604800` = 7 dias) |
| `maxNotificationsPerRun` | Máx. de vagas por execução (evita flood) |
| `pollIntervalMs` | Intervalo do loop (só no modo VPS/local) |

**Depois de editar:**
- rodando **local**: é só `npm run run:once` de novo;
- rodando no **Azure**: rebuild + push da imagem e `az containerapp job update` (ver seção "Gerenciando o deploy").

Variáveis de ambiente úteis: `RUN_ONCE`, `MAX_PER_RUN`, `SQLITE_JOURNAL_MODE`, `SYNC_DB_TO_SHARE`, `DB_PATH`, `HEADFUL`.

---

## 🏗️ Como funciona

```
LinkedIn (busca pública)
      │  Playwright (Chromium headless)
      ▼
  scraper/linkedin.ts  ──►  filters/index.ts  ──►  storage/db.ts  ──►  notifier/telegram.ts
   extrai os cards          a malha fina           dedupe (SQLite)        manda no Telegram
```

O orquestrador ([`index.ts`](src/index.ts)) roda esse fluxo para cada busca, com delays aleatórios entre elas.

---

## ⚠️ Aviso importante

O LinkedIn **proíbe scraping automatizado** nos Termos de Uso e muda o HTML sem avisar. Este projeto:

- usa a **busca pública** de vagas (sem login), pra **não arriscar sua conta**;
- roda com **intervalos e delays aleatórios** pra parecer humano;
- pode **parar de funcionar** quando o LinkedIn mudar o layout — aí é ajustar os seletores em [`src/scraper/linkedin.ts`](src/scraper/linkedin.ts).

Use com bom senso, para uso pessoal. 💛

---

## 📁 Estrutura

```
src/
  config.ts            → toda a configuração (buscas + malha fina)
  types.ts             → tipos compartilhados
  scraper/linkedin.ts  → Playwright: busca e extrai os cards
  filters/index.ts     → a malha fina
  storage/db.ts        → SQLite: dedupe de vagas já vistas
  notifier/telegram.ts → envio das notificações
  index.ts             → orquestrador (loop + agendamento)
entrypoint.sh          → sincroniza o SQLite com o File Share (deploy Azure)
Dockerfile · docker-compose.yml
```
