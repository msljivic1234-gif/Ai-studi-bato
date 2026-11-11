// Serbian Cyrillic to Latin. OSM / LocationIQ labels for Serbia are often Cyrillic ("Булевар ослобођења") while people
// type or speak Latin; matching and the shown address both use Latin.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};
export const toSerbianLatin = (value: string): string => value.replace(/[Ѐ-ӿ]/g, letter => {
  const lower = letter.toLowerCase(), latin = CYRILLIC[lower];
  if (latin === undefined) return letter;
  return letter === lower ? latin : latin.charAt(0).toUpperCase() + latin.slice(1);
});

