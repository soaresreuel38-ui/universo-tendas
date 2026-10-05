"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/forms";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { SearchSelect, type SearchOption } from "@/components/ui/SearchSelect";
import type { ActionState } from "@/lib/action-state";

export type StockProductOption = SearchOption & {
  unit: string;
  qtyAvailable: number;
  free: number;
  trackingMode: "QUANTITY" | "UNIT";
  units?: Array<{ id: string; code: string }>;
};

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function EntryForm({ action, products, defaultProduct, now }: { action: Action; products: StockProductOption[]; defaultProduct?: string; now: string }) {
  const [productId, setProductId] = useState(defaultProduct ?? "");
  const product = products.find((p) => p.value === productId);
  return (
    <ActionForm action={action} submitLabel="Confirmar entrada" resetOnSuccess>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <span className="text-sm font-medium text-muted">Produto <span className="text-accent">*</span></span>
          <SearchSelect name="productId" options={products} value={productId} onChange={setProductId} placeholder="Digite o nome ou código" required />
          {product ? (
            <p className="mt-1 text-xs text-faint">
              No depósito agora: {product.qtyAvailable} {product.unit}
              {product.trackingMode === "UNIT" ? " · as novas unidades receberão números sequenciais" : ""}
            </p>
          ) : null}
        </div>
        <Field label="Quantidade" required>
          <Input name="quantity" type="number" min={1} required inputMode="numeric" />
        </Field>
        <Field label="Motivo" required hint="Para retorno de locação use “Retornos” (conferência).">
          <Select name="reason" required defaultValue="COMPRA">
            <option value="COMPRA">Compra</option>
            <option value="DEVOLUCAO">Devolução</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="OUTRO">Outro</option>
          </Select>
        </Field>
        <Field label="Data" required>
          <Input name="occurredAt" type="datetime-local" required defaultValue={now} />
        </Field>
        <Field label="Observação" className="md:col-span-2">
          <Textarea name="notes" maxLength={1000} placeholder="Nota fiscal, fornecedor…" />
        </Field>
      </div>
    </ActionForm>
  );
}

export function ExitForm({
  action,
  products,
  kind,
  defaultProduct,
  now,
}: {
  action: Action;
  products: StockProductOption[];
  kind: "MANUTENCAO" | "PERDA" | "TRANSFERENCIA" | "OUTRO";
  defaultProduct?: string;
  now: string;
}) {
  const [productId, setProductId] = useState(defaultProduct ?? "");
  const [qty, setQty] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const product = products.find((p) => p.value === productId);
  const n = Number(qty) || 0;
  const tooMany = product ? n > product.free : false;
  const unitMismatch = product?.trackingMode === "UNIT" && selectedUnits.length > 0 && selectedUnits.length !== n;

  return (
    <ActionForm action={action} submitLabel="Confirmar saída" resetOnSuccess>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <span className="text-sm font-medium text-muted">Produto <span className="text-accent">*</span></span>
          <SearchSelect
            name="productId"
            options={products}
            value={productId}
            onChange={(v) => {
              setProductId(v);
              setSelectedUnits([]);
            }}
            placeholder="Digite o nome ou código"
            required
          />
          {product ? (
            <p className="mt-1 text-xs text-faint">
              Livre para esta saída: <b className={product.free > 0 ? "text-emerald-700" : "text-red-700"}>{product.free}</b> {product.unit} (no depósito: {product.qtyAvailable}; o restante está reservado)
            </p>
          ) : null}
        </div>
        <Field label="Quantidade" required>
          <Input name="quantity" type="number" min={1} required inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          {tooMany ? <span className="mt-1 block text-sm text-red-700">Estoque insuficiente. Disponível: {product?.free}.</span> : null}
        </Field>
        <Field label="Data" required>
          <Input name="occurredAt" type="datetime-local" required defaultValue={now} />
        </Field>
        <Field label="Motivo" required className="md:col-span-2">
          <Input
            name="reason"
            required
            maxLength={300}
            placeholder={kind === "MANUTENCAO" ? "Ex.: lona rasgada, haste torta" : kind === "TRANSFERENCIA" ? "Destino da transferência" : "Descreva o motivo"}
          />
        </Field>
        {product?.trackingMode === "UNIT" && product.units?.length ? (
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium text-muted">Unidades (opcional)</legend>
            <p className="mb-2 text-xs text-faint">Marque quais unidades saem. Sem marcar, o sistema escolhe as de menor número.</p>
            <div className="flex flex-wrap gap-2">
              {product.units.map((u) => {
                const on = selectedUnits.includes(u.id);
                return (
                  <label key={u.id} className={`cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-sm ${on ? "border-ink bg-ink text-white" : "border-line-strong"}`}>
                    <input
                      type="checkbox"
                      name="unitIds"
                      value={u.id}
                      checked={on}
                      onChange={() => setSelectedUnits((prev) => (on ? prev.filter((x) => x !== u.id) : [...prev, u.id]))}
                      className="sr-only"
                    />
                    #{u.code}
                  </label>
                );
              })}
            </div>
            {unitMismatch ? <p className="mt-1 text-sm text-red-700">Selecione exatamente {n} unidade(s) ou nenhuma.</p> : null}
          </fieldset>
        ) : null}
        <Field label="Observação" className="md:col-span-2">
          <Textarea name="notes" maxLength={1000} />
        </Field>
      </div>
    </ActionForm>
  );
}
