import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/forms";
import { Checkbox, Field, Input, PageHeader, Section, Select } from "@/components/ui/primitives";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const s =
    (await prisma.businessSettings.findUnique({ where: { id: "default" } })) ??
    (await prisma.businessSettings.create({ data: { id: "default" } }));
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Configurações da empresa"
        description="Usadas nas mensagens de WhatsApp e no cadastro de produtos."
        actions={<a href="/admin/configuracoes/contratos" className="inline-flex h-10 items-center rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Modelo de contrato</a>}
      />
      <Section>
        <ActionForm action={saveSettingsAction}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da empresa" required>
              <Input name="companyName" required defaultValue={s.companyName} />
            </Field>
            <Field label="Cidade" required>
              <Input name="city" required defaultValue={s.city} />
            </Field>
            <Field label="Telefones" required>
              <Input name="phones" required defaultValue={s.phones} />
            </Field>
            <Field label="WhatsApp da empresa" required hint="Somente números, com 55 e DDD.">
              <Input name="whatsappNumber" required inputMode="numeric" defaultValue={s.whatsappNumber} />
            </Field>
            <Field label="Instagram" required>
              <Input name="instagram" required defaultValue={s.instagram} />
            </Field>
            <Field label="Endereço" hint="Preencha quando quiser exibir o endereço nas mensagens.">
              <Input name="address" defaultValue={s.address ?? ""} />
            </Field>
            <Field label="Estoque mínimo padrão" hint="Sugerido ao cadastrar novos produtos.">
              <Input name="defaultMinStock" type="number" min={0} defaultValue={s.defaultMinStock} />
            </Field>
            <Field label="Assinatura das mensagens de WhatsApp" required>
              <Input name="whatsappFooter" required defaultValue={s.whatsappFooter} />
            </Field>
          </div>

          <h2 className="mt-8 text-sm font-semibold text-graphite">Reservas pelo site</h2>
          <p className="mt-1 text-xs text-faint">
            O site usa o mesmo estoque e a mesma regra de disponibilidade do painel. A margem define quantos dias antes e depois do
            evento as unidades ficam bloqueadas (montagem, transporte e retorno). Em cada locação, você pode ajustar a saída e o retorno em Editar.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Margem antes do evento (dias)">
              <Input name="onlineBufferDaysBefore" type="number" min={0} max={30} required defaultValue={s.onlineBufferDaysBefore} />
            </Field>
            <Field label="Margem depois do evento (dias)">
              <Input name="onlineBufferDaysAfter" type="number" min={0} max={30} required defaultValue={s.onlineBufferDaysAfter} />
            </Field>
            <Field label="Confirmação das reservas online">
              <Select name="onlineAutoConfirm" defaultValue={s.onlineAutoConfirm ? "1" : "0"}>
                <option value="0">Manual — fica reservada aguardando minha aprovação</option>
                <option value="1">Automática — já nasce confirmada</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Checkbox name="onlineBookingEnabled" label="Aceitar reservas pelo site" defaultChecked={s.onlineBookingEnabled} />
            </div>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}
