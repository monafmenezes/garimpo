import { config } from "../config.js";
import type { RawJob } from "../types.js";

/**
 * Notificador do Telegram. Usa a Bot API via fetch (Node 20+ tem fetch nativo).
 * Precisa de TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env.
 */

const API = "https://api.telegram.org";

/** Telegram está configurado? (token + chat id presentes no .env) */
export function isTelegramConfigured(): boolean {
  return Boolean(config.telegram.botToken && config.telegram.chatId);
}

/** Escapa os caracteres que o modo HTML do Telegram exige. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Bandeira + rótulo do país da vaga, pra deixar claro de onde ela veio. */
function countryTag(country: RawJob["country"]): string {
  if (country === "PT") return "🇵🇹 Portugal";
  return "🇧🇷 Brasil";
}

function formatMessage(job: RawJob): string {
  const title = escapeHtml(job.title);
  const company = escapeHtml(job.company);
  const location = escapeHtml(job.location);
  const posted = job.postedAt ? `\n🕒 ${escapeHtml(job.postedAt)}` : "";

  return [
    `💎 <b>${title}</b>`,
    `🏢 ${company}`,
    `📍 ${location}`,
    `${countryTag(job.country)}${posted}`,
    ``,
    `🔗 <a href="${job.url}">Ver vaga no LinkedIn</a>`,
  ].join("\n");
}

/** Envia uma vaga aprovada pro seu Telegram. Retorna true se deu certo. */
export async function sendJob(job: RawJob): Promise<boolean> {
  const { botToken, chatId } = config.telegram;
  // Sem configuração, retorna false silenciosamente — o aviso já é dado
  // uma única vez no boot (ver main()).
  if (!botToken || !chatId) return false;

  try {
    const res = await fetch(`${API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(job),
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`❌ Telegram respondeu ${res.status}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("❌ Falha ao enviar mensagem no Telegram:", err);
    return false;
  }
}

/** Mensagem simples de texto (usado no boot pra avisar que o bot subiu). */
export async function sendText(text: string): Promise<void> {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return;
  try {
    await fetch(`${API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {
    /* silencioso — não é crítico */
  }
}
