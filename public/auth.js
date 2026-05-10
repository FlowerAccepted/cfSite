async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function setupAuth(API_BASE) {
    function normalizeApiBase(apiBase) {
        if (typeof apiBase !== "string") return "";
        return apiBase.trim().replace(/\/+$/, "");
    }

    function apiBasesWithFallback(apiBase) {
        const normalized = normalizeApiBase(apiBase);
        const bases = normalized ? [normalized, ""] : [""];
        return [...new Set(bases)];
    }

    async function apiFetch(path, options = {}) {
        let lastRes = null;
        let lastErr = null;
        for (const base of apiBasesWithFallback(API_BASE)) {
            try {
                const res = await fetch(`${base}${path}`, {
                    credentials: "include",
                    ...options,
                    headers: {
                        "Content-Type": "application/json",
                        ...(options.headers || {}),
                    },
                });
                lastRes = res;
                if (res.ok) return res;
            } catch (err) {
                lastErr = err;
            }
        }
        if (lastRes) return lastRes;
        throw lastErr || new Error("api request failed");
    }

    window.register = async function () {
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const confirm = document.getElementById("confirm-password")?.value;
        const msg = document.getElementById("msg");

        if (confirm !== undefined && password !== confirm) {
            msg.textContent = "两次输入的密码不一致";
            return;
        }
        const passwordHash = await sha256Hex(password);
        const res = await apiFetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                password: passwordHash,
            }),
        });

        msg.textContent = await res.text();
        if (!res.ok) return;
        msg.classList.replace("text-red-500", "text-green-500");
        document.getElementById("register-success").classList.replace("hidden", "flex");
        document.getElementById("go-login").onclick = () => {
        location.href = "/login";
        };
    };

    window.login = async function () {
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const msg = document.getElementById("msg");
        const passwordHash = await sha256Hex(password);

        const res = await apiFetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                password: passwordHash,
            }),
        });
        if (!res.ok) return;
        location.href = "/";
    };

    window.logout = async function () {
        await apiFetch("/api/logout", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        });
        location.href = "/";
    };
}
