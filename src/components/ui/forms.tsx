"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { buttonClass, type ButtonVariant } from "./primitives";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Formulário ligado a uma server action. Mantém o que foi digitado quando o servidor
 * devolve erro (o React 19 limparia o formulário) e mostra a mensagem de retorno.
 */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel = "Salvar",
  submitVariant = "primary",
  resetOnSuccess = false,
  footer,
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  submitLabel?: ReactNode;
  submitVariant?: ButtonVariant;
  resetOnSuccess?: boolean;
  footer?: ReactNode;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        keepValues(formAction)(e);
      }}
      className={className}
    >
      {children}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} variant={submitVariant}>
          {submitLabel}
        </SubmitButton>
        {footer}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
    >
      {state.message}
    </p>
  );
}

export function keepValues(formAction: (payload: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => formAction(data));
  };
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "lg",
  pending: pendingOverride,
  disabled,
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  pending?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`${buttonClass(variant, size)} w-full sm:w-auto ${className}`}
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}

/** Botão de ação única (ex.: mudar status), com confirmação opcional e mensagem de erro. */
export function InlineAction({
  action,
  fields,
  children,
  variant = "secondary",
  size = "sm",
  confirm,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="contents"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={buttonClass(variant, size)}>
        {pending ? "Aguarde…" : children}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="basis-full text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
