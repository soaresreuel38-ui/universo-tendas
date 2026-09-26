"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { SearchSelect, type SearchOption } from "@/components/ui/SearchSelect";
import type { ActionState } from "@/lib/action-state";
import { money, moneyInput, parseMoney } from "@/lib/format";

export type RentalProductOption = SearchOption & { unit: string; rentalPriceCents: number | null };

export type RentalFormInitial = {
  id?: string;
  status?: string;
  customerId: string;
  eventName: string;
  eventAddress: string;
  setupAt: string;
  departureAt: string;
  eventAt: string;
  expectedReturnAt: string;
  pickupBy: string;
  notes: string;
  discount: string;
  items: Array<{ productId: string; quantity: number; unitPrice: string }>;
};

let rowSeq = 0;
const newKey = () => ++rowSeq;

type Row = { key: number; productId: string; quantity: string; unitPrice: string };

const STATUS_CHOICES = [
  { value: "ORCAMENTO", label: "Orçamento", hint: "Não reserva estoque" },
  { value: "RESERVADA", label: "Reservada", hint: "Garante o estoque na data" },
  { value: "CONFIRMADA", label: "Confirmada", hint: "Reservada e confirmada pelo cliente" },
  { value: "SAIU", label: "Saída agora", hint: "Os produtos saem do estoque já" },
] as const;

