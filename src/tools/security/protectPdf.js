import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { loadPdfLibDoc } from '../../utils/pdfHelper.js';

export const protectPdfTool = {
  id: 'protect-pdf',
  renderOptions(container, files, onUpdate) {
    container.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="lock"></i> Password & Encryption Settings</h4>
        <p class="text-muted">Encrypt document: <strong>${files[0].name}</strong> with military-grade AES-256 protection.</p>

        <div class="option-group">
          <div class="option-row">
            <label class="input-label" for="protect-user-pass">User Password (Required to Open):</label>
            <div class="input-with-icon">
              <input type="password" id="protect-user-pass" class="text-input" placeholder="Enter secure password" autocomplete="new-password">
              <button type="button" class="btn-toggle-eye" id="toggle-user-pass" title="Toggle visibility">👁</button>
            </div>
            <small class="text-muted">Anyone opening this document must enter this password.</small>
          </div>

          <div class="option-row" style="margin-top: 14px;">
            <label class="input-label" for="protect-confirm-pass">Confirm Password:</label>
            <input type="password" id="protect-confirm-pass" class="text-input" placeholder="Confirm your password" autocomplete="new-password">
            <span id="pass-match-indicator" class="small" style="display: block; margin-top: 4px;"></span>
          </div>

          <div class="accordion-section" style="margin-top: 18px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <details>
              <summary style="cursor: pointer; font-weight: 600; color: var(--text-heading); font-size: 0.9rem;">
                Advanced Permission Restrictions
              </summary>
              <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 10px;">
                <label class="custom-checkbox">
                  <input type="checkbox" id="perm-allow-print" checked>
                  <span>Allow Document Printing</span>
                </label>
                <label class="custom-checkbox">
                  <input type="checkbox" id="perm-allow-copy">
                  <span>Allow Content & Text Copying</span>
                </label>
                <div class="option-row" style="margin-top: 8px;">
                  <label class="input-label" for="protect-owner-pass">Master / Owner Password (Optional):</label>
                  <input type="password" id="protect-owner-pass" class="text-input" placeholder="Different password to bypass restrictions">
                  <small class="text-muted">Leave blank to use the same password as above.</small>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    `;

    const userPass = container.querySelector('#protect-user-pass');
    const confirmPass = container.querySelector('#protect-confirm-pass');
    const matchIndicator = container.querySelector('#pass-match-indicator');
    const toggleEye = container.querySelector('#toggle-user-pass');

    toggleEye?.addEventListener('click', () => {
      const isPass = userPass.type === 'password';
      userPass.type = isPass ? 'text' : 'password';
      confirmPass.type = isPass ? 'text' : 'password';
      toggleEye.textContent = isPass ? '🔒' : '👁';
    });

    const checkMatch = () => {
      if (!userPass.value && !confirmPass.value) {
        matchIndicator.textContent = '';
        return;
      }
      if (userPass.value === confirmPass.value) {
        matchIndicator.textContent = '✓ Passwords match';
        matchIndicator.style.color = '#10b981';
      } else {
        matchIndicator.textContent = '✗ Passwords do not match';
        matchIndicator.style.color = '#ef4444';
      }
    };

    userPass?.addEventListener('input', checkMatch);
    confirmPass?.addEventListener('input', checkMatch);
  },

  async process(files, options, setProgress) {
    const file = files[0];
    const userPassword = document.querySelector('#protect-user-pass')?.value || '';
    const confirmPassword = document.querySelector('#protect-confirm-pass')?.value || '';
    const ownerPassword = document.querySelector('#protect-owner-pass')?.value || userPassword;
    const allowPrint = document.querySelector('#perm-allow-print')?.checked ?? true;
    const allowCopy = document.querySelector('#perm-allow-copy')?.checked ?? false;

    if (!userPassword) {
      throw new Error('Please specify a password to protect this document.');
    }
    if (userPassword !== confirmPassword) {
      throw new Error('Passwords do not match. Please re-enter.');
    }

    setProgress(15, 'Reading original document buffer...');
    let arrayBuffer = await file.arrayBuffer();

    // Ensure document is valid by loading through pdf-lib first
    setProgress(30, 'Verifying document integrity and vector streams...');
    const pdfDoc = await loadPdfLibDoc(arrayBuffer);
    const sanitizedBytes = await pdfDoc.save();

    setProgress(60, 'Applying AES-256 standard encryption & permission flags...');
    const encryptOptions = {
      algorithm: 'AES-256',
      ownerPassword: ownerPassword || userPassword,
      permissions: {
        printing: allowPrint ? 'highResolution' : 'none',
        copying: allowCopy,
        modifying: false,
        annotating: false,
        fillingForms: true,
        contentAccessibility: true
      }
    };

    const encryptedBytes = await encryptPDF(sanitizedBytes, userPassword, encryptOptions);

    setProgress(95, 'Finalizing encrypted secure container...');
    setProgress(100, 'Document encrypted successfully!');

    return {
      data: encryptedBytes,
      filename: `${file.name.replace(/\.pdf$/i, '')}_protected.pdf`,
      mimeType: 'application/pdf'
    };
  }
};
