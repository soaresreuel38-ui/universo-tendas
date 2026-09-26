"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, Textarea, buttonClass } from "@/components/ui/primitives";
import { LazyModel } from "@/components/three/LazyModel";
import type { ModelViewSettings } from "@/components/three/ModelViewer";
import type { ActionState } from "@/lib/action-state";
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
  photoId: string | null;
  model: { url: string; settings: ModelViewSettings } | null;
};

type Line = { productId: string; quantity: number; unitPrice: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STEPS = ["Cliente", "Período", "Produtos", "Revisão"] as const;

export function RentalWizard({
  action,
  customers,
  products,
  defaults,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  customers: WizardCustomer[];
  products: WizardProduct[];
  defaults: { departureAt: string; expectedReturnAt: string; customerId?: string; productId?: string; immediate: boolean; paymentTerms: string };
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
  const [departureAt, setDepartureAt] = useState(defaults.departureAt);
  const [expectedReturnAt, setExpectedReturnAt] = useState(defaults.expectedReturnAt);
  const [eventName, setEventName] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [setupAt, setSetupAt] = useState("");
  const [teardownAt, setTeardownAt] = useState("");

  // ── Produtos
  const [lines, setLines] = useState<Line[]>(() => {
    const p = products.find((x) => x.id === defaults.productId);
    return p ? [{ productId: p.id, quantity: 1, unitPrice: moneyInput(p.rentalPriceCents) }] : [];
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
      return [...ls, { productId: p.id, quantity, unitPrice: moneyInput(p.rentalPriceCents) }];
    });
  const over = lines.filter((l) => free[l.productId] !== undefined && l.quantity > free[l.productId]);

  // ── Revisão
  const [discount, setDiscount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);
  const [pickupBy, setPickupBy] = useState("");
  const [notes, setNotes] = useState("");
  const gross = lines.reduce((s, l) => s + l.quantity * (parseMoney(l.unitPrice) ?? 0), 0);
  const total = Math.max(0, gross - (parseMoney(discount) ?? 0));

  const customerOk = newCustomer ? nc.name.trim() && (nc.phone.trim() || nc.whatsapp.trim()) : Boolean(customerId);
  const stepOk = [customerOk, !datesInvalid && eventName.trim(), lines.length > 0 && over.length === 0, true];

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
    Object.entries({ eventName, eventAddress, departureAt, expectedReturnAt, eventAt, setupAt, teardownAt, discount, paymentTerms, pickupBy, notes }).forEach(([k, v]) => fd.set(k, v));
    fd.set("status", status);
    if (andContract) fd.set("andContract", "1");
    fd.set("items", JSON.stringify(lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice }))));
    startTransition(() => formAction(fd));
  }

  const address = newCustomer ? [nc.address, nc.city].filter(Boolean).join(", ") : [customer?.address, customer?.city].filter(Boolean).join(", ");

  return (
    <div className="pb-24">
      {/* Etapas */}
      <ol className="mb-5 grid grid-cols-4 gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step && !stepOk.slice(0, i).every(Boolean)}
              onClick={() => setStep(i)}
              className={`w-full rounded-lg px-2 py-2 text-left text-xs sm:text-sm ${i === step ? "bg-ink text-white" : i < step ? "bg-white text-zinc-900 ring-1 ring-zinc-200" : "bg-white/60 text-zinc-400 ring-1 ring-zinc-200"}`}
            >
              <span className="block text-[10px] uppercase tracking-wider opacity-70">Etapa {i + 1}</span>
              <span className="font-semibold">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
          <h2 className="text-lg font-semibold">Para quem é a locação?</h2>
          {!newCustomer ? (
            <>
              <div className="relative mt-3">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={cq}
                  onChange={(e) => setCq(e.target.value)}
                  placeholder="Nome, telefone ou CPF/CNPJ"
                  className="h-12 w-full rounded-lg border border-zinc-300 pl-9 pr-3 outline-none focus:border-zinc-500"
                  autoFocus
                />
              </div>
              <ul className="mt-2 divide-y divide-zinc-100">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        if (!eventAddress && (c.address || c.city)) setEventAddress([c.address, c.city].filter(Boolean).join(", "));
                        setStep(1);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-zinc-50 ${c.id === customerId ? "bg-zinc-50" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{[c.phone ?? c.whatsapp, c.document, c.city].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="shrink-0 text-sm text-zinc-500">{c.id === customerId ? "Selecionado" : "Escolher"}</span>
                    </button>
                  </li>
                ))}
                {customerResults.length === 0 ? <li className="px-2 py-3 text-sm text-zinc-500">Nenhum cliente encontrado.</li> : null}
              </ul>
              <button type="button" onClick={() => setNewCustomer(true)} className={`${buttonClass("secondary", "md")} mt-3`}>
                <Icon name="plus" className="h-4 w-4" /> Novo cliente
              </button>
              {customer ? (
                <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-zinc-600">{[customer.document, customer.phone ?? customer.whatsapp, customer.email].filter(Boolean).join(" · ") || "Sem documento/telefone"}</p>
                  <p className="text-zinc-600">{[customer.address, customer.city].filter(Boolean).join(" · ")}</p>
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
                <button type="button" onClick={() => setNewCustomer(false)} className="text-left text-sm text-zinc-600 underline sm:col-span-2">
                  Escolher cliente já cadastrado
                </button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
          <h2 className="text-lg font-semibold">Quando?</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Evento" required className="sm:col-span-2">
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={120} placeholder="Ex.: Casamento" />
            </Field>
            <Field label="Saída do estoque" required>
              <Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} />
            </Field>
            <Field label="Retorno previsto" required>
              <Input type="datetime-local" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
              {datesInvalid ? <span className="mt-1 block text-sm text-red-700">O retorno precisa ser depois da saída.</span> : null}
            </Field>
            <Field label="Endereço de entrega / evento" className="sm:col-span-2">
              <Input value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} maxLength={300} />
              {address && eventAddress !== address ? (
                <button type="button" onClick={() => setEventAddress(address)} className="mt-1 text-xs text-zinc-600 underline">
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
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">O que o cliente vai alugar?</h2>
            <p className="text-xs text-zinc-500">Disponibilidade para o período selecionado{checking ? " — verificando…" : ""}</p>
          </div>
          <div className="relative mb-3">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Buscar produto ou código" className="h-12 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 outline-none focus:border-zinc-500" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((p) => {
              const f = free[p.id];
              const inCart = lineFor(p.id)?.quantity ?? 0;
              const draft = qtyDraft[p.id] ?? 1;
              const left = f === undefined ? undefined : f - inCart;
              return (
                <li key={p.id} className="flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
                  <div className="relative aspect-[4/3] bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1f5_75%)]">
                    {p.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/fotos/${p.photoId}`} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-300">
                        <Icon name="tent" className="h-14 w-14" />
                      </div>
                    )}
                    {p.model ? (
                      <button type="button" onClick={() => setViewer(p)} className="absolute bottom-2 right-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white shadow">
                        Ver em 3D
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="font-semibold leading-tight">{p.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-mono">{p.sku}</span>
                      {p.dimensions ? ` · ${p.dimensions}` : ""}
                    </p>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="tabular text-sm">
                        <span className={`text-lg font-semibold ${left === undefined ? "text-zinc-400" : left > 0 ? "text-emerald-700" : "text-red-700"}`}>{f ?? "—"}</span>{" "}
                        <span className="text-zinc-500">disponíveis</span>
                      </p>
                      <p className="tabular text-sm font-medium">{money(p.rentalPriceCents)}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex items-center rounded-lg ring-1 ring-zinc-300">
                        <button type="button" aria-label="Menos" className="h-10 w-10 text-lg" onClick={() => setQtyDraft({ ...qtyDraft, [p.id]: Math.max(1, draft - 1) })}>
                          −
                        </button>
                        <input
                          aria-label="Quantidade"
                          inputMode="numeric"
                          value={draft}
                          onChange={(e) => setQtyDraft({ ...qtyDraft, [p.id]: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })}
                          className="h-10 w-12 border-x border-zinc-300 text-center tabular outline-none"
                        />
                        <button type="button" aria-label="Mais" className="h-10 w-10 text-lg" onClick={() => setQtyDraft({ ...qtyDraft, [p.id]: draft + 1 })}>
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
                    {left !== undefined && draft > left ? <p className="mt-1 text-xs font-medium text-red-700">Não há estoque suficiente para o período selecionado. Disponível: {Math.max(0, left)}.</p> : null}
                  </div>
                </li>
              );
            })}
            {catalog.length === 0 ? <li className="text-sm text-zinc-500">Nenhum produto encontrado.</li> : null}
          </ul>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
            <h2 className="text-lg font-semibold">Revisão</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {newCustomer ? nc.name : customer?.name} · {eventName} · {departureAt.replace("T", " ")} → {expectedReturnAt.replace("T", " ")}
            </p>
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
          </div>
        </section>
      ) : null}

      {/* Lista selecionada (sempre visível a partir dos produtos) */}
      {step >= 2 && lines.length ? (
        <section className="mt-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <h3 className="text-sm font-semibold">Itens da locação</h3>
          <ul className="mt-2 divide-y divide-zinc-100">
            {lines.map((l) => {
              const p = products.find((x) => x.id === l.productId)!;
              const f = free[l.productId];
              const bad = f !== undefined && l.quantity > f;
              return (
                <li key={l.productId} className="grid grid-cols-[1fr_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_auto_8rem_7rem]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className={`block text-xs ${bad ? "font-medium text-red-700" : "text-zinc-500"}`}>
                      {bad ? `Não há estoque suficiente para o período selecionado. Disponível: ${f}` : `Disponível no período: ${f ?? "—"}`}
                    </span>
                  </span>
                  <span className="flex items-center rounded-lg ring-1 ring-zinc-300">
                    <button type="button" aria-label="Menos" className="h-9 w-9" onClick={() => setQty(l.productId, l.quantity - 1)}>
                      −
                    </button>
                    <span className="w-9 text-center tabular">{l.quantity}</span>
                    <button type="button" aria-label="Mais" className="h-9 w-9" onClick={() => setQty(l.productId, l.quantity + 1)}>
                      +
                    </button>
                  </span>
                  <label className="col-span-2 flex items-center gap-1 text-sm sm:col-span-1">
                    <span className="text-zinc-500">R$</span>
                    <input
                      aria-label="Preço unitário"
                      value={l.unitPrice}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, unitPrice: e.target.value } : x)))}
                      inputMode="decimal"
                      className="h-9 w-full rounded-md border border-zinc-300 px-2 text-right tabular"
                    />
                  </label>
                  <span className="tabular text-right text-sm font-medium max-sm:hidden">{money(l.quantity * (parseMoney(l.unitPrice) ?? 0))}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2">
            <span className="text-sm text-zinc-500">Total{discount ? " (com desconto)" : ""}</span>
            <span className="tabular text-xl font-semibold">{money(total)}</span>
          </div>
        </section>
      ) : null}

      {/* Barra de ação fixa */}
      <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={buttonClass("ghost", "lg")}>
              Voltar
            </button>
          ) : null}
          <span className="tabular mr-auto text-sm text-zinc-600">
            {lines.length ? `${lines.reduce((s, l) => s + l.quantity, 0)} itens · ${money(total)}` : ""}
          </span>
          {step < 3 ? (
            <button type="button" disabled={!stepOk[step]} onClick={() => setStep(step + 1)} className={buttonClass("primary", "lg")}>
              Continuar
            </button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => submit("ORCAMENTO")} className={buttonClass("secondary", "lg")}>
                Salvar orçamento
              </button>
              {defaults.immediate ? (
                <button type="button" disabled={pending || over.length > 0} onClick={() => submit("SAIU")} className={buttonClass("accent", "lg")}>
                  Registrar saída agora
                </button>
              ) : (
                <>
                  <button type="button" disabled={pending || over.length > 0} onClick={() => submit("RESERVADA")} className={buttonClass("secondary", "lg")}>
                    Reservar
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`${viewer.name} em 3D`}>
          <div className="w-full max-w-3xl rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{viewer.name}</p>
              <button type="button" onClick={() => setViewer(null)} className={buttonClass("ghost", "sm")}>
                Fechar
              </button>
            </div>
            <LazyModel
              url={viewer.model.url}
              settings={viewer.model.settings}
              autoLoad={false}
              fallback={<p className="p-6 text-sm text-zinc-500">Não foi possível carregar o modelo 3D.</p>}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
