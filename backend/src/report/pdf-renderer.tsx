// @ts-nocheck — @react-pdf/renderer types conflict with strict React JSX
import React from "react";
import { Document, Page, Text, View, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignReport, ReportSection } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, "../../assets/fonts");

Font.register({
  family: "Cormorant",
  fonts: [
    { src: path.join(fontsDir, "CormorantGaramond-Regular.ttf") },
    { src: path.join(fontsDir, "CormorantGaramond-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(fontsDir, "CormorantGaramond-Italic.ttf"), fontStyle: "italic" },
  ],
});

Font.register({
  family: "Inter",
  src: path.join(fontsDir, "Inter-Regular.ttf"),
});

const colors = {
  bg: "#0A0910",
  bgSection: "#110a2e",
  accent: "#D4AF37",
  textMain: "#F0EDE6",
  textMuted: "#a09bb5",
  border: "rgba(124,111,205,0.3)",
};

const s = StyleSheet.create({
  page: {
    backgroundColor: colors.bg,
    padding: 48,
    fontFamily: "Inter",
    color: colors.textMain,
  },
  coverPage: {
    backgroundColor: colors.bg,
    padding: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontFamily: "Cormorant",
    fontSize: 36,
    color: colors.textMain,
    marginBottom: 12,
    textAlign: "center",
  },
  coverSubtitle: {
    fontFamily: "Inter",
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 40,
  },
  coverAccent: {
    fontFamily: "Cormorant",
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
  },
  sectionTitle: {
    fontFamily: "Cormorant",
    fontSize: 20,
    color: colors.textMain,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.8,
    color: colors.textMain,
  },
  llmBody: {
    fontSize: 10,
    lineHeight: 1.8,
    color: "#d4cef0",
    marginTop: 10,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: colors.textMuted,
  },
  ctaBox: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    borderRadius: 8,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: "Cormorant",
    textAlign: "center",
    marginBottom: 6,
  },
  ctaSubtext: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center",
  },
});

function CoverPage({ userName }: { userName?: string }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <Text style={s.coverSubtitle}>DISEÑO HUMANO</Text>
      <Text style={s.coverTitle}>Informe Personal</Text>
      {userName && (
        <Text style={{ ...s.coverAccent, marginTop: 20, fontSize: 18 }}>{userName}</Text>
      )}
      <Text style={{ ...s.coverAccent, marginTop: 40 }}>Astral Guide</Text>
      <View style={s.footer}>
        <Text>Astral Guide — Diseño Humano</Text>
        <Text>{new Date().toLocaleDateString("es-AR")}</Text>
      </View>
    </Page>
  );
}

function SectionPage({ section }: { section: ReportSection }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.sectionHeader}>
        <Text style={s.sectionIcon}>{section.icon}</Text>
        <Text style={s.sectionTitle}>{section.title}</Text>
      </View>
      {section.staticContent && (
        <Text style={s.body}>{section.staticContent}</Text>
      )}
      {section.llmContent && (
        <Text style={s.llmBody}>{section.llmContent}</Text>
      )}
      <View style={s.footer} fixed>
        <Text>Astral Guide</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function CTAPage() {
  return (
    <Page size="A4" style={s.page}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={s.ctaBox}>
          <Text style={s.ctaText}>✦ Desbloquea tu informe completo</Text>
          <Text style={{ ...s.ctaSubtext, marginTop: 8 }}>
            Accedé a las 10 secciones con interpretación profunda de tus canales,
            centros indefinidos, cruz de encarnación, variables y más.
          </Text>
          <Text style={{ ...s.ctaSubtext, marginTop: 12 }}>
            Contactanos por WhatsApp para obtener tu informe premium.
          </Text>
        </View>
      </View>
      <View style={s.footer} fixed>
        <Text>Astral Guide</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

function ReportDocument({ report, userName }: { report: DesignReport; userName?: string }) {
  const visibleSections = report.tier === "free"
    ? report.sections.filter((sec) => sec.tier === "free")
    : report.sections;

  return (
    <Document>
      <CoverPage userName={userName} />
      {visibleSections.map((section, i) => (
        <SectionPage key={section.id ?? i} section={section} />
      ))}
      {report.tier === "free" && <CTAPage />}
    </Document>
  );
}

export async function renderReportPDF(report: DesignReport, userName?: string): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <ReportDocument report={report} userName={userName} />
  );
  return Buffer.from(buffer);
}
