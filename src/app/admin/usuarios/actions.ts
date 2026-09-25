"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zCheckbox, zEmail, zId, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createUser, updateUser } from "@/server/users";

const role = z.enum(["ADMIN", "EMPLOYEE"], { message: "Tipo de usuário inválido." });

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({ name: zReqText(120, "Nome"), email: zEmail, password: z.string().max(200), role })
      .parse({ name: str(form, "name"), email: str(form, "email"), password: str(form, "password"), role: str(form, "role") });
    await createUser(prisma, user, data);
    refreshPanel();
    return `Usuário ${data.email} criado.`;
  });
}

export async function updateUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const id = zId.parse(str(form, "id"));
    const data = z
      .object({ name: zReqText(120, "Nome"), email: zEmail, role, active: zCheckbox, password: z.string().max(200) })
      .parse({ name: str(form, "name"), email: str(form, "email"), role: str(form, "role"), active: form.get("active"), password: str(form, "password") });
    await updateUser(prisma, user, id, { ...data, password: data.password || null });
    refreshPanel();
    return "Usuário atualizado.";
  });
}
