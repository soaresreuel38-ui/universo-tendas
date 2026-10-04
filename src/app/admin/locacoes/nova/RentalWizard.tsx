"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, Textarea, buttonClass } from "@/components/ui/primitives";
import { LazyModel } from "@/components/three/LazyModel";
import { ProductImage } from "@/components/products/ProductImage";
import type { ModelViewSettings } from "@/components/three/ModelViewer";
import type { ActionState } from "@/lib/action-state";
import { BILLING_LABEL, BILLING_SHORT, BILLING_UNIT, periodEnd, periodLabel, periodsBetween, tablePrice, type BillingMode } from "@/lib/billing";
import { money, moneyInput, parseMoney } from "@/lib/format";

export type WizardCustomer = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
};

export type WizardProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  dimensions: string | null;
  rentalPriceCents: number | null;
  monthlyPriceCents: number | null;
  photoId: string | null;
  model: { url: string; settings: ModelViewSettings } | null;
};

/** priceOverride: valor digitado pela pessoa; sem ele, vale o preço de tabela × diárias/meses. */
type Line = { productId: string; quantity: number; priceOverride: string | null };

/** Date (horário do navegador) → valor de <input type="datetime-local">. */
function toLocalValue(d: Date) {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STEPS = ["Cliente", "Período", "Produtos", "Revisão"] as const;

/** "2026-09-27T08:00" → "27/09/2026 · 08:00" */
function localLabel(v: string) {
  const [d, t] = v.split("T");
  const [y, m, dd] = (d ?? "").split("-");
  return y && m && dd ? `${dd}/${m}/${y}${t ? ` · ${t.slice(0, 5)}` : ""}` : "";
}

export function RentalWizard({
  action,
  customers,
  products,
  defaults,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  customers: WizardCustomer[];
  products: WizardProduct[];
  defaults: {
    departureAt: string;
    expectedReturnAt: string;
    customerId?: string;
    productId?: string;
    immediate: boolean;
    quote?: boolean;
    paymentTerms: string;
    mode?: BillingMode;
  };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [step, setStep] = useState(0);

  // ── Cliente
  const [customerId, setCustomerId] = useState(defaults.customerId ?? "");
  const [newCustomer, setNewCustomer] = useState(false);
  const [nc, setNc] = useState({ name: "", document: "", phone: "", whatsapp: "", email: "", address: "", city: "Sinop - MT", notes: "" });
  const [cq, setCq] = useState("");
  const customer = customers.find((c) => c.id === customerId);
  const customerResults = useMemo(() => {
    const q = norm(cq.trim());
    const digits = cq.replace(/\D/g, "");
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => norm(c.name).includes(q) || (digits.length >= 3 && [c.phone, c.whatsapp, c.document].some((v) => v?.replace(/\D/g, "").includes(digits))))
      .slice(0, 12);
  }, [cq, customers]);

  // ── Período / evento
  const [mode, setMode] = useState<BillingMode>(defaults.mode ?? "DIARIA");
  const [departureAt, setDepartureAt] = useState(defaults.departureAt);
  const [expectedReturnAt, setExpectedReturnAt] = useState(defaults.expectedReturnAt);
  const periods = departureAt && expectedReturnAt ? periodsBetween(mode, new Date(departureAt), new Date(expectedReturnAt)) : 1;
  // Ao mudar a modalidade, a quantidade ou a retirada, a devolução acompanha (e continua editável).
  const applyPeriod = (m: BillingMode, n: number, from = departureAt) => {
    if (!from) return;
    setExpectedReturnAt(toLocalValue(periodEnd(m, new Date(from), Math.max(1, Math.min(n, m === "MENSAL" ? 120 : 3650)))));
  };
  const [eventName, setEventName] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [setupAt, setSetupAt] = useState("");
  const [teardownAt, setTeardownAt] = useState("");

  // ── Produtos
  const [lines, setLines] = useState<Line[]>(() => {
    const p = products.find((x) => x.id === defaults.productId);
    return p ? [{ productId: p.id, quantity: 1, priceOverride: null }] : [];
  });
  const [pq, setPq] = useState("");
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>({});
  const [free, setFree] = useState<Record<string, number>>({});
  const [checking, setChecking] = useState(false);
  const [viewer, setViewer] = useState<WizardProduct | null>(null);
  const datesInvalid = !departureAt || !expectedReturnAt || expectedReturnAt <= departureAt;

  // Disponibilidade no período para todo o catálogo (o servidor revalida ao salvar).
  const allIds = useMemo(() => products.map((p) => p.id).join(","), [products]);
  useEffect(() => {
    if (datesInvalid || !allIds) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const params = new URLSearchParams({ de: departureAt, ate: expectedReturnAt, ids: allIds });
        const res = await fetch(`/api/disponibilidade?${params}`, { signal: ctrl.signal });
        if (res.ok) setFree(((await res.json()) as { items: Record<string, number> }).items);
      } catch {
        /* cancelado */
      } finally {
        setChecking(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [departureAt, expectedReturnAt, allIds, datesInvalid]);

  const catalog = useMemo(() => {
    const q = norm(pq.trim());
    return q ? products.filter((p) => norm(`${p.name} ${p.sku} ${p.category}`).includes(q)) : products;
  }, [pq, products]);

  const lineFor = (id: string) => lines.find((l) => l.productId === id);
  const setQty = (id: string, quantity: number) =>
    setLines((ls) => (quantity <= 0 ? ls.filter((l) => l.productId !== id) : ls.map((l) => (l.productId === id ? { ...l, quantity } : l))));
  const add = (p: WizardProduct, quantity: number) =>
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === p.id);
      if (existing) return ls.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + quantity } : l));
      return [...ls, { productId: p.id, quantity, priceOverride: null }];
    });
  const over = lines.filter((l) => free[l.productId] !== undefined && l.quantity > free[l.productId]);
  /** Preço por unidade para o período todo: tabela da modalidade × diárias/meses (ou o valor digitado). */
  const autoPrice = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    const t = p ? tablePrice(p, mode) : null;
    return t == null ? "" : moneyInput(t * periods);
  };
  const priceOf = (l: Line) => l.priceOverride ?? autoPrice(l.productId);

  // ── Revisão
  const [discount, setDiscount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);
  const [pickupBy, setPickupBy] = useState("");
  const [notes, setNotes] = useState("");
  const gross = lines.reduce((s, l) => s + l.quantity * (parseMoney(priceOf(l)) ?? 0), 0);
  const total = Math.max(0, gross - (parseMoney(discount) ?? 0));

  const customerOk = newCustomer ? nc.name.trim() && (nc.phone.trim() || nc.whatsapp.trim()) : Boolean(customerId);
  const stepOk = [customerOk, !datesInvalid, lines.length > 0 && over.length === 0, true];
  const customerName = newCustomer ? nc.name.trim() : (customer?.name ?? "");

  function submit(status: "ORCAMENTO" | "RESERVADA" | "SAIU", andContract = false) {
    const fd = new FormData();
    if (newCustomer) {
      fd.set("newCustomer", "1");
      fd.set("newCustomerName", nc.name);
      fd.set("newCustomerDocument", nc.document);
      fd.set("newCustomerPhone", nc.phone);
      fd.set("newCustomerWhatsapp", nc.whatsapp);
      fd.set("newCustomerEmail", nc.email);
      fd.set("newCustomerAddress", nc.address);
      fd.set("newCustomerCity", nc.city);
      fd.set("newCustomerNotes", nc.notes);
    } else fd.set("customerId", customerId);
    // Nome do evento é opcional: sem ele, a locação leva o nome do cliente.
    const name = eventName.trim() || `Locação — ${customerName}`.slice(0, 120);
    Object.entries({ eventName: name, eventAddress, departureAt, expectedReturnAt, eventAt, setupAt, teardownAt, discount, paymentTerms, pickupBy, notes }).forEach(([k, v]) => fd.set(k, v));
    fd.set("billingMode", mode);
    fd.set("periodCount", String(periods));
    fd.set("status", status);
    if (andContract) fd.set("andContract", "1");
    fd.set("items", JSON.stringify(lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: priceOf(l) }))));
    startTransition(() => formAction(fd));
  }

  const address = newCustomer ? [nc.address, nc.city].filter(Boolean).join(", ") : [customer?.address, customer?.city].filter(Boolean).join(", ");

  return (
    <div className="pb-24">
      {/* Etapas: a quinta é o contrato, gerado a partir da revisão */}
      <ol className="mb-7 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Etapas">
        {[...STEPS, "Contrato"].map((label, i) => {
          const done = i < step;
          const current = i === step;
          const reachable = i < STEPS.length && (i <= step || stepOk.slice(0, i).every(Boolean));
          return (
            <li key={label} className="flex shrink-0 items-center gap-2">
              {i > 0 ? <span className={`h-px w-5 sm:w-10 ${done || current ? "bg-ink" : "bg-line-strong"}`} aria-hidden /> : null}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={current ? "step" : undefined}
                className="flex items-center gap-2 rounded-full py-1 pr-2 text-[13px] disabled:cursor-default"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    current ? "bg-ink text-white" : done ? "bg-ink-tint text-ink" : "border border-line-strong bg-white text-faint"
                  }`}
                >
                  {done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`font-medium ${current ? "text-graphite" : done ? "text-muted" : "text-faint"} ${current ? "" : "max-sm:hidden"}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <section className="animate-rise rounded-2xl border border-line bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-graphite">Para quem é a locação?</h2>
          {!newCustomer ? (
            <>
              <div className="relative mt-3">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  value={cq}
                  onChange={(e) => setCq(e.target.value)}
                  placeholder="Nome, telefone ou CPF/CNPJ"
                  className="h-12 w-full rounded-lg border border-line-strong pl-9 pr-3 outline-none focus:border-ink focus:ring-4 focus:ring-ink/10"
                  autoFocus
                />
              </div>
              <ul className="mt-2 divide-y divide-line">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        if (!eventAddress && (c.address || c.city)) setEventAddress([c.address, c.city].filter(Boolean).join(", "));
                        setStep(1);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-paper ${c.id === customerId ? "bg-paper" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-faint">{[c.phone ?? c.whatsapp, c.document, c.city].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="shrink-0 text-sm text-faint">{c.id === customerId ? "Selecionado" : "Escolher"}</span>
                    </button>
                  </li>
                ))}
                {customerResults.length === 0 ? <li className="px-2 py-3 text-sm text-faint">Nenhum cliente encontrado.</li> : null}
              </ul>
              <button type="button" onClick={() => setNewCustomer(true)} className={`${buttonClass("secondary", "md")} mt-3`}>
                <Icon name="plus" className="h-4 w-4" /> Novo cliente
              </button>
              {customer ? (
                <div className="mt-4 rounded-lg bg-paper p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-muted">{[customer.document, customer.phone ?? customer.whatsapp, customer.email].filter(Boolean).join(" · ") || "Sem documento/telefone"}</p>
                  <p className="text-muted">{[customer.address, customer.city].filter(Boolean).join(" · ")}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nome / razão social" required className="sm:col-span-2">
                <Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} maxLength={120} autoFocus />
              </Field>
              <Field label="CPF / CNPJ">
                <Input value={nc.document} onChange={(e) => setNc({ ...nc, document: e.target.value })} maxLength={20} inputMode="numeric" />
              </Field>
              <Field label="Telefone" required>
                <Input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} maxLength={30} inputMode="tel" />
              </Field>
              <Field label="WhatsApp" hint="Em branco = mesmo telefone">
                <Input value={nc.whatsapp} onChange={(e) => setNc({ ...nc, whatsapp: e.target.value })} maxLength={30} inputMode="tel" />
              </Field>
              <Field label="E-mail">
                <Input value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} type="email" maxLength={160} />
              </Field>
              <Field label="Endereço" className="sm:col-span-2">
                <Input value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} maxLength={300} />
              </Field>
              <Field label="Cidade">
                <Input value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} maxLength={120} />
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <Textarea value={nc.notes} onChange={(e) => setNc({ ...nc, notes: e.target.value })} rows={2} maxLength={2000} />
              </Field>
              {customers.length ? (
                <button type="button" onClick={() => setNewCustomer(false)} className="text-left text-sm text-muted underline sm:col-span-2">
                  Escolher cliente já cadastrado
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="animate-rise rounded-2xl border border-line bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-graphite">Como e quando?</h2>

          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modalidade da locação">
            {(["DIARIA", "MENSAL"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => {
                  setMode(m);
                  applyPeriod(m, 1);
                }}
                className={`rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${mode === m ? "border-ink bg-ink-tint" : "border-line bg-white hover:border-line-strong"}`}
              >
                <span className={`block text-base font-semibold ${mode === m ? "text-ink" : "text-graphite"}`}>{m === "DIARIA" ? "Diária" : "Mensal"}</span>
                <span className="block text-xs text-muted">{m === "DIARIA" ? "Cobrança por dia" : "Cobrança por mês"}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label="Retirada" required>
              <Input
                type="datetime-local"
                value={departureAt}
                onChange={(e) => {
                  setDepartureAt(e.target.value);
                  if (e.target.value) applyPeriod(mode, periods, e.target.value);
                }}
              />
            </Field>
            <div>
              <span className="text-[13px] font-medium text-graphite">{mode === "MENSAL" ? "Quantos meses?" : "Quantas diárias?"}</span>
              <div className="mt-1.5 flex h-[46px] items-center justify-between rounded-lg border border-line-strong bg-white sm:justify-start">
                <button type="button" aria-label={mode === "MENSAL" ? "Menos um mês" : "Menos uma diária"} className="h-full w-11 text-lg text-muted hover:text-graphite" onClick={() => applyPeriod(mode, periods - 1)}>
                  −
                </button>
                <span className="tabular w-12 text-center text-base font-semibold" aria-live="polite" data-testid="period-count">
                  {periods}
                </span>
                <button type="button" aria-label={mode === "MENSAL" ? "Mais um mês" : "Mais uma diária"} className="h-full w-11 text-lg text-muted hover:text-graphite" onClick={() => applyPeriod(mode, periods + 1)}>
                  +
                </button>
              </div>
            </div>
            <Field label="Devolução" required>
              <Input type="datetime-local" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
            </Field>
          </div>
          {datesInvalid ? (
            <p className="mt-2 text-sm text-accent">A devolução precisa ser depois da retirada.</p>
          ) : (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm text-graphite">
              <Icon name="calendar" className="h-4 w-4 text-ink" />
              <b className="font-semibold">{BILLING_LABEL[mode]}</b> · {periodLabel(mode, periods)}
            </p>
          )}

          <Field label="Nome do evento ou obra (opcional)" className="mt-5">
            <Input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={120} placeholder={customerName ? `Ex.: Casamento — ou deixe em branco para “Locação — ${customerName}”` : "Ex.: Casamento"} />
          </Field>

          <details className="group mt-5 rounded-xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-graphite">
              Mais detalhes (opcional): entrega, data do evento, montagem e desmontagem
              <Icon name="chevronRight" className="h-4 w-4 text-faint transition-transform group-open:rotate-90" />
            </summary>
            <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
              <Field label="Endereço de entrega / evento" className="sm:col-span-2">
                <Input value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} maxLength={300} />
                {address && eventAddress !== address ? (
                  <button type="button" onClick={() => setEventAddress(address)} className="mt-1 text-xs text-muted underline">
                    Usar endereço do cliente
                  </button>
                ) : null}
              </Field>
              <Field label="Data do evento">
                <Input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
              </Field>
              <Field label="Montagem">
                <Input type="datetime-local" value={setupAt} onChange={(e) => setSetupAt(e.target.value)} />
              </Field>
              <Field label="Desmontagem">
                <Input type="datetime-local" value={teardownAt} onChange={(e) => setTeardownAt(e.target.value)} />
              </Field>
            </div>
          </details>
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-graphite">O que o cliente vai alugar?</h2>
            <p className="text-xs text-faint">
              {BILLING_LABEL[mode]} · {periodLabel(mode, periods)} · disponibilidade no período{checking ? " — verificando…" : ""}
            </p>
          </div>
          <div className="relative mb-3">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Buscar produto ou código" className="h-12 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 outline-none focus:border-ink focus:ring-4 focus:ring-ink/10" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((p) => {
              const f = free[p.id];
              const inCart = lineFor(p.id)?.quantity ?? 0;
              const draft = qtyDraft[p.id] ?? 1;
              const left = f === undefined ? undefined : f - inCart;
              return (
                <li key={p.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition-shadow ${inCart ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:shadow-[0_8px_24px_-16px_rgba(22,24,29,0.25)]"}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
                    <ProductImage photoId={p.photoId} name={p.name} />
                    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-medium text-graphite shadow-sm backdrop-blur">
                      <span className={`h-1.5 w-1.5 rounded-full ${left === undefined ? "bg-line-strong" : left > 0 ? "bg-st-free" : "bg-st-late"}`} aria-hidden />
                      {f === undefined ? (checking ? "Verificando…" : "—") : `${f} no período`}
                    </span>
                    {inCart ? (
                      <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white">
                        <Icon name="check" className="h-3.5 w-3.5" /> {inCart} na lista
                      </span>
                    ) : null}
                    {p.model ? (
                      <button type="button" onClick={() => setViewer(p)} className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-graphite/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        <Icon name="cube" className="h-3.5 w-3.5" /> Ver em 3D
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-semibold leading-tight tracking-[-0.01em] text-graphite">{p.name}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      <span className="font-mono">{p.sku}</span>
                      {p.dimensions ? ` · ${p.dimensions}` : ""}
                    </p>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="tabular text-sm">
                        <span className={`text-lg font-semibold ${left === undefined ? "text-faint" : left > 0 ? "text-st-free" : "text-accent"}`}>{f ?? "—"}</span>{" "}
                        <span className="text-faint">disponíveis</span>
                      </p>
                      <p className="tabular text-right text-[15px] font-semibold text-graphite">
                        {tablePrice(p, mode) != null ? (
                          <>
                            {money(tablePrice(p, mode))}
                            <span className="text-xs font-normal text-faint">{BILLING_UNIT[mode]}</span>
                          </>
                        ) : (
                          <span className="text-sm font-normal text-faint">{mode === "MENSAL" ? "Sem preço mensal" : "Sem preço da diária"}</span>
                        )}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-line-strong">
                        <button type="button" aria-label="Menos" className="h-10 w-10 text-lg text-muted hover:text-graphite" onClick={() => setQtyDraft({ ...qtyDraft, [p.id]: Math.max(1, draft - 1) })}>
                          −
                        </button>
                        <input
                          aria-label="Quantidade"
                          inputMode="numeric"
                          value={draft}
                          onChange={(e) => setQtyDraft({ ...qtyDraft, [p.id]: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })}
                          className="h-10 w-12 border-x border-line text-center font-medium tabular outline-none"
                        />
                        <button type="button" aria-label="Mais" className="h-10 w-10 text-lg text-muted hover:text-graphite" onClick={() => setQtyDraft({ ...qtyDraft, [p.id]: draft + 1 })}>
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={left !== undefined && draft > left}
                        onClick={() => {
                          add(p, draft);
                          setQtyDraft({ ...qtyDraft, [p.id]: 1 });
                        }}
                        className={`${buttonClass("primary", "md")} flex-1`}
                      >
                        {inCart ? `Adicionar (+${inCart} na lista)` : "Adicionar"}
                      </button>
                    </div>
                    {left !== undefined && draft > left ? <p className="mt-2 text-xs font-medium text-accent">Não há estoque suficiente para o período selecionado. Disponível: {Math.max(0, left)}.</p> : null}
                  </div>
                </li>
              );
            })}
            {catalog.length === 0 ? <li className="text-sm text-faint">Nenhum produto encontrado.</li> : null}
          </ul>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <div className="animate-rise rounded-2xl border border-line bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold tracking-[-0.015em] text-graphite">Revisão</h2>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-line py-5 text-sm sm:grid-cols-5">
              {[
                ["Cliente", newCustomer ? `${nc.name} (novo)` : customer?.name],
                ["Modalidade", `${BILLING_SHORT[mode]} · ${periodLabel(mode, periods)}`],
                ["Evento", eventName.trim() || `Locação — ${customerName}`],
                ["Retirada", localLabel(departureAt)],
                ["Devolução", localLabel(expectedReturnAt)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mt-1 truncate font-medium text-graphite">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Desconto (R$)">
                <Input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0,00" />
              </Field>
              <Field label="Responsável pela retirada">
                <Input value={pickupBy} onChange={(e) => setPickupBy(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Condição / prazo de pagamento" className="sm:col-span-3">
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} maxLength={1000} />
              </Field>
              <Field label="Observações" className="sm:col-span-3">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
              </Field>
            </div>
            {defaults.quote || defaults.immediate ? null : (
              <ul className="mt-6 grid gap-2 border-t border-line pt-5 text-sm sm:grid-cols-3">
                <li className="rounded-xl bg-ink-tint p-3.5">
                  <b className="block text-ink">Reservar e gerar contrato</b>
                  <span className="text-muted">Bloqueia os itens no período e já cria o contrato para assinatura.</span>
                </li>
                <li className="rounded-xl bg-paper p-3.5">
                  <b className="block text-graphite">Reservar sem contrato</b>
                  <span className="text-muted">Bloqueia os itens. O contrato pode ser gerado depois.</span>
                </li>
                <li className="rounded-xl bg-paper p-3.5">
                  <b className="block text-graphite">Salvar orçamento</b>
                  <span className="text-muted">Não bloqueia o estoque. Vira reserva quando o cliente aprovar.</span>
                </li>
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* Lista selecionada (sempre visível a partir dos produtos) */}
      {step >= 2 && lines.length ? (
        <section className="mt-6 animate-rise rounded-2xl border border-line bg-white p-5">
          <h3 className="eyebrow">Itens da locação</h3>
          <p className="mt-1 text-xs text-faint">
            Valor por unidade para {periodLabel(mode, periods)} ({BILLING_LABEL[mode].toLowerCase()}). Calculado pela tabela; pode ser alterado.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {lines.map((l) => {
              const p = products.find((x) => x.id === l.productId)!;
              const f = free[l.productId];
              const bad = f !== undefined && l.quantity > f;
              return (
                <li key={l.productId} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_auto_8rem_7rem]">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
                      <ProductImage photoId={p.photoId} name={p.name} />
                    </span>
                    <span className="min-w-0">
                    <span className="block truncate font-medium text-graphite">{p.name}</span>
                    <span className={`block text-xs ${bad ? "font-medium text-accent" : "text-faint"}`}>
                      {bad ? `Não há estoque suficiente para o período selecionado. Disponível: ${f}` : `Disponível no período: ${f ?? "—"}`}
                    </span>
                    </span>
                  </span>
                  <span className="flex items-center rounded-lg border border-line-strong">
                    <button type="button" aria-label="Menos" className="h-9 w-9" onClick={() => setQty(l.productId, l.quantity - 1)}>
                      −
                    </button>
                    <span className="w-9 text-center tabular">{l.quantity}</span>
                    <button type="button" aria-label="Mais" className="h-9 w-9" onClick={() => setQty(l.productId, l.quantity + 1)}>
                      +
                    </button>
                  </span>
                  <label className="col-span-2 flex items-center gap-1 text-sm sm:col-span-1">
                    <span className="text-faint">R$</span>
                    <input
                      aria-label="Preço unitário"
                      value={priceOf(l)}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, priceOverride: e.target.value } : x)))}
                      inputMode="decimal"
                      className="h-9 w-full rounded-lg border border-line-strong px-2 text-right tabular outline-none focus:border-ink"
                    />
                  </label>
                  <span className="tabular text-right text-sm font-medium max-sm:hidden">{money(l.quantity * (parseMoney(priceOf(l)) ?? 0))}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
            <span className="eyebrow">Total{discount ? " com desconto" : ""}</span>
            <span className="tabular text-2xl font-semibold tracking-tight text-graphite">{money(total)}</span>
          </div>
        </section>
      ) : null}

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-[248px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost", "lg")}>
              Voltar
            </button>
          ) : null}
          <span className="tabular mr-auto text-sm text-muted">
            {lines.length ? `${lines.reduce((s, l) => s + l.quantity, 0)} itens · ${money(total)}` : ""}
          </span>
          {step < 3 ? (
            <button type="button" disabled={!stepOk[step]} onClick={() => setStep(step + 1)} className={buttonClass("primary", "lg")}>
              Continuar
            </button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => submit("ORCAMENTO")} className={buttonClass(defaults.quote ? "primary" : "secondary", "lg")}>
                Salvar orçamento
              </button>
              {defaults.quote ? null : defaults.immediate ? (
                <button type="button" disabled={pending || over.length > 0} onClick={() => submit("SAIU")} className={buttonClass("accent", "lg")}>
                  Registrar saída agora
                </button>
              ) : (
                <>
                  <button type="button" disabled={pending || over.length > 0} onClick={() => submit("RESERVADA")} className={buttonClass("secondary", "lg")}>
                    Reservar sem contrato
                  </button>
                  <button type="button" disabled={pending || over.length > 0} onClick={() => submit("RESERVADA", true)} className={buttonClass("primary", "lg")}>
                    {pending ? "Salvando…" : "Reservar e gerar contrato"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {state ? (
          <div className="mx-auto mt-2 max-w-5xl">
            <FormMessage state={state} />
          </div>
        ) : null}
      </div>

      {viewer?.model ? (
        <div className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-graphite/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={`${viewer.name} em 3D`}>
          <div className="w-full max-w-3xl animate-sheet rounded-2xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-semibold text-graphite">{viewer.name}</p>
              <button type="button" onClick={() => setViewer(null)} className={buttonClass("ghost", "sm")}>
                Fechar
              </button>
            </div>
            <LazyModel
              url={viewer.model.url}
              settings={viewer.model.settings}
              autoLoad={false}
              fallback={<p className="p-6 text-sm text-faint">Não foi possível carregar o modelo 3D.</p>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
