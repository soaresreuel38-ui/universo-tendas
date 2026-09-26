"use client";

import { startTransition, useActionState, useState } from "react";
import { PhotoInput } from "@/components/photos/PhotoInput";
import { FormMessage, SubmitButton } from "@/components/ui/forms";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { DAMAGE_TYPES } from "@/lib/domain";

export type CheckItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  units: Array<{ unitId: string; code: string }>;
};

type UnitState = "OK" | "DANIFICADA" | "FALTANTE";
type ItemState = {
  problem: boolean;
  good: string;
  damaged: string;
  missing: string;
  note: string;
  unitStates: Record<string, UnitState>;
  damageType: string;
  responsible: string;
};

const UNIT_LABEL: Record<UnitState, string> = { OK: "OK", DANIFICADA: "Danificada", FALTANTE: "Faltante" };

function counts(item: CheckItem, s: ItemState) {
  if (!s.problem) return { good: item.quantity, damaged: 0, missing: 0 };
  if (item.units.length) {
    const values = Object.values(s.unitStates);
    return {
      good: values.filter((v) => v === "OK").length,
      damaged: values.filter((v) => v === "DANIFICADA").length,
      missing: values.filter((v) => v === "FALTANTE").length,
    };
  }
  return { good: Number(s.good) || 0, damaged: Number(s.damaged) || 0, missing: Number(s.missing) || 0 };
}

