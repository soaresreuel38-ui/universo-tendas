import { SignJWT, jwtVerify } from "jose";

/** Módulo sem dependências de Node para poder rodar no proxy. */

export const SESSION_COOKIE = "ut_session";
export const SESSION_TTL_SEC = 60 * 60 * 12; // 12 horas (um turno de trabalho)

export type SessionPayload = { sub: string; ver: number };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .setAudience("universo-tendas")
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], audience: "universo-tendas" });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, ver: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}
