import type { PrilikaProjekcija } from '../../../contracts/projections';
import { readableTitle } from '../../../data/needDetailPresentation';

/**
 * What a task says when it leaves the app through the system's share sheet (UX plan R35): its name and its public area, and nothing else.
 * Never an address, a person, a price or a time: the area is the one the page shows to every signed-in person, and the word of the owner who
 * posted it is theirs to add. There is no link yet (no page and no store listing to open it on), so there is none to give.
 */
export function taskShareMessage(need: Pick<PrilikaProjekcija, 'naslov' | 'podrucjeTekst' | 'detalji'>): string {
  const place = need.detalji?.rezimLokacije === 'REMOTE' ? 'Na daljinu' : need.podrucjeTekst.trim();
  return [readableTitle(need.naslov), place].filter(Boolean).join('\n');
}
