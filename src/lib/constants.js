/** @type {import('../types').DailyTask[]} */
export const DAILY_TASKS = [
  { id: 'phone',   emoji: '📵', title: 'No phone until done',    desc: "You're literally on it. Put it down.", by: '07:00', color: '#FF9500' },
  { id: 'water',   emoji: '💧', title: 'Drink water',            desc: 'Before anything else. Go.',           by: '07:00', color: '#00C8FF' },
  { id: 'stretch', emoji: '🧘', title: 'Stretch (5 min)',        desc: 'On the floor. Right now.',            by: '07:20', color: '#8338EC' },
  { id: 'protein', emoji: '🥚', title: 'High-protein breakfast', desc: 'Eggs, yogurt, shake. 8 minutes tops.',by: '07:35', color: '#FFD166' },
  { id: 'ready',   emoji: '✨', title: 'Get ready',              desc: 'Showered, dressed, like a person.',   by: '07:50', color: '#FF5F3D' },
  { id: 'walk',    emoji: '🚶', title: 'Walk outside',           desc: '10 minutes minimum. Actual outside.', by: '07:55', color: '#06D6A0' },
  { id: 'gym',     emoji: '🏋️', title: 'En-route to gym',        desc: 'Dressed, out the door, go.',          by: '08:00', color: '#FF2D78' },
]

export const DAILY_TASK_IDS = DAILY_TASKS.map(t => t.id)

export const STORE_KEY   = 'cosy_v4'
export const PIN_KEY     = 'cosy_pin'
export const ROAST_PREFIX = 'cosy_roast_'

export const DECORATIONS = {
  mushrooms: ['🍄', '🌿', '🪲', '🍂', '🌰', '🦔', '🌱', '🐛', '🍃', '🪸'],
  flowers:   ['🌸', '🌼', '🌺', '🌻', '💐', '🌷', '🏵️', '🌹', '🪷', '✿'],
  cottage:   ['🕯️', '☕', '🍞', '🫖', '🪴', '🧺', '🍯', '🫙', '🧁', '🪣'],
}

export const ALL_DECO = [
  ...DECORATIONS.mushrooms,
  ...DECORATIONS.flowers,
  ...DECORATIONS.cottage,
]

export const FALLBACK_ROASTS = [
  "You're already on your phone. That's cute. Put it down.",
  "The gym doesn't care about your mood. Go anyway.",
  "You've spent more time thinking about this than it would've taken to do it. Move.",
  "Still in bed? Cool story. Get up.",
  "Yesterday you said tomorrow. It's tomorrow. Shoes on.",
]

/** @returns {string} */
export function getRandomFallbackRoast() {
  return FALLBACK_ROASTS[Math.floor(Math.random() * FALLBACK_ROASTS.length)]
}
