// Historical records remain on the server; editable forms use today's roster.
export function rosterValues(members, records, field, fallback) {
  const existing = new Map(records.map(record => [record.student, record[field]]))
  return Object.fromEntries(members.map(member => [member.id, existing.get(member.id) ?? fallback]))
}
