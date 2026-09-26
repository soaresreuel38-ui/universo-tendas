/* eslint-disable jsx-a11y/alt-text -- componentes do @react-pdf, não são <img> HTML */
import { Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { LOGO_DATA_URI } from "./logo";

export const BRAND = "#0c3f80";
export const ACCENT = "#c62b34";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f5f7fb";

export const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: INK },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: BRAND, marginBottom: 14 },
  logo: { width: 58, height: 58, borderRadius: 6 },
  company: { flex: 1, marginLeft: 12 },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND, letterSpacing: 0.5 },
  companyLine: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  docBox: { alignItems: "flex-end" },
  docType: { fontSize: 8, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase" },
  docNumber: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, marginTop: 3, lineHeight: 1.2 },
  docDate: { fontSize: 8, color: MUTED, marginTop: 4 },
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: SOFT, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  cell: { width: "50%", paddingVertical: 2.5, paddingRight: 8 },
  cellWide: { width: "100%", paddingVertical: 2.5 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: 9, marginTop: 1.5, lineHeight: 1.3 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  thead: { flexDirection: "row", backgroundColor: BRAND, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingVertical: 5, paddingHorizontal: 6 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: LINE },
  rowAlt: { backgroundColor: "#fafbfd" },
  totals: { alignSelf: "flex-end", width: 210, marginTop: 8 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 5, borderTopWidth: 1.5, borderTopColor: BRAND },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: BRAND },
  grandValue: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  paragraph: { fontSize: 8.8, textAlign: "justify", marginBottom: 4, lineHeight: 1.4 },
  clauseTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 6, marginBottom: 2 },
  footerLeft: { position: "absolute", bottom: 24, left: 40, fontSize: 7, color: MUTED },
  footerCenter: { position: "absolute", bottom: 24, left: 40, width: 515, textAlign: "center", fontSize: 7, color: MUTED },
  footerRight: { position: "absolute", bottom: 24, right: 40, fontSize: 7, color: MUTED },
  footerRule: { position: "absolute", bottom: 36, left: 40, right: 40, borderTopWidth: 1, borderTopColor: LINE },
  signRow: { flexDirection: "row", marginTop: 26, gap: 24 },
  signBox: { flex: 1, alignItems: "center" },
  signImage: { height: 46, objectFit: "contain", marginBottom: 2 },
  signLine: { width: "100%", borderTopWidth: 1, borderTopColor: INK, marginTop: 46, paddingTop: 4, alignItems: "center" },
  signLineAfterImage: { width: "100%", borderTopWidth: 1, borderTopColor: INK, paddingTop: 4, alignItems: "center" },
  signName: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  signMeta: { fontSize: 7, color: MUTED, marginTop: 1, textAlign: "center" },
  notice: { fontSize: 7.5, color: MUTED, marginTop: 8 },
});

export type Company = {
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string;
  phones: string;
  email: string | null;
  instagram: string;
};

export function DocPage({ children, company, footerRef }: { children: ReactNode; company: Company; footerRef: string }) {
  return (
    <Page size="A4" style={s.page} wrap>
      {children}
      {/* No @react-pdf, elementos fixos com numeração precisam vir depois do conteúdo. */}
      <Text style={s.footerLeft} fixed>
        {company.name} · {company.phones}
      </Text>
      <Text style={s.footerCenter} fixed>
        {footerRef}
      </Text>
      <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      <View style={s.footerRule} fixed />
    </Page>
  );
}

export function DocHeader({ company, docType, docNumber, docDate }: { company: Company; docType: string; docNumber: string; docDate: string }) {
  const lines = [
    company.cnpj ? `CNPJ ${company.cnpj}` : null,
    [company.address, company.city].filter(Boolean).join(" · "),
    [company.phones, company.email].filter(Boolean).join(" · "),
    company.instagram,
  ].filter(Boolean) as string[];
  return (
    <View style={s.header} fixed>
      <Image src={LOGO_DATA_URI} style={s.logo} />
      <View style={s.company}>
        <Text style={s.companyName}>{company.name.toUpperCase()}</Text>
        {lines.map((l) => (
          <Text key={l} style={s.companyLine}>
            {l}
          </Text>
        ))}
      </View>
      <View style={s.docBox}>
        <Text style={s.docType}>{docType}</Text>
        <Text style={s.docNumber}>{docNumber}</Text>
        <Text style={s.docDate}>{docDate}</Text>
      </View>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View wrap={false}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Grid({ items }: { items: Array<[string, string | null | undefined, boolean?]> }) {
  const visible = items.filter(([, v]) => v != null && v !== "");
  return (
    <View style={s.grid}>
      {visible.map(([label, value, wide]) => (
        <View key={label} style={wide ? s.cellWide : s.cell}>
          <Text style={s.label}>{label}</Text>
          <Text style={s.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export type Column = { title: string; width: string; align?: "left" | "right" | "center" };

export function Table({ columns, rows }: { columns: Column[]; rows: string[][] }) {
  return (
    <View style={s.table}>
      <View style={s.thead} fixed>
        {columns.map((c) => (
          <Text key={c.title} style={{ width: c.width, textAlign: c.align ?? "left" }}>
            {c.title}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 ? [s.row, s.rowAlt] : s.row} wrap={false}>
          {r.map((cell, j) => (
            <Text key={j} style={{ width: columns[j].width, textAlign: columns[j].align ?? "left" }}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Totals({ lines, total }: { lines: Array<[string, string]>; total: string }) {
  return (
    <View style={s.totals} wrap={false}>
      {lines.map(([l, v]) => (
        <View key={l} style={s.totalLine}>
          <Text style={{ color: MUTED }}>{l}</Text>
          <Text>{v}</Text>
        </View>
      ))}
      <View style={s.grandTotal}>
        <Text style={s.grandLabel}>TOTAL</Text>
        <Text style={s.grandValue}>{total}</Text>
      </View>
    </View>
  );
}

export type SignatureView = { role: string; name: string | null; document?: string | null; imageDataUri?: string | null; meta?: string | null };

export function Signatures({ parties, place }: { parties: SignatureView[]; place: string }) {
  return (
    <View wrap={false}>
      <Text style={[s.paragraph, { marginTop: 14 }]}>{place}</Text>
      <View style={s.signRow}>
        {parties.map((p) => (
          <View key={p.role} style={s.signBox}>
            {p.imageDataUri ? <Image src={p.imageDataUri} style={s.signImage} /> : null}
            <View style={p.imageDataUri ? s.signLineAfterImage : s.signLine}>
              <Text style={s.signName}>{p.name ?? " "}</Text>
              <Text style={s.signMeta}>{p.role}</Text>
              {p.document ? <Text style={s.signMeta}>{p.document}</Text> : null}
              {p.meta ? <Text style={s.signMeta}>{p.meta}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
