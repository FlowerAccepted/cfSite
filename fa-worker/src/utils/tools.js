/* ========= 工具函数 ========= */
function toHex(uint8) {
  return [...uint8].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8(hex) {
  return Uint8Array.from(
    hex.match(/.{2}/g).map(b => parseInt(b, 16))
  );
}

/* ========= 密码哈希 ========= */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  return {
    salt: toHex(salt),
    hash: toHex(new Uint8Array(bits)),
  };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const salt = hexToUint8(saltHex);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  const computed = toHex(new Uint8Array(bits));
  return computed === hashHex;
}

/* ========= 密码规则 ========= */
export function chkPassword(password) {
  if (typeof password !== 'string')
    return '密码必须是字符串';
  if (password.length < 8 || password.length > 64)
    return '密码长度必须在 8–64 之间';
  if (/\s/.test(password))
    return '密码不能包含空格';
  if (!/[A-Za-z]/.test(password))
    return '必须包含字母';
  if (!/[0-9]/.test(password))
    return '必须包含数字';
  if (!/[!@#$%^&*._-]/.test(password))
    return '必须包含特殊字符';
  if (!/^[A-Za-z0-9!@#$%^&*._-]+$/.test(password))
    return '包含非法字符';
  return null;
}
