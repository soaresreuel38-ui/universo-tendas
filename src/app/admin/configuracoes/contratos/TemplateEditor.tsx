"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { SUGGESTED_CLAUSE_TOPICS, type ClauseInput } from "@/lib/contract-types";

type Values = {
  companyName: string;
  cnpj: string | null;
  address: string | null;
  city: string;
  phones: string;
  email: string | null;
  instagram: string;
  intro: string | null;
  defaultPaymentTerms: string | null;
  footer: string | null;
  clauses: ClauseInput[];
};

let seqKey = 0;
const withKey = (c: ClauseInput) => ({ ...c, key: ++seqKey });

export function TemplateEditor({ action, initial }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial: Values }) {
  const [clauses, setClauses] = useState(() => initial.clauses.map(withKey));
  const update = (key: number, patch: Partial<ClauseInput>) => setClauses((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const move = (i: number, d: -1 | 1) =>
    setClauses((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const copy = [...cs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const missing = SUGGESTED_CLAUSE_TOPICS.filter((t) => !clauses.some((c) => c.title.toLowerCase() === t.toLowerCase()));

  return (
    <ActionForm action={action} submitLabel="Salvar modelo de contrato">
      <input type="hidden" name="clauses" value={JSON.stringify(clauses.map(({ title, body }) => ({ title, body })))} />
      <h2 className="text-sm font-semibold">Dados da empresa (cabeçalho do contrato)</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="Nome" required>
          <Input name="companyName" required defaultValue={initial.companyName} />
        </Field>
        <Field label="CNPJ">
          <Input name="cnpj" defaultValue={initial.cnpj ?? ""} placeholder="Preencha com o CNPJ da empresa" />
        </Field>
        <Field label="Endereço" className="md:col-span-2">
          <Input name="address" defaultValue={initial.address ?? ""} />
        </Field>
        <Field label="Cidade" required>
          <Input name="city" required defaultValue={initial.city} />
        </Field>
        <Field label="Telefones" required>
          <Input name="phones" required defaultValue={initial.phones} />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" defaultValue={initial.email ?? ""} />
        </Field>
        <Field label="Instagram" required>
          <Input name="instagram" required defaultValue={initial.instagram} />
        </Field>
      </div>
      <p className="mt-2 text-xs text-zinc-500">O logo usado nos documentos é o logo oficial da Universo Tendas.</p>

      <h2 className="mt-6 text-sm font-semibold">Condições e textos</h2>
      <div className="mt-3 grid gap-3">
        <Field label="Condição / prazo de pagamento padrão" hint="Pode ser alterada em cada locação.">
          <Textarea name="defaultPaymentTerms" rows={2} defaultValue={initial.defaultPaymentTerms ?? ""} />
        </Field>
        <Field label="Texto introdutório (antes das cláusulas)">
          <Textarea name="intro" rows={3} defaultValue={initial.intro ?? ""} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Cláusulas ({clauses.length})</h2>
        <div className="flex flex-wrap gap-2">
          {missing.length ? (
            <button type="button" onClick={() => setClauses((cs) => [...cs, ...missing.map((t) => withKey({ title: t, body: "" }))])} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm">
              Adicionar tópicos sugeridos (sem texto)
            </button>
          ) : null}
          <button type="button" onClick={() => setClauses((cs) => [...cs, withKey({ title: "", body: "" })])} className="rounded-md bg-ink px-3 py-1.5 text-sm text-white">
            + Nova cláusula
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        O sistema não escreve cláusulas. Cláusulas sem texto não aparecem no contrato. Separe parágrafos com uma linha em branco.
      </p>
      <ol className="mt-3 space-y-3">
        {clauses.map((c, i) => (
          <li key={c.key} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs font-semibold uppercase text-zinc-500">Cláusula {i + 1}ª</span>
              <Input value={c.title} onChange={(e) => update(c.key, { title: e.target.value })} placeholder="Título" aria-label="Título da cláusula" required className="mt-0" />
              <button type="button" onClick={() => move(i, -1)} className="rounded p-2 hover:bg-zinc-100" aria-label="Subir">
                <Icon name="chevronLeft" className="h-4 w-4 rotate-90" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-2 hover:bg-zinc-100" aria-label="Descer">
                <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
              </button>
              <button type="button" onClick={() => setClauses((cs) => cs.filter((x) => x.key !== c.key))} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label="Remover">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
            <Textarea value={c.body} onChange={(e) => update(c.key, { body: e.target.value })} rows={4} placeholder="Texto da cláusula, conforme definido pela empresa." />
            {!c.body.trim() ? <p className="mt-1 text-xs text-amber-700">Sem texto — não aparecerá no contrato.</p> : null}
          </li>
        ))}
      </ol>

      <Field label="Rodapé (opcional)" className="mt-6">
        <Textarea name="footer" rows={2} defaultValue={initial.footer ?? ""} />
      </Field>
    </ActionForm>
  );
}
