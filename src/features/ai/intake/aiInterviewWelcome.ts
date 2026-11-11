/** One immediate, local opening per fresh AI chat. This is NOT a Gemini response.
 * The server's owned conversation and first model reply still start with the
 * person's first message. Never persist a synthetic greeting as an AI turn.
 */
export function workerInterviewOpening(hasProfileContent: boolean): string {
  return hasProfileContent
    ? 'Dobar dan! 🧡 Napišite šta želite da promenite u svom profilu za uskakanje.'
    : 'Dobar dan! 🧡 Koje poslove ili usluge želite da ponudite?';
}

export function taskInterviewOpening(editingTask: boolean): string {
  return editingTask
    ? 'Dobar dan! 🧡 Napišite šta želite da promenite na zadatku.'
    : 'Dobar dan! 🧡 Opišite ukratko šta Vam je potrebno.';
}
