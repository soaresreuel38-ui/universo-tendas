import type { Metadata } from "next";
import { Notice, PageHeader, Section } from "@/components/ui/primitives";
import { requirePermission } from "@/server/auth/session";
import { getContractTemplate, parseClauses } from "@/server/contracts";
import { prisma } from "@/server/db";
import { saveContractTemplateAction } from "./actions";
import { TemplateEditor } from "./TemplateEditor";

export const metadata: Metadata = { title: "Modelo de contrato" };

export default async function ContractTemplatePage() {
  await requirePermission("settings.manage");
  const t = await getContractTemplate(prisma);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="Modelo de contrato" back={{ href: "/admin/configuracoes", label: "Configurações" }} description="Dados da empresa e cláusulas usados em todos os contratos novos." />
      <Notice tone="warn">Revise as condições contratuais com o responsável jurídico da empresa antes de utilizá-las oficialmente.</Notice>
      <Section>
        <TemplateEditor action={saveContractTemplateAction} initial={{ ...t, clauses: parseClauses(t.clauses) }} />
      </Section>
    </div>
  );
}
