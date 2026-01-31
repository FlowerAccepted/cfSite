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
    return '密码哈希必须是字符串';
  if (!/^[0-9a-f]+$/.test(password))
    return '密码哈希不是 SHA-256 十六进制格式';
  if (password.length != 64)
    return '密码哈希长度不是 SHA-256 的 64 字节';
  return null;
}
