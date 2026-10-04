"use client";

import { ActionForm } from "@/components/ui/forms";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";

type Values = { id?: string; name: string; personType?: "PF" | "PJ"; tradeName?: string | null; contactName?: string | null; document: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; city?: string | null; notes: string | null };

export function CustomerForm({ action, initial }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial?: Values }) {
  return (
    <ActionForm action={action} submitLabel={initial?.id ? "Salvar" : "Cadastrar cliente"}>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo">
          <Select name="personType" defaultValue={initial?.personType ?? "PF"}>
            <option value="PF">Pessoa física</option>
            <option value="PJ">Pessoa jurídica</option>
          </Select>
        </Field>
        <Field label="Nome / razão social" required>
          <Input name="name" required maxLength={160} defaultValue={initial?.name} />
        </Field>
        <Field label="Nome fantasia" hint="Pessoa jurídica.">
          <Input name="tradeName" maxLength={160} defaultValue={initial?.tradeName ?? ""} />
        </Field>
        <Field label="Responsável" hint="Pessoa jurídica: quem responde pela locação.">
          <Input name="contactName" maxLength={120} defaultValue={initial?.contactName ?? ""} />
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
        <Field label="Endereço">
          <Input name="address" maxLength={300} defaultValue={initial?.address ?? ""} />
        </Field>
        <Field label="Cidade">
          <Input name="city" maxLength={120} defaultValue={initial?.city ?? (initial?.id ? "" : "Sinop - MT")} />
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} />
        </Field>
      </div>
    </ActionForm>
  );
}
