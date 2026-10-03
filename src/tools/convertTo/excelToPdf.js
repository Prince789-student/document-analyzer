import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export const excelToPdfTool = {
  id: 'excel-to-pdf',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="file-spreadsheet"></i> Excel to PDF</h4>
        <p class="text-muted">Spreadsheet: <strong>${files[0].name}</strong></p>

        <div class="grid-2-col">
          <div class="option-row">
            <label class="input-label">Page Orientation:</label>
            <select id="excel-orientation" class="text-input">
              <option value="landscape" selected>Landscape (Recommended for tables)</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>

          <div class="option-row">
            <label class="input-label">Table Grid Style:</label>
            <select id="excel-style" class="text-input">
              <option value="striped" selected>Zebra Striped</option>
              <option value="grid">Bordered Grid</option>
              <option value="plain">Minimalist</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const orientation = document.querySelector('#excel-orientation')?.value || 'landscape';
    const style = document.querySelector('#excel-style')?.value || 'striped';

    setProgress(25, 'Parsing Excel workbook sheets...');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (!data || data.length === 0) {
      throw new Error('The uploaded spreadsheet contains no readable tabular data.');
    }

    setProgress(50, `Formatting ${data.length} rows and ${data[0]?.length || 0} columns...`);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const availWidth = pageWidth - margin * 2;

    // Header Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`${file.name.replace(/\.[^/.]+$/, '')} — ${firstSheetName}`, margin, margin + 10);

    const headers = (data[0] || []).map(h => String(h || ''));
    const rows = data.slice(1);
    const colCount = Math.max(headers.length, 1);
    const colWidth = availWidth / colCount;

    let currentY = margin + 40;
    const rowHeight = 24;

    // Draw Table Header
    const drawHeader = () => {
      pdf.setFillColor(79, 70, 229);
      pdf.rect(margin, currentY, availWidth, rowHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);

      headers.forEach((h, cIdx) => {
        const x = margin + cIdx * colWidth + 6;
        pdf.text(String(h).substring(0, 24), x, currentY + 16);
      });
      currentY += rowHeight;
    };

    drawHeader();

    // Draw Rows
    rows.forEach((row, rIdx) => {
      if (currentY + rowHeight > pageHeight - margin) {
        pdf.addPage('a4', orientation);
        currentY = margin + 20;
        drawHeader();
      }

      const isEven = rIdx % 2 === 0;
      if (style === 'striped') {
        pdf.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
        pdf.rect(margin, currentY, availWidth, rowHeight, 'F');
      } else if (style === 'grid') {
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, currentY, availWidth, rowHeight, 'S');
      }

      pdf.setTextColor(51, 65, 85);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        const val = row[cIdx] !== undefined && row[cIdx] !== null ? String(row[cIdx]) : '';
        const x = margin + cIdx * colWidth + 6;
        pdf.text(val.substring(0, 24), x, currentY + 16);
      }

      currentY += rowHeight;
    });

    setProgress(95, 'Generating PDF spreadsheet table...');
    const pdfBlob = pdf.output('blob');

    setProgress(100, 'Complete!');
    return {
      data: pdfBlob,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
