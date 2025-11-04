import Tesseract from "tesseract.js";

export async function runOCR(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, "eng", {
    tessjs_create_pdf: '0'
  });
  return normalizeMathText(data.text);
}

const superscripts: Record<string, string> = {
  "¹": "^1",
  "²": "^2",
  "³": "^3",
  "⁴": "^4",
  "⁵": "^5",
  "⁶": "^6",
  "⁷": "^7",
  "⁸": "^8",
  "⁹": "^9",
  "⁰": "^0"
};

const subscripts: Record<string, string> = {
  "₀": "_0",
  "₁": "_1",
  "₂": "_2",
  "₃": "_3",
  "₄": "_4",
  "₅": "_5",
  "₆": "_6",
  "₇": "_7",
  "₈": "_8",
  "₉": "_9"
};

function normalizeMathText(raw: string): string {
  return raw
    .replace(/[\r\t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      Array.from(line)
        .map((ch) => superscripts[ch] ?? subscripts[ch] ?? ch)
        .join("")
    )
    .join("\n");
}
