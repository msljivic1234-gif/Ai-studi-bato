import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { placeKey } from '../../../data/marketplaceView';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { zadataka } from '../../system/plural';
import { sys } from '../../system/tokens';
import { V2Action } from '../V2Action';
import { POPULAR_CITIES, cityStanding, foldPlace, placeMatches, type PlaceRow as PlaceEntry } from './popularCities';
import { GroupTitle, PlaceRow } from './SearchParts';

/** The words of "Gde", in one place. */
export const PLACE_WORDS = {
  withTasks: 'Mesta sa zadacima', citiesWithTasks: 'Gradovi sa zadacima', parts: 'Delovi grada', popular: 'Popularni gradovi',
  noTasksYet: 'Još nema zadataka', noTasksLead: 'Još nema', noneNow: 'Nema zadataka', inParts: 'po delovima grada', partsOnly: 'Zadaci su po delovima grada',
  facetDown: 'Mesta trenutno nisu dostupna. Pretraga zadataka i dalje radi.',
  everything: 'Svi zadaci', remote: 'Na daljinu', backToCities: 'Svi gradovi', backHint: 'Vraća na spisak gradova.',
  showParts: 'Prikazuje delove grada.', showPlaces: 'Prikazuje mesta u ovom gradu.',
} as const;

/**
 * What a row says under the place, and what a screen reader says in one go. A place the other conditions leave empty (it was
 * chosen and the days changed) says so plainly; a city nobody has posted in says "Još nema zadataka" instead.
 */
const counted = (text: string, count: number | null) => {
  const note = count === null ? null : count === 0 ? PLACE_WORDS.noneNow : zadataka(count);
  return { note, label: note === null ? text : `${text}, ${note}` };
};

/**
 * The body of "Gde" in the search (the owner-approved plan, U4): the places a search can be narrowed to, one row each, the NUMBER of tasks leading the row (the
 * owner's pick "Gradovi brojem") and the place beside it. There is no field here: the words are typed in the search's own field ("Šta tražiš"), and a place is
 * chosen from the rows, so a letter typed never silently becomes a place.
 *
 * Nothing drilled into: "Svi zadaci", the work done remotely ("Na daljinu"), then the places that have tasks (with how many; with the server's city list they are
 * CITIES, and choosing one lists exactly its count), then the biggest cities of Serbia that have none listed above, each with what the tasks can honestly say about it:
 *   - tasks name exactly the city: it is one of the places above and is not repeated;
 *   - tasks are under parts of the city: the row leads to those parts (the place filter matches the whole text, so it cannot
 *     say "all of Beograd" and never pretends to);
 *   - no task anywhere: "Još nema zadataka", and choosing it is the ordinary place filter, which answers "no tasks yet";
 *   - places not all read: nothing is claimed, and the row leads to the places that contain the name.
 * Drilled into a city (`within`, the row that "leads to" its parts): the same rows, only those that contain its name (a letter without its diacritic finds the same
 * place), under the cities the parts of the city ("Liman, Novi Sad"), which no city row does, and a first row that goes back to the cities.
 */
