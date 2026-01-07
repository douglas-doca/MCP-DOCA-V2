// src/lib/exportPdf.ts

export type ExportPdfOptions = {
  filename?: string;
  backgroundColor?: string; // ex: "#0b0f19"
  scale?: number;           // ex: 2
  marginMm?: number;        // ex: 8
  orientation?: "p" | "l";  // portrait / landscape
};

type Html2CanvasFn = (
  element: HTMLElement,
  options?: any
) => Promise<HTMLCanvasElement>;

export async function exportElementToPdf(
  element: HTMLElement,
  opts: ExportPdfOptions = {}
) {
  if (!element) throw new Error("exportElementToPdf: element is required.");

  const {
    filename = "DOCA-Relatorio.pdf",
    backgroundColor = "#0b0f19",
    scale = 2,
    marginMm = 8,
    orientation = "p",
  } = opts;

  // ✅ Import dinâmico pra evitar problemas NodeNext + ESM/CJS
  const [{ default: html2canvasDefault }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // html2canvas pode vir como default ou direto
  const html2canvas = (html2canvasDefault || (html2canvasDefault as any)) as unknown as Html2CanvasFn;

  const canvas = await html2canvas(element, {
    scale: Number(scale) || 2,
    backgroundColor,
    useCORS: true,
    logging: false,
    removeContainer: true,
  });

  const imgData = canvas.toDataURL("image/png", 1.0);

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const usableWidth = pageWidth - marginMm * 2;
  const usableHeight = pageHeight - marginMm * 2;

  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;

  const ratio = imgWidthPx / imgHeightPx;
  let renderWidth = usableWidth;
  let renderHeight = renderWidth / ratio;

  if (renderHeight > usableHeight) {
    renderHeight = usableHeight;
    renderWidth = renderHeight * ratio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = marginMm;

  pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
  pdf.save(filename);
}
