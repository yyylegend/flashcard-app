const BASE = `${import.meta.env.VITE_API_BASE}/api`;

export function getToken() { return localStorage.getItem("fc_token") || ""; }
export function setToken(t) { localStorage.setItem("fc_token", t); }
export function clearToken() { localStorage.removeItem("fc_token"); }

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` };
}

export async function login(username, password) {
  const r = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return r.json();
}

export async function fetchDecks() {
  const r = await fetch(`${BASE}/decks`);
  return r.json();
}

export async function createDeck(name, cards = []) {
  const r = await fetch(`${BASE}/decks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, cards }),
  });
  return r.json();
}

export async function deleteDeck(id) {
  await fetch(`${BASE}/decks/${id}`, { method: "DELETE", headers: authHeaders() });
}

export async function createCard(deckId, card) {
  await fetch(`${BASE}/cards`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...card, deck_id: deckId }),
  });
}

export async function updateCard(cardId, card) {
  await fetch(`${BASE}/cards/${cardId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(card),
  });
}

export async function deleteCard(cardId) {
  await fetch(`${BASE}/cards/${cardId}`, { method: "DELETE", headers: authHeaders() });
}

export async function fetchScores() {
  const r = await fetch(`${BASE}/scores`, { headers: authHeaders() });
  return r.json();
}

export async function saveScore(cardId, result) {
  await fetch(`${BASE}/scores`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ card_id: cardId, result }),
  });
}

export async function resetAll() {
  await fetch(`${BASE}/reset`, { method: "POST", headers: authHeaders() });
}

export async function fetchNotes() {
  const r = await fetch(`${BASE}/notes`, { headers: authHeaders() });
  return r.json();
}

export async function fetchNote(id) {
  const r = await fetch(`${BASE}/notes/${id}`, { headers: authHeaders() });
  return r.json();
}

export async function createNote(data) {
  const r = await fetch(`${BASE}/notes`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateNote(id, data) {
  await fetch(`${BASE}/notes/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id) {
  await fetch(`${BASE}/notes/${id}`, { method: "DELETE", headers: authHeaders() });
}
