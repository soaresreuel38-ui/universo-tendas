import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ui/forms";
import { EmptyState, Field, Input, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { can } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { closeMaintenanceAction } from "../estoque/actions";

export const metadata: Metadata = { title: "Manutenção e pendências" };

export default async function MaintenancePage() {
  const user = await requireUser();
  const [open, pendingItems, recent] = await Promise.all([
    prisma.maintenance.findMany({
      where: { status: "ABERTA" },
      include: { product: true, unit: true, rental: { select: { id: true, number: true } }, user: { select: { name: true } } },
      orderBy: { openedAt: "asc" },
    }),
    prisma.rentalItem.findMany({
      where: { qtyMissing: { gt: 0 } },
      include: { product: true, rental: { include: { customer: { select: { name: true, phone: true } } } } },
      orderBy: { rental: { actualReturnAt: "asc" } },
    }),
    prisma.maintenance.findMany({
      where: { status: { not: "ABERTA" } },
      include: { product: true, unit: true },
      orderBy: { closedAt: "desc" },
      take: 20,
    }),
  ]);
  const pendings = pendingItems.filter((i) => (i.qtyMissing ?? 0) > i.qtyMissingResolved);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manutenção e pendências"
        description="O que voltou com problema: itens em conserto e itens que não retornaram das locações."
        actions={<LinkButton href="/admin/estoque/saida?tipo=MANUTENCAO" icon="wrench">Enviar para manutenção</LinkButton>}
      />

      <Section title={`Em manutenção (${open.reduce((s, m) => s + m.quantity, 0)} itens)`} padded={false}>
        {open.length === 0 ? (
          <EmptyState>Nenhum item em manutenção.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {open.map((m) => (
              <li key={m.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">
                    <Link href={`/admin/produtos/${m.productId}`} className="hover:underline">{m.product.name}</Link>
                    {m.unit ? <span className="ml-1 font-mono text-sm text-faint">#{m.unit.code}</span> : null}
                    <span className="ml-2 tabular text-muted">× {m.quantity}</span>
                  </p>
                  <p className="text-sm text-muted">{m.reason}</p>
                  <p className="text-xs text-faint">
                    Desde {fmtDateTime(m.openedAt)} · {m.user.name}
                    {m.rental ? (
                      <>
                        {" · "}
                        <Link href={`/admin/locacoes/${m.rental.id}`} className="underline">Locação #{seq(m.rental.number)}</Link>
                      </>
                    ) : null}
                  </p>
                  {m.notes ? <p className="mt-1 text-xs text-faint">{m.notes}</p> : null}
                </div>
                <details className="md:w-80">
                  <summary className="rounded-md border border-line-strong px-3 py-2 text-center text-sm font-medium">Encerrar manutenção</summary>
                  <div className="mt-2 space-y-3 rounded-md border border-line p-3">
                    <ActionForm action={closeMaintenanceAction} submitLabel="Consertado — volta ao estoque" submitVariant="primary">
                      <input type="hidden" name="maintenanceId" value={m.id} />
                      <input type="hidden" name="outcome" value="CONCLUIDA" />
                      <div className="space-y-2">
                        <Field label="Custo (R$)">
                          <Input name="cost" inputMode="decimal" placeholder="0,00" />
                        </Field>
                        <Field label="Observação">
                          <Input name="notes" maxLength={500} />
                        </Field>
                      </div>
                    </ActionForm>
                    {can(user.role, "maintenance.discard") ? (
                      <ActionForm action={closeMaintenanceAction} submitLabel="Sem conserto — dar baixa" submitVariant="danger" confirm="Dar baixa definitiva deste item?">
                        <input type="hidden" name="maintenanceId" value={m.id} />
                        <input type="hidden" name="outcome" value="DESCARTADA" />
                        <input type="hidden" name="cost" value="" />
                        <Field label="Motivo da baixa">
                          <Input name="notes" maxLength={500} />
                        </Field>
                      </ActionForm>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div id="pendencias">
        <Section title={`Pendências — itens faltantes (${pendings.reduce((s, i) => s + (i.qtyMissing ?? 0) - i.qtyMissingResolved, 0)})`} padded={false}>
          {pendings.length === 0 ? (
            <EmptyState>Nenhum item faltante de locações.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {pendings.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/locacoes/${i.rental.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-paper">
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {i.product.name} <span className="tabular text-red-700">× {(i.qtyMissing ?? 0) - i.qtyMissingResolved}</span>
                      </span>
                      <span className="block text-sm text-muted">
                        Locação #{seq(i.rental.number)} · {i.rental.customer.name} {i.rental.customer.phone ? `· ${i.rental.customer.phone}` : ""}
                      </span>
                      {i.checkNote ? <span className="block text-xs text-faint">{i.checkNote}</span> : null}
                    </span>
                    <span className="shrink-0 text-sm text-muted underline">Resolver</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Manutenções encerradas recentemente" padded={false}>
        {recent.length === 0 ? (
          <EmptyState>Nenhuma ainda.</EmptyState>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>
                  {m.product.name} {m.unit ? `#${m.unit.code}` : ""} × {m.quantity} — {m.reason}
                </span>
                <span className="text-faint">
                  {m.status === "CONCLUIDA" ? "Consertado" : "Baixado"} em {fmtDateTime(m.closedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
