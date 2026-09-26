import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { SignInPersonForm, WhatsappContractButton } from "@/components/contracts/ContractClient";
import { ActionForm } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { DataTable, DefinitionList, Field, Input, Notice, PageHeader, Section, buttonClass } from "@/components/ui/primitives";
import type { ContractSnapshot } from "@/lib/contract-types";
import { CONTRACT_OPEN_STATUSES, can, type ContractStatus } from "@/lib/domain";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  cancelContractAction,
  manualSignatureAction,
  markSentAction,
  refreshContractAction,
  signInPersonAction,
  whatsappContractAction,
} from "../actions";

export const metadata: Metadata = { title: "Contrato" };

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gerado?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { gerado } = await searchParams;
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      customer: true,
      rental: true,
      createdBy: { select: { name: true } },
      signatures: { include: { collectedBy: { select: { name: true } } }, orderBy: { signedAt: "asc" } },
      documents: { select: { id: true, title: true, fileName: true, createdAt: true } },
    },
  });
  if (!c) notFound();
  const [history, template] = await Promise.all([
    prisma.auditLog.findMany({ where: { entityType: "Contract", entityId: c.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.contractTemplate.findUnique({ where: { id: "default" } }),
  ]);
  const snap = c.snapshot as unknown as ContractSnapshot;
  const open = CONTRACT_OPEN_STATUSES.includes(c.status as ContractStatus);
  const signedBy = new Set(c.signatures.map((s) => s.party));
  const phone = c.customer.whatsapp || c.customer.phone;

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/admin/contratos", label: "Contratos" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Contrato #{seq(c.number)} <ContractStatusBadge contract={c} />
          </span>
        }
        description={
          <>
            {snap.customer.name} · {snap.rental.eventName} ·{" "}
            {c.rental ? (
              <Link href={`/admin/locacoes/${c.rental.id}`} className="underline">
                Locação #{seq(c.rental.number)}
              </Link>
            ) : null}
          </>
        }
      />
      {gerado ? <Notice tone="ok">Contrato gerado com os dados da locação. Confira o PDF e envie ao cliente.</Notice> : null}
      {snap.clauses.length === 0 ? (
        <Notice tone="warn">
          Este contrato não tem cláusulas: o modelo de contrato ainda não foi preenchido.{" "}
          {can(user.role, "settings.manage") ? (
            <Link href="/admin/configuracoes/contratos" className="underline">Preencher o modelo</Link>
          ) : (
            "Peça ao administrador para preencher o modelo."
          )}
          {c.status === "RASCUNHO" ? " Depois, use “Atualizar rascunho”." : null}
        </Notice>
      ) : null}

      {/* Ações principais — 1 clique */}
      <div className="grid gap-2 sm:grid-cols-3">
        <a href={`/api/pdf/contrato/${c.id}`} target="_blank" rel="noopener" className={`${buttonClass("secondary", "lg")} w-full`}>
          <Icon name="clipboard" className="h-5 w-5" /> Gerar PDF
        </a>
        <a href={`/api/pdf/contrato/${c.id}?baixar=1`} className={`${buttonClass("secondary", "lg")} w-full`}>
          <Icon name="download" className="h-5 w-5" /> Baixar PDF
        </a>
        {open && !signedBy.has("CLIENTE") && phone ? (
          <WhatsappContractButton contractId={c.id} action={whatsappContractAction} />
        ) : (
          <span className={`${buttonClass("secondary", "lg")} pointer-events-none w-full opacity-50`}>
            <Icon name="whatsapp" className="h-5 w-5" /> {phone ? "WhatsApp indisponível" : "Cliente sem telefone"}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Resumo do contrato" padded={false}>
          <DataTable
            rows={snap.items}
            rowKey={(i) => i.code + i.name}
            columns={[
              { header: "Produto", mobile: "title", cell: (i) => i.name },
              { header: "Código", cell: (i) => <span className="font-mono text-xs">{i.code}</span> },
              { header: "Qtd.", align: "right", cell: (i) => `${i.quantity} ${i.unit}` },
              { header: "Preço", align: "right", cell: (i) => money(i.unitPriceCents) },
              { header: "Total", align: "right", cell: (i) => money(i.totalCents) },
            ]}
          />
          <div className="border-t border-zinc-200 px-4 py-3 text-right text-sm">
            {snap.discountCents ? <p className="text-zinc-500">Subtotal {money(snap.subtotalCents)} · Desconto −{money(snap.discountCents)}</p> : null}
            <p className="text-lg font-semibold">Total {money(snap.totalCents)}</p>
          </div>
          <div className="border-t border-zinc-200 p-4">
            <DefinitionList
              items={[
                ["Cliente", snap.customer.name],
                ["CPF / CNPJ", snap.customer.document],
                ["Telefone", snap.customer.phone ?? snap.customer.whatsapp],
                ["Endereço", [snap.customer.address, snap.customer.city].filter(Boolean).join(" · ") || null],
                ["Entrega / evento", snap.rental.eventAddress],
                ["Saída", fmtDateTime(new Date(snap.rental.departureAt))],
                ["Retorno previsto", fmtDateTime(new Date(snap.rental.expectedReturnAt))],
                ["Condição de pagamento", snap.paymentTerms],
                ["Cláusulas", snap.clauses.length ? `${snap.clauses.length} cláusula(s) do modelo` : "Nenhuma"],
                ["Gerado por", `${c.createdBy.name} em ${fmtDateTime(c.createdAt)}`],
                ["Código de verificação", <span key="h" className="font-mono text-xs">{c.contentHash.slice(0, 12).toUpperCase()}</span>],
              ]}
            />
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Assinaturas">
            <ul className="space-y-3 text-sm">
              {(["CLIENTE", "EMPRESA"] as const).map((party) => {
                const s = c.signatures.find((x) => x.party === party);
                return (
                  <li key={party} className="flex items-start gap-2">
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${s ? "bg-emerald-500" : "bg-zinc-300"}`} />
                    <span>
                      <b>{party === "CLIENTE" ? "Cliente" : "Empresa"}:</b>{" "}
                      {s ? (
                        <>
                          {s.signerName} — {s.method === "DIGITAL" ? "eletrônica" : "em papel"} em {fmtDateTime(s.signedAt)}
                          {s.collectedBy ? ` (colhida por ${s.collectedBy.name})` : s.method === "DIGITAL" ? " (pelo link)" : ""}
                        </>
                      ) : (
                        <span className="text-zinc-500">pendente</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {c.signatures.length === 0 && c.status !== "CANCELADO" ? (
              <p className="mt-3 text-xs text-zinc-500">Gerar ou enviar o contrato não o torna assinado. Ele só fica “Assinado” quando cliente e empresa assinarem.</p>
            ) : null}
          </Section>

          {open ? (
            <Section title="Outras ações">
              <div className="flex flex-wrap gap-2">
                {c.status === "RASCUNHO" ? (
                  <>
                    <ActionForm action={refreshContractAction} submitLabel="Atualizar rascunho" submitVariant="secondary">
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                    <ActionForm action={markSentAction} submitLabel="Marcar como enviado" submitVariant="secondary">
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                  </>
                ) : null}
              </div>
            </Section>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {!signedBy.has("CLIENTE") ? (
            <Section title="Assinatura do cliente (presencial)">
              <SignInPersonForm contractId={c.id} party="CLIENTE" defaultName={snap.customer.name} defaultDocument={snap.customer.document} action={signInPersonAction} />
            </Section>
          ) : null}
          {!signedBy.has("EMPRESA") ? (
            <Section title="Assinatura da empresa">
              <SignInPersonForm contractId={c.id} party="EMPRESA" defaultName={user.name} defaultDocument={template?.cnpj} action={signInPersonAction} />
            </Section>
          ) : null}
          <Section title="Assinado em papel?">
            <ActionForm action={manualSignatureAction} submitLabel="Anexar contrato assinado" submitVariant="secondary">
              <input type="hidden" name="id" value={c.id} />
              <p className="mb-3 text-sm text-zinc-600">Imprima o PDF, colha as assinaturas e anexe a foto ou o PDF digitalizado.</p>
              <div className="grid gap-3">
                <Field label="Nome do cliente que assinou" required>
                  <Input name="clientName" required maxLength={120} defaultValue={snap.customer.name} />
                </Field>
                <Field label="Arquivo (PDF, JPG ou PNG, até 4 MB)" required>
                  <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
                </Field>
              </div>
            </ActionForm>
          </Section>
        </div>
      ) : null}

      {c.documents.length ? (
        <Section title="Documentos anexados">
          <ul className="space-y-1 text-sm">
            {c.documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" className="underline">
                  {d.title}
                </a>{" "}
                <span className="text-zinc-500">· {fmtDateTime(d.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Histórico">
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id}>
              <b>{h.user?.name ?? "Cliente (link)"}</b> <span className="text-zinc-500">· {fmtDateTime(h.createdAt)}</span>
              <br />
              {h.summary}
            </li>
          ))}
        </ul>
      </Section>

      {can(user.role, "contract.cancel") && c.status !== "CANCELADO" && c.status !== "FINALIZADO" ? (
        <Section title="Cancelar contrato">
          <ActionForm action={cancelContractAction} submitLabel="Cancelar contrato" submitVariant="danger" confirm="Cancelar este contrato? Ele não será apagado.">
            <input type="hidden" name="id" value={c.id} />
            <Field label="Motivo" required>
              <Input name="reason" required maxLength={300} />
            </Field>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
