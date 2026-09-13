const crypto = require('crypto');

/**
 * Calculate SHA-256 hash of a file buffer or string content.
 * @param {Buffer|string} content - Raw content of the uploaded file
 * @returns {string} SHA-256 hexadecimal digest
 */
const calculateFileHash = (content) => {
  if (!content) {
    throw new Error('Content is required to calculate SHA-256 hash');
  }
  return crypto.createHash('sha256').update(content).digest('hex');
};

module.exports = { calculateFileHash };
