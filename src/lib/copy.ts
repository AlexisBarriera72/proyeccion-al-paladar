// Copying text, with an honest result: true only when the browser confirms it was copied.
export function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
