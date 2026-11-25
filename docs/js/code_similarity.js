// Similitud de sintaxis entre dos fragmentos de código.
// Compara tokens normalizados con la subsecuencia común más larga (LCS).
(function () {
  function normalizeCode(code) {
    return String(code || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--.*$/gm, ' ')
      .replace(/\/\/.*$/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function tokenize(code) {
    return normalizeCode(code).match(/[a-z_][a-z0-9_]*|\d+(?:\.\d+)?|[^\s]/g) || [];
  }

  function lcsLength(a, b) {
    if (!a.length || !b.length) return 0;
    const prev = new Array(b.length + 1).fill(0);
    const curr = new Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      curr[0] = 0;
      for (let j = 1; j <= b.length; j++) {
        curr[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1]);
      }
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
  }

  function calculateCodeSimilarity(expected, actual) {
    const expectedTokens = tokenize(expected);
    const actualTokens = tokenize(actual);
    if (expectedTokens.length === 0 && actualTokens.length === 0) return 100;
    if (expectedTokens.length === 0 || actualTokens.length === 0) return 0;
    const lcs = lcsLength(expectedTokens, actualTokens);
    return Math.round((2 * lcs / (expectedTokens.length + actualTokens.length)) * 100);
  }

  window.calculateCodeSimilarity = calculateCodeSimilarity;
})();
