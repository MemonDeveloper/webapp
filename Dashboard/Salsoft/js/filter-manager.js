// ============================================================
// CENTRALIZED FILTER MANAGER
// Single source of truth for all dashboard filtering
// ============================================================

/**
 * FilterManager - Centralized filtering system with drill-down support
 * 
 * Filter Levels (Hierarchy):
 * L1: Company, Region, Bank
 * L2: Based on L1 selection
 * L3: Based on L2 selection
 * 
 * Modes:
 * - cashMode: 'all', 'opening', 'closing', 'credit', 'debit', 'net'
 * - creditMode: 'all', 'income', 'spending'
 */
class FilterManager {
  constructor() {
    this.primaryFilter = null;   // {type: 'company'|'region'|'bank', value: string}
    this.secondaryFilter = null; // {type: string, value: string} (e.g., account)
    this.cashMode = 'all';       // Display mode for balance/cash flow
    this.creditMode = 'all';     // For credit types: all, income, spending
    this.dateFrom = '';
    this.dateTo = '';
  }

  /**
   * Set primary filter from Panel 1 clicks
   * This drives all downstream panel updates
   */
  setPrimaryFilter(type, value) {
    // If clicking same filter, toggle it off
    if (this.primaryFilter?.type === type && this.primaryFilter?.value === value) {
      this.primaryFilter = null;
      this.secondaryFilter = null;
      return true; // toggled off
    }
    
    // Set new primary filter and clear secondary
    this.primaryFilter = { type, value };
    this.secondaryFilter = null;
    return false; // set
  }

  /**
   * Set secondary filter from Panel 2/3 clicks
   * Works within context of primary filter
   */
  setSecondaryFilter(type, value) {
    if (this.secondaryFilter?.type === type && this.secondaryFilter?.value === value) {
      this.secondaryFilter = null;
      return true; // toggled off
    }
    
    this.secondaryFilter = { type, value };
    return false; // set
  }

  /**
   * Set cash flow display mode
   * 'all': normal amount-based view
   * 'opening': show opening balances
   * 'closing': show closing balances
   * 'credit': show inflow only
   * 'debit': show outflow only
   * 'net': show net flow
   */
  setCashMode(mode) {
    const prev = this.cashMode;
    this.cashMode = mode === prev ? 'all' : mode;
    return prev !== this.cashMode;
  }

  /**
   * Set credit type display mode
   * 'income': show positive amounts
   * 'spending': show negative amounts
   * 'all': show both
   */
  setCreditMode(mode) {
    const prev = this.creditMode;
    this.creditMode = mode === prev ? 'all' : mode;
    return prev !== this.creditMode;
  }

  /**
   * Convert to state.filters object for backward compatibility
   */
  toStateFilters() {
    const filters = {
      company: 'All',
      parentCompany: 'All',
      region: 'All',
      bank: 'All',
      account: 'All',
      bankType: state.filters.bankType || 'Bank',
      people: 'All',
      currency: 'All',
      creditCategory: 'All',
      creditReference: 'All',
      bankInterDivision: 'All',
      bankReference: 'All',
      search: state.filters.search || '',
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      chartGranularity: state.filters.chartGranularity || 'daily',
      creditAmountMode: this.creditMode,
      bankCashMode: this.cashMode
    };

    if (this.primaryFilter) {
      const { type, value } = this.primaryFilter;
      if (type === 'company') filters.company = value;
      if (type === 'region') filters.region = value;
      if (type === 'bank') filters.bank = value;
    }

    if (this.secondaryFilter) {
      const { type, value } = this.secondaryFilter;
      // Map all secondary filter types to state.filters
      if (type === 'account') filters.account = value;
      if (type === 'people') filters.people = value;
      if (type === 'bankReference') filters.bankReference = value;
      if (type === 'creditCategory') filters.creditCategory = value;
      if (type === 'creditReference') filters.creditReference = value;
      if (type === 'interDivision') filters.bankInterDivision = value;
      if (type === 'company') filters.company = value;
    }

    return filters;
  }

  /**
   * Get current filter description for UI display
   */
  getActiveFilterLabel() {
    if (!this.primaryFilter) return null;
    const { type, value } = this.primaryFilter;
    const modeLabel = this.getModeLabel();
    const label = modeLabel ? `${value} · ${modeLabel}` : value;
    return label;
  }

  /**
   * Get cash mode display label
   */
  getModeLabel() {
    const modeMap = {
      'credit': 'Inflow',
      'debit': 'Outflow',
      'opening': 'Opening Balance',
      'closing': 'Closing Balance',
      'net': 'Net Cash Flow'
    };
    return modeMap[this.cashMode] || null;
  }

  /**
   * Clear all filters
   */
  clear() {
    this.primaryFilter = null;
    this.secondaryFilter = null;
    this.cashMode = 'all';
    this.creditMode = 'all';
    // Don't clear dateFrom/dateTo as they're persistent
  }

  /**
   * Check if any filter is active
   */
  isActive() {
    return this.primaryFilter !== null || this.secondaryFilter !== null;
  }
}

// Global instance
let filterManager = new FilterManager();

/**
 * Render dashboard with automatic panel updates
 */
function renderDashboardWithFilters() {
  // Update state.filters from filterManager
  const filters = filterManager.toStateFilters();
  state.filters = { ...state.filters, ...filters };

  // Render main dashboard
  if (state.currentPage === 'dashboard') {
    renderDashboard(document.getElementById('content-area'));
  }
}

/**
 * Panel 1 Click Handler (Summary Cards)
 * - Click Opening/Closing card → set cashMode and re-render
 * - Click Company/Region/Bank → set primary filter
 */
function onPanel1Click(filterType, value) {
  filterManager.setPrimaryFilter(filterType, value);
  renderDashboardWithFilters();
}

/**
 * Panel 2 Click Handler (CashFlow Division / Companies / Region)
 * - Click company bar → filter to that company
 * - Click region slice → filter to that region
 * - Click division row → filter to that division
 */
function onPanel2Click(filterType, value) {
  // Primary filter in Panel 2 becomes new primary
  filterManager.setPrimaryFilter(filterType, value);
  renderDashboardWithFilters();
}

/**
 * Panel 3 Click Handler (Bank/People/Reference details)
 * - Respects existing filters from Panel 1+2
 * - Sets secondary filter (e.g., specific person, bank account)
 */
function onPanel3Click(filterType, value) {
  filterManager.setSecondaryFilter(filterType, value);
  renderDashboardWithFilters();
}

/**
 * Set Opening/Closing mode from Panel 1
 */
function onCashModeClick(mode) {
  if (filterManager.setCashMode(mode)) {
    renderDashboardWithFilters();
  }
}

/**
 * Set Credit Income/Spending mode from Panel 1
 */
function onCreditModeClick(mode) {
  if (filterManager.setCreditMode(mode)) {
    renderDashboardWithFilters();
  }
}

/**
 * Clear all filters
 */
function clearAllFilters() {
  filterManager.clear();
  renderDashboardWithFilters();
}
