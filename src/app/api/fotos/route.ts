import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

const MAX_BYTES = 3 * 1024 * 1024;

/** Confere a assinatura real do arquivo (não confia no tipo informado pelo navegador). */
function sniff(buf: Uint8Array): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45) return "image/webp";
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagem muito grande (máx. 3 MB)." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) return NextResponse.json({ error: "Formato não suportado. Use JPG, PNG ou WebP." }, { status: 415 });

  const caption = String(form?.get("caption") ?? "").slice(0, 200) || null;
  const photo = await prisma.photo.create({
    data: { mime, size: bytes.byteLength, data: Buffer.from(bytes), caption, uploadedById: user.id },
    select: { id: true },
  });
  return NextResponse.json({ id: photo.id });
}
