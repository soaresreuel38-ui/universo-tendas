/* eslint-disable jsx-a11y/alt-text -- componentes do @react-pdf, não são <img> HTML */
import { Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { LOGO_DATA_URI } from "./logo";

export const BRAND = "#0c3f80";
export const ACCENT = "#c62b34";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f6f7f9";

export const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: INK },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: BRAND, marginBottom: 16 },
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
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: SOFT, borderRadius: 3, paddingVertical: 7, paddingHorizontal: 9, borderLeftWidth: 2, borderLeftColor: BRAND },
  cell: { width: "50%", paddingVertical: 2.5, paddingRight: 8 },
  cellWide: { width: "100%", paddingVertical: 2.5 },
  label: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: 9, marginTop: 1.5, lineHeight: 1.3 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  thead: {
    flexDirection: "row",
    backgroundColor: "#eef3fa",
    color: BRAND,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
  },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: LINE },
  rowAlt: { backgroundColor: "#fbfbfa" },
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

/** Variante compacta (contrato): mesmo visual, espaçamentos menores para caber em uma folha A4. */
export const compact = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 46 },
  header: { paddingBottom: 8, marginBottom: 4 },
  logo: { width: 44, height: 44 },
  docNumber: { fontSize: 15 },
  sectionTitle: { marginTop: 8, marginBottom: 3.5 },
  grid: { paddingVertical: 4, paddingHorizontal: 8 },
  cell: { paddingVertical: 1.5 },
  value: { marginTop: 1, lineHeight: 1.25 },
  row: { paddingVertical: 4.5 },
  thead: { paddingVertical: 4.5 },
  totals: { marginTop: 4 },
  paragraph: { fontSize: 8.5, lineHeight: 1.33, marginBottom: 3 },
  clauseTitle: { marginTop: 3, marginBottom: 1.5 },
  place: { marginTop: 8 },
  signRow: { marginTop: 4 },
  signLine: { marginTop: 30 },
  signImage: { height: 34 },
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

export function DocPage({ children, company, footerRef, dense = false }: { children: ReactNode; company: Company; footerRef: string; dense?: boolean }) {
  return (
    <Page size="A4" style={dense ? [s.page, compact.page] : s.page} wrap>
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

export function DocHeader({
  company,
  docType,
  docNumber,
  docDate,
  dense = false,
}: {
  company: Company;
  docType: string;
  docNumber: string;
  docDate: string;
  dense?: boolean;
}) {
  const lines = [
    company.cnpj ? `CNPJ ${company.cnpj}` : null,
    [company.address, company.city].filter(Boolean).join(" · "),
    [company.phones, company.email].filter(Boolean).join(" · "),
    company.instagram,
  ].filter(Boolean) as string[];
  return (
    <View style={dense ? [s.header, compact.header] : s.header} fixed>
      <Image src={LOGO_DATA_URI} style={dense ? [s.logo, compact.logo] : s.logo} />
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
        <Text style={dense ? [s.docNumber, compact.docNumber] : s.docNumber}>{docNumber}</Text>
        <Text style={s.docDate}>{docDate}</Text>
      </View>
    </View>
  );
}

export function Section({ title, children, dense = false }: { title: string; children: ReactNode; dense?: boolean }) {
  return (
    <View wrap={false}>
      <Text style={dense ? [s.sectionTitle, compact.sectionTitle] : s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Terceiro item: `true` ocupa a linha inteira; um número ocupa essa quantidade de colunas (com `cols`). */
export function Grid({ items, cols = 2, dense = false }: { items: Array<[string, string | null | undefined, (boolean | number)?]>; cols?: 2 | 3; dense?: boolean }) {
  const visible = items.filter(([, v]) => v != null && v !== "");
  const width = (span: boolean | number | undefined) => `${(Math.min(span === true ? cols : span || 1, cols) * 100) / cols}%`;
  return (
    <View style={dense ? [s.grid, compact.grid] : s.grid}>
      {visible.map(([label, value, span]) => (
        <View key={label} style={[span === true ? s.cellWide : s.cell, dense ? compact.cell : {}, { width: width(span) }]}>
          <Text style={s.label}>{label}</Text>
          <Text style={dense ? [s.value, compact.value] : s.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export type Column = { title: string; width: string; align?: "left" | "right" | "center" };

export function Table({ columns, rows, dense = false }: { columns: Column[]; rows: string[][]; dense?: boolean }) {
  return (
    <View style={s.table}>
      <View style={dense ? [s.thead, compact.thead] : s.thead} fixed>
        {columns.map((c) => (
          <Text key={c.title} style={{ width: c.width, textAlign: c.align ?? "left" }}>
            {c.title}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[s.row, i % 2 ? s.rowAlt : {}, dense ? compact.row : {}]} wrap={false}>
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

export function Totals({ lines, total, dense = false }: { lines: Array<[string, string]>; total: string; dense?: boolean }) {
  return (
    <View style={dense ? [s.totals, compact.totals] : s.totals} wrap={false}>
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

export function Signatures({ parties, place, dense = false }: { parties: SignatureView[]; place: string; dense?: boolean }) {
  return (
    <View wrap={false}>
      <Text style={[s.paragraph, { marginTop: 14 }, dense ? compact.place : {}]}>{place}</Text>
      <View style={dense ? [s.signRow, compact.signRow] : s.signRow}>
        {parties.map((p) => (
          <View key={p.role} style={s.signBox}>
            {p.imageDataUri ? <Image src={p.imageDataUri} style={dense ? [s.signImage, compact.signImage] : s.signImage} /> : null}
            <View style={p.imageDataUri ? s.signLineAfterImage : dense ? [s.signLine, compact.signLine] : s.signLine}>
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
