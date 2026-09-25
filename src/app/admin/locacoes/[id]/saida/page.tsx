import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductThumb } from "@/components/products/ProductThumb";
import { ActionForm } from "@/components/ui/forms";
import { Field, Input, Notice, PageHeader, Section } from "@/components/ui/primitives";
import { RENTAL_TRANSITIONS } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { availabilityForPeriod } from "@/server/availability";
import { prisma } from "@/server/db";
import { departAction } from "../../actions";

export const metadata: Metadata = { title: "Registrar saída" };

export default async function DeparturePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("rental.manage");
  const { id } = await params;
  const r = await prisma.rental.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { units: { where: { status: "AVAILABLE" }, orderBy: { code: "asc" } } } } } },
    },
  });
  if (!r) notFound();
  if (!RENTAL_TRANSITIONS[r.status].includes("SAIU")) redirect(`/admin/locacoes/${id}`);

  const now = new Date();
  const from = r.departureAt > now ? now : r.departureAt;
  const avail = r.expectedReturnAt > now ? await availabilityForPeriod(prisma, r.items.map((i) => i.productId), from, r.expectedReturnAt, { excludeRentalId: r.id }) : new Map();
  const problems = r.items.filter((i) => i.product.qtyAvailable < i.quantity || (avail.get(i.productId)?.free ?? 0) < i.quantity);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Registrar saída"
        description={`Locação #${seq(r.number)} — ${r.eventName} · ${r.customer.name}`}
        back={{ href: `/admin/locacoes/${r.id}`, label: `#${seq(r.number)}` }}
      />
      {r.expectedReturnAt <= now ? (
        <Notice tone="danger">O retorno previsto ({fmtDateTime(r.expectedReturnAt)}) já passou. Edite as datas da locação antes de registrar a saída.</Notice>
      ) : null}
      {problems.length ? (
        <div className="mb-4">
          <Notice tone="danger">
            Estoque insuficiente para: {problems.map((p) => p.product.name).join(", ")}. A saída será bloqueada até haver estoque.
          </Notice>
        </div>
      ) : null}
      <ActionForm action={departAction} submitLabel="Confirmar saída do estoque" submitVariant="accent" confirm="Confirmar a saída destes produtos?">
        <input type="hidden" name="id" value={r.id} />
        <Section title="Conferir produtos que estão saindo" padded={false}>
          <ul className="divide-y divide-zinc-100">
            {r.items.map((i) => {
              const ok = i.product.qtyAvailable >= i.quantity && (avail.get(i.productId)?.free ?? 0) >= i.quantity;
              return (
                <li key={i.id} className="flex gap-3 p-4">
                  <ProductThumb photoId={i.product.photoId} name={i.product.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{i.product.name}</span>
                      <span className="tabular text-lg font-semibold">
                        {i.quantity} <span className="text-sm font-normal text-zinc-500">{i.product.unit}</span>
                      </span>
                    </p>
                    <p className={`text-sm ${ok ? "text-zinc-500" : "font-medium text-red-700"}`}>
                      No depósito: {i.product.qtyAvailable} · Disponível: {avail.get(i.productId)?.free ?? 0}
                    </p>
                    {i.product.trackingMode === "UNIT" ? (
                      <fieldset className="mt-2">
                        <legend className="text-xs text-zinc-500">
                          Unidades que estão saindo (marque {i.quantity}; sem marcar, o sistema escolhe as de menor número)
                        </legend>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {i.product.units.map((u) => (
                            <label key={u.id} className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-1 font-mono text-sm has-checked:border-ink has-checked:bg-ink has-checked:text-white">
                              <input type="checkbox" name={`unit:${i.productId}`} value={u.id} className="sr-only" />#{u.code}
                            </label>
                          ))}
                          {i.product.units.length === 0 ? <span className="text-sm text-red-700">Nenhuma unidade disponível.</span> : null}
                        </div>
                      </fieldset>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Responsável pela retirada" hint="Quem está levando os produtos.">
            <Input name="pickupBy" maxLength={120} defaultValue={r.pickupBy ?? ""} />
          </Field>
          <div className="text-sm text-zinc-600 md:pt-6">
            Retorno previsto: <b>{fmtDateTime(r.expectedReturnAt)}</b>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
