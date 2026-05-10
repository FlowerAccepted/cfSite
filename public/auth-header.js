function sanitizeAvatarUrl(value) {
    if (!value || typeof value !== "string") return null;
    try {
        const u = new URL(value, window.location.origin);
        if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {
        return null;
    }
    return null;
}

function buildLink(href, text) {
    const a = document.createElement("a");
    a.className = "glass-btn";
    a.href = href;
    a.textContent = text;
    return a;
}

export async function initAuthHeader(API_BASE) {
    const el = document.getElementById("auth-area");
    if (!el) return;

    let res;
    try {
        res = await fetch(`${API_BASE}/api/me`, {
            credentials: "include",
        });
    } catch (err) {
        console.warn("auth header fetch failed:", err);
        el.textContent = "";
        el.append(buildLink("/login", "登录"), buildLink("/register", "注册"));
        return;
    }

    el.textContent = "";

    if (!res.ok) {
        el.append(buildLink("/login", "登录"), buildLink("/register", "注册"));
        return;
    }

    const user = await res.json();
    const fallbackAvatar =
        "https://cdn.jsdmirror.com/gh/FlowerAccepted/gh-src-for-cfsite-dns@main/defult_avatar.png";
    const avatar = sanitizeAvatarUrl(user?.profile?.avatar) || fallbackAvatar;

    const root = document.createElement("div");
    root.className = "relative group inline-block";

    const img = document.createElement("img");
    img.src = avatar;
    img.alt = "用户头像";
    img.className = "w-8 h-8 rounded-full cursor-pointer";

    const menu = document.createElement("div");
    menu.className =
        "absolute right-0 top-full pt-2 hidden group-hover:grid grid-cols-1 gap-2 list-panel w-64";

    const whoamiLink = document.createElement("a");
    whoamiLink.className = "list-btn block px-4 py-2 text-center hover:bg-white/10";
    whoamiLink.href = "/whoami";
    whoamiLink.textContent = "个人中心";

    const myArticlesLink = document.createElement("a");
    myArticlesLink.className = "list-btn block px-4 py-2 text-center hover:bg-white/10";
    myArticlesLink.href = "/article/mine";
    myArticlesLink.textContent = "我的文章";

    const settingsLink = document.createElement("a");
    settingsLink.className = "list-btn block px-4 py-2 text-center hover:bg-white/10";
    settingsLink.href = "/settings";
    settingsLink.textContent = "个人设置";

    const logoutLink = document.createElement("a");
    logoutLink.className = "list-btn block px-4 py-2 text-center hover:bg-white/10";
    logoutLink.href = "/logout";
    logoutLink.textContent = "退出登录";

    menu.append(whoamiLink, myArticlesLink, settingsLink, logoutLink);
    root.append(img, menu);
    el.append(root);
}
