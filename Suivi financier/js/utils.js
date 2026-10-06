/**
 * ==========================================================================
 * js/utils.js - Fonctions utilitaires : formatage, notifications et fichiers
 * ==========================================================================
 */

/**
 * Formate un nombre au format monétaire Euro (ex: 1 250,50 €)
 * @param {number} val
 * @returns {string}
 */
function formatCur(val) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(val || 0);
}

/**
 * Formate une date ISO YYYY-MM-DD en format français JJ/MM/AAAA
 * @param {string} dStr
 * @returns {string}
 */
function formatDateFR(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length !== 3) return dStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Échappe le texte brut pour prévenir les injections HTML (XSS)
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Affiche une notification toast temporaire
 * @param {string} text Message à afficher
 * @param {number} duration Durée d'affichage en ms (défaut: 2200ms)
 */
function showToast(text, duration = 2200) {
  const toast = document.getElementById('toastMessage');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/**
 * Déclenche le téléchargement d'un fichier via un lien temporaire
 * @param {string} dataUrl Données encodées en DataURL ou Blob URL
 * @param {string} filename Nom du fichier de destination
 */
function downloadFile(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Génère une icône PNG carrée avec coins arrondis et pictogramme monétaire
 * @param {number} size Dimension en pixels (192 ou 512)
 * @returns {string} DataURL de l'image PNG
 */
function createIconPNG(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dégradé vert émeraude en fond
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#047857');

  // Tracé du rectangle arrondi (squircle)
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Dessin stylisé d'un portefeuille / carte
  ctx.save();
  ctx.translate(size * 0.22, size * 0.22);
  const s = (size * 0.56) / 100;
  ctx.scale(s, s);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 20, 100, 65, [14]);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.beginPath();
  ctx.roundRect(8, 4, 84, 20, [8]);
  ctx.fill();

  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.arc(80, 52, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return canvas.toDataURL('image/png');
}

// Export pour environnements modules / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatCur,
    formatDateFR,
    escapeHtml,
    showToast,
    downloadFile,
    createIconPNG
  };
}