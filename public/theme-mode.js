const THEME_MODE_KEY = "cf-theme-mode";
const DARK_CLASS = "dark-theme";
const VALID_MODES = ["light", "dark", "system"];

function normalizeMode(mode) {
    return VALID_MODES.includes(mode) ? mode : "system";
}

function readMode() {
    return normalizeMode(localStorage.getItem(THEME_MODE_KEY));
}

function isDarkByMode(mode) {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
}

function updateStatusText(statusEl, mode, suffix = "") {
    if (!statusEl) return;
    const map = {
        light: "浅色模式",
        dark: "深色模式",
        system: "跟随系统",
    };
    statusEl.textContent = `当前：${map[mode] || "跟随系统"}${suffix}`;
}

async function fetchUserThemeMode(apiBase) {
    if (!apiBase) return null;
    try {
        const res = await fetch(`${apiBase}/api/me`, { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        return normalizeMode(data?.profile?.settings?.themeMode);
    } catch {
        return null;
    }
}

async function saveUserThemeMode(apiBase, mode) {
    if (!apiBase) return false;
    try {
        const res = await fetch(`${apiBase}/api/update-profile`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                settings: { themeMode: mode },
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export function applyThemeMode(mode) {
    const next = normalizeMode(mode);
    const isDark = isDarkByMode(next);
    document.documentElement.classList.toggle(DARK_CLASS, isDark);
    document.body.classList.toggle(DARK_CLASS, isDark);
}

export async function initThemeMode({ apiBase } = {}) {
    const localMode = readMode();
    applyThemeMode(localMode);

    if (typeof window.matchMedia === "function") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", () => {
            if (readMode() === "system") applyThemeMode("system");
        });
    }

    const serverMode = await fetchUserThemeMode(apiBase);
    if (serverMode && serverMode !== localMode) {
        localStorage.setItem(THEME_MODE_KEY, serverMode);
        applyThemeMode(serverMode);
    }
}

export async function initThemeSettings({ apiBase, groupName = "theme-mode", statusId = "theme-status" } = {}) {
    const radios = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
    const statusEl = document.getElementById(statusId);

    let mode = readMode();
    const serverMode = await fetchUserThemeMode(apiBase);
    if (serverMode) {
        mode = serverMode;
        localStorage.setItem(THEME_MODE_KEY, mode);
        applyThemeMode(mode);
    }

    for (const radio of radios) {
        radio.checked = radio.value === mode;
    }
    updateStatusText(statusEl, mode, serverMode ? "（已同步账号）" : "（仅本机）");

    for (const radio of radios) {
        radio.addEventListener("change", async () => {
            const nextMode = normalizeMode(radio.value);
            localStorage.setItem(THEME_MODE_KEY, nextMode);
            applyThemeMode(nextMode);
            updateStatusText(statusEl, nextMode, "（保存中）");

            const synced = await saveUserThemeMode(apiBase, nextMode);
            updateStatusText(statusEl, nextMode, synced ? "（已同步账号）" : "（仅本机）");
        });
    }
}
