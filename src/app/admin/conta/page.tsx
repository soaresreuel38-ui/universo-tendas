import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/forms";
import { DefinitionList, Field, Input, PageHeader, Section } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/domain";
import { requireUser } from "@/server/auth/session";
import { logout } from "../../login/actions";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Minha conta" />
      <Section>
        <DefinitionList items={[["Nome", user.name], ["E-mail", user.email], ["Tipo", ROLE_LABEL[user.role]]]} />
      </Section>
      <Section title="Trocar senha">
        <ActionForm action={changePasswordAction} submitLabel="Trocar senha" resetOnSuccess>
          <div className="grid gap-3">
            <Field label="Senha atual" required>
              <Input name="current" type="password" required autoComplete="current-password" />
            </Field>
            <Field label="Nova senha" required hint="Mínimo de 10 caracteres.">
              <Input name="next" type="password" required minLength={10} autoComplete="new-password" />
            </Field>
            <Field label="Confirmar nova senha" required>
              <Input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
            </Field>
          </div>
        </ActionForm>
      </Section>
      <form action={logout}>
        <button className="h-11 w-full rounded-lg border border-line-strong bg-white text-sm font-medium text-red-700">Sair do sistema</button>
      </form>
    </div>
  );
}
