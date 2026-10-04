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
import { StockBar, StockLegend } from "@/components/stock/StockBar";
import { Icon } from "@/components/ui/icons";
import { ActionForm } from "@/components/ui/forms";
import { Badge, DataTable, DefinitionList, Field, Input, LinkButton, Notice, Section, buttonClass } from "@/components/ui/primitives";
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

  const total = p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending;
  const parts = { free, reserved: Math.min(reserved, p.qtyAvailable), rented: p.qtyRented, maintenance: p.qtyMaintenance };

  return (
    <div className="space-y-10">
      {sp.salvo ? <Notice tone="ok">Produto salvo.</Notice> : null}

      <nav className="flex items-center gap-1.5 text-[13px] text-faint" aria-label="Caminho">
        <Link href="/admin/produtos" className="hover:text-graphite">
          Catálogo
        </Link>
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
        <Link href={`/admin/produtos?categoria=${encodeURIComponent(p.category)}`} className="hover:text-graphite">
          {p.category}
        </Link>
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
        <span className="truncate text-muted">{p.name}</span>
      </nav>

      <div className="grid animate-rise gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <ProductMedia name={p.name} photoIds={photoIds} model={modelViewData} />
          {isAdmin && photoIds.length === 0 ? (
            <p className="mt-3 text-xs text-faint">
              Sem fotos ainda. Envie as fotos reais em <a href="#galeria" className="font-medium text-ink underline">Galeria de fotos</a>
              {modelViewData ? "" : " — a área 3D fica pronta para receber um arquivo .glb quando houver"}.
            </p>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="eyebrow">{p.category}</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-graphite md:text-[36px]">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className="font-mono text-[13px]">{p.sku}</span>
            {p.dimensions ? <span>· {p.dimensions}</span> : null}
            <span>· {KIND_LABEL[p.kind]}</span>
            {modelViewData ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-graphite">
                <Icon name="cube" className="h-3.5 w-3.5 text-ink" /> Modelo 3D
              </span>
            ) : null}
            {!p.active ? <Badge tone="muted">Desativado</Badge> : null}
          </p>

          <div className="mt-7 border-t border-line pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Disponível agora</p>
                <p className={`tabular mt-1.5 text-[44px] font-semibold leading-none tracking-[-0.03em] ${free > 0 ? "text-graphite" : "text-accent"}`}>
                  {free}
                  <span className="ml-1.5 text-base font-normal tracking-normal text-faint">
                    de {total} {p.unit}
                  </span>
                </p>
              </div>
              <span className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${free > 0 ? "bg-emerald-50 text-emerald-800" : "bg-accent-soft text-accent"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${free > 0 ? "bg-st-free" : "bg-st-late"}`} />
                {free > 0 ? "Pronto para locação" : "Sem unidades livres"}
              </span>
            </div>
            <StockBar className="mt-4" parts={parts} />
            <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-st-reserved" />{parts.reserved} reservado</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-st-rented" />{p.qtyRented} em locação</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-st-maint" />{p.qtyMaintenance} manutenção</span>
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-6 sm:grid-cols-3">
            {p.kind !== "SALE" ? (
              <>
                <div>
                  <dt className="eyebrow">Diária</dt>
                  <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-graphite">
                    {p.rentalPriceCents != null ? (
                      <>
                        {money(p.rentalPriceCents)}
                        <span className="text-sm font-normal text-faint">/dia</span>
                      </>
                    ) : (
                      <span className="text-base font-normal text-faint">Não aluga por dia</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Mensal</dt>
                  <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-graphite">
                    {p.monthlyPriceCents != null ? (
                      <>
                        {money(p.monthlyPriceCents)}
                        <span className="text-sm font-normal text-faint">/mês</span>
                      </>
                    ) : (
                      <span className="text-base font-normal text-faint">Não aluga por mês</span>
                    )}
                  </dd>
                </div>
              </>
            ) : null}
            {p.kind !== "RENTAL" ? (
              <div>
                <dt className="eyebrow">Venda</dt>
                <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-graphite">{p.salePriceCents != null ? money(p.salePriceCents) : <span className="text-base font-normal text-faint">A definir</span>}</dd>
              </div>
            ) : null}
          </dl>

          {p.active ? (
            <div className="mt-6 grid gap-2">
              {p.kind !== "SALE" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {p.monthlyPriceCents != null && p.rentalPriceCents == null ? null : (
                      <LinkButton href={`/admin/locacoes/nova?produto=${p.id}&modo=diaria`} variant="primary" size="lg" className="w-full" icon="calendar">
                        Alugar por dia
                      </LinkButton>
                    )}
                    {p.monthlyPriceCents != null ? (
                      <LinkButton
                        href={`/admin/locacoes/nova?produto=${p.id}&modo=mensal`}
                        variant={p.rentalPriceCents == null ? "primary" : "secondary"}
                        size="lg"
                        className="w-full"
                        icon="calendar"
                      >
                        Alugar por mês
                      </LinkButton>
                    ) : (
                      <LinkButton href={`/admin/locacoes/nova?produto=${p.id}&orcamento=1`} size="lg" className="w-full" icon="money">
                        Fazer orçamento
                      </LinkButton>
                    )}
                  </div>
                  {p.monthlyPriceCents != null ? (
                    <LinkButton href={`/admin/locacoes/nova?produto=${p.id}&orcamento=1`} className="w-full" icon="money">
                      Fazer orçamento
                    </LinkButton>
                  ) : null}
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {p.kind !== "SALE" ? (
                  <LinkButton href={`/admin/locacoes/nova?produto=${p.id}&saida=1`} className="w-full" icon="truck">
                    Alugar agora
                  </LinkButton>
                ) : null}
                {p.kind !== "RENTAL" ? (
                  <LinkButton href={`/admin/vendas/nova?produto=${p.id}`} variant={p.kind === "SALE" ? "primary" : "secondary"} className="w-full" icon="cart">
                    Vender
                  </LinkButton>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
            <Link href={`/admin/estoque/entrada?produto=${p.id}`} className="inline-flex items-center gap-1.5 text-muted hover:text-graphite"><Icon name="arrowIn" className="h-4 w-4" />Entrada</Link>
            <Link href={`/admin/estoque/saida?produto=${p.id}`} className="inline-flex items-center gap-1.5 text-muted hover:text-graphite"><Icon name="arrowOut" className="h-4 w-4" />Saída</Link>
            <Link href={`/admin/calendario?produto=${p.id}`} className="inline-flex items-center gap-1.5 text-muted hover:text-graphite"><Icon name="calendar" className="h-4 w-4" />Calendário</Link>
            {isAdmin ? <Link href={`/admin/produtos/${p.id}/editar`} className="inline-flex items-center gap-1.5 text-muted hover:text-graphite"><Icon name="edit" className="h-4 w-4" />Editar cadastro</Link> : null}
          </div>
          {p.description ? <p className="mt-6 whitespace-pre-line border-t border-line pt-6 text-sm leading-relaxed text-muted">{p.description}</p> : null}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section title="Situação do estoque">
          <StockLegend parts={parts} total={total} />
          <p className="mt-4 text-xs text-faint">
            No depósito agora: <b className="text-graphite">{p.qtyAvailable}</b> (inclui {reserved} reservado(s) para próximas locações) · Pendentes: {p.qtyPending} · Vendidos: {p.qtySold} · Perdidos/baixados: {p.qtyLost}
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
            <button className={`${buttonClass("secondary", "md")} w-full`}>Consultar período</button>
          </form>
          {!periodOk ? (
            <p className="mt-3 text-sm text-accent">A data final precisa ser depois da inicial.</p>
          ) : period ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="eyebrow">Livre no período</p>
              <p className={`tabular mt-1 text-3xl font-semibold tracking-tight ${period.free > 0 ? "text-st-free" : "text-accent"}`}>
                {period.free} <span className="text-base font-normal text-faint">{p.unit}</span>
              </p>
              <p className="mt-1 text-xs text-faint">
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
            <p className="text-sm text-faint">Nenhuma unidade. Registre uma entrada para criar unidades.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-md border border-line px-2.5 py-2 text-sm">
                  <span className="font-mono font-medium">#{u.code}</span>
                  <Badge tone={UNIT_STATUS[u.status].tone}>{UNIT_STATUS[u.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Modelo 3D">
            <ModelManager
              productId={p.id}
              model={modelViewData && p.model3d ? { ...modelViewData, fileName: p.model3d.fileName, size: p.model3d.size } : null}
              saveView={saveModelViewAction}
              removeAction={removeModelAction}
            />
          </Section>
          <Section id="galeria" title={`Galeria de fotos (${photoIds.length})`}>
            {photoIds.length ? (
              <ul className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photoIds.map((ph) => (
                  <li key={ph} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/fotos/${ph}?s=t`} alt="" className={`aspect-square w-full rounded-xl border border-line object-cover ${ph === p.photoId ? "ring-2 ring-ink ring-offset-2" : ""}`} loading="lazy" />
                    <div className="flex flex-wrap gap-1">
                      {ph !== p.photoId && p.images.some((i) => i.photoId === ph) ? (
                        <InlineAction action={mainImageAction} fields={{ productId: p.id, photoId: ph }}>Principal</InlineAction>
                      ) : ph === p.photoId ? (
                        <span className="text-xs text-faint">Principal</span>
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Section title="Cadastro">
          <DefinitionList
            items={[
              ["Controle", TRACKING_LABEL[p.trackingMode]],
              ["Unidade", p.unit],
              ["Dimensões", p.dimensions],
              ["Preço da diária", p.rentalPriceCents != null ? `${money(p.rentalPriceCents)}/dia` : "—"],
              ["Preço mensal", p.monthlyPriceCents != null ? `${money(p.monthlyPriceCents)}/mês` : "—"],
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
              <details className="mb-4 rounded-xl border border-line p-3">
                <summary className="text-sm font-medium">Ajuste de inventário</summary>
                <p className="mt-2 text-xs text-faint">
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
                <p className="text-xs text-faint">Produtos com movimentações são desativados (o histórico é mantido). Sem histórico, o cadastro é excluído.</p>
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
        id="historico"
        title="Histórico do estoque"
        padded={false}
        actions={<Link href={`/admin/movimentacoes?produto=${p.id}`} className="text-[13px] font-medium text-ink hover:underline">Ver tudo</Link>}
      >
        <MovementTable rows={movements} showProduct={false} />
      </Section>
    </div>
  );
}
