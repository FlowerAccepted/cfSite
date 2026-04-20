const THEME_MODE_KEY = "cf-theme-mode";
const DARK_CLASS = "dark-theme";

function readMode() {
    const mode = localStorage.getItem(THEME_MODE_KEY);
    return mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
}

function isDarkByMode(mode) {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
}

export function applyThemeMode(mode) {
    const isDark = isDarkByMode(mode);
    document.documentElement.classList.toggle(DARK_CLASS, isDark);
    document.body.classList.toggle(DARK_CLASS, isDark);
}

export function initThemeMode() {
    const mode = readMode();
    applyThemeMode(mode);

    if (typeof window.matchMedia === "function") {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", () => {
            if (readMode() === "system") applyThemeMode("system");
        });
    }
}

export function initThemeSettings({ groupName = "theme-mode", statusId = "theme-status" } = {}) {
    const mode = readMode();
    const radios = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
    const statusEl = document.getElementById(statusId);

    for (const radio of radios) {
        radio.checked = radio.value === mode;
    }

    const updateStatus = (nextMode) => {
        if (!statusEl) return;
        const map = {
            light: "浅色模式",
            dark: "深色模式",
            system: "跟随系统",
        };
        statusEl.textContent = `当前：${map[nextMode] || "跟随系统"}`;
    };

    updateStatus(mode);

    for (const radio of radios) {
        radio.addEventListener("change", () => {
            const nextMode = radio.value;
            if (!["light", "dark", "system"].includes(nextMode)) return;
            localStorage.setItem(THEME_MODE_KEY, nextMode);
            applyThemeMode(nextMode);
            updateStatus(nextMode);
        });
    }
}
