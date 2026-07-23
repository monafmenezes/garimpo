import { chromium, type Browser, type Page } from "playwright";
import { config, type SearchQuery } from "../config.js";
import type { RawJob } from "../types.js";

/**
 * Scraper do LinkedIn usando a busca PÚBLICA de vagas (guest), sem login.
 *
 * Por que sem login?
 *  - Evita risco de banir/bloquear a sua conta pessoal.
 *  - É mais estável: o endpoint guest muda menos que o feed logado.
 *
 * ⚠️ Ainda assim, scraping do LinkedIn contraria os Termos de Uso deles e o
 *    HTML pode mudar. Use com parcimônia (intervalos humanos) e espere ter que
 *    ajustar os seletores de tempos em tempos.
 */

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let browser: Browser | null = null;

export async function launchBrowser(): Promise<void> {
  browser = await chromium.launch({
    headless: !config.headful,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}

/** Monta a URL da busca pública de vagas com os filtros da config. */
function buildSearchUrl(query: SearchQuery, start = 0): string {
  const params = new URLSearchParams({
    keywords: query.keywords,
    location: query.location ?? config.location,
    f_WT: "2", // 2 = remoto
    f_TPR: config.timePosted, // janela de tempo
    start: String(start),
  });
  // geoId ancora a busca no país de forma muito mais confiável que o texto.
  const geoId = query.geoId ?? config.geoId;
  if (geoId) params.set("geoId", geoId);
  return `https://www.linkedin.com/jobs/search?${params.toString()}`;
}

/** Extrai os cards de vaga que estão renderizados na página. */
async function extractCards(page: Page): Promise<RawJob[]> {
  return page.$$eval("ul.jobs-search__results-list li, div.base-search-card", (nodes) => {
    const jobs: Array<Record<string, unknown>> = [];

    for (const li of nodes) {
      const card = li.querySelector("div.base-card, div.base-search-card") ?? li;

      // ID: vem no data-entity-urn "urn:li:jobPosting:1234567890"
      const urn = card.getAttribute("data-entity-urn") ?? "";
      const idFromUrn = urn.split(":").pop() ?? "";

      const link = card.querySelector<HTMLAnchorElement>("a.base-card__full-link, a[href*='/jobs/view/']");
      const href = link?.href ?? "";
      // fallback: extrai o id numérico da própria URL
      const idFromHref = href.match(/(\d{6,})/)?.[1] ?? "";
      const id = idFromUrn || idFromHref;
      if (!id) continue;

      const title =
        card.querySelector(".base-search-card__title")?.textContent?.trim() ?? "";
      const company =
        card.querySelector(".base-search-card__subtitle")?.textContent?.trim() ?? "";
      const location =
        card.querySelector(".job-search-card__location")?.textContent?.trim() ?? "";
      const postedEl = card.querySelector<HTMLTimeElement>("time");
      const postedAt = postedEl?.getAttribute("datetime") ?? undefined;

      // Detecta sinal de "promovido"/patrocinado no texto do card.
      const rawText = (card.textContent ?? "").replace(/\s+/g, " ").trim();
      const promoted = /promo(vid|ted)/i.test(rawText);

      jobs.push({ id, title, company, location, url: href, postedAt, rawText, promoted });
    }
    return jobs;
  }) as unknown as RawJob[];
}

/** Faz o scraping de uma busca e devolve as vagas brutas (sem filtrar). */
export async function scrapeSearch(query: SearchQuery): Promise<RawJob[]> {
  if (!browser) throw new Error("Browser não iniciado. Chame launchBrowser() antes.");

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
  });
  const page = await context.newPage();

  const collected = new Map<string, RawJob>();
  try {
    await page.goto(buildSearchUrl(query), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Rola a página algumas vezes pra carregar mais cards (lazy load).
    for (let i = 0; i < 3 && collected.size < config.maxJobsPerSearch; i++) {
      const cards = await extractCards(page);
      for (const job of cards) {
        if (!collected.has(job.id)) collected.set(job.id, job);
        if (collected.size >= config.maxJobsPerSearch) break;
      }
      await page.mouse.wheel(0, 2500);
      await page.waitForTimeout(1200 + Math.random() * 800);
    }
  } catch (err) {
    console.error(`❌ Erro no scraping de "${query.label ?? query.keywords}":`, (err as Error).message);
  } finally {
    await context.close();
  }

  return [...collected.values()].slice(0, config.maxJobsPerSearch);
}
