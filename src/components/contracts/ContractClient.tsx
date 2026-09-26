"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, keepValues } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Field, Input, buttonClass } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { SignaturePad } from "./SignaturePad";

/** Abre o WhatsApp com a mensagem e o link de assinatura. Nada é enviado sem a pessoa confirmar no WhatsApp. */
export function WhatsappContractButton({
  contractId,
  action,
}: {
  contractId: string;
  action: (id: string) => Promise<{ ok: boolean; url?: string; message: string }>;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={`${buttonClass("primary", "lg")} w-full`}
        onClick={async () => {
          // Abre a aba já no clique (evita bloqueio de pop-up) e depois aponta para o WhatsApp.
          const win = window.open("about:blank", "_blank");
          setBusy(true);
          const r = await action(contractId);
          setBusy(false);
          setMsg(r);
          if (r.ok && r.url) {
            if (win) win.location.href = r.url;
            else window.location.href = r.url;
          } else win?.close();
        }}
      >
        <Icon name="whatsapp" className="h-5 w-5" /> {busy ? "Preparando…" : "Enviar pelo WhatsApp"}
      </button>
      {msg ? <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.message}</p> : null}
    </div>
  );
}

export function SignInPersonForm({
  contractId,
  party,
  defaultName,
  defaultDocument,
  action,
}: {
  contractId: string;
  party: "CLIENTE" | "EMPRESA";
  defaultName: string;
  defaultDocument?: string | null;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [hasInk, setHasInk] = useState(false);
  return (
    <form action={formAction} onSubmit={keepValues(formAction)} className="space-y-3">
      <input type="hidden" name="id" value={contractId} />
      <input type="hidden" name="party" value={party} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome de quem assina" required>
          <Input name="signerName" required maxLength={120} defaultValue={defaultName} />
        </Field>
        <Field label="CPF / CNPJ">
          <Input name="signerDocument" maxLength={30} defaultValue={defaultDocument ?? ""} />
        </Field>
      </div>
      <SignaturePad onChange={setHasInk} />
      <SubmitButton pending={pending} disabled={!hasInk}>
        Registrar assinatura {party === "CLIENTE" ? "do cliente" : "da empresa"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
