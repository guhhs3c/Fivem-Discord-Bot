import OpenAI from 'openai';
import { config } from '../config/config.js';

// =======================================================
// SNIFOX AI (https://snifoxai.com) — AI Gateway, OpenAI-compatible
// -------------------------------------------------------
// Dipakai sebagai fallback !ask kalau rule-based intent matching
// (lihat commands/general/ask.js) gak nemu jawaban. AI dapat menjawab
// pertanyaan umum, bukan hanya pertanyaan tentang bot.
//
// Requirement di .env:
//   SNIFOX_API_KEY=snfx-xxxxxxxx   (wajib, dari dashboard SnifoxAI)
//   SNIFOX_MODEL=openai/gpt-4o-mini (opsional, ganti sesuai model yang
//                                    kamu mau pakai — cek daftar model
//                                    & harga di https://snifoxai.com/models.
//                                    Pilih model kecil/murah biar !ask cepat.)
//
// Kalau SNIFOX_API_KEY kosong, fitur AI otomatis nonaktif dan !ask
// tetap jalan pakai rule-based matching biasa — bot gak akan crash.
// =======================================================

// Batasi panjang pertanyaan yang dikirim ke AI — lebih cepat, lebih murah,
// dan mencegah orang iseng ngirim teks raksasa buat nge-spam token.
const MAX_QUESTION_LENGTH = 300;

// Cache jawaban sementara di memori (per teks pertanyaan yang sama persis).
// Bikin !ask instan buat pertanyaan yang sering diulang, dan hemat kuota API.
// key -> { value, expiresAt }
const responseCache = new Map();
let lastAskCacheHit = false;
const CACHE_MAX_ENTRIES = 200;

let client = null;

function getClient() {
  if (!config.ai.enabled) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
      timeout: config.ai.timeout,
      maxRetries: 0, // gagal cepat — biar ask.js langsung fallback, gak bikin user nunggu lama
    });
  }
  return client;
}

function buildSystemPrompt(botContext) {
  return (
    `Kamu adalah asisten AI untuk bot Discord bernama "${config.bot.name}" (versi ${config.bot.version}).\n` +
    `Prefix command bot ini adalah "${config.bot.prefix}".\n\n` +
    `ATURAN UTAMA:\n` +
    `1. Jawab pertanyaan user secara umum dengan akurat dan membantu. Kamu BOLEH menjawab topik seperti FiveM, gaming, coding, teknologi, matematika, pengetahuan umum, dan topik aman lainnya.\n` +
    `2. Jika pertanyaan berkaitan dengan STRONAUT, gunakan INFO BOT di bawah sebagai sumber utama agar tidak mengarang nama command, fitur, atau status.\n` +
    `3. Jika user menanyakan status server secara real-time tetapi data tidak tersedia di INFO BOT, jelaskan keterbatasannya dan arahkan ke command bot yang sesuai jika ada. Jangan mengarang status.\n` +
    `4. Jawab dalam Bahasa Indonesia yang santai, jelas, dan langsung ke inti.\n` +
    `5. Jangan mengaku sebagai manusia dan jangan mengarang fakta yang tidak kamu ketahui.\n\n` +
    `INFO BOT (khusus untuk pertanyaan tentang STRONAUT):\n${botContext}`
  );
}

function cacheKey(question) {
  return question.trim().toLowerCase();
}

function readCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache(key, value) {
  // Buang entry paling lama kalau cache kepenuhan (FIFO sederhana, cukup buat FAQ bot).
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + config.ai.cacheTtl });
}

// Urutan model yang dicoba kalau model utama (config.ai.model) gagal.
// "gpt-5-nano" ditaruh sebagai jaring pengaman terakhir karena paling
// kecil/cepat/reliable — kalau ini pun gagal, kemungkinan besar masalahnya
// di jaringan/API key, bukan di model tertentu.
const FALLBACK_MODEL_CHAIN = ['openai/gpt-5-nano'];

function describeApiError(err) {
  // SDK openai/axios biasanya nyimpen detail asli di err.status +
  // err.error / err.response.data — bukan cuma err.message yang sering
  // generic ("Request timed out.", dll). Kita bongkar semuanya biar
  // kelihatan jelas di log, tanpa perlu curl manual tiap kali debug.
  const status = err?.status ?? err?.response?.status ?? '?';
  const body = err?.error ?? err?.response?.data ?? err?.body;
  const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '(tidak ada body)';
  return `status=${status} | message="${err?.message}" | body=${bodyStr}`;
}

async function callModel(openai, model, trimmedQuestion, botContext) {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3, // rendah biar gak terlalu "kreatif"/ngarang
    max_tokens: 400, // cukup buat jawaban FAQ singkat, jaga respons tetap cepat
    messages: [
      { role: 'system', content: buildSystemPrompt(botContext) },
      { role: 'user', content: trimmedQuestion },
    ],
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('SnifoxAI tidak mengembalikan jawaban (response kosong).');
  return reply;
}

/**
 * Tanya ke SnifoxAI, dibatasi ketat cuma seputar bot.
 * Otomatis fallback ke model cadangan yang lebih kecil/cepat kalau model
 * utama gagal (timeout, error API, dll) — dan log detail error ASLI ke
 * console tiap percobaan gagal, biar gampang didiagnosis dari log bot
 * tanpa perlu curl manual.
 * @param {string} question - pertanyaan mentah dari user
 * @param {string} botContext - ringkasan command/fitur bot (dibangun di ask.js)
 * @returns {Promise<string|null>} - jawaban teks, atau null kalau dianggap di luar topik
 */
export async function askSnifoxAI(question, botContext) {
  const openai = getClient();
  if (!openai) {
    throw new Error('SnifoxAI belum diaktifkan (SNIFOX_API_KEY kosong di .env)');
  }

  const trimmedQuestion = question.trim().slice(0, MAX_QUESTION_LENGTH);
  const key = cacheKey(trimmedQuestion);

  const cached = readCache(key);
  if (cached !== undefined) {
    lastAskCacheHit = true;
    return cached;
  }
  lastAskCacheHit = false;

  // Susun daftar model yang dicoba: model utama dulu, baru fallback chain
  // (dedup biar gak nyoba model yang sama dua kali kalau kebetulan sama).
  const modelsToTry = [config.ai.model, ...FALLBACK_MODEL_CHAIN].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );

  let lastErr = null;
  for (const model of modelsToTry) {
    try {
      const reply = await callModel(openai, model, trimmedQuestion, botContext);
      writeCache(key, reply);
      lastAskCacheHit = false;
      if (model !== config.ai.model) {
        console.warn(`[snifoxAI] Model utama "${config.ai.model}" gagal, berhasil pakai fallback "${model}".`);
      }
      return reply;
    } catch (err) {
      lastErr = err;
      console.error(`[snifoxAI] Gagal pakai model "${model}": ${describeApiError(err)}`);
      // lanjut coba model berikutnya di chain
    }
  }

  // Semua model di chain gagal — lempar error terakhir (dengan detail asli)
  // biar ask.js tetap bisa kasih fallback message seperti biasa.
  throw lastErr || new Error('SnifoxAI gagal tanpa detail error.');
}

/**
 * Cek cepat apakah SnifoxAI sudah dikonfigurasi (dipakai di !ping atau debug).
 */
export function isSnifoxAIConfigured() {
  return config.ai.enabled;
}

/**
 * True kalau pemanggilan ask terakhir dilayani dari cache
 * (jadi tidak consumiu request API baru).
 */
export function wasLastAskCacheHit() {
  return lastAskCacheHit;
}