import { marked, Renderer } from "https://cdn.jsdmirror.com/npm/marked/lib/marked.esm.js";

const DEFAULT_BIO = "这个人很懒，什么都没写。";
const DEFAULT_INTRO = "这个人很懒，连个人简介都没写。";
const DEFAULT_AVATAR =
    "https://cdn.jsdmirror.com/gh/FlowerAccepted/gh-src-for-cfsite-dns@main/defult_avatar.png";

class IntroRenderer extends Renderer {
    link({ href, tokens }) {
        const text = (tokens || []).map((t) => t.text || "").join("");
        return `<a href="${href}" class="basic-href" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
}

function showUnauthModal(unauthModal, profileCard) {
    profileCard?.classList.add("hidden");
    unauthModal?.classList.remove("hidden");
    unauthModal?.classList.add("flex");
}

function hideUnauthModal(unauthModal) {
    unauthModal?.classList.remove("flex");
    unauthModal?.classList.add("hidden");
}

function renderMarkdown(targetEl, markdown, renderer) {
    if (!targetEl) return;
    const source = (markdown || "").trim() || DEFAULT_INTRO;
    targetEl.innerHTML = marked.parse(source, { renderer });
}

export function initWhoami() {
    const API_BASE = window.__WHOAMI_API_BASE__;
    if (!API_BASE) {
        throw new Error("API_BASE is missing on window.__WHOAMI_API_BASE__");
    }

    const profileCard = document.getElementById("profile-card");
    const unauthModal = document.getElementById("un-auth");
    const goLoginBtn = document.getElementById("go-login");

    const avatarEl = document.getElementById("avatar");
    const nicknameEl = document.getElementById("nickname");
    const usernameEl = document.getElementById("username");

    const bioDisplayEl = document.getElementById("bio-display");
    const bioEditorEl = document.getElementById("bio-editor");
    const bioInputEl = document.getElementById("bio-input");
    const bioCancelBtn = document.getElementById("bio-cancel");
    const bioSaveBtn = document.getElementById("bio-save");

    const introEditBtn = document.getElementById("intro-edit-btn");
    const introViewEl = document.getElementById("intro-view");
    const introRenderEl = document.getElementById("intro-render");
    const introEditorEl = document.getElementById("intro-editor");
    const introInputEl = document.getElementById("intro-input");
    const introPreviewEl = document.getElementById("intro-preview");
    const introCancelBtn = document.getElementById("intro-cancel");
    const introSaveBtn = document.getElementById("intro-save");

    const introRenderer = new IntroRenderer();

    let currentBio = "";
    let currentIntro = "";

    function renderBio() {
        if (!bioDisplayEl) return;
        bioDisplayEl.textContent = currentBio.trim() || DEFAULT_BIO;
    }

    function enterBioEditMode() {
        if (!bioInputEl || !bioDisplayEl || !bioEditorEl) return;
        bioInputEl.value = currentBio;
        bioDisplayEl.classList.add("hidden");
        bioEditorEl.classList.remove("hidden");
        bioEditorEl.classList.add("flex");
        bioInputEl.focus();
    }

    function exitBioEditMode() {
        if (!bioDisplayEl || !bioEditorEl) return;
        bioEditorEl.classList.remove("flex");
        bioEditorEl.classList.add("hidden");
        bioDisplayEl.classList.remove("hidden");
    }

    function enterIntroEditMode() {
        if (!introInputEl || !introEditBtn || !introViewEl || !introEditorEl) return;
        introInputEl.value = currentIntro;
        renderMarkdown(introPreviewEl, currentIntro, introRenderer);
        introEditBtn.classList.add("hidden");
        introViewEl.classList.add("hidden");
        introEditorEl.classList.remove("hidden");
    }

    function exitIntroEditMode() {
        if (!introEditBtn || !introViewEl || !introEditorEl) return;
        introEditorEl.classList.add("hidden");
        introEditBtn.classList.remove("hidden");
        introViewEl.classList.remove("hidden");
    }

    async function updateProfile(patch) {
        try {
            const res = await fetch(`${API_BASE}/api/update-profile`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                if (res.status === 401) {
                    showUnauthModal(unauthModal, profileCard);
                    return null;
                }
                throw new Error(await res.text());
            }
            return await res.json();
        } catch (err) {
            console.error("update-profile failed:", err);
            showUnauthModal(unauthModal, profileCard);
            return null;
        }
    }

    async function loadMe() {
        try {
            const res = await fetch(`${API_BASE}/api/me`, {
                credentials: "include",
            });
            if (!res.ok) {
                showUnauthModal(unauthModal, profileCard);
                return;
            }

            const data = await res.json();
            const p = data.profile || {};
            currentBio = p.bio || "";
            currentIntro = p.intro || "";

            hideUnauthModal(unauthModal);
            if (avatarEl) avatarEl.src = p.avatar || DEFAULT_AVATAR;
            if (nicknameEl) nicknameEl.textContent = p.nickname || data.username;
            if (usernameEl) usernameEl.textContent = "@" + data.username;
            renderBio();
            renderMarkdown(introRenderEl, currentIntro, introRenderer);
            profileCard?.classList.remove("hidden");
        } catch (err) {
            console.error("loadMe failed:", err);
            showUnauthModal(unauthModal, profileCard);
        }
    }

    bioDisplayEl?.addEventListener("click", enterBioEditMode);
    bioCancelBtn?.addEventListener("click", exitBioEditMode);
    bioSaveBtn?.addEventListener("click", async () => {
        if (!bioInputEl) return;
        const nextBio = bioInputEl.value;
        const updated = await updateProfile({ bio: nextBio });
        if (!updated) return;
        currentBio = updated.bio ?? nextBio;
        renderBio();
        exitBioEditMode();
    });

    introEditBtn?.addEventListener("click", enterIntroEditMode);
    introInputEl?.addEventListener("input", () => {
        renderMarkdown(introPreviewEl, introInputEl.value, introRenderer);
    });
    introCancelBtn?.addEventListener("click", exitIntroEditMode);
    introSaveBtn?.addEventListener("click", async () => {
        if (!introInputEl) return;
        const nextIntro = introInputEl.value;
        const updated = await updateProfile({ intro: nextIntro });
        if (!updated) return;
        currentIntro = updated.intro ?? nextIntro;
        renderMarkdown(introRenderEl, currentIntro, introRenderer);
        exitIntroEditMode();
    });

    goLoginBtn?.addEventListener("click", () => {
        location.href = "/login";
    });

    loadMe();
}
