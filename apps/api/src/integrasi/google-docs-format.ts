import type { RenderedNotulen, ParagraphBlock } from "./renderer-notulen.js";

export function susunFormatBatchUpdate(
  docStructure: RenderedNotulen,
  startOffset = 1
): { requests: Record<string, unknown>[] } {
  // 1. Bangun teks utuh dokumen dalam satu string besar
  let fullText = "";
  interface PosisiParagraf {
    start: number;
    end: number;
    block: ParagraphBlock;
    runPositions: { start: number; end: number; run: ParagraphBlock["runs"][0] }[];
  }

  const posisiList: PosisiParagraf[] = [];

  for (const block of docStructure.blocks) {
    const pStart = startOffset + fullText.length;
    const runPositions: { start: number; end: number; run: ParagraphBlock["runs"][0] }[] = [];

    let pText = "";
    for (const run of block.runs) {
      const rStart = pStart + pText.length;
      pText += run.text;
      const rEnd = pStart + pText.length;
      runPositions.push({ start: rStart, end: rEnd, run });
    }

    if (!pText.endsWith("\n")) {
      pText += "\n";
    }

    fullText += pText;
    const pEnd = startOffset + fullText.length;

    posisiList.push({ start: pStart, end: pEnd, block, runPositions });
  }

  // 2. Format Halaman: Mode Halaman (Paged Mode), Kertas A4 (595.28 x 841.89 PT), Margin 2.5 cm (70.87 PT)
  const requests: Record<string, unknown>[] = [
    {
      updateDocumentStyle: {
        documentStyle: {
          pageSize: {
            width: { magnitude: 595.28, unit: "PT" },
            height: { magnitude: 841.89, unit: "PT" },
          },
          marginTop: { magnitude: 70.87, unit: "PT" },
          marginBottom: { magnitude: 70.87, unit: "PT" },
          marginLeft: { magnitude: 70.87, unit: "PT" },
          marginRight: { magnitude: 70.87, unit: "PT" },
        },
        fields: "pageSize,marginTop,marginBottom,marginLeft,marginRight",
      },
    },
    {
      insertText: {
        location: { index: startOffset },
        text: fullText,
      },
    },
  ];

  // 3. Format Paragraph Style (Alignment, Spacing, Line Border, Shading)
  for (const pos of posisiList) {
    const p = pos.block;
    const paragraphStyle: Record<string, unknown> = {};
    const pFields: string[] = [];

    if (p.namedStyle) {
      paragraphStyle.namedStyleType = p.namedStyle;
      pFields.push("namedStyleType");
    }
    if (p.alignment) {
      paragraphStyle.alignment = p.alignment;
      pFields.push("alignment");
    }
    if (p.spaceAbove !== undefined) {
      paragraphStyle.spaceAbove = { magnitude: p.spaceAbove, unit: "PT" };
      pFields.push("spaceAbove");
    }
    if (p.spaceBelow !== undefined) {
      paragraphStyle.spaceBelow = { magnitude: p.spaceBelow, unit: "PT" };
      pFields.push("spaceBelow");
    }
    if (p.indentStart !== undefined) {
      paragraphStyle.indentStart = { magnitude: p.indentStart, unit: "PT" };
      pFields.push("indentStart");
    }
    if (p.borderLeft) {
      paragraphStyle.borderLeft = {
        color: { color: { rgbColor: p.borderLeft.color } },
        width: { magnitude: p.borderLeft.width, unit: "PT" },
        padding: { magnitude: 6, unit: "PT" },
        dashStyle: p.borderLeft.dashStyle,
      };
      pFields.push("borderLeft");
    }
    if (p.backgroundColor) {
      paragraphStyle.shading = {
        backgroundColor: { color: { rgbColor: p.backgroundColor } },
      };
      pFields.push("shading");
    }

    if (pFields.length > 0) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: pos.start, endIndex: pos.end },
          paragraphStyle,
          fields: pFields.join(","),
        },
      });
    }

    // 4. Format Text Style per Run
    for (const r of pos.runPositions) {
      if (r.start >= r.end || !r.run.style) continue;
      const tStyle: Record<string, unknown> = {};
      const tFields: string[] = [];

      if (r.run.style.bold !== undefined) {
        tStyle.bold = r.run.style.bold;
        tFields.push("bold");
      }
      if (r.run.style.italic !== undefined) {
        tStyle.italic = r.run.style.italic;
        tFields.push("italic");
      }
      if (r.run.style.fontSize !== undefined) {
        tStyle.fontSize = { magnitude: r.run.style.fontSize, unit: "PT" };
        tFields.push("fontSize");
      }
      if (r.run.style.color) {
        tStyle.foregroundColor = { color: { rgbColor: r.run.style.color } };
        tFields.push("foregroundColor");
      }

      if (tFields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: tStyle,
            fields: tFields.join(","),
          },
        });
      }
    }
  }

  return { requests };
}
