export async function sha256Hex(value) {
  const hexFromBuffer = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const cryptoApi =
    typeof window !== "undefined" && window?.crypto?.subtle ? window.crypto.subtle : null;

  if (!cryptoApi) {
    throw new Error("El navegador no soporta Web Crypto API (subtle)");
  }

  const data = new TextEncoder().encode(value);
  const digest = await cryptoApi.digest("SHA-256", data);
  return hexFromBuffer(digest);
}
