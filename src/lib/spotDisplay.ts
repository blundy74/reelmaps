/** Display cleanup for imported names like CAPT--CARL-RAFFI. */

export function displaySpotName(name: string): string {
  return name
    .replace(/[_]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
