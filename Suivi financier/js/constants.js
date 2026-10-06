/**
 * ==========================================================================
 * js/constants.js - Constantes et configuration globale
 * ==========================================================================
 */

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const BASE_CATEGORIES = [
  { id: 'cat-carburant', name: 'Carburant', type: 'expense', color: '#f59e0b' },
  { id: 'cat-autoroute', name: 'Autoroute', type: 'expense', color: '#3b82f6' },
  { id: 'cat-abonnements', name: 'Abonnements', type: 'expense', color: '#8b5cf6' },
  { id: 'cat-courses', name: 'Courses', type: 'expense', color: '#10b981' },
  { id: 'cat-resto-safran', name: 'Resto Safran', type: 'expense', color: '#ec4899' },
  { id: 'cat-autre', name: 'Autre', type: 'expense', color: '#64748b' },
  { id: 'cat-salaire', name: 'Salaire', type: 'income', color: '#059669' }
];

const MS_IN_SECOND = 1000;
const DEFAULT_HOURLY_RATE = 6.425;

const DEFAULT_SCHEDULE = {
  morningStart: '08:00',
  morningEnd: '12:00',
  afternoonStart: '12:45',
  afternoonEnd: '16:45'
};

const STORAGE_KEYS = {
  THEME: 'budget_theme',
  CATEGORIES: 'budget_categories',
  TRANSACTIONS: 'budget_transactions',
  HOURLY_RATE: 'budget_hourly_rate',
  SCHEDULE: 'budget_work_schedule',
  MONTHLY_SALARY: 'budget_monthly_salary'
};

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MONTH_NAMES,
    BASE_CATEGORIES,
    MS_IN_SECOND,
    DEFAULT_HOURLY_RATE,
    DEFAULT_SCHEDULE,
    STORAGE_KEYS
  };
}