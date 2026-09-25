import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/primitives";
import { requirePermission } from "@/server/auth/session";
import { saveCustomerAction } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  await requirePermission("customer.manage");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo cliente" back={{ href: "/admin/clientes", label: "Clientes" }} />
      <Section>
        <CustomerForm action={saveCustomerAction} />
      </Section>
    </div>
  );
}
