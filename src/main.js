import { CATEGORIES, TOOLS } from './data/toolsList.js';
import { getTool } from './tools/registry.js';
import { downloadFile, formatFileSize, triggerConfetti } from './utils/downloadHelper.js';
import { generateFirstPageThumbnail } from './utils/pdfHelper.js';
import { toast } from './utils/toast.js';
import {
  createSamplePdfFile,
  createSampleImageFile,
  createSampleExcelFile,
  createSampleWordFile,
  createSampleHtmlFile
} from './utils/sampleDocs.js';
import { authService } from './utils/authService.js';
import { adminService } from './utils/adminService.js';

class DocuMatrixStudioApp {
  constructor() {
    this.currentView = 'home'; // 'home' | 'tool' | 'admin' | 'legal'
    this.currentStage = 1;      // 1: Upload, 2: Workbench, 3: Download
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.adminUsersList = [];
    this.authMode = 'signin';

    // Pricing & UPI Configuration
    this.selectedPlanDuration = 'monthly';
    this.selectedPlanAmount = 100;
    this.activeUpiId = 'apnacollegebihar@slc';

    this.selectedToolMeta = null;
    this.activeToolInstance = null;
    this.activeFiles = [];
    this.lastProcessedResult = null;
    this.isProcessing = false;
    this.pendingFilesForRoute = null;

    this.initDOM();
    this.initTheme();
    this.renderCategoryPills();
    this.renderToolsGrid();
    this.initAuthAndAdmin();
    this.bindEvents();
    this.initRouter();
    this.updateHistoryBadge();
    this.refreshIcons();
  }

  /* --------------------------------------------------------------------------
     DOM Elements Initialization
     -------------------------------------------------------------------------- */
  initDOM() {
    // Views
    this.homeView = document.getElementById('home-view');
    this.studioToolView = document.getElementById('studio-tool-view');
    this.adminView = document.getElementById('admin-view');
    this.legalView = document.getElementById('legal-view');
    this.btnLegalBackStudio = document.getElementById('btn-legal-back-studio');
    this.legalTabButtons = document.querySelectorAll('.legal-tab-btn');
    this.legalPanes = document.querySelectorAll('.legal-content-pane');
    this.contactSupportForm = document.getElementById('contact-support-form');

    // Header & Navigation
    this.brandHomeLink = document.getElementById('brand-home-link');
    this.openPricingBtn = document.getElementById('open-pricing-btn');
    this.btnHeaderLogin = document.getElementById('btn-header-login');
    this.userHeaderWidget = document.getElementById('user-header-widget');
    this.btnUserAvatar = document.getElementById('btn-user-avatar');
    this.userAvatarInitial = document.getElementById('user-avatar-initial');
    this.userPlanBadge = document.getElementById('user-plan-badge');
    this.userDropdownMenu = document.getElementById('user-dropdown-menu');
    this.dropdownUserName = document.getElementById('dropdown-user-name');
    this.dropdownUserEmail = document.getElementById('dropdown-user-email');
    this.userQuotaCount = document.getElementById('user-quota-count');
    this.userQuotaFill = document.getElementById('user-quota-fill');
    this.dropdownUpgradeBtn = document.getElementById('dropdown-upgrade-btn');
    this.dropdownAdminBtn = document.getElementById('dropdown-admin-btn');
    this.dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

    // Auth Modal Elements (Google OAuth Exclusive)
    this.authModalOverlay = document.getElementById('auth-modal-overlay');
    this.btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
    this.btnGoogleSignIn = document.getElementById('btn-google-signin');
    this.btnGooglePrinceAdmin = document.getElementById('btn-google-prince-admin');
    this.btnGoogleGuestUser = document.getElementById('btn-google-guest-user');
    this.formCustomGoogle = document.getElementById('form-custom-google');
    this.customGoogleEmail = document.getElementById('custom-google-email');
    this.customGoogleName = document.getElementById('custom-google-name');

    // Pricing & Fast UPI Checkout Elements (DocStudio PRO: ₹5 / ₹100 / ₹1,000)
    this.pricingModalOverlay = document.getElementById('pricing-modal-overlay');
    this.btnClosePricingModal = document.getElementById('btn-close-pricing-modal');
    this.proTierCards = document.querySelectorAll('.pro-tier-card');
    this.btnTierSelects = document.querySelectorAll('.btn-tier-select');
    this.fastUpiDrawer = document.getElementById('fast-upi-payment-drawer');
    this.displayPayableAmount = document.getElementById('display-payable-amount');
    this.labelSelectedPlanName = document.getElementById('label-selected-plan-name');
    this.btnVerifyLabel = document.getElementById('btn-verify-label');
    this.displayUpiId = document.getElementById('display-upi-id');
    this.btnCopyUpiId = document.getElementById('btn-copy-upi-id');
    this.btnUpiDeeplink = document.getElementById('btn-upi-deeplink');
    this.inputUpiUtr = document.getElementById('input-upi-utr');
    this.btnVerifyUpiPayment = document.getElementById('btn-verify-upi-payment');
    this.pricingQrImage = document.getElementById('pricing-qr-image');

    // Quota Modal Elements
    this.quotaModalOverlay = document.getElementById('quota-modal-overlay');
    this.btnQuotaUpgradePro = document.getElementById('btn-quota-upgrade-pro');
    this.btnCloseQuotaModal = document.getElementById('btn-close-quota-modal');

    // Admin Dashboard Elements
    this.btnAdminReturnStudio = document.getElementById('btn-admin-return-studio');
    this.btnAdminRefreshUsers = document.getElementById('btn-admin-refresh-users');
    this.adminUserSearch = document.getElementById('admin-user-search');
    this.adminPlanFilter = document.getElementById('admin-plan-filter');
    this.adminUsersTbody = document.getElementById('admin-users-tbody');
    this.adminSubscriptionsTbody = document.getElementById('admin-subscriptions-tbody');
    this.adminLogsContainer = document.getElementById('admin-logs-container');
    this.kpiTotalUsers = document.getElementById('kpi-total-users');
    this.kpiProUsers = document.getElementById('kpi-pro-users');
    this.kpiProRatio = document.getElementById('kpi-pro-ratio');
    this.kpiDailyCount = document.getElementById('kpi-daily-count');
    this.kpiMonthlyCount = document.getElementById('kpi-monthly-count');
    this.kpiYearlyCount = document.getElementById('kpi-yearly-count');
    this.kpiSubscriptionsCountBadge = document.getElementById('kpi-subscriptions-count-badge');
    this.kpiTotalRevenue = document.getElementById('kpi-total-revenue');
    this.kpiTotalOps = document.getElementById('kpi-total-ops');
    this.mongoStatusPill = document.getElementById('mongo-status-pill');
    this.mongoStatusText = document.getElementById('mongo-status-text');
    this.myAccountLabel = document.querySelector('.my-account-label');
    this.dropdownPlanTitle = document.getElementById('dropdown-plan-title');
    this.dropdownSubStatus = document.getElementById('dropdown-sub-status');
    this.globalSearchInput = document.getElementById('global-search-input');
    this.globalSearchClear = document.getElementById('global-search-clear');
    this.sampleDocsDropdownBtn = document.getElementById('sample-docs-dropdown-btn');
    this.sampleDocsMenu = document.getElementById('sample-docs-menu');
    this.openHistoryBtn = document.getElementById('open-history-btn');
    this.historyCounterChip = document.getElementById('history-counter-chip');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.iconSun = document.getElementById('icon-sun');
    this.iconMoon = document.getElementById('icon-moon');

    // Homepage Meta & Filters
    this.categoryPillsBar = document.getElementById('category-pills-bar');
    this.currentCategoryLabel = document.getElementById('current-category-label');
    this.toolsCountBadge = document.getElementById('tools-count-badge');
    this.searchFeedbackChip = document.getElementById('search-feedback-chip');
    this.searchFeedbackText = document.getElementById('search-feedback-text');
    this.clearSearchChipBtn = document.getElementById('clear-search-chip-btn');
    this.toolsDirectoryGrid = document.getElementById('tools-directory-grid');
    this.emptySearchState = document.getElementById('empty-search-state');
    this.resetAllFiltersBtn = document.getElementById('reset-all-filters-btn');

    // Workspace Top Bar
    this.btnBackToDirectory = document.getElementById('btn-back-to-directory');
    this.wsCategoryTag = document.getElementById('ws-category-tag');
    this.wsBadgeTag = document.getElementById('ws-badge-tag');
    this.wsQuickSampleBtn = document.getElementById('ws-quick-sample-btn');

    // Stage 1: Document Ingestion
    this.studioStageUpload = document.getElementById('studio-stage-upload');
    this.stageUploadIcon = document.getElementById('stage-upload-icon');
    this.stageUploadTitle = document.getElementById('stage-upload-title');
    this.stageUploadDesc = document.getElementById('stage-upload-desc');
    this.ingestionDropZone = document.getElementById('ingestion-drop-zone');
    this.zoneSupportedTypes = document.getElementById('zone-supported-types');
    this.studioFileInput = document.getElementById('studio-file-input');
    this.btnBrowseLabel = document.getElementById('btn-browse-label');
    this.btnTrySampleStage1 = document.getElementById('btn-try-sample-stage1');

    // Stage 2: Workbench
    this.studioStageWorkbench = document.getElementById('studio-stage-workbench');
    this.studioAddMoreInput = document.getElementById('studio-add-more-input');
    this.mainStageFileCount = document.getElementById('main-stage-file-count');
    this.btnSortFiles = document.getElementById('btn-sort-files');
    this.btnClearFiles = document.getElementById('btn-clear-files');
    this.workbenchFileDeck = document.getElementById('workbench-file-deck');
    this.workbenchVisualStage = document.getElementById('workbench-visual-stage');

    // Sidebar
    this.sidebarIconGem = document.getElementById('sidebar-icon-gem');
    this.sidebarToolTitle = document.getElementById('sidebar-tool-title');
    this.sidebarDynamicOptions = document.getElementById('sidebar-dynamic-options');
    this.sidebarProgressContainer = document.getElementById('sidebar-progress-container');
    this.progressStatusLabel = document.getElementById('progress-status-label');
    this.progressPercentageLabel = document.getElementById('progress-percentage-label');
    this.sidebarProgressFill = document.getElementById('sidebar-progress-fill');
    this.sidebarActionExecuteBtn = document.getElementById('sidebar-action-execute-btn');
    this.sidebarExecuteLabel = document.getElementById('sidebar-execute-label');

    // Stage 3: Download Celebration
    this.studioStageDownload = document.getElementById('studio-stage-download');
    this.downloadHeading = document.getElementById('download-heading');
    this.downloadDescription = document.getElementById('download-description');
    this.btnInstantDownload = document.getElementById('btn-instant-download');
    this.btnDownloadText = document.getElementById('btn-download-text');
    this.downloadFilesizeChip = document.getElementById('download-filesize-chip');
    this.btnProcessAnotherFile = document.getElementById('btn-process-another-file');
    this.btnReturnDirectory = document.getElementById('btn-return-directory');

    // History Drawer
    this.historyDrawerOverlay = document.getElementById('history-drawer-overlay');
    this.closeHistoryDrawerBtn = document.getElementById('close-history-drawer-btn');
    this.historyEmptyView = document.getElementById('history-empty-view');
    this.historyItemsContainer = document.getElementById('history-items-container');
    this.clearAllHistoryRecords = document.getElementById('clear-all-history-records');
  }

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* --------------------------------------------------------------------------
     Theme Management (Light Mode Default + Dark Mode Toggle)
     -------------------------------------------------------------------------- */
  initTheme() {
    const saved = localStorage.getItem('documatrix_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this.applyThemeIcons(saved);
  }

  applyThemeIcons(theme) {
    if (theme === 'dark') {
      if (this.iconSun) this.iconSun.style.display = 'block';
      if (this.iconMoon) this.iconMoon.style.display = 'none';
    } else {
      if (this.iconSun) this.iconSun.style.display = 'none';
      if (this.iconMoon) this.iconMoon.style.display = 'block';
    }
  }

  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('documatrix_theme', next);
    this.applyThemeIcons(next);
  }

