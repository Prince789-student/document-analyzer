import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { extractTextFromPdf } from '../../utils/pdfHelper.js';

export const pdfToWordTool = {
  id: 'pdf-to-word',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="file-text"></i> PDF to Word Converter (.docx)</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">Word Document Format:</label>
            <select id="docx-format-style" class="text-input">
              <option value="standard" selected>Standard DOCX with Headers</option>
              <option value="clean">Clean Minimal Text Flow</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    setProgress(20, 'Extracting text streams and layout hierarchy...');

    const { pages, numPages } = await extractTextFromPdf(file);
    setProgress(55, `Processing text across ${numPages} pages...`);

    const docChildren = [];

    // Title banner
    docChildren.push(
      new Paragraph({
        text: file.name.replace(/\.[^/.]+$/, ''),
        heading: HeadingLevel.TITLE
      })
    );

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx];
      setProgress(55 + Math.round((pIdx / pages.length) * 35), `Formatting Word page ${pIdx + 1}...`);

      docChildren.push(
        new Paragraph({
          text: `Section ${pIdx + 1} (Original Page ${p.page})`,
          heading: HeadingLevel.HEADING_2
        })
      );

      // Split into paragraphs by double newlines or punctuation
      const paragraphs = p.text.split(/(?<=[.?!])\s+/);
      let currentChunk = '';

      for (const sentence of paragraphs) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        if (currentChunk.length > 250) {
          docChildren.push(new Paragraph({
            children: [new TextRun(currentChunk)]
          }));
          currentChunk = '';
        }
      }

      if (currentChunk.trim()) {
        docChildren.push(new Paragraph({
          children: [new TextRun(currentChunk)]
        }));
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    setProgress(92, 'Packing .docx OpenXML archive...');
    const buffer = await Packer.toBlob(doc);

    setProgress(100, 'Complete!');
    return {
      data: buffer,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }
};
