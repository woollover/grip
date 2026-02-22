export async function serveCommand(_args: string[]): Promise<void> {
  // Delegate to main.ts
  const { main } = await import('../../main');
  await main();
}
