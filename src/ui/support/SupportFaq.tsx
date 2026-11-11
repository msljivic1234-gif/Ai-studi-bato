import { StyleSheet, View } from 'react-native';
import { SettingsGroup, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { sys } from '../system/tokens';

/**
 * "Najčešća pitanja" (R09, UI/UX pass 2026-10-08; a DRAFT for the owner's eye). Six questions people ask before they write to
 * support, answered in the words the app itself uses, so a person finds the answer where the thing is done. They are about how the
 * app works and nothing else: no money, no rights or legal text, no promise about how fast support answers (the owner decides those
 * words), and no feature that the app does not have today: every label named here ("Prijavi problem", "Izmeni uslove",
 * "Otkaži Dogovor", "Zadatak je gotov", "Potvrdi završetak", "Prijavi ili blokiraj osobu") is the label on the screen (8 Oct 2026: the overview of a
 * Dogovor has no row "Izmene i otkazivanje" any more; its rows are "Izmeni uslove" and "Otkaži Dogovor").
 */
export const SUPPORT_FAQ: readonly { question: string; answer: string }[] = [
  { question: 'Kako da izaberem osobu za zadatak?',
    answer: 'Kad stignu prijave, otvorite zadatak i uporedite ih po oceni i poruci. Kad izaberete prijavu, nastaje Dogovor.' },
  { question: 'Kako da se čujemo sa drugom osobom?',
    answer: 'Posle izbora otvara se Dogovor i u njemu razgovarate. Tačnu adresu vide samo izabrani, u Dogovoru.' },
  { question: 'Šta ako se nešto promeni?',
    answer: 'U Dogovoru izaberite „Izmeni uslove“ da predložite izmenu ili „Otkaži Dogovor“ da ga otkažete.' },
  { question: 'Šta ako osoba ne dođe ili nešto krene loše?',
    answer: 'U Dogovoru izaberite „Prijavi problem“. Druga strana vidi prijavu, a automatsko završavanje se zaustavlja. Možete i da napišete podršci.' },
  { question: 'Kako se završava Dogovor i kako se ocenjuje?',
    answer: 'Kad je zadatak urađen, osoba koja uskače izabere „Zadatak je gotov“, a druga strana potvrdi završetak. Posle toga možete da ocenite saradnju.' },
  { question: 'Kako da prijavim ili blokiram osobu?',
    answer: 'Otvorite profil osobe, zadatak ili Dogovor i izaberite „Prijavi ili blokiraj osobu“. Prijavu prima podrška, a druga osoba ne vidi kategoriju, razlog ni opis.' },
];

/** The questions, each folded to its words until opened (one row each, like the retention rules), under the one title. */
export function SupportFaq() {
  return <SettingsGroup title="Najčešća pitanja">
    {SUPPORT_FAQ.map((item, index) => <Disclosure key={item.question} label={item.question} divider={index > 0}>
      <View style={s.answer}><T variant="copy" tone="muted">{item.answer}</T></View>
    </Disclosure>)}
  </SettingsGroup>;
}

const s = StyleSheet.create({
  answer: { gap: sys.space.sm },
});
