import { redirect } from "next/navigation";

/** Orçamentos são locações ainda não aprovadas pelo cliente. */
export default function QuotesPage() {
  redirect("/admin/locacoes?aba=orcamentos");
}
