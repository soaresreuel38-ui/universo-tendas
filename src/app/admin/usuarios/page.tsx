import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/forms";
import { Badge, Checkbox, Field, Input, PageHeader, Section, Select } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/domain";
import { fmtDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createUserAction, updateUserAction } from "./actions";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requirePermission("user.manage");
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Usuários e permissões"
        description="Administrador: tudo, incluindo produtos, usuários, relatórios e configurações. Funcionário: entradas, saídas, locações, retornos, vendas e consultas."
      />
      <Section title="Novo usuário">
        <ActionForm action={createUserAction} submitLabel="Criar usuário" resetOnSuccess>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome" required>
              <Input name="name" required maxLength={120} />
            </Field>
            <Field label="E-mail (login)" required>
              <Input name="email" type="email" required maxLength={160} autoComplete="off" />
            </Field>
            <Field label="Senha inicial" required hint="Mínimo de 10 caracteres. Peça para a pessoa trocar no primeiro acesso.">
              <Input name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" />
            </Field>
            <Field label="Tipo" required>
              <Select name="role" defaultValue="EMPLOYEE">
                <option value="EMPLOYEE">Funcionário</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
          </div>
        </ActionForm>
      </Section>
      <Section title={`Usuários (${users.length})`} padded={false}>
        <ul className="divide-y divide-zinc-100">
          {users.map((u) => (
            <li key={u.id} className="p-4">
              <details>
                <summary className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{u.name}</span> <span className="text-sm text-zinc-500">{u.email}</span>
                    {u.id === me.id ? <span className="ml-1 text-xs text-zinc-500">(você)</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
                    {!u.active ? <Badge tone="muted">Desativado</Badge> : null}
                    Último acesso: {fmtDateTime(u.lastLoginAt)}
                  </span>
                </summary>
                <div className="mt-3 rounded-md border border-zinc-200 p-3">
                  <ActionForm action={updateUserAction} submitLabel="Salvar" submitVariant="secondary">
                    <input type="hidden" name="id" value={u.id} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Nome">
                        <Input name="name" required maxLength={120} defaultValue={u.name} />
                      </Field>
                      <Field label="E-mail (login)">
                        <Input name="email" type="email" required maxLength={160} defaultValue={u.email} />
                      </Field>
                      <Field label="Tipo">
                        <Select name="role" defaultValue={u.role}>
                          <option value="EMPLOYEE">Funcionário</option>
                          <option value="ADMIN">Administrador</option>
                        </Select>
                      </Field>
                      <Field label="Nova senha" hint="Deixe em branco para manter.">
                        <Input name="password" type="password" minLength={10} maxLength={200} autoComplete="new-password" />
                      </Field>
                      <Checkbox name="active" label="Acesso ativo" defaultChecked={u.active} />
                    </div>
                  </ActionForm>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
