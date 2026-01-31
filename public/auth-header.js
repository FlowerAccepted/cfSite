export async function initAuthHeader(API_BASE) {
    const el = document.getElementById("auth-area");
    if (!el) return;

    // 尝试访问一个需要登录的接口
    const res = await fetch(`${API_BASE}/api/me`, {
        credentials: "include",
    });

    // 未登录
    if (!res.ok) {
        el.innerHTML = `
      <a class="glass-btn" href="/login">登录</a>
      <a class="glass-btn" href="/register">注册</a>
    `;
        return;
    }

    // 已登录
    const user = await res.json();
    const avatar = user.profile?.avatar ?? "/default-avatar.png";

    el.innerHTML = `
    <div class="relative group inline-block">
        <img src="${avatar}" class="w-8 h-8 rounded-full cursor-pointer" />
        <div
            class="absolute right-0 top-full pt-2
                opacity-0 pointer-events-none
                group-hover:opacity-100
                group-hover:pointer-events-auto
                grid grid-cols-2 gap-2
                list-panel w-64">
            <a class="list-btn block px-4 py-2 text-center hover:bg-white/10"
            href="/profile">
            个人中心
            </a>
            <a class="list-btn block px-4 py-2 text-center hover:bg-white/10"
            href="/logout">
            退出登录
            </a>
        </div>
    </div>
    `;
}
