const BASE = "http://localhost:5000/api";

export async function fetchDecks() {
  const r = await fetch(`${BASE}/decks`);
  return r.json();
}

export async function createDeck(name, cards = []) {
  const r = await fetch(`${BASE}/decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, cards }),
  });
  return r.json();
}

export async function deleteDeck(id) {
  await fetch(`${BASE}/decks/${id}`, { method: "DELETE" });
}

export async function createCard(deckId, card) {
  await fetch(`${BASE}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...card, deck_id: deckId }),
  });
}

export async function updateCard(cardId, card) {
  await fetch(`${BASE}/cards/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

export async function deleteCard(cardId) {
  await fetch(`${BASE}/cards/${cardId}`, { method: "DELETE" });
}

export async function fetchScores() {
  const r = await fetch(`${BASE}/scores`);
  return r.json();
}

export async function saveScore(cardId, result) {
  await fetch(`${BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: cardId, result }),
  });
}

export async function resetAll() {
  await fetch(`${BASE}/reset`, { method: "POST" });
}