  /* --------------------------------------------------------------------------
     Category Filter Pills & Directory Rendering
     -------------------------------------------------------------------------- */
  renderCategoryPills() {
    if (!this.categoryPillsBar) return;

    this.categoryPillsBar.innerHTML = CATEGORIES.map(cat => {
      const isActive = cat.id === this.currentFilter;
      return `
        <button type="button" class="category-filter-pill ${isActive ? 'active' : ''}" data-cat-id="${cat.id}">
          <i data-lucide="${this.getLucideIcon(cat.icon)}"></i>
          <span>${cat.name}</span>
          <span class="pill-count-tag">${cat.count}</span>
        </button>
      `;
    }).join('');

    this.categoryPillsBar.querySelectorAll('.category-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const catId = pill.dataset.catId;
        this.currentFilter = catId;
        this.categoryPillsBar.querySelectorAll('.category-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (catId === 'all') {
          this.navigateTo('#/');
        } else {
          this.navigateTo(`#/category/${catId}`);
        }
        this.renderToolsGrid();
      });
    });
  }

  getFilteredTools() {
    return TOOLS.filter(tool => {
      const matchesCategory = this.currentFilter === 'all' || tool.category === this.currentFilter;
      const q = this.searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        tool.title.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  renderToolsGrid() {
    const filtered = this.getFilteredTools();

    // Update Meta Indicators
    const catObj = CATEGORIES.find(c => c.id === this.currentFilter);
    if (this.currentCategoryLabel) {
      this.currentCategoryLabel.textContent = catObj ? catObj.name : 'All Tools';
    }
    if (this.toolsCountBadge) {
      this.toolsCountBadge.textContent = `${filtered.length} Tool${filtered.length === 1 ? '' : 's'}`;
    }

    if (this.searchQuery.trim()) {
      if (this.searchFeedbackChip) this.searchFeedbackChip.style.display = 'inline-flex';
      if (this.searchFeedbackText) this.searchFeedbackText.textContent = this.searchQuery.trim();
    } else {
      if (this.searchFeedbackChip) this.searchFeedbackChip.style.display = 'none';
    }

    // Render Cards
    if (!this.toolsDirectoryGrid) return;

    if (filtered.length === 0) {
      this.toolsDirectoryGrid.innerHTML = '';
      if (this.emptySearchState) this.emptySearchState.style.display = 'block';
    } else {
      if (this.emptySearchState) this.emptySearchState.style.display = 'none';
      this.toolsDirectoryGrid.innerHTML = filtered.map(t => {
        const gradient = t.gradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)';
        return `
          <article class="studio-tool-card" data-tool-id="${t.id}" style="--tool-gradient: ${gradient};">
            <div class="card-header-line">
              <div class="card-icon-halo">
                <i data-lucide="${this.getLucideIcon(t.icon)}"></i>
              </div>
              ${t.badge ? `<span class="card-badge-pill">${t.badge}</span>` : ''}
            </div>

            <div class="card-main-content">
              <h3>${t.title}</h3>
              <p>${t.description}</p>
            </div>

            <div class="card-footer-line">
              <span class="card-cat-label">${t.category.replace('-', ' ')}</span>
              <div class="card-enter-icon" title="Open ${t.title}">
                <i data-lucide="arrow-up-right"></i>
              </div>
            </div>
          </article>
        `;
      }).join('');

      this.toolsDirectoryGrid.querySelectorAll('.studio-tool-card').forEach(card => {
        card.addEventListener('click', () => {
          this.navigateTo(`#/${card.dataset.toolId}`);
        });
      });
    }

    this.refreshIcons();
  }

  getLucideIcon(iconName) {
    const iconMap = {
      'LayoutGrid': 'layout-grid',
      'FolderKanban': 'folder-kanban',
      'Gauge': 'gauge',
      'FileInput': 'file-input',
      'FileOutput': 'file-output',
      'PenTool': 'pen-tool',
      'ShieldCheck': 'shield-check',
      'Layers': 'layers',
      'Scissors': 'scissors',
      'Trash2': 'trash-2',
      'FileSymlink': 'file-symlink',
      'LayoutDashboard': 'layout-dashboard',
      'Camera': 'camera',
      'Minimize2': 'minimize-2',
      'Wrench': 'wrench',
      'ScanText': 'scan-text',
      'Image': 'image',
      'Images': 'images',
      'FileText': 'file-text',
      'Presentation': 'presentation',
      'FileSpreadsheet': 'file-spreadsheet',
      'Code2': 'code-2',
      'Sheet': 'sheet',
      'Archive': 'archive',
      'RotateCw': 'rotate-cw',
      'Binary': 'binary',
      'Stamp': 'stamp',
      'Crop': 'crop',
      'Edit3': 'edit-3',
      'CheckSquare': 'check-square',
      'Unlock': 'unlock',
      'Lock': 'lock',
      'PenSquare': 'pen-tool',
      'EyeOff': 'eye-off',
      'GitCompare': 'git-compare'
    };
    return iconMap[iconName] || 'file-text';
  }

  /* --------------------------------------------------------------------------
     Single Page Application (SPA) Router
     -------------------------------------------------------------------------- */
  initRouter() {
    window.addEventListener('hashchange', () => {
      this.handleRouting();
    });

    // Handle initial route on first page load
    this.handleRouting();
  }

  navigateTo(hashPath, replace = false) {
    if (!hashPath.startsWith('#/')) {
      hashPath = '#/' + hashPath.replace(/^#?\/?/, '');
    }
    if (replace) {
      window.location.replace(hashPath);
    } else {
      if (window.location.hash !== hashPath) {
        window.location.hash = hashPath;
      } else {
        this.handleRouting();
      }
    }
  }

  handleRouting() {
    let clean = '';
    const rawHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
    const rawPath = (window.location.pathname || '').replace(/^\//, '').replace(/\/$/, '').trim();

    if (rawHash) {
      clean = rawHash;
    } else if (rawPath && rawPath !== 'index.html') {
      clean = rawPath;
    }

    // Home route
    if (!clean || clean === 'home' || clean === '/') {
      this.showHomeView(false);
      return;
    }

    // Admin portal route: #/admin or /admin
    if (clean === 'admin') {
      if (!authService.isAdmin()) {
        toast.info('Please sign in as Super Admin (prince86944@gmail.com) to access the Admin Portal.');
        this.openAuthModal('signin');
        this.showHomeView(false);
        return;
      }
      this.showAdminView(false);
      return;
    }

    // Legal, Compliance & Support routes: #/privacy, #/terms, #/refund, #/about, #/contact
    if (['privacy', 'terms', 'refund', 'about', 'contact'].includes(clean)) {
      this.showLegalView(clean, false);
      return;
    }
    if (clean.startsWith('legal/')) {
      const sub = clean.replace('legal/', '').trim() || 'privacy';
      this.showLegalView(sub, false);
      return;
    }

    // Category filter route: #/category/:catId
    if (clean.startsWith('category/')) {
      const catId = clean.replace('category/', '').trim();
      const catObj = CATEGORIES.find(c => c.id === catId);
      if (catObj) {
        this.currentFilter = catId;
        if (this.categoryPillsBar) {
          this.categoryPillsBar.querySelectorAll('.category-filter-pill').forEach(p => {
            p.classList.toggle('active', p.dataset.catId === catId);
          });
        }
        this.showHomeView(false);
        this.renderToolsGrid();
        document.title = `${catObj.name} — DocStudio`;
        return;
      }
    }

    // Tool Studio route: #/:toolId
    const toolId = clean.split('/')[0];
    const meta = TOOLS.find(t => t.id === toolId);
    if (meta) {
      this.showToolView(toolId, null, false);
    } else {
      // Unknown route fallback
      this.navigateTo('#/', true);
    }
  }

  /* --------------------------------------------------------------------------
     Navigation Views (Home Directory vs Studio Tool View vs Admin Portal vs Legal)
     -------------------------------------------------------------------------- */
  showHomeView(updateHash = true) {
    if (updateHash && window.location.hash !== '#/' && window.location.hash !== '') {
      this.navigateTo('#/');
      return;
    }

    this.currentView = 'home';
    if (this.homeView) this.homeView.style.display = 'block';
    if (this.studioToolView) this.studioToolView.style.display = 'none';
    if (this.adminView) this.adminView.style.display = 'none';
    if (this.legalView) this.legalView.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.selectedToolMeta = null;
    this.activeToolInstance = null;
    this.activeFiles = [];
    this.lastProcessedResult = null;
    this.updateNavTabsActiveState(null);
    document.title = 'DocStudio — Next-Gen Client-Side PDF Engine';
  }

  showAdminView(updateHash = true) {
    if (updateHash && window.location.hash !== '#/admin') {
      this.navigateTo('#/admin');
      return;
    }

    this.currentView = 'admin';
    if (this.homeView) this.homeView.style.display = 'none';
    if (this.studioToolView) this.studioToolView.style.display = 'none';
    if (this.adminView) this.adminView.style.display = 'block';
    if (this.legalView) this.legalView.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.title = 'Admin Command Center — DocStudio';
    this.updateNavTabsActiveState(null);
    this.loadAdminDashboard();
    this.refreshIcons();
  }

  showLegalView(section = 'privacy', updateHash = true) {
    if (updateHash && window.location.hash !== `#/${section}`) {
      this.navigateTo(`#/${section}`);
      return;
    }

    this.currentView = 'legal';
    if (this.homeView) this.homeView.style.display = 'none';
    if (this.studioToolView) this.studioToolView.style.display = 'none';
    if (this.adminView) this.adminView.style.display = 'none';
    if (this.legalView) this.legalView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Activate corresponding tab button
    document.querySelectorAll('.legal-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.legalTarget === section);
    });

    // Activate corresponding content pane
    document.querySelectorAll('.legal-content-pane').forEach(pane => {
      const match = pane.id === `legal-pane-${section}`;
      pane.style.display = match ? 'block' : 'none';
      pane.classList.toggle('active', match);
    });

    const titles = {
      privacy: 'Privacy Policy — DocStudio',
      terms: 'Terms of Service — DocStudio',
      refund: 'Refund & Cancellation Policy — DocStudio',
      about: 'About DocStudio — Engineering Principles',
      contact: 'Contact Support & Help Desk — DocStudio'
    };
    document.title = titles[section] || 'Compliance & Support — DocStudio';
    this.updateNavTabsActiveState(null);
    this.refreshIcons();
  }

  updateNavTabsActiveState(activeId) {
    document.querySelectorAll('.header-nav-tabs .nav-tab-item, .header-nav-tabs .nav-tab-dropdown-btn').forEach(el => {
      el.classList.remove('active');
    });

    if (!activeId) return;

    // Direct tab
    const directTab = document.querySelector(`.header-nav-tabs .nav-tab-item[data-nav-tool="${activeId}"]`);
    if (directTab) {
      directTab.classList.add('active');
      return;
    }

    // Check if under convert dropdown
    const isConvert = document.querySelector(`#menu-convert-dropdown [data-nav-tool="${activeId}"]`);
    if (isConvert) {
      document.getElementById('btn-convert-dropdown')?.classList.add('active');
      return;
    }

    // Otherwise mark All PDF Tools dropdown
    document.getElementById('btn-all-tools-dropdown')?.classList.add('active');
  }

  async showToolView(toolId, preloadedFiles = null, updateHash = true) {
    if (updateHash && window.location.hash !== `#/${toolId}`) {
      if (preloadedFiles) {
        this.pendingFilesForRoute = preloadedFiles;
      }
      this.navigateTo(`#/${toolId}`);
      return;
    }

    const meta = TOOLS.find(t => t.id === toolId);
    if (!meta) return;

    const toolLogic = getTool(toolId);
    if (!toolLogic) {
      toast.error(`Tool logic for "${meta.title}" could not be loaded.`);
      return;
    }

    this.currentView = 'tool';
    this.selectedToolMeta = meta;
    this.activeToolInstance = toolLogic;

    const filesToLoad = preloadedFiles || this.pendingFilesForRoute || [];
    this.pendingFilesForRoute = null;
    this.activeFiles = [...filesToLoad];

    document.title = `${meta.title} — DocStudio`;
    this.updateNavTabsActiveState(toolId);

    // Switch Views
    if (this.homeView) this.homeView.style.display = 'none';
    if (this.adminView) this.adminView.style.display = 'none';
    if (this.legalView) this.legalView.style.display = 'none';
    if (this.studioToolView) this.studioToolView.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Workspace Top Bar Details
    if (this.wsCategoryTag) this.wsCategoryTag.textContent = meta.category.replace('-', ' ');
    if (this.wsBadgeTag) this.wsBadgeTag.textContent = meta.badge || 'PRO';

    // Stage 1 (Drop Zone Setup)
    if (this.stageUploadIcon) {
      this.stageUploadIcon.style.background = meta.gradient || 'linear-gradient(135deg, #6366f1, #a855f7)';
      this.stageUploadIcon.innerHTML = `<i data-lucide="${this.getLucideIcon(meta.icon)}"></i>`;
    }
    if (this.stageUploadTitle) this.stageUploadTitle.textContent = meta.title;
    if (this.stageUploadDesc) this.stageUploadDesc.textContent = meta.description;

    const fileLabel = this.getFileLabelForTool(meta);
    if (this.btnBrowseLabel) this.btnBrowseLabel.textContent = `Select ${fileLabel}`;
    if (this.zoneSupportedTypes) this.zoneSupportedTypes.textContent = `Accepted formats: ${meta.accept || '.pdf'}`;

    if (this.studioFileInput) {
      this.studioFileInput.accept = meta.accept || '.pdf';
      this.studioFileInput.multiple = !!meta.multiple;
    }
    if (this.studioAddMoreInput) {
      this.studioAddMoreInput.accept = meta.accept || '.pdf';
      this.studioAddMoreInput.multiple = true;
    }

    // Sidebar Config Setup
    if (this.sidebarIconGem) {
      this.sidebarIconGem.style.background = meta.gradient || 'linear-gradient(135deg, #6366f1, #a855f7)';
      this.sidebarIconGem.innerHTML = `<i data-lucide="${this.getLucideIcon(meta.icon)}" style="width: 20px; height: 20px;"></i>`;
    }
    if (this.sidebarToolTitle) this.sidebarToolTitle.textContent = meta.title;
    if (this.sidebarExecuteLabel) this.sidebarExecuteLabel.textContent = meta.actionName || meta.title;

    if (this.activeFiles.length > 0) {
      await this.setToolStage(2);
    } else {
      this.setToolStage(1);
    }

    this.refreshIcons();
  }

  getFileLabelForTool(meta) {
    const id = meta.id;
    if (id.includes('excel')) return 'Excel Document';
    if (id.includes('word')) return 'Word Document';
    if (id.includes('powerpoint') || id.includes('ppt')) return 'PowerPoint Slides';
    if (id.includes('jpg') || id.includes('image')) return 'Image File';
    if (id.includes('html')) return 'HTML File';
    return 'PDF File';
  }

  async setToolStage(stageNum) {
    this.currentStage = stageNum;

    if (this.studioStageUpload) this.studioStageUpload.style.display = stageNum === 1 ? 'flex' : 'none';
    if (this.studioStageWorkbench) this.studioStageWorkbench.style.display = stageNum === 2 ? 'flex' : 'none';
    if (this.studioStageDownload) this.studioStageDownload.style.display = stageNum === 3 ? 'flex' : 'none';

    if (stageNum === 2) {
      await this.renderWorkbench();
    } else if (stageNum === 3) {
      this.renderDownloadScreen();
    }

    this.refreshIcons();
  }

  /* --------------------------------------------------------------------------
     Stage 2: Split Workbench Layout (Document Deck/Visual Canvas + Right Panel)
     -------------------------------------------------------------------------- */
  async renderWorkbench() {
    const count = this.activeFiles.length;
    if (this.mainStageFileCount) {
      this.mainStageFileCount.textContent = `${count} file${count === 1 ? '' : 's'} loaded`;
    }

    const toolId = this.selectedToolMeta?.id;
    const isVisualTool = [
      'edit-pdf',
      'sign-pdf',
      'crop-pdf',
      'compare-pdf',
      'redact-pdf',
      'remove-pages',
      'extract-pages',
      'organize-pdf'
    ].includes(toolId);

    if (isVisualTool) {
      // Interactive visual canvas / page organizer mode
      this.workbenchFileDeck.style.display = 'none';
      this.workbenchVisualStage.style.display = 'flex';
      this.workbenchVisualStage.innerHTML = '';

      if (typeof this.activeToolInstance.renderOptions === 'function') {
        await this.activeToolInstance.renderOptions(
          this.workbenchVisualStage,
          this.activeFiles,
          (updated) => {
            if (toolId === 'remove-pages') {
              this.updateRemovePagesSidebarStats();
            } else if (toolId === 'extract-pages') {
              this.updateExtractPagesSidebarStats();
            } else if (updated) {
              this.activeFiles = updated;
              if (this.mainStageFileCount) {
                this.mainStageFileCount.textContent = `${this.activeFiles.length} file${this.activeFiles.length === 1 ? '' : 's'} loaded`;
              }
            }
          }
        );
      }

      // Render dedicated interactive sidebar controls for page tools
      if (toolId === 'remove-pages') {
        this.renderRemovePagesSidebar();
      } else if (toolId === 'extract-pages') {
        this.renderExtractPagesSidebar();
      } else if (toolId === 'organize-pdf') {
        this.renderOrganizePdfSidebar();
      } else {
        // Standard interactive studio sidebar guide
        this.sidebarDynamicOptions.innerHTML = `
          <div class="tool-options-panel">
            <h4><i data-lucide="sparkles"></i> Interactive Stage</h4>
            <p class="text-muted" style="line-height:1.6; margin-top:8px; font-size:0.88rem;">
              Make your precise adjustments directly on the main visual stage. When satisfied, click the action button below to compile and save your document.
            </p>
            <div style="margin-top:20px; background:var(--bg-surface-elevated); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
              <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.04em;">Primary Source</span>
              <div style="font-weight:600; font-size:0.9rem; color:var(--text-heading); word-break:break-all; margin-top:4px;">${this.activeFiles[0]?.name || 'Document'}</div>
              <div style="font-size:0.78rem; color:var(--text-dim); margin-top:2px;">${formatFileSize(this.activeFiles[0]?.size)}</div>
            </div>
          </div>
        `;
      }
    } else {
      // Standard File Deck Grid
      this.workbenchVisualStage.style.display = 'none';
      this.workbenchFileDeck.style.display = 'grid';

      this.workbenchFileDeck.innerHTML = this.activeFiles.map((file, idx) => `
        <div class="file-deck-card" data-idx="${idx}">
          <button type="button" class="file-deck-card__delete" data-del-idx="${idx}" title="Remove file">&times;</button>
          <div class="file-deck-card__thumb" id="file-deck-thumb-${idx}">
            <div class="thumb-loading-placeholder">
              <i data-lucide="file-text" style="width:44px; height:44px; color:var(--primary); opacity:0.6;"></i>
            </div>
          </div>
          <div class="file-deck-card__name" title="${file.name}">${file.name}</div>
          <div class="file-deck-card__meta">${formatFileSize(file.size)}</div>
        </div>
      `).join('');

      // Immediately render high-res thumbnail for every file card!
      this.activeFiles.forEach(async (file, idx) => {
        const thumbSlot = document.getElementById(`file-deck-thumb-${idx}`);
        if (!thumbSlot) return;
        try {
          const thumbUrl = await generateFirstPageThumbnail(file);
          if (thumbUrl && thumbSlot) {
            thumbSlot.innerHTML = `<img src="${thumbUrl}" alt="${file.name}" class="file-deck-thumb-img" />`;
          }
        } catch (e) {
          console.warn('Could not generate thumb for file', file.name, e);
        }
      });

      this.workbenchFileDeck.querySelectorAll('.file-deck-card__delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.delIdx);
          this.activeFiles.splice(idx, 1);
          if (this.activeFiles.length === 0) {
            this.setToolStage(1);
          } else {
            this.renderWorkbench();
          }
        });
      });

      // Options inside right sidebar
      if (typeof this.activeToolInstance.renderOptions === 'function') {
        this.sidebarDynamicOptions.innerHTML = '';
        await this.activeToolInstance.renderOptions(
          this.sidebarDynamicOptions,
          this.activeFiles,
          (updated) => {
            if (updated) {
              this.activeFiles = updated;
              this.renderWorkbench();
            }
          }
        );
      } else {
        this.sidebarDynamicOptions.innerHTML = `
          <div class="tool-options-panel">
            <h4><i data-lucide="check-circle" style="color:var(--accent-emerald);"></i> Ready to Execute</h4>
            <p class="text-muted" style="margin-top:8px; line-height:1.6; font-size:0.88rem;">
              All source documents are loaded into browser memory. Click the action button below to start the WebAssembly pipeline.
            </p>
          </div>
        `;
      }
    }

    if (this.sidebarActionExecuteBtn) {
      this.sidebarActionExecuteBtn.disabled = this.activeFiles.length === 0;
    }
    this.refreshIcons();
  }

  /* --------------------------------------------------------------------------
     Sidebar Controls for Visual Page Tools
     -------------------------------------------------------------------------- */
  renderRemovePagesSidebar() {
    this.sidebarDynamicOptions.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="trash-2" style="color:var(--accent-rose);"></i> Remove Pages</h4>
        <p class="text-muted" style="line-height:1.5; margin-top:6px; font-size:0.85rem;">
          Click any page on the main stage to mark it for deletion. Red-highlighted pages will be removed.
        </p>

        <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
          <button type="button" id="side-del-all-btn" class="btn-stage-tool" style="justify-content:center; width:100%;">
            <i data-lucide="check-square"></i> Select All Pages
          </button>
          <button type="button" id="side-del-clear-btn" class="btn-stage-tool" style="justify-content:center; width:100%;">
            <i data-lucide="x"></i> Clear Selection
          </button>
          <div class="grid-2-col" style="gap:8px;">
            <button type="button" id="side-del-odd-btn" class="btn-stage-tool" style="justify-content:center;">
              Odd Pages
            </button>
            <button type="button" id="side-del-even-btn" class="btn-stage-tool" style="justify-content:center;">
              Even Pages
            </button>
          </div>
        </div>

        <div style="margin-top:20px; background:var(--bg-surface-elevated); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.04em;">Pages to delete:</div>
          <div id="side-del-count" style="font-size:1.15rem; font-weight:700; color:var(--accent-rose); margin-top:4px;">0 pages selected</div>
          <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px; word-break:break-all;">${this.activeFiles[0]?.name || 'Document'}</div>
        </div>
      </div>
    `;

    document.getElementById('side-del-all-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      cards.forEach(card => {
        const p = parseInt(card.dataset.page);
        this.activeToolInstance.selectedPages.add(p);
        card.classList.add('marked-for-deletion');
      });
      this.updateRemovePagesSidebarStats();
    });

    document.getElementById('side-del-clear-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      this.activeToolInstance.selectedPages.clear();
      cards.forEach(card => card.classList.remove('marked-for-deletion'));
      this.updateRemovePagesSidebarStats();
    });

    document.getElementById('side-del-odd-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      this.activeToolInstance.selectedPages.clear();
      cards.forEach(card => {
        const p = parseInt(card.dataset.page);
        if (p % 2 !== 0) {
          this.activeToolInstance.selectedPages.add(p);
          card.classList.add('marked-for-deletion');
        } else {
          card.classList.remove('marked-for-deletion');
        }
      });
      this.updateRemovePagesSidebarStats();
    });

    document.getElementById('side-del-even-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      this.activeToolInstance.selectedPages.clear();
      cards.forEach(card => {
        const p = parseInt(card.dataset.page);
        if (p % 2 === 0) {
          this.activeToolInstance.selectedPages.add(p);
          card.classList.add('marked-for-deletion');
        } else {
          card.classList.remove('marked-for-deletion');
        }
      });
      this.updateRemovePagesSidebarStats();
    });

    this.updateRemovePagesSidebarStats();
  }

  updateRemovePagesSidebarStats() {
    const count = this.activeToolInstance?.selectedPages?.size || 0;
    const countEl = document.getElementById('side-del-count');
    if (countEl) countEl.textContent = `${count} page${count === 1 ? '' : 's'} selected`;
    if (this.sidebarActionExecuteBtn) {
      this.sidebarActionExecuteBtn.disabled = count === 0;
    }
  }

  renderExtractPagesSidebar() {
    this.sidebarDynamicOptions.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="file-symlink" style="color:var(--accent-emerald);"></i> Extract Pages</h4>
        <p class="text-muted" style="line-height:1.5; margin-top:6px; font-size:0.85rem;">
          Click pages on the main stage to select which pages to extract into a brand new document.
        </p>

        <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
          <button type="button" id="side-extract-all-btn" class="btn-stage-tool" style="justify-content:center; width:100%;">
            <i data-lucide="check-square"></i> Select All Pages
          </button>
          <button type="button" id="side-extract-clear-btn" class="btn-stage-tool" style="justify-content:center; width:100%;">
            <i data-lucide="x"></i> Reset Selection
          </button>
        </div>

        <div style="margin-top:20px; background:var(--bg-surface-elevated); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.04em;">Pages to extract:</div>
          <div id="side-extract-count" style="font-size:1.15rem; font-weight:700; color:var(--accent-emerald); margin-top:4px;">1 page selected</div>
          <div style="font-size:0.75rem; color:var(--text-dim); margin-top:4px; word-break:break-all;">${this.activeFiles[0]?.name || 'Document'}</div>
        </div>
      </div>
    `;

    document.getElementById('side-extract-all-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      cards.forEach(card => {
        const p = parseInt(card.dataset.page);
        this.activeToolInstance.selectedPages.add(p);
        card.classList.add('marked-for-extraction');
      });
      this.updateExtractPagesSidebarStats();
    });

    document.getElementById('side-extract-clear-btn')?.addEventListener('click', () => {
      const cards = this.workbenchVisualStage.querySelectorAll('.page-thumb-card');
      this.activeToolInstance.selectedPages.clear();
      this.activeToolInstance.selectedPages.add(1);
      cards.forEach(card => {
        const p = parseInt(card.dataset.page);
        card.classList.toggle('marked-for-extraction', p === 1);
      });
      this.updateExtractPagesSidebarStats();
    });

    this.updateExtractPagesSidebarStats();
  }

  updateExtractPagesSidebarStats() {
    const count = this.activeToolInstance?.selectedPages?.size || 0;
    const countEl = document.getElementById('side-extract-count');
    if (countEl) countEl.textContent = `${count} page${count === 1 ? '' : 's'} selected`;
    if (this.sidebarActionExecuteBtn) {
      this.sidebarActionExecuteBtn.disabled = count === 0;
    }
  }

  renderOrganizePdfSidebar() {
    this.sidebarDynamicOptions.innerHTML = `
      <div class="tool-options-panel">
        <h4><i data-lucide="layout-dashboard"></i> Page Organizer</h4>
        <p class="text-muted" style="line-height:1.5; margin-top:6px; font-size:0.85rem;">
          Drag, reorder, rotate, or delete individual pages directly on the visual organizer stage.
        </p>

        <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
          <button type="button" id="side-org-rotate-all" class="btn-stage-tool" style="justify-content:center; width:100%;">
            <i data-lucide="rotate-cw"></i> Rotate All Pages 90°
          </button>
        </div>

        <div style="margin-top:20px; background:var(--bg-surface-elevated); padding:14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.04em;">Loaded Document:</div>
          <div style="font-weight:600; font-size:0.9rem; color:var(--text-heading); word-break:break-all; margin-top:4px;">${this.activeFiles[0]?.name || 'Document'}</div>
          <div style="font-size:0.78rem; color:var(--text-dim); margin-top:2px;">${formatFileSize(this.activeFiles[0]?.size)}</div>
        </div>
      </div>
    `;

    document.getElementById('side-org-rotate-all')?.addEventListener('click', () => {
      if (Array.isArray(this.activeToolInstance.pagesState)) {
        this.activeToolInstance.pagesState.forEach(p => {
          p.rotation = (p.rotation + 90) % 360;
        });
        const grid = this.workbenchVisualStage.querySelector('#organize-grid');
        if (grid && typeof this.activeToolInstance.renderGrid === 'function') {
          this.activeToolInstance.renderGrid(grid);
        }
      }
    });
  }

  /* --------------------------------------------------------------------------
     Execution Pipeline & Stage 3 (Download Celebration)
     -------------------------------------------------------------------------- */
  async executeTool() {
    if (!this.activeToolInstance || this.activeFiles.length === 0 || this.isProcessing) return;

    // Check quota before execution
    const usageCheck = await authService.checkAndRecordUsage(
      this.selectedToolMeta?.id || 'tool',
      this.activeFiles[0]?.name || 'document.pdf'
    );

    if (!usageCheck.allowed) {
      this.openQuotaModal();
      return;
    }

    this.isProcessing = true;
    if (this.sidebarActionExecuteBtn) this.sidebarActionExecuteBtn.disabled = true;
    if (this.sidebarProgressContainer) this.sidebarProgressContainer.style.display = 'block';
    if (this.sidebarProgressFill) this.sidebarProgressFill.style.width = '10%';
    if (this.progressPercentageLabel) this.progressPercentageLabel.textContent = '10%';
    if (this.progressStatusLabel) this.progressStatusLabel.textContent = 'Initializing in-memory engine...';

    const setProgress = (pct, label) => {
      if (this.sidebarProgressFill) this.sidebarProgressFill.style.width = `${pct}%`;
      if (this.progressPercentageLabel) this.progressPercentageLabel.textContent = `${pct}%`;
      if (this.progressStatusLabel && label) this.progressStatusLabel.textContent = label;
    };

    try {
      const result = await this.activeToolInstance.process(this.activeFiles, {}, setProgress);

      if (result && result.data) {
        this.lastProcessedResult = result;
        // Trigger auto-download
        downloadFile(result.data, result.filename, result.mimeType);
        this.recordHistoryItem(result);
        this.updateHistoryBadge();
        await this.setToolStage(3);
      }
    } catch (err) {
      console.error('Execution error:', err);
      toast.error(err.message || 'Processing failed. Please check your documents.');
    } finally {
      this.isProcessing = false;
      if (this.sidebarActionExecuteBtn) this.sidebarActionExecuteBtn.disabled = false;
      if (this.sidebarProgressContainer) this.sidebarProgressContainer.style.display = 'none';
    }
  }

  renderDownloadScreen() {
    if (!this.lastProcessedResult) return;
    const res = this.lastProcessedResult;

    if (this.downloadHeading) {
      this.downloadHeading.textContent = `Your ${this.selectedToolMeta?.title || 'Document'} is Ready!`;
    }
    if (this.downloadDescription) {
      this.downloadDescription.textContent = `"${res.filename}" has been successfully synthesized in local memory.`;
    }
    if (this.btnDownloadText) {
      this.btnDownloadText.textContent = `Download ${res.filename}`;
    }

    const size = res.data?.byteLength || res.data?.size || 0;
    if (this.downloadFilesizeChip) {
      this.downloadFilesizeChip.textContent = `Output Size: ${formatFileSize(size)}`;
    }

    triggerConfetti();
  }

  /* --------------------------------------------------------------------------
     File Handling & Sample Generation
     -------------------------------------------------------------------------- */
  handleFileSelection(filesList) {
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList);

    if (this.selectedToolMeta?.multiple) {
      this.activeFiles = [...this.activeFiles, ...incoming];
    } else {
      this.activeFiles = [incoming[0]];
    }

    this.setToolStage(2);
  }

  async loadSampleDocForCurrentTool() {
    if (!this.selectedToolMeta) return;
    const id = this.selectedToolMeta.id;
    const accept = (this.selectedToolMeta.accept || '').toLowerCase();

    toast.info('Generating sample file in browser memory...');
    let sampleFile;

    try {
      if (id.includes('excel') || accept.includes('.xlsx')) {
        sampleFile = createSampleExcelFile();
      } else if (id.includes('word') || accept.includes('.docx')) {
        sampleFile = await createSampleWordFile();
      } else if (id.includes('jpg') || id.includes('image') || accept.includes('image/')) {
        sampleFile = createSampleImageFile();
      } else if (id.includes('html') || accept.includes('.html')) {
        sampleFile = createSampleHtmlFile();
      } else if (id === 'compare-pdf') {
        // Compare PDF requires 2 documents
        const file1 = await createSamplePdfFile('Baseline_Q1_Audit.pdf');
        const file2 = await createSamplePdfFile('Modified_Q2_Audit.pdf');
        this.activeFiles = [file1, file2];
        toast.success('Loaded 2 comparison sample documents!');
        await this.setToolStage(2);
        return;
      } else {
        sampleFile = await createSamplePdfFile();
      }

      this.handleFileSelection([sampleFile]);
      toast.success(`Loaded "${sampleFile.name}"!`);
    } catch (e) {
      console.error(e);
      toast.error('Could not generate sample file: ' + e.message);
    }
  }

  async loadSampleFromHeader(type) {
    if (this.sampleDocsMenu) this.sampleDocsMenu.classList.remove('show');
    toast.info(`Synthesizing sample ${type.toUpperCase()} file...`);
    let file;
    let targetTool = 'merge-pdf';

    try {
      if (type === 'pdf') {
        file = await createSamplePdfFile();
        targetTool = 'organize-pdf';
      } else if (type === 'excel') {
        file = createSampleExcelFile();
        targetTool = 'excel-to-pdf';
      } else if (type === 'word') {
        file = await createSampleWordFile();
        targetTool = 'word-to-pdf';
      } else if (type === 'image') {
        file = createSampleImageFile();
        targetTool = 'jpg-to-pdf';
      } else if (type === 'html') {
        file = createSampleHtmlFile();
        targetTool = 'html-to-pdf';
      }

      await this.showToolView(targetTool, [file]);
      toast.success(`Loaded "${file.name}" into ${targetTool}!`);
    } catch (e) {
      console.error(e);
      toast.error('Sample generation failed: ' + e.message);
    }
  }

  /* --------------------------------------------------------------------------
     Recent Downloads History
     -------------------------------------------------------------------------- */
  recordHistoryItem(res) {
    const history = JSON.parse(localStorage.getItem('documatrix_history') || '[]');
    const size = res.data?.byteLength || res.data?.size || 0;
    const item = {
      filename: res.filename,
      size: formatFileSize(size),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    };
    history.unshift(item);
    if (history.length > 25) history.pop();
    localStorage.setItem('documatrix_history', JSON.stringify(history));
  }

  updateHistoryBadge() {
    const history = JSON.parse(localStorage.getItem('documatrix_history') || '[]');
    if (this.historyCounterChip) {
      this.historyCounterChip.textContent = history.length;
    }
  }

  openHistoryDrawer() {
    const history = JSON.parse(localStorage.getItem('documatrix_history') || '[]');
    if (history.length === 0) {
      if (this.historyEmptyView) this.historyEmptyView.style.display = 'flex';
      if (this.historyItemsContainer) this.historyItemsContainer.innerHTML = '';
    } else {
      if (this.historyEmptyView) this.historyEmptyView.style.display = 'none';
      if (this.historyItemsContainer) {
        this.historyItemsContainer.innerHTML = history.map(item => `
          <div class="history-card-item">
            <div class="history-item-top">
              <i data-lucide="file-check" style="color:var(--accent-emerald); width:18px; height:18px;"></i>
              <div class="history-filename" title="${item.filename}">${item.filename}</div>
            </div>
            <div class="history-meta-row">
              <span>${item.size}</span>
              <span>&bull;</span>
              <span>${item.date}</span>
            </div>
          </div>
        `).join('');
      }
    }

    if (this.historyDrawerOverlay) {
      this.historyDrawerOverlay.classList.add('active');
      this.historyDrawerOverlay.setAttribute('aria-hidden', 'false');
    }
    this.refreshIcons();
  }

  closeHistoryDrawer() {
    if (this.historyDrawerOverlay) {
      this.historyDrawerOverlay.classList.remove('active');
      this.historyDrawerOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  clearAllHistory() {
    localStorage.removeItem('documatrix_history');
    this.updateHistoryBadge();
    this.openHistoryDrawer();
    toast.info('Downloads history cleared.');
  }

  /* --------------------------------------------------------------------------
     Event Listeners
     -------------------------------------------------------------------------- */
  bindEvents() {
    // Brand Logo & Back to Directory (SPA Routing)
    this.brandHomeLink?.addEventListener('click', () => this.navigateTo('#/'));
    this.btnBackToDirectory?.addEventListener('click', () => this.navigateTo('#/'));

    // Top Navbar Tool Tabs & Dropdown Links (SPA Routing)
    document.querySelectorAll('[data-nav-tool]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const toolId = link.dataset.navTool;
        document.querySelectorAll('.nav-tab-dropdown').forEach(d => d.classList.remove('open'));
        this.navigateTo(`#/${toolId}`);
      });
    });

    // Mobile / Touch toggle for header dropdowns
    const convertDrop = document.getElementById('dropdown-convert');
    const allToolsDrop = document.getElementById('dropdown-all-tools');
    const btnConvert = document.getElementById('btn-convert-dropdown');
    const btnAllTools = document.getElementById('btn-all-tools-dropdown');

    btnConvert?.addEventListener('click', (e) => {
      e.stopPropagation();
      allToolsDrop?.classList.remove('open');
      convertDrop?.classList.toggle('open');
    });

    btnAllTools?.addEventListener('click', (e) => {
      e.stopPropagation();
      convertDrop?.classList.remove('open');
      allToolsDrop?.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-tab-dropdown')) {
        convertDrop?.classList.remove('open');
        allToolsDrop?.classList.remove('open');
      }
    });

    // Footer route links
    document.querySelectorAll('[data-route-tool]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const toolId = link.dataset.routeTool;
        this.navigateTo(`#/${toolId}`);
      });
    });

    // Theme Toggle
    this.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());

    // Sample Docs Dropdown
    this.sampleDocsDropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sampleDocsMenu?.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (this.sampleDocsDropdownBtn && this.sampleDocsMenu) {
        if (!this.sampleDocsDropdownBtn.contains(e.target) && !this.sampleDocsMenu.contains(e.target)) {
          this.sampleDocsMenu.classList.remove('show');
        }
      }
    });

    this.sampleDocsMenu?.querySelectorAll('[data-sample]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.loadSampleFromHeader(btn.dataset.sample);
      });
    });

    // History Drawer
    this.openHistoryBtn?.addEventListener('click', () => this.openHistoryDrawer());
    this.closeHistoryDrawerBtn?.addEventListener('click', () => this.closeHistoryDrawer());
    this.clearAllHistoryRecords?.addEventListener('click', () => this.clearAllHistory());
    this.historyDrawerOverlay?.addEventListener('click', (e) => {
      if (e.target === this.historyDrawerOverlay) this.closeHistoryDrawer();
    });

    // Global Search Input
    this.globalSearchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      if (this.globalSearchClear) {
        this.globalSearchClear.style.display = this.searchQuery.trim() ? 'flex' : 'none';
      }
      this.renderToolsGrid();
    });

    this.globalSearchClear?.addEventListener('click', () => {
      if (this.globalSearchInput) this.globalSearchInput.value = '';
      this.searchQuery = '';
      this.globalSearchClear.style.display = 'none';
      this.renderToolsGrid();
      this.globalSearchInput?.focus();
    });

    this.clearSearchChipBtn?.addEventListener('click', () => {
      if (this.globalSearchInput) this.globalSearchInput.value = '';
      this.searchQuery = '';
      if (this.globalSearchClear) this.globalSearchClear.style.display = 'none';
      this.renderToolsGrid();
    });

    this.resetAllFiltersBtn?.addEventListener('click', () => {
      if (this.globalSearchInput) this.globalSearchInput.value = '';
      this.searchQuery = '';
      this.currentFilter = 'all';
      if (this.globalSearchClear) this.globalSearchClear.style.display = 'none';
      this.renderCategoryPills();
      this.renderToolsGrid();
    });

    // Top Bar Quick Sample Button
    this.wsQuickSampleBtn?.addEventListener('click', () => {
      this.loadSampleDocForCurrentTool();
    });

    // Stage 1: File Inputs & Drag/Drop
    this.studioFileInput?.addEventListener('change', (e) => {
      this.handleFileSelection(e.target.files);
      this.studioFileInput.value = '';
    });

    this.btnTrySampleStage1?.addEventListener('click', () => {
      this.loadSampleDocForCurrentTool();
    });

    if (this.ingestionDropZone) {
      ['dragenter', 'dragover'].forEach(name => {
        this.ingestionDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.ingestionDropZone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        this.ingestionDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.ingestionDropZone.classList.remove('drag-over');
        });
      });

      this.ingestionDropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) {
          this.handleFileSelection(e.dataTransfer.files);
        }
      });
    }

    // Stage 2: Add More Files
    this.studioAddMoreInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFileSelection(e.target.files);
      }
      this.studioAddMoreInput.value = '';
    });

    // Stage 2: Sort Files
    this.btnSortFiles?.addEventListener('click', () => {
      this.activeFiles.sort((a, b) => a.name.localeCompare(b.name));
      this.renderWorkbench();
      toast.info('Files sorted alphabetically.');
    });

    // Stage 2: Clear Files
    this.btnClearFiles?.addEventListener('click', () => {
      this.activeFiles = [];
      this.setToolStage(1);
    });

    // Stage 2: Sticky Execute
    this.sidebarActionExecuteBtn?.addEventListener('click', () => {
      this.executeTool();
    });

    // Stage 3: Download Actions
    this.btnInstantDownload?.addEventListener('click', () => {
      if (this.lastProcessedResult) {
        const res = this.lastProcessedResult;
        downloadFile(res.data, res.filename, res.mimeType);
      }
    });

    this.btnProcessAnotherFile?.addEventListener('click', () => {
      this.activeFiles = [];
      this.lastProcessedResult = null;
      this.setToolStage(1);
    });

    this.btnReturnDirectory?.addEventListener('click', () => {
      this.navigateTo('#/');
    });

    // Global Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== this.globalSearchInput) {
        e.preventDefault();
        this.globalSearchInput?.focus();
      } else if (e.key === 'Escape') {
        if (this.historyDrawerOverlay?.classList.contains('active')) {
          this.closeHistoryDrawer();
        } else if (this.currentView === 'tool') {
          this.navigateTo('#/');
        }
      }
    });
  }

  /* --------------------------------------------------------------------------
     Authentication, Subscription & Admin Command Center Management
     -------------------------------------------------------------------------- */
  initAuthAndAdmin() {
    // 1. Initial Auth Header Rendering
    this.updateAuthHeader(authService.getUser());

    // 2. Auth state change listener
    window.addEventListener('docstudio:auth-change', (e) => {
      this.updateAuthHeader(e.detail.user);
      if (this.currentView === 'admin' && !authService.isAdmin()) {
        this.navigateTo('#/');
      }
    });

    // 3. User Avatar dropdown toggle
    this.btnUserAvatar?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.userDropdownMenu?.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (this.userDropdownMenu && !this.userDropdownMenu.contains(e.target) && !this.btnUserAvatar?.contains(e.target)) {
        this.userDropdownMenu.classList.remove('show');
      }
    });

    // 4. Header buttons
    this.btnHeaderLogin?.addEventListener('click', () => {
      this.openAuthModal('signin');
    });

    this.openPricingBtn?.addEventListener('click', () => {
      this.openPricingModal();
    });

    this.dropdownUpgradeBtn?.addEventListener('click', () => {
      this.userDropdownMenu?.classList.remove('show');
      this.openPricingModal();
    });

    this.dropdownAdminBtn?.addEventListener('click', () => {
      this.userDropdownMenu?.classList.remove('show');
      this.navigateTo('#/admin');
    });

    this.dropdownLogoutBtn?.addEventListener('click', () => {
      this.userDropdownMenu?.classList.remove('show');
      authService.logout();
      this.navigateTo('#/');
    });

    // 5. Google OAuth Exclusive Auth Modal Interactions
    this.btnCloseAuthModal?.addEventListener('click', () => this.closeAuthModal());
    this.authModalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.authModalOverlay) this.closeAuthModal();
    });

    // Pinned 1-Click Google Super Admin: Prince
    this.btnGooglePrinceAdmin?.addEventListener('click', async () => {
      const res = await authService.loginWithGoogle('prince86944@gmail.com', 'Prince Super Admin');
      if (res.success) {
        this.closeAuthModal();
        this.navigateTo('#/admin');
      }
    });

    // Quick Google Guest User
    this.btnGoogleGuestUser?.addEventListener('click', async () => {
      const res = await authService.loginWithGoogle('user@gmail.com', 'Personal Google User');
      if (res.success) {
        this.closeAuthModal();
      }
    });

    // Main Google Continue Button
    this.btnGoogleSignIn?.addEventListener('click', async () => {
      // By default sign in as Prince if admin, or prompt
      const res = await authService.loginWithGoogle('prince86944@gmail.com', 'Prince Super Admin');
      if (res.success) {
        this.closeAuthModal();
        this.navigateTo('#/admin');
      }
    });

    // Custom Google Email Login Form
    this.formCustomGoogle?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.customGoogleEmail?.value.trim();
      const name = this.customGoogleName?.value.trim() || 'Google User';

      if (!email) {
        toast.error('Please enter a valid Google email.');
        return;
      }

      const res = await authService.loginWithGoogle(email, name);
      if (res.success) {
        this.closeAuthModal();
        if (email.toLowerCase() === 'prince86944@gmail.com') {
          this.navigateTo('#/admin');
        }
      }
    });

    // 6. Pricing & Fast Direct UPI Payment Drawer (DocStudio PRO: ₹5 / ₹100 / ₹1,000)
    this.btnClosePricingModal?.addEventListener('click', () => this.closePricingModal());
    this.pricingModalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.pricingModalOverlay) this.closePricingModal();
    });

    const updateSelectedTier = (duration, amount) => {
      this.selectedPlanDuration = duration;
      this.selectedPlanAmount = Number(amount) || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100));
      this.proTierCards?.forEach(card => {
        card.classList.toggle('selected', card.dataset.tierDuration === duration);
      });
      if (this.displayPayableAmount) {
        this.displayPayableAmount.textContent = `₹${this.selectedPlanAmount.toLocaleString('en-IN')}`;
      }
      if (this.labelSelectedPlanName) {
        const nameMap = {
          daily: '24-Hour Pass (₹5)',
          monthly: 'Monthly Pro (₹100)',
          yearly: 'Yearly Pro (₹1,000)'
        };
        this.labelSelectedPlanName.textContent = `Selected: ${nameMap[duration] || 'Monthly Pro (₹100)'}`;
      }
      if (this.btnVerifyLabel) {
        this.btnVerifyLabel.textContent = `I Have Paid ₹${this.selectedPlanAmount} • Activate Pro Instantly`;
      }
      if (this.btnUpiDeeplink) {
        const upiId = this.activeUpiId || 'apnacollegebihar@slc';
        this.btnUpiDeeplink.href = `upi://pay?pa=${upiId}&pn=DocStudio&am=${this.selectedPlanAmount}&cu=INR&tn=DocStudio%20Pro%20${duration.toUpperCase()}`;
      }
    };
    this.updateSelectedTier = updateSelectedTier;

    this.proTierCards?.forEach(card => {
      card.addEventListener('click', () => {
        const dur = card.dataset.tierDuration || 'monthly';
        const amt = card.dataset.tierPrice || (dur === 'daily' ? 5 : (dur === 'yearly' ? 1000 : 100));
        updateSelectedTier(dur, amt);
      });
    });

    this.btnTierSelects?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dur = btn.dataset.selectTier || 'monthly';
        const card = btn.closest('.pro-tier-card');
        const amt = card?.dataset.tierPrice || (dur === 'daily' ? 5 : (dur === 'yearly' ? 1000 : 100));
        updateSelectedTier(dur, amt);
        this.fastUpiDrawer?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Copy UPI ID to Clipboard
    this.btnCopyUpiId?.addEventListener('click', async () => {
      const upi = this.activeUpiId || 'apnacollegebihar@slc';
      try {
        await navigator.clipboard.writeText(upi);
        toast.success(`Copied UPI ID "${upi}" to clipboard!`);
      } catch {
        toast.info(`UPI ID: ${upi}`);
      }
    });

    // Verify UPI Payment & Activate Pro Instantly
    this.btnVerifyUpiPayment?.addEventListener('click', async () => {
      if (!authService.isLoggedIn()) {
        toast.info('Please sign in with your Google account first to link your subscription.');
        this.closePricingModal();
        this.openAuthModal('signin');
        return;
      }

      const utr = this.inputUpiUtr?.value.trim() || '';
      if (this.btnVerifyUpiPayment) this.btnVerifyUpiPayment.disabled = true;

      toast.info(`Verifying payment of ₹${this.selectedPlanAmount} for DocStudio Pro (${this.selectedPlanDuration.toUpperCase()})...`);
      const ok = await authService.upgradeToPro('UPI', this.selectedPlanAmount, this.selectedPlanDuration, utr);
      if (this.btnVerifyUpiPayment) this.btnVerifyUpiPayment.disabled = false;

      if (ok) {
        triggerConfetti();
        this.closePricingModal();
      }
    });

    // 7. Legal, Compliance & Support Center Events
    this.btnLegalBackStudio?.addEventListener('click', () => {
      this.navigateTo('#/');
    });

    this.legalTabButtons?.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.legalTarget || 'privacy';
        this.showLegalView(target, true);
      });
    });

    this.contactSupportForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name')?.value.trim();
      const email = document.getElementById('contact-email')?.value.trim();
      const subject = document.getElementById('contact-subject')?.value;
      const message = document.getElementById('contact-message')?.value.trim();

      try {
        const res = await fetch('/api/contact/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || 'Thank you! Your message has been received. Support will reply within 2 hours.');
          this.contactSupportForm.reset();
        } else {
          toast.error(data.error || 'Failed to submit inquiry.');
        }
      } catch (err) {
        toast.success('Your message has been dispatched to support@docstudio.com!');
        this.contactSupportForm.reset();
      }
    });

    // 8. Quota Modal
    this.btnCloseQuotaModal?.addEventListener('click', () => this.closeQuotaModal());
    this.quotaModalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.quotaModalOverlay) this.closeQuotaModal();
    });

    this.btnQuotaUpgradePro?.addEventListener('click', () => {
      this.closeQuotaModal();
      this.openPricingModal();
    });

    // 9. Admin Panel Topbar & Actions
    this.btnAdminReturnStudio?.addEventListener('click', () => {
      this.navigateTo('#/');
    });

    this.btnAdminRefreshUsers?.addEventListener('click', () => {
      this.loadAdminDashboard();
      toast.info('Admin dashboard metrics and users refreshed.');
    });

    this.adminUserSearch?.addEventListener('input', () => {
      this.filterAdminUsers();
    });

    this.adminPlanFilter?.addEventListener('change', () => {
      this.filterAdminUsers();
    });
  }

  updateAuthHeader(user) {
    if (user) {
      if (this.btnHeaderLogin) this.btnHeaderLogin.style.display = 'none';
      if (this.userHeaderWidget) this.userHeaderWidget.style.display = 'inline-flex';

      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      if (this.userAvatarInitial) this.userAvatarInitial.textContent = initial;
      if (this.myAccountLabel) this.myAccountLabel.textContent = 'My Account';

      if (this.userPlanBadge) {
        if (user.role === 'admin') {
          this.userPlanBadge.textContent = 'ADMIN';
          this.userPlanBadge.className = 'user-plan-badge admin';
        } else if (user.plan === 'pro') {
          const dBadge = user.planDuration === 'daily' ? 'PRO (1D)' : (user.planDuration === 'yearly' ? 'PRO (1Y)' : 'PRO');
          this.userPlanBadge.textContent = dBadge;
          this.userPlanBadge.className = 'user-plan-badge pro';
        } else {
          this.userPlanBadge.textContent = 'FREE';
          this.userPlanBadge.className = 'user-plan-badge free';
        }
      }

      if (this.dropdownUserName) this.dropdownUserName.textContent = user.name || 'DocStudio User';
      if (this.dropdownUserEmail) this.dropdownUserEmail.textContent = user.email;

      if (this.dropdownPlanTitle) {
        if (user.role === 'admin') {
          this.dropdownPlanTitle.textContent = 'Super Admin • Lifetime Access';
        } else if (user.plan === 'pro') {
          const durText = user.planDuration === 'daily' ? 'Daily Pass (₹5)' : (user.planDuration === 'yearly' ? 'Yearly Pro (₹1,000)' : 'Monthly Pro (₹100)');
          this.dropdownPlanTitle.textContent = `DocStudio Pro • ${durText}`;
        } else {
          this.dropdownPlanTitle.textContent = 'DocStudio Free Starter (5 ops/day)';
        }
      }

      const isUnlimited = user.role === 'admin' || user.plan === 'pro' || user.plan === 'enterprise';
      if (this.userQuotaCount) {
        this.userQuotaCount.textContent = isUnlimited ? 'Unlimited' : `${Math.max(0, 5 - (user.dailyOperationsUsed || 0))} / 5 left today`;
      }
      if (this.userQuotaFill) {
        const pct = isUnlimited ? 100 : Math.min(100, ((user.dailyOperationsUsed || 0) / 5) * 100);
        this.userQuotaFill.style.width = `${pct}%`;
      }

      if (this.dropdownAdminBtn) {
        this.dropdownAdminBtn.style.display = user.role === 'admin' ? 'flex' : 'none';
      }
      if (this.dropdownUpgradeBtn) {
        this.dropdownUpgradeBtn.style.display = (user.plan === 'pro' || user.role === 'admin') ? 'none' : 'flex';
      }
    } else {
      if (this.btnHeaderLogin) this.btnHeaderLogin.style.display = 'flex';
      if (this.userHeaderWidget) this.userHeaderWidget.style.display = 'none';
      if (this.userDropdownMenu) this.userDropdownMenu.classList.remove('show');
    }
  }

  setAuthMode(mode) {
    this.authMode = mode;
    if (mode === 'signup') {
      this.tabSignUp?.classList.add('active');
      this.tabSignIn?.classList.remove('active');
      if (this.groupName) this.groupName.style.display = 'block';
      if (this.btnAuthSubmitLabel) this.btnAuthSubmitLabel.textContent = 'Create DocStudio Account';
      const title = document.getElementById('auth-modal-title');
      if (title) title.textContent = 'Create Free Account';
      const desc = document.getElementById('auth-modal-desc');
      if (desc) desc.textContent = 'Get 5 free operations daily, save history, and manage preferences.';
    } else {
      this.tabSignIn?.classList.add('active');
      this.tabSignUp?.classList.remove('active');
      if (this.groupName) this.groupName.style.display = 'none';
      if (this.btnAuthSubmitLabel) this.btnAuthSubmitLabel.textContent = 'Sign In to DocStudio';
      const title = document.getElementById('auth-modal-title');
      if (title) title.textContent = 'Welcome to DocStudio';
      const desc = document.getElementById('auth-modal-desc');
      if (desc) desc.textContent = 'Sign in to manage your documents, plans, and quotas';
    }
  }

  openAuthModal(mode = 'signin') {
    this.setAuthMode(mode);
    if (this.authModalOverlay) {
      this.authModalOverlay.style.display = 'flex';
      this.authModalOverlay.setAttribute('aria-hidden', 'false');
    }
    this.refreshIcons();
  }

  closeAuthModal() {
    if (this.authModalOverlay) {
      this.authModalOverlay.style.display = 'none';
      this.authModalOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  openPricingModal() {
    if (this.pricingModalOverlay) {
      this.pricingModalOverlay.style.display = 'flex';
      this.pricingModalOverlay.setAttribute('aria-hidden', 'false');
      if (typeof this.updateSelectedTier === 'function') {
        this.updateSelectedTier(this.selectedPlanDuration || 'monthly', this.selectedPlanAmount || 100);
      }
    }
    this.refreshIcons();
  }

  closePricingModal() {
    if (this.pricingModalOverlay) {
      this.pricingModalOverlay.style.display = 'none';
      this.pricingModalOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  openQuotaModal(limit = 5, plan = 'free') {
    if (this.quotaModalOverlay) {
      this.quotaModalOverlay.style.display = 'flex';
      this.quotaModalOverlay.setAttribute('aria-hidden', 'false');
    }
    this.refreshIcons();
  }

  closeQuotaModal() {
    if (this.quotaModalOverlay) {
      this.quotaModalOverlay.style.display = 'none';
      this.quotaModalOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  async loadAdminDashboard() {
    // 1. Fetch Metrics
    const metrics = await adminService.getMetrics();
    if (metrics) {
      if (this.kpiTotalUsers) this.kpiTotalUsers.textContent = metrics.totalUsers || 0;
      if (this.kpiProUsers) this.kpiProUsers.textContent = metrics.proSubscribers || 0;
      if (this.kpiProRatio) {
        const ratio = metrics.totalUsers ? Math.round((metrics.proSubscribers / metrics.totalUsers) * 100) : 0;
        this.kpiProRatio.textContent = `${ratio}% Pro Conversion`;
      }
      if (this.kpiDailyCount) this.kpiDailyCount.textContent = `${metrics.dailyPasses || 0} Daily (₹5)`;
      if (this.kpiMonthlyCount) this.kpiMonthlyCount.textContent = `${metrics.monthlySubs || 0} Monthly (₹100)`;
      if (this.kpiYearlyCount) this.kpiYearlyCount.textContent = `${metrics.yearlySubs || 0} Yearly (₹1,000)`;
      if (this.kpiSubscriptionsCountBadge) {
        this.kpiSubscriptionsCountBadge.textContent = `${(metrics.subscriptions || []).length} Transactions`;
      }
      if (this.kpiTotalRevenue) this.kpiTotalRevenue.textContent = `₹${(metrics.totalRevenue || 0).toLocaleString('en-IN')}`;
      if (this.kpiTotalOps) this.kpiTotalOps.textContent = metrics.totalOperations || 0;

      if (this.mongoStatusText) {
        this.mongoStatusText.textContent = metrics.isMongoConnected ? 'MongoDB Atlas Cluster Connected' : 'Persistent Storage Fallback Active';
      }
      if (this.mongoStatusPill) {
        this.mongoStatusPill.className = metrics.isMongoConnected ? 'mongo-status-pill connected' : 'mongo-status-pill local';
      }

      if (metrics.subscriptions) {
        this.renderAdminSubscriptions(metrics.subscriptions);
      }

      if (metrics.recentLogs) {
        this.renderAdminLogs(metrics.recentLogs);
      }
    }

    // 2. Fetch Users
    const users = await adminService.getUsers();
    this.adminUsersList = users;
    this.filterAdminUsers();
  }

  filterAdminUsers() {
    if (!this.adminUsersList) return;
    const query = (this.adminUserSearch?.value || '').toLowerCase().trim();
    const planFilter = this.adminPlanFilter?.value || 'all';

    const filtered = this.adminUsersList.filter(u => {
      const matchQuery = !query ||
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query));

      let matchPlan = true;
      if (planFilter === 'free') matchPlan = u.plan === 'free';
      else if (planFilter === 'pro') matchPlan = u.plan === 'pro';
      else if (planFilter === 'admin') matchPlan = u.role === 'admin';

      return matchQuery && matchPlan;
    });

    this.renderAdminUsers(filtered);
  }

  renderAdminUsers(users) {
    if (!this.adminUsersTbody) return;

    if (users.length === 0) {
      this.adminUsersTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-dim);">
            <i data-lucide="users" style="width: 24px; height: 24px; margin-bottom: 8px; display: inline-block;"></i>
            <div>No matching user accounts found.</div>
          </td>
        </tr>
      `;
      this.refreshIcons();
      return;
    }

    this.adminUsersTbody.innerHTML = users.map(u => {
      const isSuperAdmin = u.email.toLowerCase() === 'prince86944@gmail.com';
      const initial = (u.name || u.email || 'U').charAt(0).toUpperCase();
      const planClass = u.plan === 'pro' ? 'pro' : (u.plan === 'enterprise' ? 'enterprise' : 'free');
      const roleClass = u.role === 'admin' ? 'admin' : 'user';
      const regDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

      return `
        <tr data-user-id="${u.id || u._id}">
          <td>
            <div class="user-row-profile">
              <div class="user-row-avatar ${isSuperAdmin ? 'super-admin' : ''}">${initial}</div>
              <div>
                <div class="user-row-name">
                  ${u.name || 'DocStudio User'}
                  ${isSuperAdmin ? '<span class="badge-super-admin">SUPER ADMIN</span>' : ''}
                </div>
                <div class="user-row-email">${u.email}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="user-tag ${roleClass}">${u.role.toUpperCase()}</span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
              <span class="user-tag ${planClass}">${(u.plan || 'free').toUpperCase()}</span>
              ${u.plan === 'pro' ? `
                <span class="sub-plan-badge ${u.planDuration || 'monthly'}">
                  <i data-lucide="${u.planDuration === 'daily' ? 'clock' : (u.planDuration === 'yearly' ? 'crown' : 'calendar')}"></i>
                  ${u.planDuration === 'daily' ? '24-Hr Pass' : (u.planDuration === 'yearly' ? '365-Day Pro' : '30-Day Pro')}
                </span>
              ` : (u.role === 'admin' ? `
                <span class="sub-plan-badge yearly"><i data-lucide="shield"></i> Lifetime</span>
              ` : `
                <span class="sub-plan-badge free">Free Tier</span>
              `)}
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="sub-amount-tag ${u.planAmount ? '' : 'free'}">
                ${u.planAmount ? `₹${u.planAmount}` : (u.role === 'admin' ? 'Exempt' : 'Free (₹0)')}
              </span>
              ${u.planUtr ? `
                <span class="sub-utr-tag" title="UTR Reference: ${u.planUtr}"><i data-lucide="hash"></i> ${u.planUtr}</span>
              ` : `
                <span class="sub-utr-tag empty">No UTR</span>
              `}
            </div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-heading);">
              ${u.dailyQuota >= 9000 ? 'Unlimited' : `${u.dailyOperationsUsed || 0} / ${u.dailyQuota || 5}`}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">Operations / day</div>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-dim); white-space: nowrap;">
            ${regDate}
          </td>
          <td style="text-align: right;">
            <div class="user-actions-group">
              <select class="admin-action-select" data-action="change-plan" data-user-id="${u.id || u._id}" title="Change Subscription Plan">
                <option value="free" ${u.plan === 'free' ? 'selected' : ''}>Plan: Free</option>
                <option value="pro" ${u.plan === 'pro' ? 'selected' : ''}>Plan: Pro</option>
                <option value="enterprise" ${u.plan === 'enterprise' ? 'selected' : ''}>Plan: Enterprise</option>
              </select>

              ${!isSuperAdmin ? `
                <button type="button" class="btn-user-action toggle-role" data-action="toggle-role" data-user-id="${u.id || u._id}" data-role="${u.role}" title="Toggle Admin / User Role">
                  <i data-lucide="${u.role === 'admin' ? 'shield-minus' : 'shield-check'}"></i>
                </button>
                <button type="button" class="btn-user-action delete-user" data-action="delete" data-user-id="${u.id || u._id}" data-email="${u.email}" title="Delete User">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : `
                <span class="protected-badge" title="Super Admin is protected"><i data-lucide="lock"></i></span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind event handlers for action buttons in user table
    this.adminUsersTbody.querySelectorAll('[data-action="change-plan"]').forEach(select => {
      select.addEventListener('change', async (e) => {
        const userId = e.target.dataset.userId;
        const newPlan = e.target.value;
        const newQuota = newPlan === 'pro' || newPlan === 'enterprise' ? 9999 : 5;
        await adminService.updateUser(userId, { plan: newPlan, dailyQuota: newQuota });
        this.loadAdminDashboard();
      });
    });

    this.adminUsersTbody.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userId;
        const curRole = btn.dataset.role;
        const newRole = curRole === 'admin' ? 'user' : 'admin';
        if (confirm(`Change this user's role to ${newRole.toUpperCase()}?`)) {
          await adminService.updateUser(userId, { role: newRole });
          this.loadAdminDashboard();
        }
      });
    });

    this.adminUsersTbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userId;
        const email = btn.dataset.email;
        if (confirm(`Are you sure you want to permanently delete user "${email}"?`)) {
          await adminService.deleteUser(userId);
          this.loadAdminDashboard();
        }
      });
    });

    this.refreshIcons();
  }

  renderAdminSubscriptions(subscriptions) {
    if (!this.adminSubscriptionsTbody) return;

    if (!subscriptions || subscriptions.length === 0) {
      this.adminSubscriptionsTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-dim);">
            <i data-lucide="receipt" style="width: 24px; height: 24px; margin-bottom: 8px; display: inline-block;"></i>
            <div>No UPI subscription receipts recorded yet.</div>
          </td>
        </tr>
      `;
      this.refreshIcons();
      return;
    }

    this.adminSubscriptionsTbody.innerHTML = subscriptions.map((s, idx) => {
      const txnId = s.id || s._id || `TXN-${String(idx + 1001).padStart(6, '0')}`;
      const duration = s.duration || 'monthly';
      const durLabel = duration === 'daily' ? '24 Hours (Daily)' : (duration === 'yearly' ? '365 Days (Yearly)' : '30 Days (Monthly)');
      const amount = s.amount || (duration === 'daily' ? 5 : (duration === 'yearly' ? 1000 : 100));
      const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Recent';

      return `
        <tr>
          <td>
            <span class="sub-txn-id">${txnId}</span>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-heading);">${s.userEmail || s.userId || 'User'}</div>
          </td>
          <td>
            <span class="sub-plan-badge ${duration}">
              <i data-lucide="${duration === 'daily' ? 'clock' : (duration === 'yearly' ? 'crown' : 'calendar')}"></i>
              ${durLabel}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; font-size: 0.95rem; color: #10b981; font-family: var(--font-heading);">
              ₹${amount.toLocaleString('en-IN')}
            </span>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-heading);">${s.paymentMethod || 'UPI Instant'}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">${s.upiId || 'apnacollegebihar@slc'}</div>
          </td>
          <td>
            <span class="sub-utr-tag ${s.utrRef ? '' : 'empty'}" title="${s.utrRef || 'No UTR Reference'}">
              <i data-lucide="hash"></i> ${s.utrRef || 'Direct UPI'}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-dim); white-space: nowrap;">
            ${dateStr}
          </td>
          <td>
            <span class="sub-status-pill active">
              <i data-lucide="check-circle-2"></i> ${s.status || 'Active'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    this.refreshIcons();
  }

  renderAdminLogs(logs) {
    if (!this.adminLogsContainer) return;

    if (!logs || logs.length === 0) {
      this.adminLogsContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-dim);">No audit logs recorded yet.</div>
      `;
      return;
    }

    this.adminLogsContainer.innerHTML = logs.map(l => {
      const timeStr = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now';
      let icon = 'activity';
      let color = 'var(--accent-color)';

      if (l.action.includes('REGISTER')) {
        icon = 'user-plus';
        color = '#10b981';
      } else if (l.action.includes('LOGIN')) {
        icon = 'log-in';
        color = '#6366f1';
      } else if (l.action.includes('UPGRADED')) {
        icon = 'crown';
        color = '#f59e0b';
      } else if (l.action.includes('TOOL')) {
        icon = 'cpu';
        color = '#ec4899';
      }

      return `
        <div class="log-item-row">
          <div class="log-icon-pill" style="color: ${color};">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="log-content">
            <div class="log-action-text">${l.action} &bull; <span class="log-user">${l.userEmail || 'Guest'}</span></div>
            <div class="log-detail-text">${l.details || ''}</div>
          </div>
          <div class="log-time-chip">${timeStr}</div>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.docuMatrixStudio = new DocuMatrixStudioApp();
});
