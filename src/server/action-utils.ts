import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "./errors";

export const ok = (message: string): ActionState => ({ ok: true, message, at: Date.now() });
export const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() });

/**
 * Executa uma operação de uma server action: erros de regra de negócio e de validação
 * viram mensagens para o usuário; redirect() e erros inesperados seguem o fluxo normal.
 */
export async function run(fn: () => Promise<string | ActionState | void>): Promise<ActionState> {
  try {
    const result = await fn();
    if (result && typeof result === "object") return result;
    return ok(result || "Salvo.");
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError) return fail(error.message);
    if (error instanceof z.ZodError) return fail(error.issues[0]?.message ?? "Dados inválidos.");
    console.error(error);
    return fail("Não foi possível concluir a operação. Tente novamente.");
  }
}

/** Atualiza todas as telas do painel após uma alteração. */
export function refreshPanel() {
  revalidatePath("/admin", "layout");
}

export const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};
