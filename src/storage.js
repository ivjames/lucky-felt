// localStorage-backed storage, API-compatible with the Claude artifact version

export async function loadUser(email) {
  try {
    const raw = localStorage.getItem(`user:${email.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveUser(email, data) {
  try {
    localStorage.setItem(`user:${email.toLowerCase()}`, JSON.stringify(data));
  } catch {}
}
