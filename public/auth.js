export function setupAuth(API_BASE) {
  async function apiFetch(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  }

  window.register = async function () {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");

    const res = await apiFetch("/api/register", {
      method: "POST",
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    msg.textContent = await res.text();
  };

  window.login = async function () {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");

    const res = await apiFetch("/api/login", {
      method: "POST",
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    msg.textContent = await res.text();
  };
}
