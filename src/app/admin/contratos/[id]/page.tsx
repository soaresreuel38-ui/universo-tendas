import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { PrintPdfButton, SignInPersonForm, WhatsappContractButton } from "@/components/contracts/ContractClient";
import { ActionForm } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { DefinitionList, Field, Input, Notice, PageHeader, Section, buttonClass } from "@/components/ui/primitives";
import type { ContractSnapshot } from "@/lib/contract-types";
import { CONTRACT_OPEN_STATUSES, EDITABLE_STATUSES, can, effectiveContractStatus, type ContractStatus } from "@/lib/domain";
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
  const effective = effectiveContractStatus(c);
  const pdf = `/api/pdf/contrato/${c.id}`;
  const canEdit = c.status === "RASCUNHO" && c.rental != null && EDITABLE_STATUSES.includes(c.rental.status);
  const disabledBtn = `${buttonClass("secondary", "md")} pointer-events-none w-full opacity-45`;

  // Linha do tempo do documento
  const steps: Array<{ label: string; done: boolean; at?: Date | null }> = [
    { label: "Gerado a partir da locação", done: true, at: c.createdAt },
    { label: "Enviado ao cliente", done: Boolean(c.sentAt) || (c.status !== "RASCUNHO" && c.status !== "CANCELADO"), at: c.sentAt },
    { label: "Cliente assinou", done: signedBy.has("CLIENTE"), at: c.signatures.find((s) => s.party === "CLIENTE")?.signedAt },
    { label: "Empresa assinou", done: signedBy.has("EMPRESA"), at: c.signatures.find((s) => s.party === "EMPRESA")?.signedAt },
    { label: "Ativo (material saiu)", done: c.status === "ATIVO" || c.status === "FINALIZADO" },
    { label: "Finalizado", done: c.status === "FINALIZADO" },
  ];

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/contratos", label: "Contratos" }}
        eyebrow="Contrato de locação"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>Contrato Nº {seq(c.number)}</span>
            <ContractStatusBadge contract={c} />
          </span>
        }
        description={
          <>
            {snap.customer.name} · {snap.rental.eventName}
            {c.rental ? (
              <>
                {" · "}
                <Link href={`/admin/locacoes/${c.rental.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                  Locação #{seq(c.rental.number)}
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {gerado ? <Notice tone="ok">Contrato gerado com os dados da locação. Confira a prévia e envie ao cliente.</Notice> : null}
        {snap.clauses.length === 0 ? (
          <Notice tone="warn">
            Este contrato não tem cláusulas: o modelo de contrato ainda não foi preenchido.{" "}
            {can(user.role, "settings.manage") ? (
              <Link href="/admin/configuracoes/contratos" className="font-medium underline">
                Preencher o modelo
              </Link>
            ) : (
              "Peça ao administrador para preencher o modelo."
            )}
            {c.status === "RASCUNHO" ? " Depois, use “Atualizar rascunho”." : null}
          </Notice>
        ) : null}
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          {/* Ações */}
          <section aria-label="Ações do contrato" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <a href={pdf} target="_blank" rel="noopener" className={`${buttonClass("primary", "md")} w-full`}>
              <Icon name="file" className="h-4 w-4" /> Visualizar PDF
            </a>
            <a href={`${pdf}?baixar=1`} className={`${buttonClass("secondary", "md")} w-full`}>
              <Icon name="download" className="h-4 w-4" /> Baixar
            </a>
            {open && (!signedBy.has("CLIENTE") || !signedBy.has("EMPRESA")) ? (
              <a href="#assinar" className={`${buttonClass("secondary", "md")} w-full`}>
                <Icon name="edit" className="h-4 w-4" /> Assinar
              </a>
            ) : (
              <span className={disabledBtn}>
                <Icon name="check" className="h-4 w-4" /> {signedBy.size === 2 ? "Assinado" : "Assinar"}
              </span>
            )}
            {open && !signedBy.has("CLIENTE") && phone ? (
              <WhatsappContractButton contractId={c.id} action={whatsappContractAction} />
            ) : (
              <span className={disabledBtn} title={phone ? "Disponível enquanto o cliente não assinou" : "Cliente sem telefone"}>
                <Icon name="whatsapp" className="h-4 w-4" /> WhatsApp
              </span>
            )}
            {canEdit && c.rental ? (
              <Link href={`/admin/locacoes/${c.rental.id}/editar`} className={`${buttonClass("secondary", "md")} w-full`}>
                <Icon name="edit" className="h-4 w-4" /> Editar
              </Link>
            ) : (
              <span className={disabledBtn} title="Depois de enviado, o contrato fica congelado. Para mudar, cancele e gere outro.">
                <Icon name="edit" className="h-4 w-4" /> Editar
              </span>
            )}
            <PrintPdfButton url={pdf} frameId="contract-preview" />
          </section>
          {canEdit ? <p className="-mt-3 text-xs text-faint">“Editar” abre a locação. Depois de salvar, use “Atualizar rascunho” aqui.</p> : null}

          {/* Situação */}
          <Section title="Situação">
            <ol className="space-y-4">
              {steps.map((st, i) => (
                <li key={st.label} className="relative flex items-start gap-3">
                  {i < steps.length - 1 ? (
                    <span className={`absolute left-[9px] top-6 h-[calc(100%-2px)] w-px ${st.done && steps[i + 1].done ? "bg-ink" : "bg-line"}`} aria-hidden />
                  ) : null}
                  <span className={`relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${st.done ? "bg-ink text-white" : "border border-line-strong bg-white"}`}>
                    {st.done ? <Icon name="check" className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className={st.done ? "font-medium text-graphite" : "text-faint"}>{st.label}</span>
                    {st.at ? <span className="block text-xs text-faint">{fmtDateTime(st.at)}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            {effective === "VENCIDO" ? <p className="mt-4 text-sm text-accent">A data de saída passou sem as assinaturas: contrato vencido.</p> : null}
            {c.status === "CANCELADO" && c.cancelReason ? <p className="mt-4 text-sm text-muted">Cancelado: {c.cancelReason}</p> : null}
            {c.signatures.length === 0 && c.status !== "CANCELADO" ? (
              <p className="mt-4 border-t border-line pt-4 text-xs text-faint">Gerar ou enviar o contrato não o torna assinado. Ele só fica “Assinado” quando cliente e empresa assinarem.</p>
            ) : null}
            {open && c.status === "RASCUNHO" ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <ActionForm action={refreshContractAction} submitLabel="Atualizar rascunho" submitVariant="secondary">
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
                <ActionForm action={markSentAction} submitLabel="Marcar como enviado" submitVariant="secondary">
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            ) : null}
          </Section>

          {/* Assinaturas */}
          <Section title="Assinaturas" padded={false}>
            <ul className="divide-y divide-line/70">
              {(["CLIENTE", "EMPRESA"] as const).map((party) => {
                const s = c.signatures.find((x) => x.party === party);
                return (
                  <li key={party} className="flex items-start gap-3 px-5 py-4">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s ? "bg-st-free" : "bg-line-strong"}`} />
                    <span className="min-w-0 text-sm">
                      {s ? (
                        <span className="block text-graphite">
                          <span className="font-medium">{party === "CLIENTE" ? "Cliente" : "Empresa"}:</span> {s.signerName} — {s.method === "DIGITAL" ? "eletrônica" : "em papel"} em {fmtDateTime(s.signedAt)}
                          {s.collectedBy ? <span className="text-faint"> · colhida por {s.collectedBy.name}</span> : s.method === "DIGITAL" ? <span className="text-faint"> · pelo link</span> : ""}
                        </span>
                      ) : (
                        <span className="block text-faint">
                          <span className="font-medium text-graphite">{party === "CLIENTE" ? "Cliente" : "Empresa"}:</span> pendente
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* Resumo */}
          <Section title="Resumo" padded={false}>
            <ul className="divide-y divide-line/70">
              {snap.items.map((i) => (
                <li key={i.code + i.name} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-graphite">{i.name}</span>
                    <span className="block text-xs text-faint">
                      <span className="font-mono">{i.code}</span> · {i.quantity} {i.unit} × {money(i.unitPriceCents)}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-medium text-graphite">{money(i.totalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-line px-5 py-4">
              <span className="text-xs text-faint">{snap.discountCents ? `Subtotal ${money(snap.subtotalCents)} · desconto −${money(snap.discountCents)}` : "Total"}</span>
              <span className="tabular text-2xl font-semibold tracking-tight text-graphite">{money(snap.totalCents)}</span>
            </div>
            <div className="border-t border-line p-5">
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
                  [
                    "Código de verificação",
                    <span key="h" className="font-mono text-xs">
                      {c.contentHash.slice(0, 12).toUpperCase()}
                    </span>,
                  ],
                ]}
              />
            </div>
          </Section>

          {open ? (
            <div id="assinar" className="scroll-mt-8 space-y-6">
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
                  <p className="mb-4 text-sm text-muted">Imprima o PDF, colha as assinaturas e anexe a foto ou o PDF digitalizado.</p>
                  <div className="grid gap-4">
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
            <Section title="Documentos anexados" padded={false}>
              <ul className="divide-y divide-line/70">
                {c.documents.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-paper">
                      <Icon name="file" className="h-4 w-4 text-ink" />
                      <span className="flex-1 font-medium text-graphite">{d.title}</span>
                      <span className="text-xs text-faint">{fmtDateTime(d.createdAt)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Histórico">
            <ol className="space-y-4">
              {history.map((h) => (
                <li key={h.id} className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-line-strong" aria-hidden />
                  <span>
                    <span className="text-graphite">{h.summary}</span>
                    <span className="block text-xs text-faint">
                      {h.user?.name ?? "Cliente (pelo link)"} · {fmtDateTime(h.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
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

        {/* Pré-visualização do documento (computador) */}
        <aside className="hidden xl:sticky xl:top-8 xl:block" aria-label="Pré-visualização do contrato">
          <div className="overflow-hidden rounded-2xl border border-line bg-[#e9e6e0]">
            <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2.5">
              <span className="eyebrow">Pré-visualização · A4</span>
              <a href={pdf} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:underline">
                Abrir em nova aba <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe id="contract-preview" src={`${pdf}#view=FitH`} title={`Contrato Nº ${seq(c.number)}`} className="h-[calc(100dvh-9rem)] min-h-[560px] w-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
