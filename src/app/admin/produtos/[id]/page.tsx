import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModelManager } from "@/components/products/ModelManager";
import { ProductMedia } from "@/components/products/ProductMedia";
import { modelView } from "@/lib/model-view";
import { PhotoInput } from "@/components/photos/PhotoInput";
import { InlineAction } from "@/components/ui/forms";
import { addImagesAction, mainImageAction, removeImageAction, removeModelAction, saveModelViewAction } from "../media-actions";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { MovementTable, movementInclude } from "@/components/stock/MovementTable";
import { StockBreakdown } from "@/components/stock/StockBreakdown";
import { ActionForm } from "@/components/ui/forms";
import { Badge, DataTable, DefinitionList, Field, Input, LinkButton, Notice, Section } from "@/components/ui/primitives";
import { COMMITTING_STATUSES, KIND_LABEL, TRACKING_LABEL, can } from "@/lib/domain";
import { fmtDateTime, money, seq } from "@/lib/format";
import { addDays, fromLocalInput, toLocalInput, todayKey, zonedToUtc, TZ } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { availabilityForPeriod, reservedByProduct } from "@/server/availability";
import { prisma } from "@/server/db";
import { deleteProductAction, reactivateProductAction } from "../actions";
import { adjustInventoryAction } from "../../estoque/actions";

export const metadata: Metadata = { title: "Produto" };

