import * as XLSX from 'xlsx';
import { loadPdfJsDoc } from '../../utils/pdfHelper.js';

export const pdfToExcelTool = {
  id: 'pdf-to-excel',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="sheet"></i> PDF to Excel Converter (.xlsx)</h4>
        <p class="text-muted">Document: <strong>${files[0].name}</strong></p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label">Table Extraction Mode:</label>
            <select id="excel-extract-mode" class="text-input">
              <option value="auto" selected>Auto-detect Columns & Rows</option>
              <option value="line">Line-by-Line Structured Grid</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },

  async process(files, options, setProgress) {
    const file = files[0];
    setProgress(20, 'Analyzing PDF layout and coordinate text streams...');

    const pdfJsDoc = await loadPdfJsDoc(file);
    const numPages = pdfJsDoc.numPages;
    const wb = XLSX.utils.book_new();

    for (let i = 1; i <= numPages; i++) {
      setProgress(20 + Math.round((i / numPages) * 70), `Extracting table data from Page ${i}...`);
      const page = await pdfJsDoc.getPage(i);
      const textContent = await page.getTextContent();

      // Group text items by Y coordinate (rows)
      const rowsMap = new Map();
      const tolerance = 4; // points tolerance for same row

      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        let foundY = null;
        for (const existingY of rowsMap.keys()) {
          if (Math.abs(existingY - y) <= tolerance) {
            foundY = existingY;
            break;
          }
        }

        if (foundY === null) {
          foundY = y;
          rowsMap.set(foundY, []);
        }

        rowsMap.get(foundY).push({
          x: item.transform[4],
          str: item.str
        });
      });

      // Sort rows descending by Y (top to bottom)
      const sortedYs = Array.from(rowsMap.keys()).sort((a, b) => b - a);
      const sheetData = [];

      sortedYs.forEach(y => {
        const items = rowsMap.get(y);
        // Sort items left to right
        items.sort((a, b) => a.x - b.x);
        const rowCells = items.map(it => {
          const val = it.str.trim();
          // Convert numeric strings to actual numbers
          if (/^-?\d+(\.\d+)?$/.test(val)) {
            return parseFloat(val);
          }
          return val;
        }).filter(v => v !== '');

        if (rowCells.length > 0) {
          sheetData.push(rowCells);
        }
      });

      if (sheetData.length === 0) {
        sheetData.push(['No tabular data detected on page']);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`);
    }

    setProgress(95, 'Writing Excel workbook (.xlsx)...');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    setProgress(100, 'Complete!');
    return {
      data: wbout,
      filename: `${file.name.replace(/\.[^/.]+$/, '')}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }
};
