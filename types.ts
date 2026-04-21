/** @typedef {Object} LogEntry
 *  @property {number} id
 *  @property {string} date - formato YYYY-MM-DD
 *  @property {string} time - formato HH:MM
 *  @property {number} total
 *  @property {number|null} rating
 *  @property {number} diff
 *  @property {number} pct
 *  @property {string} notes
 *  @property {string|null} image - base64
 */

/** @typedef {Object} Store
 *  @property {string} id
 *  @property {string} name
 *  @property {string} logo
 *  @property {string} color
 */

/** @typedef {Object} HealthStatus
 *  @property {string} label
 *  @property {string} icon
 *  @property {string} cls
 */

/** @typedef {Object} KPI
 *  @property {string} label
 *  @property {string} value
 *  @property {string} sub
 *  @property {string} icon
 */

/** @typedef {Object} Insight
 *  @property {'drop'|'gain'|'neutral'|'warn'} type
 *  @property {string} text
 */

/** @typedef {Object} Regression
 *  @property {number} slope
 *  @property {number} intercept
 */
