export function parseMeta (obj?: Record<string, any>): Record<string, string> | undefined {
  if (obj == null) {
    return
  }

  const output: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    output[key] = value.toString()
  }

  return output
}