export function CheckInForm({
  rentalId,
  items,
  now,
  action,
}: {
  rentalId: string;
  items: CheckItem[];
  now: string;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [values, setValues] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          problem: false,
          good: String(i.quantity),
          damaged: "0",
          missing: "0",
          note: "",
          unitStates: Object.fromEntries(i.units.map((u) => [u.unitId, "OK" as UnitState])),
          damageType: "",
          responsible: "",
        },
      ]),
    ),
  );

  const set = (id: string, patch: Partial<ItemState>) => setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const problems: string[] = [];
  for (const item of items) {
    const c = counts(item, values[item.id]);
    if (c.good + c.damaged + c.missing !== item.quantity) problems.push(`${item.name}: a soma precisa dar ${item.quantity}.`);
    else if ((c.damaged || c.missing) && !values[item.id].note.trim()) problems.push(`${item.name}: descreva o problema.`);
    else if (c.damaged && !values[item.id].damageType) problems.push(`${item.name}: informe o tipo de dano.`);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (problems.length) return;
    if (!window.confirm("Finalizar a conferência? O estoque será atualizado.")) return;
    const fd = new FormData(e.currentTarget);
    fd.set(
      "items",
      JSON.stringify(
        items.map((i) => {
          const s = values[i.id];
          const c = counts(i, s);
          const photoIds = fd.getAll(`damagePhotos_${i.id}`).map(String);
          return {
            itemId: i.id,
            ...c,
            note: s.note,
            ...(i.units.length && s.problem ? { unitStates: s.unitStates } : {}),
            ...(c.damaged ? { damage: { damageType: s.damageType, responsible: s.responsible, photoIds } } : {}),
          };
        }),
      ),
    );
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="id" value={rentalId} />
      <ul className="space-y-3">
        {items.map((item) => {
          const s = values[item.id];
          const c = counts(item, s);
          const sumOk = c.good + c.damaged + c.missing === item.quantity;
          const diff = c.damaged + c.missing > 0 || c.good !== item.quantity;
          return (
            <li key={item.id} className={`rounded-lg border bg-white p-4 ${!sumOk ? "border-red-300" : diff ? "border-amber-300" : "border-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-graphite">
                  <span className={diff ? "text-amber-600" : "text-emerald-600"} aria-hidden>
                    {diff ? "⚠" : "☑"}
                  </span>{" "}
                  {item.name}
                </p>
                <p className="tabular shrink-0 text-lg font-semibold">
                  {c.good}/{item.quantity}
                </p>
              </div>
              <p className="text-xs text-faint">
                Enviado: {item.quantity} {item.unit}
                {c.damaged ? ` · ${c.damaged} danificada(s)` : ""}
                {c.missing ? ` · ${c.missing} faltante(s)` : ""}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Situação de ${item.name}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!s.problem}
                  onClick={() => set(item.id, { problem: false })}
                  className={`rounded-lg px-3 py-3 text-sm font-semibold ${!s.problem ? "bg-emerald-600 text-white" : "bg-canvas text-muted"}`}
                >
                  🟢 OK
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={s.problem}
                  onClick={() => set(item.id, { problem: true })}
                  className={`rounded-lg px-3 py-3 text-sm font-semibold ${s.problem ? "bg-red-600 text-white" : "bg-canvas text-muted"}`}
                >
                  🔴 PROBLEMA
                </button>
              </div>

              {!s.problem ? null : item.units.length ? (
                <ul className="mt-3 space-y-1.5">
                  {item.units.map((u) => (
                    <li key={u.unitId} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm">#{u.code}</span>
                      <span className="inline-flex overflow-hidden rounded-md border border-line-strong">
                        {(Object.keys(UNIT_LABEL) as UnitState[]).map((st) => (
                          <button
                            type="button"
                            key={st}
                            onClick={() => set(item.id, { unitStates: { ...s.unitStates, [u.unitId]: st } })}
                            className={`px-2.5 py-1.5 text-xs font-medium ${
                              s.unitStates[u.unitId] === st
                                ? st === "OK"
                                  ? "bg-emerald-600 text-white"
                                  : st === "DANIFICADA"
                                    ? "bg-amber-500 text-white"
                                    : "bg-red-600 text-white"
                                : "bg-white text-muted"
                            }`}
                          >
                            {UNIT_LABEL[st]}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Field label="Retornaram OK">
                    <Input type="number" min={0} inputMode="numeric" value={s.good} onChange={(e) => set(item.id, { good: e.target.value })} />
                  </Field>
                  <Field label="Danificadas">
                    <Input type="number" min={0} inputMode="numeric" value={s.damaged} onChange={(e) => set(item.id, { damaged: e.target.value })} />
                  </Field>
                  <Field label="Faltantes">
                    <Input type="number" min={0} inputMode="numeric" value={s.missing} onChange={(e) => set(item.id, { missing: e.target.value })} />
                  </Field>
                </div>
              )}
              {!sumOk ? <p className="mt-2 text-sm text-red-700">Retornadas + danificadas + faltantes precisa ser {item.quantity}.</p> : null}
              {diff ? (
                <Field label="Descrição do problema" required className="mt-3">
                  <Textarea value={s.note} onChange={(e) => set(item.id, { note: e.target.value })} rows={2} maxLength={1000} placeholder="O que aconteceu?" />
                </Field>
              ) : null}
              {c.damaged ? (
                <div className="mt-3 grid gap-3 rounded-lg bg-red-50/60 p-3 sm:grid-cols-2">
                  <Field label="Tipo de dano" required>
                    <select
                      value={s.damageType}
                      onChange={(e) => set(item.id, { damageType: e.target.value })}
                      className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm"
                    >
                      <option value="">Selecione…</option>
                      {DAMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Responsável (quem causou / quem responde)">
                    <Input value={s.responsible} onChange={(e) => set(item.id, { responsible: e.target.value })} maxLength={120} />
                  </Field>
                  <div className="sm:col-span-2">
                    <span className="text-sm font-medium text-muted">Fotos do dano</span>
                    <PhotoInput name={`damagePhotos_${item.id}`} multiple label="Tirar / enviar foto" />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Data/hora do retorno">
            <Input type="datetime-local" name="returnedAt" defaultValue={now} />
          </Field>
          <div className="md:col-span-2">
            <span className="text-sm font-medium text-muted">Fotos da condição dos equipamentos</span>
            <p className="mb-2 text-xs text-faint">Registre danos para ter o histórico.</p>
            <PhotoInput name="photoIds" multiple label="Tirar / anexar foto" />
          </div>
          <Field label="Observações gerais" className="md:col-span-2">
            <Textarea name="notes" maxLength={2000} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-faint">
          Ao finalizar: itens OK voltam para <b>Disponível</b>, danificados vão para <b>Manutenção</b> e faltantes ficam como <b>Pendência</b>.
        </p>
      </div>

      <div className="sticky bottom-16 z-10 -mx-4 space-y-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:bottom-0">
        {problems.length ? (
          <ul className="text-sm text-red-700">
            {problems.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
        ) : null}
        <SubmitButton pending={pending} disabled={problems.length > 0} variant="accent">
          Finalizar conferência
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
