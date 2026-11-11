import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { ProductFact, ProductFacts } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { osoba } from '../system/plural';
import { applicationPriceBasisText, BEZ_IZNOSA } from '../../lib/novac';
import { brandAction, sys, inset } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/** Accepted Agreement facts only. The route owns the review lifetime and command. */
export function AgreementCompletionReview({ agreement, worker, confirm, back }: {
  agreement: DogovorProjekcija; worker: boolean; confirm: () => void; back: () => void;
}) {
  const other = agreement.ucesnici.find(person => !person.viSte);
  return <ProductSheet title="Pregled završetka" closeLabel="Nazad na Dogovor" onClose={back}
    footer={() => <V2Action label={worker ? 'Da, zadatak je gotov' : 'Da, potvrdite završetak'} onPress={confirm} style={brandAction} />}>
    {() => <>
        <View style={s.intro}>
          <T accessibilityRole="header" variant="title" style={s.title}>{worker ? 'Zadatak je gotov?' : 'Potvrdite završetak'}</T>
          {/* One sentence each (J5): what the other side gets to do, or what is being confirmed. What follows is on the page they return to. */}
          <T variant="body" tone="muted">{worker
            ? 'Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.'
            : 'Potvrđujete da je zadatak obavljen po prihvaćenim uslovima.'}</T>
        </View>
        <View style={s.terms}>
          {/* No eyebrow over the title ("Prihvaćeni uslovi"): the facts under it are the accepted terms, and say so in their own labels. */}
          <T variant="heading" style={s.ink}>{readableTitle(agreement.naslov)}</T>
          {other ? <T variant="body" tone="muted">{other.ime}</T> : null}
          <ProductFacts>
            <ProductFact art="calendar" label="Dogovoreni termin" value={agreement.vremeTekst} />
            <ProductFact art="users" label="Dogovoreni broj ljudi" value={osoba(agreement.pokrivenost.popunjeno)} />
            {/* A missing amount is a word and never wears the amount's style. */}
            <ProductFact art="money" label={`Sačuvani iznos · ${applicationPriceBasisText(agreement.osnovaCene)}`} value={agreement.cena.prikaz || BEZ_IZNOSA} prominent
              prominentAs={agreement.cena.prikaz ? 'amount' : 'label'} />
          </ProductFacts>
        </View>
        {agreement.problemOtvoren ? <View style={s.notice}>
          <T variant="bodyStrong" style={s.ink}>Problem je prijavljen</T>
          <T variant="body" tone="muted">{worker
            ? 'Prijavljeni problem ostaje sačuvan. Automatski završetak je zaustavljen.'
            : 'Prijavljeni problem ostaje sačuvan. Ovom potvrdom ipak završavaš Dogovor; problem sam po sebi ne određuje krivicu ili dug.'}</T>
        </View> : null}
    </>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  intro: { gap: 12 }, title: { color: sys.color.ink }, ink: { color: sys.color.ink },
  terms: { gap: 8 },
  notice: { ...inset, padding: 16, gap: 8, backgroundColor: sys.color.warnSoft },
});
