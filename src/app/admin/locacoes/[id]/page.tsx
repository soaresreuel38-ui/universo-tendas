import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { MovementTable, movementInclude } from "@/components/stock/MovementTable";
import { ActionForm, InlineAction } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { DataTable, DefinitionList, Field, Input, LinkButton, Notice, PageHeader, Section, buttonClass } from "@/components/ui/primitives";
import { EDITABLE_STATUSES, RENTAL_STATUS_LABEL, RENTAL_TRANSITIONS, can, isOut, isOverdue, type RentalStatus } from "@/lib/domain";
import { fmtDateTime, money, seq, whatsappLink } from "@/lib/format";
import { rentalWhatsappMessage } from "@/lib/whatsapp";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { resolvePendingAction } from "../../estoque/actions";
import { changeStatusAction, registerPaymentAction } from "../actions";
import { createContractAction } from "../../contratos/actions";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain";

export const metadata: Metadata = { title: "Locação" };

const STATUS_BUTTON: Partial<Record<RentalStatus, string>> = {
  RESERVADA: "Reservar",
  CONFIRMADA: "Confirmar",
  SEPARACAO: "Em separação",
  EM_EVENTO: "Em evento",
  AGUARDANDO_RETORNO: "Aguardando retorno",
  RETORNADA: "Chegou (retornada)",
  FINALIZADA: "Finalizar",
  CANCELADA: "Cancelar locação",
};

