import "server-only";

function encryptionKeyBytes() {
  const encoded = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY não configurada.");

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 32) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY precisa representar exatamente 32 bytes em base64.");
  }
  return bytes;
}

async function key() {
  return crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(value),
  );

  return [
    "v1",
    Buffer.from(iv).toString("base64url"),
    Buffer.from(encrypted).toString("base64url"),
  ].join(".");
}

export async function decryptToken(value: string) {
  const [version, ivEncoded, ciphertextEncoded] = value.split(".");
  if (version !== "v1" || !ivEncoded || !ciphertextEncoded) {
    throw new Error("Formato de token criptografado inválido.");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivEncoded, "base64url") },
    await key(),
    Buffer.from(ciphertextEncoded, "base64url"),
  );

  return new TextDecoder().decode(decrypted);
}