export function RentalForm({
  action,
  customers,
  products,
  initial,
  immediate = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  customers: SearchOption[];
  products: RentalProductOption[];
  initial: RentalFormInitial;
  immediate?: boolean;
}) {
  const isEdit = Boolean(initial.id);
  const [state, formAction, pending] = useActionState(action, null);
  const [customerId, setCustomerId] = useState(initial.customerId);
  const [newCustomer, setNewCustomer] = useState(customers.length === 0);
  const [departureAt, setDepartureAt] = useState(initial.departureAt);
  const [expectedReturnAt, setExpectedReturnAt] = useState(initial.expectedReturnAt);
  const [status, setStatus] = useState<string>(immediate ? "SAIU" : "RESERVADA");
  const [discount, setDiscount] = useState(initial.discount);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.items.length
      ? initial.items.map((i) => ({ key: newKey(), productId: i.productId, quantity: String(i.quantity), unitPrice: i.unitPrice }))
      : [{ key: newKey(), productId: "", quantity: "1", unitPrice: "" }],
  );
  const [free, setFree] = useState<Record<string, number>>({});
  const [checking, setChecking] = useState(false);

  const productIds = useMemo(() => [...new Set(rows.map((r) => r.productId).filter(Boolean))].sort().join(","), [rows]);

  // Verificação de disponibilidade em tempo real (o servidor verifica de novo ao salvar).
  useEffect(() => {
    if (!productIds || !departureAt || !expectedReturnAt) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const params = new URLSearchParams({ de: departureAt, ate: expectedReturnAt, ids: productIds });
        if (initial.id) params.set("excluir", initial.id);
        const res = await fetch(`/api/disponibilidade?${params}`, { signal: ctrl.signal });
        if (res.ok) setFree(((await res.json()) as { items: Record<string, number> }).items);
      } catch {
        /* requisição cancelada */
      } finally {
        setChecking(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [productIds, departureAt, expectedReturnAt, initial.id]);

  const datesInvalid = Boolean(departureAt && expectedReturnAt && expectedReturnAt <= departureAt);
  const reserves = isEdit ? initial.status !== "ORCAMENTO" : status !== "ORCAMENTO";
  const problems = rows
    .filter((r) => r.productId && free[r.productId] !== undefined && Number(r.quantity) > free[r.productId])
    .map((r) => r.productId);
  const duplicate = rows.some((r, i) => r.productId && rows.findIndex((x) => x.productId === r.productId) !== i);
  const gross = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (parseMoney(r.unitPrice) ?? 0), 0);
  const total = Math.max(0, gross - (parseMoney(discount) ?? 0));
  const blocked = datesInvalid || duplicate || (reserves && problems.length > 0);

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) return;
    const fd = new FormData(e.currentTarget);
    fd.set(
      "items",
      JSON.stringify(rows.filter((r) => r.productId).map((r) => ({ productId: r.productId, quantity: r.quantity, unitPrice: r.unitPrice }))),
    );
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Cliente</legend>
        {newCustomer ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="newCustomer" value="1" />
            <Field label="Nome do cliente" required>
              <Input name="newCustomerName" required maxLength={120} />
            </Field>
            <Field label="Telefone / WhatsApp" required>
              <Input name="newCustomerPhone" required maxLength={30} inputMode="tel" placeholder="(66) 9 0000-0000" />
            </Field>
            {customers.length ? (
              <button type="button" onClick={() => setNewCustomer(false)} className="text-left text-sm text-zinc-600 underline md:col-span-2">
                Escolher cliente já cadastrado
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            <SearchSelect name="customerId" options={customers} value={customerId} onChange={setCustomerId} placeholder="Nome, telefone ou CPF/CNPJ" required />
            {!isEdit ? (
              <button type="button" onClick={() => setNewCustomer(true)} className="mt-2 text-sm text-zinc-600 underline">
                + Cliente novo
              </button>
            ) : null}
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Evento e datas</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Evento" required>
            <Input name="eventName" required maxLength={120} defaultValue={initial.eventName} placeholder="Ex.: Casamento" />
          </Field>
          <Field label="Endereço do evento">
            <Input name="eventAddress" maxLength={300} defaultValue={initial.eventAddress} />
          </Field>
          <Field label="Saída do estoque" required>
            <Input type="datetime-local" name="departureAt" required value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} />
          </Field>
          <Field label="Retorno previsto" required>
            <Input type="datetime-local" name="expectedReturnAt" required value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
            {datesInvalid ? <span className="mt-1 block text-sm text-red-700">O retorno precisa ser depois da saída.</span> : null}
          </Field>
          <Field label="Montagem">
            <Input type="datetime-local" name="setupAt" defaultValue={initial.setupAt} />
          </Field>
          <Field label="Data do evento">
            <Input type="datetime-local" name="eventAt" defaultValue={initial.eventAt} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Produtos</legend>
        <p className="mb-3 text-xs text-zinc-500">
          A disponibilidade considera o período entre a saída e o retorno previsto.{checking ? " Verificando…" : ""}
        </p>
        <ul className="space-y-3">
          {rows.map((r) => {
            const p = products.find((x) => x.value === r.productId);
            const f = r.productId ? free[r.productId] : undefined;
            const over = f !== undefined && Number(r.quantity) > f;
            return (
              <li key={r.key} className={`rounded-md border p-3 ${over ? "border-red-300 bg-red-50/50" : "border-zinc-200"}`}>
                <div className="grid gap-3 md:grid-cols-[1fr_7rem_9rem_auto] md:items-end">
                  <div>
                    <span className="text-sm font-medium text-zinc-700">Produto</span>
                    <SearchSelect
                      options={products}
                      value={r.productId}
                      onChange={(v) => {
                        const np = products.find((x) => x.value === v);
                        update(r.key, { productId: v, unitPrice: r.unitPrice || moneyInput(np?.rentalPriceCents) });
                      }}
                      placeholder="Buscar produto"
                    />
                  </div>
                  <Field label="Quantidade">
                    <Input type="number" min={1} inputMode="numeric" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Valor unit. (R$)">
                    <Input inputMode="decimal" value={r.unitPrice} onChange={(e) => update(r.key, { unitPrice: e.target.value })} placeholder="0,00" />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== r.key) : prev))}
                    className="inline-flex h-10 items-center justify-center rounded-md px-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-700"
                    aria-label="Remover produto"
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
                {r.productId ? (
                  <p className={`mt-2 text-sm ${over ? "font-medium text-red-700" : "text-zinc-600"}`}>
                    {f === undefined
                      ? "Informe as datas para ver a disponibilidade."
                      : over
                        ? `Estoque insuficiente para esta data. Disponibilidade atual: ${f} ${f === 1 ? "unidade" : "unidades"}.`
                        : `Disponível no período: ${f} ${p?.unit ?? ""}`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { key: newKey(), productId: "", quantity: "1", unitPrice: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-zinc-800 underline"
        >
          <Icon name="plus" className="h-4 w-4" /> Adicionar produto
        </button>
        {duplicate ? <p className="mt-2 text-sm text-red-700">O mesmo produto aparece duas vezes. Some as quantidades em uma linha.</p> : null}

        <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 md:grid-cols-3">
          <Field label="Desconto (R$)">
            <Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
          </Field>
          <div className="md:col-span-2 md:text-right">
            <p className="text-sm text-zinc-500">Subtotal {money(gross)}</p>
            <p className="tabular text-2xl font-semibold text-zinc-900">Total {money(total)}</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Outros</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Responsável pela retirada" hint="Quem vai buscar/levar os produtos.">
            <Input name="pickupBy" maxLength={120} defaultValue={initial.pickupBy} />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea name="notes" maxLength={2000} defaultValue={initial.notes} />
          </Field>
        </div>
      </fieldset>

      {!isEdit ? (
        <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-900">Situação</legend>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STATUS_CHOICES.map((s) => (
              <label
                key={s.value}
                className={`cursor-pointer rounded-md border px-3 py-2 ${status === s.value ? "border-ink bg-ink text-white" : "border-zinc-300 hover:border-zinc-400"}`}
              >
                <input type="radio" name="status" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} className="sr-only" />
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className={`block text-xs ${status === s.value ? "text-zinc-300" : "text-zinc-500"}`}>{s.hint}</span>
              </label>
            ))}
          </div>
          {status === "ORCAMENTO" && problems.length > 0 ? (
            <p className="mt-2 text-sm text-amber-800">Atenção: não há estoque suficiente para as datas. O orçamento pode ser salvo, mas não poderá ser reservado assim.</p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="sticky bottom-16 z-10 -mx-4 flex flex-col gap-2 border-t border-zinc-200 bg-canvas/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center lg:bottom-0">
        <SubmitButton pending={pending} disabled={blocked} variant={status === "SAIU" && !isEdit ? "accent" : "primary"}>
          {isEdit ? "Salvar alterações" : status === "SAIU" ? "Registrar saída" : status === "ORCAMENTO" ? "Salvar orçamento" : "Salvar locação"}
        </SubmitButton>
        {blocked && !datesInvalid && !duplicate ? <p className="text-sm font-medium text-red-700">Estoque insuficiente para esta data — ajuste as quantidades ou as datas.</p> : null}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
