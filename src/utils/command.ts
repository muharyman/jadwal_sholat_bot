export function parseCommand(text?: string): { cmd: string; args: string } {
  if (!text) return { cmd: "", args: "" };
  const t = text.trim();
  const [first, ...rest] = t.split(" ");
  return { cmd: first.toLowerCase(), args: rest.join(" ").trim() };
}
