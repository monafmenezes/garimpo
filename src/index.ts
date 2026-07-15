import { config } from "./config.js";
import { launchBrowser, closeBrowser, scrapeSearch } from "./scraper/linkedin.js";
import { applyFilters } from "./filters/index.js";
import { hasSeen, markNotified, totalSeen, closeDb } from "./storage/db.js";
import { sendJob, sendText, isTelegramConfigured } from "./notifier/telegram.js";
import type { RawJob } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

/** Roda um ciclo completo: varre todas as buscas, filtra, dedupe e notifica. */
async function runCycle(): Promise<void> {
  const startedAt = new Date();
  console.log(`\n⛏️  [${startedAt.toLocaleString("pt-BR")}] Iniciando garimpo...`);

  let found = 0;
  let approved = 0;
  let sent = 0;

  const cap = config.maxNotificationsPerRun;
  let capReached = false;

  for (const query of config.searches) {
    if (capReached) break;
    const label = query.label ?? query.keywords;
    const jobs = await scrapeSearch(query);
    found += jobs.length;
    console.log(`  🔎 ${label}: ${jobs.length} vagas encontradas`);

    for (const job of jobs) {
      // Limite por execução: o excedente fica pra próxima rodada (sem marcar
      // como visto), evitando flood no Telegram.
      if (isTelegramConfigured() && sent >= cap) {
        console.log(`     ⏸️  limite de ${cap} vagas/execução atingido — o resto vem no próximo ciclo`);
        capReached = true;
        break;
      }

      // 1) Já mandei essa antes? (dedupe)
      if (hasSeen(job.id)) continue;

      // 2) Passa na malha fina?
      const result = applyFilters(job);
      if (!result.approved) {
        console.log(`     ✂️  descartada [${result.reason}]: ${job.title}`);
        continue;
      }
      approved++;

      // 3) Notifica e registra
      if (!isTelegramConfigured()) {
        // Sem Telegram: só mostra no log (modo teste) e não marca como vista,
        // pra você receber o histórico quando configurar o token.
        console.log(`     💎 (log) ${job.title} — ${job.company} [${job.location}] · ${job.url}`);
        continue;
      }

      const ok = await sendJob(job);
      if (ok) {
        markNotified(job);
        sent++;
        console.log(`     ✅ enviada: ${job.title} — ${job.company}`);
        // pausinha entre mensagens pra não estourar rate limit do Telegram
        await sleep(randomBetween(700, 1500));
      }
    }

    // Pausa humana entre buscas
    const { min, max } = config.delayBetweenSearches;
    await sleep(randomBetween(min, max));
  }

  console.log(
    `⛏️  Ciclo concluído: ${found} encontradas · ${approved} aprovadas · ${sent} enviadas · ${totalSeen()} no histórico.`
  );
}

/** Agenda o próximo ciclo com jitter aleatório. */
function scheduleNext(): void {
  const delay = config.pollIntervalMs + randomBetween(0, config.pollJitterMs);
  const next = new Date(Date.now() + delay);
  console.log(`😴 Próximo ciclo às ${next.toLocaleTimeString("pt-BR")} (em ~${Math.round(delay / 60000)} min).`);
  setTimeout(loop, delay);
}

async function loop(): Promise<void> {
  try {
    await runCycle();
  } catch (err) {
    console.error("❌ Erro inesperado no ciclo:", err);
  }
  if (!config.runOnce) scheduleNext();
}

async function main(): Promise<void> {
  console.log("💎 garimpo — bot de vagas remotas do LinkedIn");

  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.warn(
      "⚠️  Telegram não configurado. As vagas vão só aparecer no log.\n" +
        "   Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env pra receber no celular."
    );
  }

  await launchBrowser();
  await sendText("💎 <b>garimpo</b> começou a garimpar suas vagas! ⛏️");

  await loop();

  if (config.runOnce) {
    await shutdown(0);
  }
}

async function shutdown(code = 0): Promise<void> {
  console.log("\n🛑 Encerrando garimpo...");
  await closeBrowser();
  closeDb();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch(async (err) => {
  console.error("💥 Falha fatal:", err);
  await shutdown(1);
});
