import { PDFDocument } from 'pdf-lib';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const pdfFormsTool = {
  id: 'pdf-forms',
  fields: [],

  async renderOptions(container, files, onUpdate) {
    this.fields = [];
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="check-square"></i> PDF Form Field Studio</h4>
        <p class="text-muted">Fill out interactive PDF forms, check boxes, or flatten form fields.</p>

        <div class="form-fields-container" id="form-fields-list" style="margin-top: 15px;">
          <div class="spinner"></div>
          <span>Inspecting PDF AcroForm fields...</span>
        </div>

        <div class="option-row" style="margin-top: 20px;">
          <label class="custom-checkbox">
            <input type="checkbox" id="form-flatten" checked>
            <span>Flatten Form (Make all filled fields permanent and uneditable)</span>
          </label>
        </div>
      </div>
    `;

    try {
      const pdfDoc = await loadPdfLibDoc(files[0]);
      const form = pdfDoc.getForm();
      const rawFields = form.getFields();

      const listEl = container.querySelector('#form-fields-list');

      if (rawFields.length === 0) {
        listEl.innerHTML = `
          <div class="alert-box">
            <p><strong>Notice:</strong> This document does not have pre-existing AcroForm metadata fields. You can stamp standard business form values onto page 3 or download with form readiness.</p>
          </div>
          <div class="option-group" style="margin-top: 10px;">
            <div class="option-row">
              <label class="input-label">Full Name Field:</label>
              <input type="text" id="sim-form-name" class="text-input" value="Jane Cooper">
            </div>
            <div class="option-row" style="margin-top: 10px;">
              <label class="input-label">Authorization Date:</label>
              <input type="date" id="sim-form-date" class="text-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="option-row" style="margin-top: 10px;">
              <label class="custom-checkbox">
                <input type="checkbox" id="sim-form-approved" checked>
                <span>Formally Verified and Accepted</span>
              </label>
            </div>
          </div>
        `;
      } else {
        listEl.innerHTML = `
          <div class="option-group">
            ${rawFields.map((f, i) => `
              <div class="option-row" style="margin-bottom: 12px;">
                <label class="input-label">${f.getName()}:</label>
                <input type="text" class="text-input acro-field-input" data-name="${f.getName()}" value="">
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (e) {
      console.error(e);
    }
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const flatten = document.querySelector('#form-flatten')?.checked || false;

    setProgress(25, 'Loading PDF Form...');
    const pdfDoc = await loadPdfLibDoc(file);
    const form = pdfDoc.getForm();
    const rawFields = form.getFields();

    if (rawFields.length > 0) {
      setProgress(50, 'Filling interactive form fields...');
      const inputs = document.querySelectorAll('.acro-field-input');
      inputs.forEach(input => {
        const name = input.dataset.name;
        const val = input.value;
        try {
          const field = form.getTextField(name);
          if (field && val) field.setText(val);
        } catch (e) {}
      });

      if (flatten) {
        setProgress(75, 'Flattening form fields...');
        form.flatten();
      }
    } else {
      setProgress(60, 'Stamping form response data...');
      const simName = document.querySelector('#sim-form-name')?.value || 'Jane Cooper';
      const simDate = document.querySelector('#sim-form-date')?.value || new Date().toLocaleDateString();
      const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      const { height } = lastPage.getSize();

      lastPage.drawText(`[STAMPED FORM RECORD] ${simName} - ${simDate}`, {
        x: 60,
        y: 80,
        size: 10,
        color: { type: 'RGB', red: 0.1, green: 0.5, blue: 0.2 }
      });
    }

    setProgress(90, 'Saving filled document...');
    const bytes = await pdfDoc.save();

    setProgress(100, 'Complete!');
    return {
      data: bytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_completed_form.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
