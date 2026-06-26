/**
 * @typedef {'water'|'stretch'|'walk'|'phone'|'gym'|'protein'|'ready'} DailyTaskId
 *
 * @typedef {Object} DailyTask
 * @property {DailyTaskId} id
 * @property {string} emoji
 * @property {string} title
 * @property {string} desc
 * @property {boolean} [hasForm]
 *
 * @typedef {Object} OneOffTask
 * @property {string}  title
 * @property {string}  [note]
 * @property {boolean} done
 * @property {string}  addedDate   - toDateString()
 * @property {boolean} [smart]     - added by AI from calendar
 * @property {string}  [triggerEvent]
 * @property {'high'|'med'|'low'} [priority]
 *
 * @typedef {Object} AppState
 * @property {Record<DailyTaskId, true>} dailyChecked
 * @property {OneOffTask[]}              oneOffTasks
 * @property {number}                   streak
 * @property {string|null}              lastCompleted  - toDateString() or null
 * @property {string|null}              lastDate       - toDateString() or null
 * @property {string|null}              photo          - base64 data URL or null
 * @property {string|null}              smartTasksDate - toDateString() or null
 *
 * @typedef {'high'|'med'|'low'} Priority
 *
 * @typedef {Object} RolloverTask
 * @property {string}   title
 * @property {string}   note
 * @property {Priority} priority
 *
 * @typedef {Object} SmartTask
 * @property {string}   title
 * @property {string}   note
 * @property {Priority} priority
 * @property {string}   triggerEvent
 *
 * @typedef {Object} CalendarEvent
 * @property {string}      title
 * @property {string}      start  - ISO date string
 * @property {string|null} location
 *
 * @typedef {Object} EmailSummary
 * @property {string} subject
 * @property {string} from
 */

export {}
