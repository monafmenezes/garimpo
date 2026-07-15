import { config } from "../config.js";
import type { RawJob, FilterResult } from "../types.js";

/** Normaliza texto: minúsculas, sem acento, pra casar termos de forma robusta. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Casa um termo como palavra inteira (evita falso positivo tipo "sr" em outra palavra). */
function containsWord(haystack: string, term: string): boolean {
  const t = normalize(term);
  // Escapa caracteres especiais de regex (ex.: ".net", "c#").
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

/**
 * Passa uma vaga pela malha fina. Retorna aprovado/reprovado + motivo.
 * A ordem dos testes é do mais barato/comum pro mais específico.
 */
export function applyFilters(job: RawJob): FilterResult {
  const f = config.filters;
  const title = normalize(job.title);
  const fullText = normalize(
    [job.title, job.company, job.location, job.rawText ?? ""].join(" ")
  );

  // 1) Promovidas / patrocinadas
  if (f.blockPromoted && (job.promoted || containsWord(fullText, "promovido") || containsWord(fullText, "promoted"))) {
    return { approved: false, reason: "promovida (anúncio pago)" };
  }

  // 2) Stack que você não trabalha (checa no título)
  for (const stack of f.blockedStacks) {
    if (containsWord(title, stack)) {
      return { approved: false, reason: `stack bloqueada: ${stack}` };
    }
  }

  // 3) Senioridade acima do alvo (Júnior + Pleno)
  for (const level of f.blockedSeniority) {
    if (containsWord(title, level)) {
      return { approved: false, reason: `senioridade: ${level}` };
    }
  }

  // 4) Falsa remota (híbrida/presencial disfarçada)
  if (f.rejectFakeRemote) {
    for (const marker of f.fakeRemoteMarkers) {
      if (containsWord(fullText, marker)) {
        return { approved: false, reason: `falsa remota: ${marker}` };
      }
    }
  }

  // 5) Foco no Brasil (a localização do card precisa indicar o país)
  if (f.onlyBrazil) {
    const loc = normalize(job.location);

    if (!loc) {
      if (f.rejectUnknownLocation) {
        return { approved: false, reason: "localização desconhecida" };
      }
    } else {
      // "brasil"/"brazil"/"região" no texto
      const hasMarker = f.brazilMarkers.some((m) => loc.includes(normalize(m)));
      // termina com uma UF brasileira, ex.: "são paulo, sp"
      const ufPattern = new RegExp(`,\\s*(${f.brazilStateAbbrevs.join("|")})$`);
      const hasUf = ufPattern.test(loc);
      // remota ampla (LatAm/Américas) que costuma incluir o Brasil
      const isBroad =
        f.acceptBroadRemote &&
        f.broadRemoteMarkers.some((m) => loc.includes(normalize(m)));

      if (!hasMarker && !hasUf && !isBroad) {
        return { approved: false, reason: `fora do Brasil: ${job.location}` };
      }
    }
  }

  return { approved: true };
}
