/**
 * Application-wide constants.
 */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const ENTRY_SOURCES = ['manual', 'ai', 'pdf'];
const CHAT_ROLES = ['user', 'assistant'];

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = { MEAL_TYPES, ENTRY_SOURCES, CHAT_ROLES, PAGINATION };
