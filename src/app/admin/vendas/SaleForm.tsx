"use client";

import { startTransition, useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { SearchSelect, type SearchOption } from "@/components/ui/SearchSelect";
import type { ActionState } from "@/lib/action-state";
import { money, moneyInput, parseMoney } from "@/lib/format";

export type SaleProductOption = SearchOption & { unit: string; free: number; salePriceCents: number | null };
let rowSeq = 0;
const newKey = () => ++rowSeq;

type Row = { key: number; productId: string; quantity: string; unitPrice: string };

export function SaleForm({
  action,
  customers,
  products,
  now,
  defaultProduct,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  customers: SearchOption[];
  products: SaleProductOption[];
  now: string;
  defaultProduct?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const initialProduct = products.find((p) => p.value === defaultProduct);
  const [rows, setRows] = useState<Row[]>([
    { key: newKey(), productId: initialProduct?.value ?? "", quantity: "1", unitPrice: moneyInput(initialProduct?.salePriceCents) },
  ]);
  const [discount, setDiscount] = useState("");
  const [customerMode, setCustomerMode] = useState<"cadastro" | "avulso">("cadastro");

  const update = (k: number, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const over = rows.filter((r) => {
    const p = products.find((x) => x.value === r.productId);
    return p && Number(r.quantity) > p.free;
  });
  const duplicate = rows.some((r, i) => r.productId && rows.findIndex((x) => x.productId === r.productId) !== i);
  const gross = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (parseMoney(r.unitPrice) ?? 0), 0);
  const total = Math.max(0, gross - (parseMoney(discount) ?? 0));
  const blocked = over.length > 0 || duplicate || !rows.some((r) => r.productId);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blocked) return;
    const fd = new FormData(e.currentTarget);
    fd.set("items", JSON.stringify(rows.filter((r) => r.productId).map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice }))));
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Cliente</legend>
        <div className="mb-2 flex gap-4 text-sm">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={customerMode === "cadastro"} onChange={() => setCustomerMode("cadastro")} /> Cliente cadastrado
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={customerMode === "avulso"} onChange={() => setCustomerMode("avulso")} /> Venda avulsa
          </label>
        </div>
        {customerMode === "cadastro" ? (
          <SearchSelect name="customerId" options={customers} placeholder="Buscar cliente (opcional)" />
        ) : (
          <Input name="customerName" maxLength={120} placeholder="Nome do comprador (opcional)" />
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Produtos</legend>
        <ul className="space-y-3">
          {rows.map((r) => {
            const p = products.find((x) => x.value === r.productId);
            const isOver = p ? Number(r.quantity) > p.free : false;
            return (
              <li key={r.key} className={`rounded-md border p-3 ${isOver ? "border-red-300 bg-red-50/50" : "border-zinc-200"}`}>
                <div className="grid gap-3 md:grid-cols-[1fr_7rem_9rem_auto] md:items-end">
                  <div>
                    <span className="text-sm font-medium text-zinc-700">Produto</span>
                    <SearchSelect
                      options={products}
                      value={r.productId}
                      onChange={(v) => update(r.key, { productId: v, unitPrice: r.unitPrice || moneyInput(products.find((x) => x.value === v)?.salePriceCents) })}
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
                {p ? (
                  <p className={`mt-2 text-sm ${isOver ? "font-medium text-red-700" : "text-zinc-600"}`}>
                    {isOver ? `Estoque insuficiente. Disponível para venda: ${p.free} ${p.unit}.` : `Disponível para venda: ${p.free} ${p.unit}`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { key: newKey(), productId: "", quantity: "1", unitPrice: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline"
        >
          <Icon name="plus" className="h-4 w-4" /> Adicionar produto
        </button>
        {duplicate ? <p className="mt-2 text-sm text-red-700">O mesmo produto aparece duas vezes.</p> : null}
        <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 md:grid-cols-3">
          <Field label="Desconto (R$)">
            <Input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
          </Field>
          <div className="md:col-span-2 md:text-right">
            <p className="text-sm text-zinc-500">Subtotal {money(gross)}</p>
            <p className="tabular text-2xl font-semibold">Total {money(total)}</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-2">
        <Field label="Data da venda" required>
          <Input type="datetime-local" name="soldAt" required defaultValue={now} />
        </Field>
        <Field label="Pagamento recebido agora" hint="Deixe em branco se o pagamento será feito depois.">
          <select name="paymentMethod" defaultValue="PIX" className="mt-1 block h-10 w-full rounded-md border border-zinc-300 bg-white px-2">
            <option value="">Ainda não pago</option>
            <option value="PIX">Pix</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO_CREDITO">Cartão de crédito</option>
            <option value="CARTAO_DEBITO">Cartão de débito</option>
            <option value="BOLETO">Boleto</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="OUTRO">Outro</option>
          </select>
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" maxLength={2000} />
        </Field>
      </fieldset>

      <div className="sticky bottom-16 z-10 -mx-4 flex flex-col gap-2 border-t border-zinc-200 bg-zinc-100/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center lg:bottom-0">
        <SubmitButton pending={pending} disabled={blocked}>Registrar venda</SubmitButton>
        <p className="text-xs text-zinc-500">A venda retira os produtos do estoque definitivamente.</p>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
