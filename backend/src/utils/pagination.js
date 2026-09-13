const { PAGINATION } = require('../config/constants');

/**
 * Parse pagination query params with safe defaults and limits.
 * @param {object} query - Express req.query
 * @returns {{ page, limit, skip }}
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT)
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Build a standard paginated response envelope.
 */
const paginatedResponse = (data, total, page, limit) => ({
  success: true,
  data,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  },
});

module.exports = { parsePagination, paginatedResponse };
