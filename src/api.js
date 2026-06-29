// API client for the server-authoritative backend.
//
// The server owns RNG, payouts, and balances. This module only sends actions
// and reads back authoritative results. It never computes an outcome or writes
// a balance — that's exactly the capability we removed from the client.

const BASE = "/api";
const TOKEN_KEY = "luckyfelt:token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(t) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

async function req(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    const e = new Error("Can't reach the casino server. Check your connection.");
    e.status = 0;
    throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON / empty */ }
  if (!res.ok) {
    const e = new Error(data?.error || `Request failed (${res.status})`);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

// ---- Auth / account ----
// Two-step sign-in: request a one-time code by email, then verify it for a token.
export function requestCode(email) {
  return req("/login/request", { method: "POST", body: { email }, auth: false });
}
export async function verifyCode(email, code) {
  const d = await req("/login/verify", { method: "POST", body: { email, code }, auth: false });
  setToken(d.token);
  return d;
}
export async function logout() {
  try { await req("/logout", { method: "POST" }); } catch { /* best effort */ }
  clearToken();
}
export function fetchMe() { return req("/me"); }
export function getConfig() { return req("/config", { auth: false }); }
export function atm() { return req("/atm", { method: "POST" }); }

// ---- Bets ----
export function betSlots(game, bet) { return req("/bet/slots", { method: "POST", body: { game, bet } }); }
export function betRoulette(bets) { return req("/bet/roulette", { method: "POST", body: { bets } }); }
export function betSicbo(bets) { return req("/bet/sicbo", { method: "POST", body: { bets } }); }
export function crapsRoll(bet, type) { return req("/bet/craps", { method: "POST", body: { bet, type } }); }

// ---- Poker (stateful) ----
export function pokerState() { return req("/poker/state"); }
export function pokerDeal(bet) { return req("/poker/deal", { method: "POST", body: { bet } }); }
export function pokerAdvance() { return req("/poker/advance", { method: "POST" }); }
export function pokerShowdown() { return req("/poker/showdown", { method: "POST" }); }
export function pokerFold() { return req("/poker/fold", { method: "POST" }); }
