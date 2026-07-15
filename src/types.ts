/** Uma vaga bruta, do jeitinho que sai do scraping. */
export interface RawJob {
  /** ID único da vaga no LinkedIn (usado pra dedupe). */
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  /** Data de publicação (ISO), quando disponível. */
  postedAt?: string;
  /** Texto extra do card (usado pelos filtros, ex.: "Promovido"). */
  rawText?: string;
  /** Marca se o card veio sinalizado como promovido/patrocinado. */
  promoted?: boolean;
}

/** Resultado da malha fina para uma vaga. */
export interface FilterResult {
  approved: boolean;
  /** Motivo da rejeição (só quando approved = false). */
  reason?: string;
}
