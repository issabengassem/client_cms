export function friendlyLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function fieldLabel(path: string): string {
  return path.split(".").map(friendlyLabel).join(" / ");
}