const UNIT_STATUS: Record<string, { label: string; tone: "ok" | "accent" | "warn" | "danger" | "muted" }> = {
  AVAILABLE: { label: "Disponível", tone: "ok" },
  RENTED: { label: "Alugada", tone: "accent" },
  MAINTENANCE: { label: "Manutenção", tone: "warn" },
  PENDING: { label: "Pendente", tone: "danger" },
  SOLD: { label: "Vendida", tone: "muted" },
  LOST: { label: "Baixada", tone: "muted" },
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ de?: string; ate?: string; salvo?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await prisma.product.findUnique({
    where: { id },
    include: { units: true, images: { orderBy: { sortOrder: "asc" } }, model3d: { omit: { data: true } } },
  });
  if (!p) notFound();

  const [reservedMap, movements, commitments] = await Promise.all([
    reservedByProduct(prisma, [p.id]),
    prisma.stockMovement.findMany({ where: { productId: p.id }, include: movementInclude, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 50 }),
    prisma.rentalItem.findMany({
      where: { productId: p.id, rental: { status: { in: COMMITTING_STATUSES } } },
      include: { rental: { include: { customer: { select: { name: true } } } } },
      orderBy: { rental: { departureAt: "asc" } },
    }),
  ]);
  const reserved = reservedMap.get(p.id) ?? 0;
  const free = Math.max(0, p.qtyAvailable - reserved);

  // Consulta de disponibilidade por período
  const fromDefault = zonedToUtc(todayKey(), "08:00", TZ);
  const from = fromLocalInput(sp.de ?? "") ?? fromDefault;
  const to = fromLocalInput(sp.ate ?? "") ?? zonedToUtc(addDays(todayKey(), 1), "18:00", TZ);
  const periodOk = to > from;
  const period = periodOk ? (await availabilityForPeriod(prisma, [p.id], from, to)).get(p.id) : undefined;

  const units = [...p.units].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  const isAdmin = can(user.role, "product.manage");
  const photoIds = [...new Set([...(p.photoId ? [p.photoId] : []), ...p.images.map((i) => i.photoId)])];
  const modelViewData = modelView(p.id, p.model3d);

  return (
    <div className="space-y-4">
      {sp.salvo ? <Notice tone="ok">Produto salvo.</Notice> : null}
      <Link href="/admin/produtos" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">← Estoque</Link>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <ProductMedia name={p.name} photoIds={photoIds} model={modelViewData} />

        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{p.category}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="font-mono">{p.sku}</span>
            {p.dimensions ? <span>· {p.dimensions}</span> : null}
            <Badge>{KIND_LABEL[p.kind]}</Badge>
            {!p.active ? <Badge tone="muted">Desativado</Badge> : null}
          </p>

          <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Disponível agora</p>
            <p className={`tabular mt-0.5 text-4xl font-semibold ${free > 0 ? "text-zinc-900" : "text-red-700"}`}>
              {free} <span className="text-base font-normal text-zinc-500">{p.unit}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Total {p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending} · reservado {reserved} · em locação {p.qtyRented} · manutenção {p.qtyMaintenance}
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3">
            {p.kind !== "SALE" ? (
              <div>
                <dt className="text-xs text-zinc-500">Locação</dt>
                <dd className="tabular text-xl font-semibold">{money(p.rentalPriceCents)}</dd>
              </div>
            ) : null}
            {p.kind !== "RENTAL" ? (
              <div>
                <dt className="text-xs text-zinc-500">Venda</dt>
                <dd className="tabular text-xl font-semibold">{money(p.salePriceCents)}</dd>
              </div>
            ) : null}
          </dl>

          {p.active ? (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {p.kind !== "SALE" ? (
                <>
                  <LinkButton href={`/admin/locacoes/nova?produto=${p.id}&saida=1`} variant="primary" size="lg" className="w-full">Alugar</LinkButton>
                  <LinkButton href={`/admin/locacoes/nova?produto=${p.id}`} size="lg" className="w-full">Reservar</LinkButton>
                </>
              ) : null}
              {p.kind !== "RENTAL" ? <LinkButton href={`/admin/vendas/nova?produto=${p.id}`} size="lg" className="w-full">Vender</LinkButton> : null}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href={`/admin/estoque/entrada?produto=${p.id}`} icon="arrowIn" size="sm">Entrada</LinkButton>
            <LinkButton href={`/admin/estoque/saida?produto=${p.id}`} icon="arrowOut" size="sm">Saída</LinkButton>
            {isAdmin ? <LinkButton href={`/admin/produtos/${p.id}/editar`} icon="edit" size="sm">Editar cadastro</LinkButton> : null}
          </div>
          {p.description ? <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-700">{p.description}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Situação do estoque">
          <StockBreakdown free={free} reserved={Math.min(reserved, p.qtyAvailable)} rented={p.qtyRented} maintenance={p.qtyMaintenance} pending={p.qtyPending} unit={p.unit} />
          <p className="mt-3 text-xs text-zinc-500">
            No depósito agora: <b>{p.qtyAvailable}</b> (inclui {reserved} reservado(s) para próximas locações) · Vendidos: {p.qtySold} · Perdidos/baixados: {p.qtyLost}
          </p>
        </Section>

        <Section title="Disponibilidade por data">
          <form className="space-y-3">
            <Field label="De">
              <Input type="datetime-local" name="de" defaultValue={toLocalInput(from)} />
            </Field>
            <Field label="Até">
              <Input type="datetime-local" name="ate" defaultValue={toLocalInput(to)} />
            </Field>
            <button className="h-10 w-full rounded-md border border-zinc-300 text-sm font-medium hover:bg-zinc-50">Consultar</button>
          </form>
          {!periodOk ? (
            <p className="mt-3 text-sm text-red-700">A data final precisa ser depois da inicial.</p>
          ) : period ? (
            <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm">
              <p className="text-zinc-600">Livre no período:</p>
              <p className={`tabular text-3xl font-semibold ${period.free > 0 ? "text-emerald-700" : "text-red-700"}`}>
                {period.free} <span className="text-base font-normal text-zinc-500">{p.unit}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Capacidade {period.capacity} (depósito + alugados que voltam) − pico comprometido {period.peak}. Itens em manutenção não contam.
              </p>
            </div>
          ) : null}
        </Section>
      </div>

      <Section title={`Locações com este produto (${commitments.length})`} padded={false}>
        <DataTable
          rows={commitments}
          rowKey={(c) => c.id}
          rowHref={(c) => `/admin/locacoes/${c.rental.id}`}
          empty="Nenhuma reserva ou locação em andamento."
          columns={[
            { header: "Locação", mobile: "title", cell: (c) => <>#{seq(c.rental.number)} — {c.rental.eventName}</> },
            { header: "Cliente", cell: (c) => c.rental.customer.name },
            { header: "Saída", cell: (c) => fmtDateTime(c.rental.departureAt) },
            { header: "Retorno", cell: (c) => fmtDateTime(c.rental.expectedReturnAt) },
            { header: "Qtd.", align: "right", cell: (c) => <span className="tabular font-medium">{c.quantity}</span> },
            { header: "Status", cell: (c) => <RentalStatusBadge rental={c.rental} /> },
          ]}
        />
      </Section>

      {p.trackingMode === "UNIT" ? (
        <Section title={`Unidades numeradas (${units.length})`}>
          {units.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma unidade. Registre uma entrada para criar unidades.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-2.5 py-2 text-sm">
                  <span className="font-mono font-medium">#{u.code}</span>
                  <Badge tone={UNIT_STATUS[u.status].tone}>{UNIT_STATUS[u.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Modelo 3D">
            <ModelManager
              productId={p.id}
              model={modelViewData && p.model3d ? { ...modelViewData, fileName: p.model3d.fileName, size: p.model3d.size } : null}
              saveView={saveModelViewAction}
              removeAction={removeModelAction}
            />
          </Section>
          <Section title={`Galeria de fotos (${photoIds.length})`}>
            {photoIds.length ? (
              <ul className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photoIds.map((ph) => (
                  <li key={ph} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/fotos/${ph}`} alt="" className={`aspect-square w-full rounded-lg object-cover ${ph === p.photoId ? "ring-2 ring-ink" : ""}`} loading="lazy" />
                    <div className="flex flex-wrap gap-1">
                      {ph !== p.photoId && p.images.some((i) => i.photoId === ph) ? (
                        <InlineAction action={mainImageAction} fields={{ productId: p.id, photoId: ph }}>Principal</InlineAction>
                      ) : ph === p.photoId ? (
                        <span className="text-xs text-zinc-500">Principal</span>
                      ) : null}
                      {p.images.some((i) => i.photoId === ph) ? (
                        <InlineAction action={removeImageAction} fields={{ productId: p.id, photoId: ph }} variant="danger" confirm="Remover esta foto da galeria?">×</InlineAction>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <ActionForm action={addImagesAction} submitLabel="Adicionar à galeria" submitVariant="secondary">
              <input type="hidden" name="productId" value={p.id} />
              <PhotoInput name="photoIds" multiple label="Fotos" />
            </ActionForm>
          </Section>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Cadastro">
          <DefinitionList
            items={[
              ["Controle", TRACKING_LABEL[p.trackingMode]],
              ["Unidade", p.unit],
              ["Dimensões", p.dimensions],
              ["Preço de locação", money(p.rentalPriceCents)],
              ["Preço de venda", money(p.salePriceCents)],
              ["Estoque mínimo (alerta)", p.minStock || "Sem alerta"],
              ["Cadastrado em", fmtDateTime(p.createdAt)],
              ["Descrição", p.description],
              ["Observações", p.notes],
            ]}
          />
        </Section>
        {isAdmin ? (
          <Section title="Administração">
            {p.trackingMode === "QUANTITY" && p.active ? (
              <details className="mb-4 rounded-md border border-zinc-200 p-3">
                <summary className="text-sm font-medium">Ajuste de inventário</summary>
                <p className="mt-2 text-xs text-zinc-500">
                  Use após uma contagem física. Informe quantas unidades há no depósito agora (sem contar as alugadas e em manutenção). Saldo atual: {p.qtyAvailable}.
                </p>
                <ActionForm action={adjustInventoryAction} submitLabel="Aplicar ajuste" submitVariant="secondary" confirm="Confirmar o ajuste de inventário?">
                  <input type="hidden" name="productId" value={p.id} />
                  <div className="mt-3 space-y-3">
                    <Field label="Quantidade contada no depósito" required>
                      <Input name="countedQty" type="number" min={0} required inputMode="numeric" />
                    </Field>
                    <Field label="Motivo" required>
                      <Input name="reason" required maxLength={200} placeholder="Ex.: contagem mensal" />
                    </Field>
                  </div>
                </ActionForm>
              </details>
            ) : null}
            {p.active ? (
              <ActionForm
                action={deleteProductAction}
                submitLabel="Excluir / desativar produto"
                submitVariant="danger"
                confirm="Produtos com histórico são apenas desativados. Continuar?"
              >
                <input type="hidden" name="id" value={p.id} />
                <p className="text-xs text-zinc-500">Produtos com movimentações são desativados (o histórico é mantido). Sem histórico, o cadastro é excluído.</p>
              </ActionForm>
            ) : (
              <ActionForm action={reactivateProductAction} submitLabel="Reativar produto" submitVariant="secondary">
                <input type="hidden" name="id" value={p.id} />
              </ActionForm>
            )}
          </Section>
        ) : null}
      </div>

      <Section
        title="Histórico do estoque"
        padded={false}
        actions={<Link href={`/admin/movimentacoes?produto=${p.id}`} className="text-sm text-zinc-600 underline">Ver tudo</Link>}
      >
        <MovementTable rows={movements} showProduct={false} />
      </Section>
    </div>
  );
}
