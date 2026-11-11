import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { useSesija } from '../../store/sesija';
import { T } from '../Text';
import { AgreementPrivateLocation, clearCachedAgreementLocation } from '../AgreementPrivateLocation';
import { FactArt } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { sys } from '../system/tokens';

/**
 * "Komunikacija i mesto" (Usklađeno sa nalogom vlasnika o privatnosti):
 * Sva komunikacija (poruke, glasovne poruke i fotografije) vodi se isključivo
 * unutar USKOČI aplikacije. Nema deljenja privatnih telefonskih brojeva.
 * Privatna lokacija se prikazuje kroz autorizovani grant kada je to potrebno.
 */
export function AgreementContactPlace({
  agreement,
  enabled,
  concealed = false,
  onOpenMessages,
  onRequestAddress,
  onLayout,
  locationSlot,
}: {
  agreement: DogovorProjekcija;
  enabled: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  concealed?: boolean;
  onOpenMessages?: () => void;
  onRequestAddress?: () => void;
  locationSlot?: ReactNode;
}) {
  const session = useSesija();
  const active = agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER';
  const physical = agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji;
  useEffect(() => {
    if (!active && session.user?.id) {
      void clearCachedAgreementLocation(session.user.id, agreement.id);
    }
  }, [active, session.user?.id, agreement.id]);

  const rows: ((last: boolean) => ReactNode)[] = [
    last => (
      <ListRow
        key="messages"
        leading={<FactArt kind="chat" size={32} />}
        title="Poruke u aplikaciji"
        subtitle="Sva komunikacija i dogovori vode se bezbedno u aplikaciji."
        last={last}
        accessibilityLabel="Poruke u aplikaciji"
        onPress={onOpenMessages}
      />
    ),
  ];

  const tail = physical ? (
    active ? (
      locationSlot ?? (
        <AgreementPrivateLocation
          agreement={agreement}
          enabled={enabled && !concealed}
          onRequestAddress={onRequestAddress}
        />
      )
    ) : (
      <T variant="note" tone="muted">
        Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.
      </T>
    )
  ) : null;

  const title = agreement.rezim === 'DALJINSKI' ? 'Komunikacija' : 'Komunikacija i mesto';

  return (
    <View testID="agreement-contact-place" onLayout={onLayout}>
      <Section title={title}>
        <View>{rows.map((row, index) => row(index === rows.length - 1))}</View>
        {tail}
      </Section>
    </View>
  );
}
