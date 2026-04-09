const { createRequire } = require('module');
const requireCustom = createRequire('file://' + __filename);
try {
  const pdfParseRaw = requireCustom("pdf-parse");
  console.log("pdf-parse type:", typeof pdfParseRaw);
  console.log("pdf-parse keys:", Object.keys(pdfParseRaw));
  if (pdfParseRaw.default) console.log("pdf-parse default type:", typeof pdfParseRaw.default);
} catch (e) {
  console.error("Error loading pdf-parse:", e.message);
}
