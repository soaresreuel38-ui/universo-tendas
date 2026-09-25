"use client";

import { ActionForm } from "@/components/ui/forms";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";

type Values = { id?: string; name: string; document: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; notes: string | null };

export function CustomerForm({ action, initial }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial?: Values }) {
  return (
    <ActionForm action={action} submitLabel={initial?.id ? "Salvar" : "Cadastrar cliente"}>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome" required className="md:col-span-2">
          <Input name="name" required maxLength={120} defaultValue={initial?.name} />
        </Field>
        <Field label="CPF / CNPJ">
          <Input name="document" maxLength={20} inputMode="numeric" defaultValue={initial?.document ?? ""} />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" maxLength={160} defaultValue={initial?.email ?? ""} />
        </Field>
        <Field label="Telefone">
          <Input name="phone" maxLength={30} inputMode="tel" defaultValue={initial?.phone ?? ""} />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" maxLength={30} inputMode="tel" defaultValue={initial?.whatsapp ?? ""} />
        </Field>
        <Field label="Endereço" className="md:col-span-2">
          <Input name="address" maxLength={300} defaultValue={initial?.address ?? ""} />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} />
        </Field>
      </div>
    </ActionForm>
  );
}
