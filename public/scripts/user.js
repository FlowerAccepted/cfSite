import { ExtendedRenderer, renderExtendedMarkdown } from "/scripts/markdown-renderer.js";

const DEFAULT_BIO = "这个人很懒，什么都没写。";
const DEFAULT_INTRO = "这个人很懒，连个人简介都没写。";
const DEFAULT_AVATAR =
    "https://cdn.jsdmirror.com/gh/FlowerAccepted/gh-src-for-cfsite-dns@main/defult_avatar.png";

function parseUidFromPath() {
    // 优先使用服务器端传递的 uid
    if (window.__USER_UID__) return window.__USER_UID__;
    
    const m = window.location.pathname.match(/^\/user\/(\d+)\/?$/);
    if (m) return m[1];
    const q = new URLSearchParams(window.location.search).get("uid");
    return /^\d+$/.test(q || "") ? q : "";
}

function apiUrl(path) {
    const base = String(window.__USER_API_BASE__ || "").trim().replace(/\/+$/, "");
    return `${base}${path}`;
}

export async function initUserPage() {
    const uid = parseUidFromPath();
    const profileCard = document.getElementById("profile-card");
    const notFound = document.getElementById("user-not-found");
    const avatarEl = document.getElementById("avatar");
    const nicknameEl = document.getElementById("nickname");
    const usernameEl = document.getElementById("username");
    const bioEl = document.getElementById("bio-display");
    const introRenderEl = document.getElementById("intro-render");

    if (!uid) {
        notFound?.classList.remove("hidden");
        return;
    }

    try {
        const res = await fetch(apiUrl(`/api/user?uid=${uid}`), {
            credentials: "include",
        });
        if (!res.ok) {
            notFound?.classList.remove("hidden");
            return;
        }

        const data = await res.json();
        const p = data?.profile || {};

        if (avatarEl) avatarEl.src = p.avatar || DEFAULT_AVATAR;
        if (nicknameEl) nicknameEl.textContent = p.nickname || data.username || `用户 ${uid}`;
        if (usernameEl) usernameEl.textContent = `@${data.username || uid}`;
        if (bioEl) bioEl.textContent = p.bio?.trim() || DEFAULT_BIO;

        const renderer = new ExtendedRenderer();
        const intro = String(p.intro || "").trim() || DEFAULT_INTRO;
        if (introRenderEl) introRenderEl.innerHTML = renderExtendedMarkdown(intro, renderer);

        profileCard?.classList.remove("hidden");
    } catch {
        notFound?.classList.remove("hidden");
    }
}