export default async function RentalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; saiu?: string; conferida?: string; erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const r = await prisma.rental.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      checkedBy: { select: { name: true } },
      items: { include: { product: true, units: { include: { unit: true } } }, orderBy: { product: { name: "asc" } } },
      photos: { select: { id: true } },
      maintenances: { include: { product: { select: { name: true } } } },
      contracts: { orderBy: { number: "desc" } },
      payments: { include: { user: { select: { name: true } } }, orderBy: { paidAt: "asc" } },
      damageReports: { include: { product: { select: { name: true } }, photos: { select: { id: true } } } },
    },
  });
  if (!r) notFound();
  const [movements, settings] = await Promise.all([
    prisma.stockMovement.findMany({ where: { rentalId: r.id }, include: movementInclude, orderBy: { createdAt: "asc" } }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);

  const phone = r.customer.whatsapp || r.customer.phone;
  const message = rentalWhatsappMessage({ ...r, footer: settings?.whatsappFooter ?? "Universo Tendas" });
  const waLink = whatsappLink(phone, message);
  const transitions = RENTAL_TRANSITIONS[r.status].filter((s) => s !== "SAIU" && s !== "CONFERIDA");
  const canDepart = RENTAL_TRANSITIONS[r.status].includes("SAIU");
  const canCheck = isOut(r.status);
  const checked = r.checkedAt != null;
  const gross = r.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const pendingItems = r.items.filter((i) => (i.qtyMissing ?? 0) - i.qtyMissingResolved > 0);
  const activeContract = r.contracts.find((x) => x.status !== "CANCELADO");
  const paid = r.payments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/admin/locacoes", label: "Locações" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-zinc-500">#{seq(r.number)}</span> {r.eventName} <RentalStatusBadge rental={r} />
          </span>
        }
        description={`${r.customer.name} · criada por ${r.createdBy.name} em ${fmtDateTime(r.createdAt)}`}
        actions={
          EDITABLE_STATUSES.includes(r.status) && can(user.role, "rental.manage") ? (
            <LinkButton href={`/admin/locacoes/${r.id}/editar`} icon="edit">Editar</LinkButton>
          ) : null
        }
      />
      {sp.salvo ? <Notice tone="ok">Locação salva.</Notice> : null}
      {sp.erro ? <Notice tone="danger">Locação salva como orçamento, mas o contrato não foi gerado: {sp.erro.slice(0, 300)}</Notice> : null}
      {sp.saiu ? <Notice tone="ok">Saída registrada. Os produtos agora constam como alugados.</Notice> : null}
      {sp.conferida ? <Notice tone="ok">Conferência finalizada. O estoque foi atualizado.</Notice> : null}
      {isOverdue(r) ? <Notice tone="danger">Locação atrasada: o retorno estava previsto para {fmtDateTime(r.expectedReturnAt)}.</Notice> : null}

      {/* Próximo passo em destaque */}
      {canDepart || canCheck ? (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-700">
            {canDepart ? "Próximo passo: separar os produtos e registrar a saída do estoque." : "Próximo passo: quando os produtos voltarem, fazer a conferência."}
          </p>
          {canDepart ? (
            <Link href={`/admin/locacoes/${r.id}/saida`} className={buttonClass("accent", "lg")}>
              <Icon name="arrowOut" className="h-5 w-5" /> Registrar saída
            </Link>
          ) : (
            <Link href={`/admin/locacoes/${r.id}/conferencia`} className={buttonClass("accent", "lg")}>
              <Icon name="clipboard" className="h-5 w-5" /> Registrar retorno / conferir
            </Link>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Produtos" padded={false}>
          <DataTable
            rows={r.items}
            rowKey={(i) => i.id}
            columns={[
              {
                header: "Produto",
                mobile: "title",
                cell: (i) => (
                  <span>
                    <Link href={`/admin/produtos/${i.productId}`} className="hover:underline">{i.product.name}</Link>
                    {i.units.length ? (
                      <span className="block font-mono text-xs font-normal text-zinc-500">
                        {i.units.map((u) => `#${u.unit.code}${u.returnState && u.returnState !== "OK" ? ` (${u.returnState.toLowerCase()})` : ""}`).join(", ")}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              { header: "Qtd.", align: "right", cell: (i) => <span className="tabular font-medium">{i.quantity} {i.product.unit}</span> },
              { header: "Valor unit.", align: "right", cell: (i) => <span className="tabular">{money(i.unitPriceCents)}</span> },
              { header: "Subtotal", align: "right", cell: (i) => <span className="tabular">{money(i.unitPriceCents * i.quantity)}</span> },
              ...(checked
                ? [
                    {
                      header: "Conferência",
                      cell: (i: (typeof r.items)[number]) => {
                        const diff = (i.qtyDamaged ?? 0) + (i.qtyMissing ?? 0) > 0;
                        return (
                          <span className={diff ? "text-amber-800" : "text-emerald-700"}>
                            {diff ? "⚠" : "☑"} {i.qtyReturned}/{i.quantity} ok
                            {i.qtyDamaged ? ` · ${i.qtyDamaged} danif.` : ""}
                            {i.qtyMissing ? ` · ${i.qtyMissing} falt.` : ""}
                            {i.checkNote ? <span className="block text-xs text-zinc-500">{i.checkNote}</span> : null}
                          </span>
                        );
                      },
                    },
                  ]
                : []),
            ]}
          />
          <div className="space-y-0.5 border-t border-zinc-200 px-4 py-3 text-right text-sm">
            {r.discountCents ? (
              <>
                <p className="text-zinc-500">Subtotal {money(gross)}</p>
                <p className="text-zinc-500">Desconto −{money(r.discountCents)}</p>
              </>
            ) : null}
            <p className="tabular text-lg font-semibold">Total {money(r.totalCents)}</p>
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Contrato e documentos">
            {activeContract ? (
              <Link href={`/admin/contratos/${activeContract.id}`} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                <span className="font-medium">Contrato #{seq(activeContract.number)}</span>
                <ContractStatusBadge contract={{ ...activeContract, rental: r }} />
              </Link>
            ) : r.status !== "CANCELADA" && can(user.role, "contract.manage") ? (
              <div className="flex flex-wrap gap-2">
                <InlineAction action={createContractAction} fields={{ rentalId: r.id }} variant="primary" size="md">
                  {r.status === "ORCAMENTO" ? "Cliente aprovou — gerar contrato" : "Gerar contrato"}
                </InlineAction>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Sem contrato.</p>
            )}
            {r.status === "ORCAMENTO" && !activeContract ? (
              <p className="mt-2 text-xs text-zinc-500">Gerar o contrato reserva o estoque para o período (se houver disponibilidade).</p>
            ) : null}
            <a href={`/api/pdf/orcamento/${r.id}`} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-700 underline">
              <Icon name="download" className="h-4 w-4" /> PDF do orçamento
            </a>
          </Section>

          <Section title="Pagamentos">
            <p className="text-sm">
              Recebido <b>{money(paid)}</b> de {money(r.totalCents)}
              {paid < r.totalCents ? <span className="text-amber-700"> · falta {money(r.totalCents - paid)}</span> : <span className="text-emerald-700"> · quitado</span>}
            </p>
            {r.payments.length ? (
              <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                {r.payments.map((p) => (
                  <li key={p.id}>
                    {fmtDateTime(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method]} · {money(p.amountCents)} · {p.user.name}
                  </li>
                ))}
              </ul>
            ) : null}
            {r.status !== "CANCELADA" && can(user.role, "payment.register") && paid < r.totalCents ? (
              <details className="mt-3">
                <summary className="text-sm font-medium underline">Registrar pagamento</summary>
                <ActionForm action={registerPaymentAction} submitLabel="Registrar" submitVariant="secondary" resetOnSuccess>
                  <input type="hidden" name="rentalId" value={r.id} />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Valor (R$)">
                      <Input name="amount" inputMode="decimal" required defaultValue={((r.totalCents - paid) / 100).toFixed(2).replace(".", ",")} />
                    </Field>
                    <Field label="Forma">
                      <select name="method" className="mt-1 block h-10 w-full rounded-md border border-zinc-300 bg-white px-2">
                        {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </ActionForm>
              </details>
            ) : null}
          </Section>

          <Section title="Cliente">
            <p className="font-medium">
              <Link href={`/admin/clientes/${r.customer.id}`} className="hover:underline">{r.customer.name}</Link>
            </p>
            {phone ? (
              <p className="mt-1 flex flex-wrap gap-3 text-sm">
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-zinc-700 underline">
                  <Icon name="phone" className="h-4 w-4" /> {phone}
                </a>
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Sem telefone cadastrado.</p>
            )}
            {waLink && !["ORCAMENTO", "CANCELADA"].includes(r.status) ? (
              <details className="mt-3">
                <summary className={`${buttonClass("secondary", "md")} w-full list-none`}>
                  <Icon name="whatsapp" className="h-4 w-4 text-emerald-600" /> Enviar confirmação pelo WhatsApp
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 font-sans text-sm text-zinc-800">{message}</pre>
                <a href={waLink} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary", "md")} mt-2 w-full`}>
                  Abrir WhatsApp com esta mensagem
                </a>
                <p className="mt-1 text-xs text-zinc-500">Nada é enviado automaticamente: você revisa e envia no WhatsApp.</p>
              </details>
            ) : null}
          </Section>

          {transitions.length && can(user.role, "rental.manage") ? (
            <Section title="Alterar status">
              <div className="flex flex-wrap gap-2">
                {transitions.map((to) => (
                  <InlineAction
                    key={to}
                    action={changeStatusAction}
                    fields={{ id: r.id, to }}
                    variant={to === "CANCELADA" ? "danger" : "secondary"}
                    confirm={to === "CANCELADA" ? "Cancelar esta locação? A reserva de estoque será liberada." : undefined}
                  >
                    {STATUS_BUTTON[to] ?? RENTAL_STATUS_LABEL[to]}
                  </InlineAction>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>

      <Section title="Datas e detalhes">
        <DefinitionList
          items={[
            ["Montagem", fmtDateTime(r.setupAt)],
            ["Saída", fmtDateTime(r.departureAt)],
            ["Data do evento", fmtDateTime(r.eventAt)],
            ["Retorno previsto", fmtDateTime(r.expectedReturnAt)],
            ["Saída registrada em", fmtDateTime(r.departedAt)],
            ["Retorno real", fmtDateTime(r.actualReturnAt)],
            ["Endereço do evento", r.eventAddress],
            ["Responsável pela retirada", r.pickupBy],
            ["Conferido por", r.checkedBy ? `${r.checkedBy.name} em ${fmtDateTime(r.checkedAt)}` : null],
            ["Observações", r.notes],
            ["Observações da conferência", r.checkNotes],
          ]}
        />
      </Section>

      {pendingItems.length ? (
        <Section title="Pendências (itens faltantes)">
          <ul className="space-y-4">
            {pendingItems.map((i) => {
              const open = (i.qtyMissing ?? 0) - i.qtyMissingResolved;
              return (
                <li key={i.id} className="rounded-md border border-red-200 bg-red-50/50 p-3">
                  <p className="text-sm font-medium">
                    {i.product.name}: {open} pendente(s)
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <ActionForm action={resolvePendingAction} submitLabel="Item encontrado (volta ao estoque)" submitVariant="secondary">
                      <input type="hidden" name="rentalItemId" value={i.id} />
                      <input type="hidden" name="outcome" value="ENCONTRADO" />
                      <Field label="Quantidade">
                        <Input name="quantity" type="number" min={1} max={open} defaultValue={open} inputMode="numeric" />
                      </Field>
                    </ActionForm>
                    {can(user.role, "pending.lost") ? (
                      <ActionForm action={resolvePendingAction} submitLabel="Baixar como perda" submitVariant="danger" confirm="Baixar como perda definitiva?">
                        <input type="hidden" name="rentalItemId" value={i.id} />
                        <input type="hidden" name="outcome" value="PERDIDO" />
                        <Field label="Quantidade">
                          <Input name="quantity" type="number" min={1} max={open} defaultValue={open} inputMode="numeric" />
                        </Field>
                        <Field label="Observação">
                          <Input name="notes" maxLength={500} placeholder="Ex.: cobrado do cliente" />
                        </Field>
                      </ActionForm>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {r.damageReports.length ? (
        <Section title="Ocorrências de danos">
          <ul className="space-y-3 text-sm">
            {r.damageReports.map((d) => (
              <li key={d.id} className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
                <p className="font-medium">
                  {d.product.name} × {d.quantity} — {d.damageType}
                </p>
                <p className="text-zinc-700">{d.description}</p>
                {d.responsible ? <p className="text-xs text-zinc-500">Responsável: {d.responsible}</p> : null}
                {d.photos.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.photos.map((p) => (
                      <a key={p.id} href={`/api/fotos/${p.id}`} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/fotos/${p.id}`} alt="Foto do dano" className="h-20 w-20 rounded object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {r.photos.length ? (
        <Section title="Fotos da conferência">
          <div className="flex flex-wrap gap-2">
            {r.photos.map((p) => (
              <a key={p.id} href={`/api/fotos/${p.id}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fotos/${p.id}`} alt="Foto da conferência" className="h-28 w-28 rounded-md object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Movimentações desta locação" padded={false}>
        <MovementTable rows={movements} />
      </Section>
    </div>
  );
}
