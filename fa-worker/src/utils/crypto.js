// 密码 hash
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// JWT 使用 Web Crypto + btoa 简单实现（本地测试可用）
export function signJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa(secret); // 简化版，仅测试用
  return `${header}.${body}.${signature}`;
}

export function verifyJWT(token, secret) {
  const [header, body, sig] = token.split(".");
  if (sig !== btoa(secret)) return null;
  return JSON.parse(atob(body));
}
