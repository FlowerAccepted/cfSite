export async function hashPassword(password) {
	const data = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64EncodeUTF8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64DecodeUTF8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
export function signJWT(payload, secret) {
  const body = base64EncodeUTF8(JSON.stringify(payload));
  const sig = base64EncodeUTF8(body + secret);
  return `${body}.${sig}`;
}

export function verifyJWT(token, secret) {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    if (base64EncodeUTF8(body + secret) !== sig) return null;
    return JSON.parse(base64DecodeUTF8(body));
  } catch {
    return null;
  }
}


export function chkPassword(password) {
	if (typeof password !== 'string') return '密码必须是一个字符串 | Password must be a string';
	if (password.length < 8 || password.length > 64) return '密码长度必须在8到64之间 | Password length must be between 8 and 64';
	if (/\s/.test(password)) return '密码不能包含空格 | Password must not contain spaces';
	if (!/[A-Za-z]/.test(password)) return '密码必须至少包含一个字母 | Password must contain at least one letter';
	if (!/[0-9]/.test(password)) return '密码必须至少包含一个数字 | Password must contain at least one number';
	if (!/[!@#$%^&*._-]/.test(password)) return '密码必须至少包含一个特殊字符 | Password must contain at least one special character';
	if (!/^[A-Za-z0-9!@#$%^&*._-]+$/.test(password)) return '密码包含无效字符 | Password contains invalid characters';
	return null; // 合法
}
