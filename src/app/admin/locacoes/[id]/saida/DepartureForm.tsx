"use client";

import { useActionState, useState } from "react";
import { ProductThumb } from "@/components/products/ProductThumb";
import { FormMessage, SubmitButton } from "@/components/ui/forms";
import { Field, Input } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";

export type DepartureItem = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  photoId: string | null;
  quantity: number;
  inStock: number;
  free: number;
  byUnit: boolean;
  units: Array<{ id: string; code: string }>;
};

/** Saída em modo operação: checklist de separação e um botão grande para confirmar. */
export function DepartureForm({
  rentalId,
  items,
  pickupBy,
  blocked,
  action,
}: {
  rentalId: string;
  items: DepartureItem[];
  pickupBy: string;
  blocked: boolean;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = items.filter((i) => checked[i.id]).length;
  const all = done === items.length;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!all || blocked || !window.confirm("Confirmar a saída destes produtos? O estoque será atualizado.")) e.preventDefault();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={rentalId} />
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700">Separação</span>
        <span className="tabular text-zinc-500" data-testid="checklist-progress">
          {done}/{items.length} conferidos
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((i) => {
          const ok = i.inStock >= i.quantity && i.free >= i.quantity;
          const on = Boolean(checked[i.id]);
          return (
            <li key={i.id} className={`rounded-xl border bg-white p-3 ${on ? "border-emerald-400" : ok ? "border-zinc-200" : "border-red-300"}`}>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setChecked((c) => ({ ...c, [i.id]: e.target.checked }))}
                  className="h-7 w-7 shrink-0 accent-emerald-600"
                  aria-label={`Separado: ${i.name}`}
                />
                <ProductThumb photoId={i.photoId} name={i.name} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-zinc-900">{i.name}</span>
                  <span className={`block text-xs ${ok ? "text-zinc-500" : "font-medium text-red-700"}`}>
                    No depósito: {i.inStock} · Disponível no período: {i.free}
                  </span>
                </span>
                <span className="tabular text-xl font-semibold">
                  {i.quantity}
                  <span className="ml-1 text-xs font-normal text-zinc-500">{i.unit}</span>
                </span>
              </label>
              {i.byUnit ? (
                <fieldset className="mt-2 border-t border-zinc-100 pt-2">
                  <legend className="text-xs text-zinc-500">Unidades (marque {i.quantity}; sem marcar, o sistema escolhe as de menor número)</legend>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {i.units.map((u) => (
                      <label
                        key={u.id}
                        className="inline-flex cursor-pointer items-center rounded border border-zinc-300 px-2 py-1 font-mono text-sm has-checked:border-ink has-checked:bg-ink has-checked:text-white"
                      >
                        <input type="checkbox" name={`unit:${i.productId}`} value={u.id} className="sr-only" />#{u.code}
                      </label>
                    ))}
                    {i.units.length === 0 ? <span className="text-sm text-red-700">Nenhuma unidade disponível.</span> : null}
                  </div>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Field label="Responsável pela retirada" hint="Quem está levando os produtos.">
        <Input name="pickupBy" maxLength={120} defaultValue={pickupBy} />
      </Field>
      <div className="sticky bottom-16 z-10 -mx-4 space-y-2 border-t border-zinc-200 bg-zinc-100/95 px-4 py-3 backdrop-blur lg:bottom-0">
        {!all ? <p className="text-sm text-zinc-600">Marque todos os itens separados para liberar a saída.</p> : null}
        <SubmitButton pending={pending} disabled={!all || blocked} variant="accent" className="h-14 w-full text-base tracking-wide">
          CONFIRMAR SAÍDA
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
