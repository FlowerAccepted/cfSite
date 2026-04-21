const THEME_MODE_KEY = "cf-theme-mode";
const THEME_STYLE_KEY = "cf-theme-style";
const DARK_CLASS = "dark-theme";
const GLASS_CLASS = "theme-glass";
const ANTIQUE_CLASS = "theme-antique";

const VALID_MODES = ["light", "dark", "system"];
const VALID_STYLES = ["glass", "antique"];

function normalizeMode(mode) {
    return VALID_MODES.includes(mode) ? mode : "system";
}

function normalizeStyle(style) {
    return VALID_STYLES.includes(style) ? style : "glass";
}

function readMode() {
    return normalizeMode(localStorage.getItem(THEME_MODE_KEY));
}

function readStyle() {
    return normalizeStyle(localStorage.getItem(THEME_STYLE_KEY));
}

function isDarkByMode(mode) {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
}

function updateStatusText(statusEl, mode, style, suffix = "") {
    if (!statusEl) return;
    const modeMap = {
        light: "浅色模式",
        dark: "深色模式",
        system: "跟随系统",
    };
    const styleMap = {
        glass: "毛玻璃",
        antique: "简约仿古",
    };
    statusEl.textContent = `当前：${modeMap[mode] || "跟随系统"} + ${styleMap[style] || "毛玻璃"}${suffix}`;
}

async function fetchUserThemeSettings(apiBase) {
    if (!apiBase) return null;
    try {
        const res = await fetch(`${apiBase}/api/me`, { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        const settings = data?.profile?.settings || {};
        return {
            themeMode: normalizeMode(settings.themeMode),
            themeStyle: normalizeStyle(settings.themeStyle),
        };
    } catch {
        return null;
    }
}

async function saveUserThemeSettings(apiBase, { themeMode, themeStyle }) {
    if (!apiBase) return false;
    try {
        const res = await fetch(`${apiBase}/api/update-profile`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                settings: {
                    themeMode: normalizeMode(themeMode),
                    themeStyle: normalizeStyle(themeStyle),
                },
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

export function applyThemeStyle(style) {
    const next = normalizeStyle(style);
    document.documentElement.classList.toggle(GLASS_CLASS, next === "glass");
    document.documentElement.classList.toggle(ANTIQUE_CLASS, next === "antique");
    document.body.classList.toggle(GLASS_CLASS, next === "glass");
    document.body.classList.toggle(ANTIQUE_CLASS, next === "antique");
}

export async function initThemeMode({ apiBase } = {}) {
    const localMode = readMode();
    const localStyle = readStyle();
    applyThemeMode(localMode);
    applyThemeStyle(localStyle);

    if (typeof window.matchMedia === "function") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", () => {
            if (readMode() === "system") applyThemeMode("system");
        });
    }

    const serverSettings = await fetchUserThemeSettings(apiBase);
    if (serverSettings) {
        const { themeMode, themeStyle } = serverSettings;
        if (themeMode !== localMode) {
            localStorage.setItem(THEME_MODE_KEY, themeMode);
            applyThemeMode(themeMode);
        }
        if (themeStyle !== localStyle) {
            localStorage.setItem(THEME_STYLE_KEY, themeStyle);
            applyThemeStyle(themeStyle);
        }
    }
}

export async function initThemeSettings({ apiBase, modeGroupName = "theme-mode", styleGroupName = "theme-style", statusId = "theme-status" } = {}) {
    const modeRadios = Array.from(document.querySelectorAll(`input[name="${modeGroupName}"]`));
    const styleRadios = Array.from(document.querySelectorAll(`input[name="${styleGroupName}"]`));
    const styleSelect = document.querySelector(`select[name="${styleGroupName}"]`);
    const statusEl = document.getElementById(statusId);

    let themeMode = readMode();
    let themeStyle = readStyle();

    const serverSettings = await fetchUserThemeSettings(apiBase);
    if (serverSettings) {
        themeMode = serverSettings.themeMode;
        themeStyle = serverSettings.themeStyle;
        localStorage.setItem(THEME_MODE_KEY, themeMode);
        localStorage.setItem(THEME_STYLE_KEY, themeStyle);
        applyThemeMode(themeMode);
        applyThemeStyle(themeStyle);
    }

    for (const radio of modeRadios) {
        radio.checked = radio.value === themeMode;
    }
    for (const radio of styleRadios) {
        radio.checked = radio.value === themeStyle;
    }
    if (styleSelect) {
        styleSelect.value = themeStyle;
    }

    updateStatusText(statusEl, themeMode, themeStyle, serverSettings ? "（已同步账号）" : "（仅本机）");

    async function persistAndRender(nextMode, nextStyle) {
        themeMode = normalizeMode(nextMode);
        themeStyle = normalizeStyle(nextStyle);

        localStorage.setItem(THEME_MODE_KEY, themeMode);
        localStorage.setItem(THEME_STYLE_KEY, themeStyle);
        applyThemeMode(themeMode);
        applyThemeStyle(themeStyle);

        updateStatusText(statusEl, themeMode, themeStyle, "（保存中）");
        const synced = await saveUserThemeSettings(apiBase, { themeMode, themeStyle });
        updateStatusText(statusEl, themeMode, themeStyle, synced ? "（已同步账号）" : "（仅本机）");
    }

    for (const radio of modeRadios) {
        radio.addEventListener("change", () => {
            persistAndRender(radio.value, themeStyle);
        });
    }

    for (const radio of styleRadios) {
        radio.addEventListener("change", () => {
            persistAndRender(themeMode, radio.value);
        });
    }

    if (styleSelect) {
        styleSelect.addEventListener("change", () => {
            persistAndRender(themeMode, styleSelect.value);
        });
    }
}
