"use client";

import { useActionState, useState } from "react";
import { SignaturePad } from "@/components/contracts/SignaturePad";
import { FormMessage, SubmitButton, keepValues } from "@/components/ui/forms";
import { Checkbox, Field, Input } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";

export function PublicSignForm({ token, name, document, action }: { token: string; name: string; document: string | null; action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [hasInk, setHasInk] = useState(false);
  if (state?.ok) {
    return <p className="rounded-lg bg-emerald-50 p-4 text-center text-emerald-800">{state.message}</p>;
  }
  return (
    <form action={formAction} onSubmit={keepValues(formAction)} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nome completo" required>
        <Input name="signerName" required maxLength={120} defaultValue={name} autoComplete="name" />
      </Field>
      <Field label="CPF / CNPJ">
        <Input name="signerDocument" maxLength={30} defaultValue={document ?? ""} inputMode="numeric" />
      </Field>
      <div>
        <span className="text-sm font-medium text-muted">Sua assinatura</span>
        <SignaturePad onChange={setHasInk} />
      </div>
      <Checkbox name="accept" required label="Li o contrato e concordo com os termos." />
      <SubmitButton pending={pending} disabled={!hasInk} className="sm:w-full">
        Assinar contrato
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
