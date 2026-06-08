const fs = require('fs')
const { PDFParse } = require('pdf-parse')

const extractPdfText = async (filePath) => {
  let parser;

  try {
    const pdfBuffer = fs.readFileSync(filePath)
    parser = new PDFParse({ data: pdfBuffer })

    const pdfData = await parser.getText()

    if (!pdfData.text || !pdfData.text.trim()) {
      throw new Error('No text found in PDF')
    }

    return pdfData.text.trim()
  } catch (error) {
    console.error('PDF Extraction Error:', error.message)

    throw new Error('Failed to extract text from PDF')
  } finally {
    if (parser) {
      await parser.destroy()
    }
  }
}

module.exports = {
  extractPdfText,
}
