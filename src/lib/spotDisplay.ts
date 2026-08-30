/** Cheap display cleanup — imported names like CAPT--CARL-RAFFI. */

export function displaySpotName(name: string): string {
  return name.replace(/--+/g, '-')
}
