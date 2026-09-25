"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, keepValues } from "@/components/ui/forms";
import type { ActionState } from "@/lib/action-state";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, null);
  return (
    <form action={action} onSubmit={keepValues(action)} className="space-y-4">
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required maxLength={160} autoFocus />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full sm:w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
