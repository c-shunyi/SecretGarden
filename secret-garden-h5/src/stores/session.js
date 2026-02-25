import { reactive } from 'vue'

const TOKEN_KEY = 'sg_access_token'
const USER_KEY = 'sg_user'

function readUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const sessionState = reactive({
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: readUser(),
})

export function hasSession() {
  return Boolean(sessionState.token)
}

export function setSession({ token, user }) {
  sessionState.token = token
  sessionState.user = user || null
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user || null))
}

export function setSessionUser(user) {
  sessionState.user = user
  localStorage.setItem(USER_KEY, JSON.stringify(user || null))
}

export function clearSession() {
  sessionState.token = ''
  sessionState.user = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
