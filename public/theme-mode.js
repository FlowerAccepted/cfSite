const THEME_MODE_KEY = "cf-theme-mode";
const THEME_STYLE_KEY = "cf-theme-style";
const DARK_CLASS = "dark-theme";
const STYLE_CLASS_PREFIX = "theme-";

const VALID_MODES = ["light", "dark", "system"];
const VALID_STYLES = [
    "glass",
    "antique",
    "ocean",
    "sunset",
    "forest",
    "rose",
    "slate",
    "aurora",
    "antique-flat",
    "ocean-flat",
    "sunset-flat",
    "forest-flat",
    "rose-flat",
    "slate-flat",
    "aurora-flat",
];

const MODE_LABELS = {
    light: "浅色模式",
    dark: "深色模式",
    system: "跟随系统",
};

const STYLE_LABELS = {
    glass: "原版毛玻璃",
    antique: "简约仿古",
    ocean: "海洋蓝",
    sunset: "晚霞橙",
    forest: "森绿",
    rose: "樱花粉",
    slate: "石墨灰",
    aurora: "极光霓彩",
    "antique-flat": "简约仿古（纯色）",
    "ocean-flat": "海洋蓝（纯色）",
    "sunset-flat": "晚霞橙（纯色）",
    "forest-flat": "森绿（纯色）",
    "rose-flat": "樱花粉（纯色）",
    "slate-flat": "石墨灰（纯色）",
    "aurora-flat": "极光霓彩（纯色）",
};

function normalizeMode(mode) {
    return VALID_MODES.includes(mode) ? mode : "system";
}

function normalizeStyle(style) {
    return VALID_STYLES.includes(style) ? style : "glass";
}

function styleClassName(style) {
    return `${STYLE_CLASS_PREFIX}${normalizeStyle(style)}`;
}

function normalizeApiBase(apiBase) {
    if (typeof apiBase !== "string") return "";
    return apiBase.trim().replace(/\/+$/, "");
}

function apiUrl(apiBase, path) {
    const base = normalizeApiBase(apiBase);
    return `${base}${path}`;
}

function expandStyleClasses(style) {
    const next = normalizeStyle(style);
    if (next.endsWith("-flat")) {
        const base = next.slice(0, -5);
        return [`theme-${base}`, "theme-flat", `theme-${base}-flat`];
    }
    return [`theme-${next}`];
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
    statusEl.textContent = `当前：${MODE_LABELS[mode] || "跟随系统"} + ${STYLE_LABELS[style] || "原版毛玻璃"}${suffix}`;
}

function extractServerThemeSettings(data) {
    const settings = data?.profile?.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;

    const hasMode = VALID_MODES.includes(settings.themeMode);
    const hasStyle = VALID_STYLES.includes(settings.themeStyle);
    if (!hasMode && !hasStyle) return null;

    return {
        themeMode: hasMode ? normalizeMode(settings.themeMode) : null,
        themeStyle: hasStyle ? normalizeStyle(settings.themeStyle) : null,
    };
}

async function fetchUserThemeSettings(apiBase) {
    try {
        const res = await fetch(apiUrl(apiBase, "/api/me"), { credentials: "include" });
        if (!res.ok) return null;
        const data = await res.json();
        return extractServerThemeSettings(data);
    } catch {
        return null;
    }
}

async function saveUserThemeSettings(apiBase, { themeMode, themeStyle }) {
    try {
        const res = await fetch(apiUrl(apiBase, "/api/update-profile"), {
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
    document.body.classList.remove(DARK_CLASS);
}

export function applyThemeStyle(style) {
    const nextClasses = new Set(expandStyleClasses(style));
    for (const candidate of VALID_STYLES) {
        const cls = styleClassName(candidate);
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
    }
    document.documentElement.classList.remove("theme-flat");
    document.body.classList.remove("theme-flat");
    for (const cls of nextClasses) {
        document.documentElement.classList.add(cls);
    }
}

export async function initThemeMode({ apiBase } = {}) {
    let themeMode = readMode();
    let themeStyle = readStyle();
    applyThemeMode(themeMode);
    applyThemeStyle(themeStyle);

    if (typeof window.matchMedia === "function") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", () => {
            if (readMode() === "system") applyThemeMode("system");
        });
    }

    const serverSettings = await fetchUserThemeSettings(apiBase);
    if (!serverSettings) return;

    if (serverSettings.themeMode && serverSettings.themeMode !== themeMode) {
        themeMode = serverSettings.themeMode;
        localStorage.setItem(THEME_MODE_KEY, themeMode);
        applyThemeMode(themeMode);
    }

    if (serverSettings.themeStyle && serverSettings.themeStyle !== themeStyle) {
        themeStyle = serverSettings.themeStyle;
        localStorage.setItem(THEME_STYLE_KEY, themeStyle);
        applyThemeStyle(themeStyle);
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
    const hasServerSettings = Boolean(serverSettings?.themeMode || serverSettings?.themeStyle);
    if (serverSettings?.themeMode) {
        themeMode = serverSettings.themeMode;
        localStorage.setItem(THEME_MODE_KEY, themeMode);
        applyThemeMode(themeMode);
    }
    if (serverSettings?.themeStyle) {
        themeStyle = serverSettings.themeStyle;
        localStorage.setItem(THEME_STYLE_KEY, themeStyle);
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

    updateStatusText(statusEl, themeMode, themeStyle, hasServerSettings ? "（已同步账号）" : "（仅本机）");

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
