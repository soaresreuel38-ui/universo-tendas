"use client";

import { useState } from "react";
import { PhotoInput } from "@/components/photos/PhotoInput";
import { ActionForm } from "@/components/ui/forms";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { moneyInput } from "@/lib/format";

export type ProductFormValues = {
  id?: string;
  name: string;
  sku: string;
  category: string;
  kind: "RENTAL" | "SALE" | "BOTH";
  trackingMode: "QUANTITY" | "UNIT";
  description: string | null;
  unit: string;
  rentalPriceCents: number | null;
  salePriceCents: number | null;
  minStock: number;
  photoId: string | null;
  notes: string | null;
  dimensions?: string | null;
  active: boolean;
};

export function ProductForm({
  action,
  initial,
  categories,
  lockTracking,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial?: ProductFormValues;
  categories: string[];
  lockTracking?: boolean;
}) {
  const [tracking, setTracking] = useState(initial?.trackingMode ?? "QUANTITY");
  const [kind, setKind] = useState(initial?.kind ?? "RENTAL");
  const isNew = !initial?.id;
  return (
    <ActionForm action={action} submitLabel={isNew ? "Cadastrar produto" : "Salvar alterações"}>
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome" required className="md:col-span-2">
          <Input name="name" required maxLength={120} defaultValue={initial?.name} placeholder="Ex.: Tenda 5x5" />
        </Field>
        <Field label="Código / SKU" required hint="Identificação única, usada na busca.">
          <Input name="sku" required maxLength={40} defaultValue={initial?.sku} className="uppercase" />
        </Field>
        <Field label="Categoria" required hint="Tendas, estruturas, mesas, cadeiras, acessórios, peças…">
          <Input name="category" required maxLength={60} defaultValue={initial?.category} list="categorias" />
          <datalist id="categorias">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Tipo" required>
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="RENTAL">Locação</option>
            <option value="SALE">Venda</option>
            <option value="BOTH">Locação e venda</option>
          </Select>
        </Field>
        <Field
          label="Controle do estoque"
          required
          hint={
            lockTracking
              ? "Não pode ser alterado: o produto já tem estoque ou unidades."
              : tracking === "UNIT"
                ? "Cada unidade recebe um número (#001, #002…) e o sistema registra qual unidade foi para cada evento."
                : "Controle apenas pela quantidade total."
          }
        >
          <Select name="trackingMode" value={tracking} onChange={(e) => setTracking(e.target.value as typeof tracking)} disabled={lockTracking}>
            <option value="QUANTITY">Por quantidade</option>
            <option value="UNIT">Por unidade (numeradas)</option>
          </Select>
          {lockTracking ? <input type="hidden" name="trackingMode" value={tracking} /> : null}
        </Field>
        {kind !== "SALE" ? (
          <Field label="Preço de locação (R$)" hint="Valor sugerido por unidade; pode ser ajustado em cada locação.">
            <Input name="rentalPrice" inputMode="decimal" defaultValue={moneyInput(initial?.rentalPriceCents)} placeholder="0,00" />
          </Field>
        ) : (
          <input type="hidden" name="rentalPrice" value={moneyInput(initial?.rentalPriceCents)} />
        )}
        {kind !== "RENTAL" ? (
          <Field label="Preço de venda (R$)">
            <Input name="salePrice" inputMode="decimal" defaultValue={moneyInput(initial?.salePriceCents)} placeholder="0,00" />
          </Field>
        ) : (
          <input type="hidden" name="salePrice" value={moneyInput(initial?.salePriceCents)} />
        )}
        <Field label="Tamanho / dimensões" hint="Ex.: 4 x 4 m, pé-direito 3 m">
          <Input name="dimensions" maxLength={120} defaultValue={initial?.dimensions ?? ""} />
        </Field>
        <Field label="Unidade de medida" required hint="un, par, jogo, metro…">
          <Input name="unit" required maxLength={20} defaultValue={initial?.unit ?? "un"} />
        </Field>
        <Field label="Estoque mínimo (alerta)" hint="Alerta quando o disponível ficar igual ou abaixo. 0 = sem alerta.">
          <Input name="minStock" type="number" min={0} inputMode="numeric" defaultValue={initial?.minStock ?? 0} />
        </Field>
        {isNew ? (
          <Field
            label="Quantidade inicial em estoque"
            hint={tracking === "UNIT" ? "Serão criadas as unidades #001, #002… automaticamente." : "Registrada no histórico como entrada inicial."}
          >
            <Input name="initialQty" type="number" min={0} inputMode="numeric" defaultValue={0} />
          </Field>
        ) : null}
        <Field label="Descrição" className="md:col-span-2">
          <Textarea name="description" maxLength={2000} defaultValue={initial?.description ?? ""} />
        </Field>
        <div className="md:col-span-2">
          <span className="text-sm font-medium text-muted">Foto</span>
          <p className="mb-2 text-xs text-faint">Ajuda o funcionário a identificar o equipamento.</p>
          <PhotoInput name="photoId" initial={initial?.photoId ? [initial.photoId] : []} />
        </div>
        <Field label="Observações" className="md:col-span-2">
          <Textarea name="notes" maxLength={2000} defaultValue={initial?.notes ?? ""} />
        </Field>
        <div className="md:col-span-2">
          <Checkbox name="active" label="Produto ativo (aparece para novas locações e vendas)" defaultChecked={initial?.active ?? true} />
        </div>
      </div>
    </ActionForm>
  );
}
