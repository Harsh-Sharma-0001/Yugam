import fs from "fs/promises";
import { PDFParse } from "pdf-parse";

const extractText = async (filePath) => {
  const buffer = await fs.readFile(filePath);

  const pdf = new PDFParse({
    data: buffer,
  });

  try {
    const result = await pdf.getText();
    return result.text || "";
  } finally {
    await pdf.destroy();
  }
};

export default extractText;
