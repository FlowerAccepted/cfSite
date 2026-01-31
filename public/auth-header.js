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
    <div class="relative group">
      <img src="${avatar}"
           class="w-8 h-8 rounded-full cursor-pointer" />

      <div class="absolute right-0 mt-2 hidden group-hover:block
                  glass-sidebar rounded shadow">
        <a class="block px-4 py-2" href="/profile">个人中心</a>
        <a class="block px-4 py-2" href="/logout">退出登录</a>
      </div>
    </div>
  `;
}
