/**
 * Diagnose env loading + token shape (TIDAK print isi token).
 * Pakai: `npx tsx scripts/diag-env.ts`
 */
import "./_env";

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
const dbUrl = process.env.DATABASE_URL;

console.log("URL:", url || "(missing)");
console.log("DATABASE_URL fallback:", dbUrl || "(missing)");
console.log(
  "Token: " +
    (token
      ? `length=${token.length}, starts=${token.slice(0, 12)}..., parts=${token.split(".").length}`
      : "(missing)"),
);
if (token) {
  // JWT = 3 parts (header.payload.signature). Decode header to see alg
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const header = JSON.parse(
        Buffer.from(parts[0], "base64url").toString("utf-8"),
      );
      console.log("Token header:", header);
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf-8"),
      );
      // Hanya keluarkan klaim non-sensitif (scope, exp, iat)
      console.log("Token claims:", {
        iss: payload.iss,
        aud: payload.aud,
        a: payload.a,
        p: payload.p,
        exp: payload.exp
          ? `${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`
          : undefined,
        iat: payload.iat
          ? `${payload.iat} (${new Date(payload.iat * 1000).toISOString()})`
          : undefined,
      });
    } catch (err) {
      console.log("Token payload tidak bisa di-decode:", err);
    }
  } else {
    console.log("Token bukan JWT 3-part. Salah copy?");
  }
}
