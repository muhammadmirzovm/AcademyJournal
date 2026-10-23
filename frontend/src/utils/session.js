export function isInvalidSession(error) {
  return error.response?.status === 401
}
