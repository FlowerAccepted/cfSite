const SPECIAL_RE = /[!@#$%^&*._-]/;
const VALID_RE = /^[A-Za-z0-9!@#$%^&*._-]+$/;

/* ========== 密码强度 UI ========== */
export function initPasswordUI({
  passwordId,
  confirmId,
  containerId
}) {
  const pwd = document.getElementById(passwordId);
  const confirm = document.getElementById(confirmId);
  const box = document.getElementById(containerId);

  if (!pwd || !box) return;

  function renderInvalid(msg) {
    box.innerHTML = `<p style="color:#999">这个密码不可行喵，${msg}</p>`;
  }

  function renderStrength(score, items) {
    const map = [
      { text: "密码太蒻啦～", color: "#999" },
      { text: "密码有点蒻喵～", color: "#e74c3c" },
      { text: "密码有点蒻喵～", color: "#e74c3c" },
      { text: "密码还不够强哦～", color: "#f1c40f" },
      { text: "这个密码能经受住风吹雨打啦！", color: "#2ecc71" }
    ];

    const head = map[score];

    box.innerHTML = `
      <p style="color:${head.color}">${head.text}</p>
      <ul style="list-style:none;padding-left:0">
        ${items.map(i => `
          <li style="color:${i.ok ? head.color : "#999"}">
            ${i.ok ? "✔" : "✘"} ${i.text}
          </li>
        `).join("")}
      </ul>
    `;
  }

  function check() {
    const v = pwd.value;

    if (typeof v !== "string")
      return renderInvalid("密码不是字符串");

    if (v.length > 64)
      return renderInvalid("密码长度超过 64");

    if (/\s/.test(v))
      return renderInvalid("密码包含空格");

    if (!VALID_RE.test(v))
      return renderInvalid("密码包含非法字符");

    const items = [
      { text: "长度大于 8", ok: v.length >= 8 },
      { text: "包含字母", ok: /[A-Za-z]/.test(v) },
      { text: "包含数字", ok: /[0-9]/.test(v) },
      { text: "包含特殊字符", ok: SPECIAL_RE.test(v) }
    ];

    const score = items.filter(i => i.ok).length;
    renderStrength(score, items);
  }

  pwd.addEventListener("input", check);
  if (confirm) confirm.addEventListener("input", check);
}

/* ========== 密码显示 / 隐藏（新版眼睛） ========== */
export function initPasswordToggle() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".eye-btn");
    if (!btn) return;

    const id = btn.dataset.target;
    const input = document.getElementById(id);
    if (!input) return;

    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    btn.classList.toggle("visible", !visible);
  });
}
