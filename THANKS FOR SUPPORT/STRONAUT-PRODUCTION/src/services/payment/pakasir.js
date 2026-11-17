// =======================================================
// Klien minimal Pakasir API v2 (https://pakasir.com) — tanpa dependency tambahan.
// Env: PAKASIR_SLUG (alias: PAKASIR_PROJECT), PAKASIR_API_KEY
// Docs: https://pakasir.com/p/create-transaction , /p/transaction-status
// =======================================================

const BASE = 'https://app.pakasir.com';

export function pakasirConfig() {
  return {
    slug: process.env.PAKASIR_SLUG || process.env.PAKASIR_PROJECT || '',
    apiKey: process.env.PAKASIR_API_KEY || '',
  };
}

export function isPaymentConfigured() {
  const c = pakasirConfig();
  return Boolean(c.slug && c.apiKey);
}

async function request(path, { method = 'GET', body } = {}) {
  const c = pakasirConfig();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'X-Api-Key': c.apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json) {
    const msg = json?.error || json?.message || `HTTP ${res.status}`;
    const err = new Error(`Pakasir: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Buat transaksi QRIS (find-or-create: order_id sama => hasil sama).
 * Return: { txn_id, order_id, amount, fee, total_payment, qr_string, expired_at, is_sandbox }
 */
export function createQrisTransaction({ orderId, amount }) {
  const { slug } = pakasirConfig();
  return request(`/api/v2/create-transaction/${encodeURIComponent(slug)}/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    body: { method: 'qris', amount },
  });
}

/**
 * Status transaksi. status: 'pending' | 'completed' | 'canceled'
 * Batas Pakasir: 1 request / 4 detik per transaksi.
 */
export function getTransactionStatus(txnId) {
  const { slug } = pakasirConfig();
  return request(`/api/v2/transaction-status/${encodeURIComponent(slug)}/${encodeURIComponent(txnId)}`);
}

export function paymentLink(txnId) {
  return `${BASE}/pay-v2/${encodeURIComponent(txnId)}?qris_only=1`;
}

/**
 * Batalkan transaksi di Pakasir (best-effort, endpoint v1 yang masih didukung).
 * Melempar error kalau gagal — pemanggil harus memutuskan apa yang dilakukan.
 */
export async function cancelTransaction({ orderId, amount }) {
  const c = pakasirConfig();
  const res = await fetch(`${BASE}/api/transactioncancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: c.slug, order_id: orderId, amount, api_key: c.apiKey }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Pakasir cancel: HTTP ${res.status}`);
}
