/**
 * PII Masking utilities
 * Masks sensitive personally identifiable information before returning data
 */

/**
 * Patterns for various PII types
 */
const PII_PATTERNS = {
  // Danish CPR number: XXXXXX-XXXX
  cpr: {
    pattern: /\b\d{6}-?\d{4}\b/g,
    replacement: '******-****',
    description: 'Danish CPR number'
  },

  // Email addresses
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: (match) => {
      const parts = match.split('@');
      return parts[0].substring(0, 2) + '***@' + parts[1];
    },
    description: 'Email address'
  },

  // Phone numbers (various formats)
  phone: {
    pattern: /\b(?:\+45\s?)?(?:\d{2}\s?\d{2}\s?\d{2}\s?\d{2}|\d{8})\b/g,
    replacement: '** ** ** **',
    description: 'Phone number'
  },

  // Credit card numbers (basic pattern)
  creditCard: {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '**** **** **** ****',
    description: 'Credit card number'
  },

  // Social security numbers (generic)
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***-**-****',
    description: 'Social security number'
  }
};

/**
 * Mask a string value based on enabled patterns
 * @param {string} value - The value to mask
 * @param {Object} config - Configuration object with enabled patterns
 * @returns {string} - Masked value
 */
function maskString(value, config) {
  if (typeof value !== 'string') {
    return value;
  }

  let maskedValue = value;

  // Apply each enabled pattern
  Object.keys(PII_PATTERNS).forEach(patternKey => {
    if (config[patternKey] !== false) { // Enabled by default unless explicitly disabled
      const { pattern, replacement } = PII_PATTERNS[patternKey];
      maskedValue = maskedValue.replace(pattern, replacement);
    }
  });

  return maskedValue;
}

/**
 * Recursively mask PII in an object
 * @param {*} obj - Object to mask
 * @param {Object} config - Masking configuration
 * @returns {*} - Object with masked values
 */
function maskObject(obj, config) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item, config));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      masked[key] = maskObject(value, config);
    }
    return masked;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return maskString(obj, config);
  }

  // Return primitives as-is
  return obj;
}

/**
 * Mask PII in search results
 * @param {Object} results - Elasticsearch results object
 * @param {Object} config - Masking configuration
 * @returns {Object} - Results with masked PII
 */
export function maskPII(results, config = {}) {
  if (!config.enabled) {
    return results;
  }

  return maskObject(results, config);
}

/**
 * Get default masking configuration
 */
export function getDefaultMaskingConfig() {
  return {
    enabled: false,
    cpr: true,
    email: true,
    phone: true,
    creditCard: true,
    ssn: true
  };
}

/**
 * Get available masking patterns for documentation
 */
export function getAvailablePatterns() {
  return Object.entries(PII_PATTERNS).map(([key, value]) => ({
    name: key,
    description: value.description,
    example: value.replacement
  }));
}
