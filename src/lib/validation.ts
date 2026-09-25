import { z } from "zod";
import { parseMoney } from "./format";
import { fromLocalInput } from "./time";

/** Remove caracteres de controle e espaços excedentes. A saída do React já é escapada (XSS). */
export function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
}

export const zText = (max: number) =>
  z.string().transform(cleanText).pipe(z.string().max(max, `Texto muito longo (máximo ${max} caracteres).`));
export const zOptText = (max: number) => zText(max).transform((v) => (v === "" ? null : v));
export const zReqText = (max: number, label: string) =>
  z.string().transform(cleanText).pipe(z.string().min(1, `${label}: campo obrigatório.`).max(max, `${label}: texto muito longo.`));

export const zId = z.string().trim().min(1, "Registro inválido.").max(40).regex(/^[a-z0-9]+$/i, "Registro inválido.");
export const zOptId = z.string().trim().max(40).transform((v) => (v === "" ? null : v)).pipe(zId.nullable());

export const zInt = (label: string, min = 0, max = 1_000_000) =>
  z.coerce
    .number({ message: `${label}: informe um número.` })
    .int(`${label}: use números inteiros.`)
    .min(min, `${label}: mínimo ${min}.`)
    .max(max, `${label}: valor muito alto.`);

/** Valor em reais digitado ("1.234,56") → centavos. Vazio → null. */
export const zMoney = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const cents = parseMoney(v);
      if (cents == null) {
        ctx.addIssue({ code: "custom", message: `${label}: valor inválido (ex.: 150,00).` });
        return z.NEVER;
      }
      return cents;
    });

export const zDateTime = (label: string) =>
  z.string().transform((v, ctx) => {
    const d = fromLocalInput(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `${label}: data/hora inválida.` });
      return z.NEVER;
    }
    return d;
  });

export const zOptDateTime = (label: string) =>
  z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const d = fromLocalInput(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `${label}: data/hora inválida.` });
      return z.NEVER;
    }
    return d;
  });

export const zCheckbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const zEmail = z.string().trim().toLowerCase().email("E-mail inválido.").max(160);
