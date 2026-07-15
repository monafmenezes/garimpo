/**
 * Configuração do garimpo — ajuste aqui sem precisar mexer no resto do código.
 * Tudo que é sensível (tokens) vem de variáveis de ambiente (.env).
 */

export interface SearchQuery {
  /** Termo de busca no LinkedIn */
  keywords: string;
  /** Rótulo amigável só pra log */
  label?: string;
}

export const config = {
  /**
   * Buscas que o bot vai rodar a cada ciclo.
   * Preenchidas com base no perfil da Monalisa (Full Stack Java/Vue/React/TS).
   */
  searches: [
    { keywords: "Desenvolvedor Backend Java Spring Boot", label: "Backend Java" },
    { keywords: "Desenvolvedor Full Stack Java", label: "Full Stack Java" },
    { keywords: "Desenvolvedor Vue.js TypeScript", label: "Vue/TS" },
    { keywords: "Desenvolvedor React TypeScript", label: "React/TS" },
    { keywords: "Desenvolvedor Next.js", label: "Next.js" },
    { keywords: "Engenheiro de Software Microsserviços", label: "Microsserviços" },
  ] satisfies SearchQuery[],

  /** Localização usada na busca (texto). */
  location: "Brasil",

  /**
   * geoId do Brasil no LinkedIn. Muito mais confiável que o texto acima pra
   * ancorar a busca no país (o texto sozinho deixa vazar remota internacional).
   * Deixe "" pra desativar e usar só o texto.
   */
  geoId: "106057199",

  /**
   * Janela de tempo das vagas (LinkedIn f_TPR).
   * "r86400" = últimas 24h · "r604800" = última semana.
   * Rodando o bot todo dia, 24h é o ideal pra não repetir muito.
   */
  timePosted: "r86400",

  /** Quantos cards no máximo processar por busca (evita paginar demais). */
  maxJobsPerSearch: 25,

  /**
   * Máximo de vagas notificadas por execução — evita floodar o Telegram na
   * primeira rodada (quando o histórico está vazio). O que passar do limite
   * fica pra próxima execução (não é marcado como visto).
   */
  maxNotificationsPerRun: Number(process.env.MAX_PER_RUN ?? 15),

  /** ------------------------- MALHA FINA ------------------------- */
  filters: {
    /** Descarta vagas marcadas como "Promovido"/patrocinadas. */
    blockPromoted: true,

    /**
     * Stacks/termos que você NÃO trabalha — se aparecer no título, descarta.
     * (Você pediu pra remover PHP 😄)
     */
    blockedStacks: [
      "php",
      "laravel",
      "symfony",
      "wordpress",
      "drupal",
      "codeigniter",
      "ruby",
      "rails",
      "python",
      "django",
      ".net",
      "c#",
      "cobol",
      "delphi",
    ],

    /**
     * Níveis de senioridade que você NÃO quer (foco Júnior + Pleno).
     * Casa como palavra inteira, então "sr" não pega "desenvolvedoR" etc.
     */
    blockedSeniority: [
      "senior",
      "sênior",
      "sr",
      "especialista",
      "specialist",
      "staff",
      "principal",
      "lead",
      "líder",
      "lider",
      "expert",
      "iii",
      "iv",
    ],

    /**
     * Rejeita "falsa remota": vaga que aparece na busca remota mas o texto
     * denuncia que é híbrida/presencial.
     */
    rejectFakeRemote: true,
    fakeRemoteMarkers: [
      "híbrido",
      "hibrido",
      "presencial",
      "on-site",
      "on site",
      "no local",
      "comparecer",
    ],

    /**
     * Foco no Brasil: rejeita vagas cuja localização não indica o país.
     * (Remoto no LinkedIn ignora fronteira, então muita vaga dos EUA vaza.)
     */
    onlyBrazil: true,
    /**
     * A localização do card é aceita se contiver um destes termos, OU terminar
     * com uma UF brasileira (ex.: "São Paulo, SP"), OU falar em "Região".
     */
    brazilMarkers: ["brasil", "brazil", "regiao", "região"],
    /** Siglas dos estados — casam quando vêm ao fim (ex.: "..., MG"). */
    brazilStateAbbrevs: [
      "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms",
      "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc",
      "sp", "se", "to",
    ],
    /**
     * Também aceitar remotas amplas que normalmente incluem o Brasil
     * (LatAm / Américas). Deixe false pra ser estritamente "Brazil".
     */
    acceptBroadRemote: true,
    broadRemoteMarkers: [
      "latam",
      "latin america",
      "america latina",
      "américa latina",
      "americas",
      "south america",
      "america do sul",
      "américa do sul",
    ],
    /** Rejeitar quando a localização vier vazia/desconhecida (mais seguro). */
    rejectUnknownLocation: true,
  },

  /** ------------------------- COMPORTAMENTO ------------------------- */
  /** Intervalo entre ciclos completos (ms). Padrão: 30 min. */
  pollIntervalMs: 30 * 60 * 1000,

  /** Jitter aleatório somado ao intervalo, pra parecer menos robô (ms). */
  pollJitterMs: 5 * 60 * 1000,

  /** Pausa aleatória entre cada busca dentro de um ciclo (ms). */
  delayBetweenSearches: { min: 4000, max: 9000 },

  /** Roda uma vez e sai (útil pra testar ou pra usar com cron externo). */
  runOnce: process.env.RUN_ONCE === "true",

  /** ------------------------- SEGREDOS (.env) ------------------------- */
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  },

  /** Caminho do banco SQLite. */
  dbPath: process.env.DB_PATH ?? "./data/garimpo.db",

  /**
   * Journal mode do SQLite.
   * - "WAL": mais rápido, ideal em disco local (VPS/VM).
   * - "DELETE": use quando o banco fica num FILE SHARE de rede (ex.: Azure
   *   Files), porque WAL não funciona sobre SMB.
   */
  sqliteJournalMode: process.env.SQLITE_JOURNAL_MODE ?? "WAL",

  /** Roda o navegador com interface (false = headless, padrão em produção). */
  headful: process.env.HEADFUL === "true",
};

export type Config = typeof config;