export function PlacePicker({ within, onWithin, anywhere, remote, remoteNote = null, places, parts = [], cities: byCity = false, serverFiltered = false, chosenPlace, ready, complete, more, note, onPlace }: {
  /** The city whose parts are shown, or '' for the cities. */ within: string; onWithin: (city: string) => void;
  anywhere: { label?: string; checked: boolean; count: number | null; onPress: () => void };
  /** Work done remotely: a row of its own where tasks say how they are done (with how many when that is known). */
  remote: { available: boolean; checked: boolean; count: number | null; onPress: () => void };
  /**
   * Said while the work done remotely is chosen: it has no place, so there are no places to choose (and the server's preview does not ask for any). The picker is then
   * only "Svi zadaci" and "Na daljinu" and this line, which says how to get to a city.
   */
  remoteNote?: string | null;
  /** Every place the tasks name, with how many (null while that is not known). */ places: readonly PlaceEntry[];
  /** The parts of the city drilled into, with how many (the server's AREA rows). Nothing while nothing is drilled into. */ parts?: readonly PlaceEntry[];
  /** The rows of `places` are cities (the server's city list): the group is named for them. */ cities?: boolean;
  /**
   * The rows are already the ones that contain the letters of the city drilled into (the server's prefix, which folds Serbian letters its own way: "dj" for "đ"), so they
   * are not filtered again here, where "đ" folds to "d". Without the server (the loaded rows) every place is held and the letters filter them.
   */
  serverFiltered?: boolean;
  chosenPlace: string | null;
  /** Whether the places held answer what is drilled into now; false while they are still being read (nothing is said missing then). */ ready: boolean;
  /** Whether every place with tasks has been read; false while more are to come. */ complete: boolean;
  /** The server has more places to read. */ more: { label: string; busy: boolean; onPress: () => void } | null;
  /** A quiet line when the places could not be read. */ note: string | null;
  onPlace: (text: string) => void;
}) {
  const typed = within, typing = foldPlace(typed) !== '';
  const shown = useMemo(() => serverFiltered ? places : places.filter(place => placeMatches(place.text, typed)), [places, typed, serverFiltered]);
  // A part of a city is listed once, and never as a city of the list above.
  const partsShown = useMemo(() => typing ? parts.filter(part => !shown.some(place => placeKey(place.text) === placeKey(part.text))) : [], [parts, shown, typing]);
  // A city is listed once: as a place when tasks name it exactly (above), and here otherwise. A city that leads on to its parts is
  // not listed again once its parts are what the list shows (its name is what has been typed).
  const cities = useMemo(() => POPULAR_CITIES.filter(city => placeMatches(city, typed))
    .map(city => ({ city, standing: cityStanding(city, places, complete) }))
    .filter(({ city, standing }) => standing.kind !== 'place'
      && !((standing.kind === 'parts' || standing.kind === 'unknown') && foldPlace(city) === foldPlace(typed))), [places, typed, complete]);
  const chosen = chosenPlace ? placeKey(chosenPlace) : null;
  const anywhereCount = counted(anywhere.label ?? PLACE_WORDS.everything, anywhere.count), remoteCount = counted(PLACE_WORDS.remote, remote.count);
  if (remoteNote) {
    return <View testID="search-place-editor" style={s.editor}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.list}>
        <PlaceRow count={anywhere.count} text={anywhere.label ?? PLACE_WORDS.everything} label={anywhereCount.label} checked={anywhere.checked} onPress={anywhere.onPress} />
        <PlaceRow art={remote.count === null ? 'remote' : undefined} count={remote.count} text={PLACE_WORDS.remote} label={remoteCount.label}
          checked={remote.checked} onPress={remote.onPress} />
      </View>
      <T variant="note" tone="muted">{remoteNote}</T>
    </View>;
  }
  return <View testID="search-place-editor" style={s.editor}>
    <View accessibilityRole="radiogroup" accessibilityLabel="Mesta" style={s.list}>
      {typing ? <Press testID="search-place-back" accessibilityRole="button" accessibilityLabel={PLACE_WORDS.backToCities} accessibilityHint={PLACE_WORDS.backHint}
        haptic="select" scaleTo={sys.motion.scale.row} hitSlop={0} onPress={() => onWithin('')} style={s.back}>
        <Glyph name="caret-left" tone="ink" /><T variant="body" style={s.ink}>{typed}</T>
      </Press> : <>
        <PlaceRow count={anywhere.count} text={anywhere.label ?? PLACE_WORDS.everything} label={anywhereCount.label} checked={anywhere.checked} onPress={anywhere.onPress} />
        {remote.available ? <PlaceRow art={remote.count === null ? 'remote' : undefined} count={remote.count} text={PLACE_WORDS.remote} label={remoteCount.label}
          checked={remote.checked} onPress={remote.onPress} /> : null}
      </>}
      {shown.length ? <GroupTitle>{byCity ? PLACE_WORDS.citiesWithTasks : PLACE_WORDS.withTasks}</GroupTitle> : null}
      {shown.map(place => <PlaceRow key={placeKey(place.text)} count={place.count} text={place.text} label={counted(place.text, place.count).label}
        checked={chosen !== null && chosen === placeKey(place.text)} onPress={() => onPlace(place.text)} />)}
      {more ? <V2Action label={more.label} disabled={more.busy} kind="quiet" onPress={more.onPress} /> : null}
      {partsShown.length ? <GroupTitle>{PLACE_WORDS.parts}</GroupTitle> : null}
      {partsShown.map(part => <PlaceRow key={`part:${placeKey(part.text)}`} count={part.count} text={part.text} label={counted(part.text, part.count).label}
        checked={chosen !== null && chosen === placeKey(part.text)} onPress={() => onPlace(part.text)} />)}
      {note ? <T variant="note" tone="muted">{note}</T> : null}
      {cities.length ? <GroupTitle>{PLACE_WORDS.popular}</GroupTitle> : null}
      {cities.map(({ city, standing }) => {
        if (standing.kind === 'none') {
          return <PlaceRow key={`city:${city}`} lead={PLACE_WORDS.noTasksLead} text={city} label={`${city}, ${PLACE_WORDS.noTasksYet}`}
            checked={chosen === placeKey(city)} onPress={() => onPlace(city)} />;
        }
        if (standing.kind === 'parts') {
          // The figure leads the row; what the tasks are split by is the line under the city.
          const line = standing.count === null ? PLACE_WORDS.partsOnly : `${zadataka(standing.count)} · ${PLACE_WORDS.inParts}`;
          const under = standing.count === null ? PLACE_WORDS.partsOnly : PLACE_WORDS.inParts.charAt(0).toLocaleUpperCase('sr-Latn-RS') + PLACE_WORDS.inParts.slice(1);
          return <PlaceRow key={`city:${city}`} count={standing.count} text={city} note={under} label={`${city}, ${line}`} role="button" hint={PLACE_WORDS.showParts}
            onPress={() => onWithin(city)} />;
        }
        return <PlaceRow key={`city:${city}`} text={city} label={city} role="button" hint={PLACE_WORDS.showPlaces} onPress={() => onWithin(city)} />;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  editor: { gap: sys.space.md },
  list: { gap: sys.space.xs },
  ink: { color: sys.color.ink },
  // The way back from the parts of a city: the arrow and the city's name, one 48 row.
  back: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 48, paddingVertical: sys.space.xs },
});
