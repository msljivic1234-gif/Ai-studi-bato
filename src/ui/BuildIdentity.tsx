import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { readBuildIdentity } from '../data/buildIdentity';
import { sys } from './system/tokens';

const targets = {
  canonical: 'Referentni USKOČI projekat', local: 'Lokalno test okruženje',
  other: 'Drugo ili neprepoznato okruženje', unconfigured: 'Okruženje nije zabeleženo',
};

/** Small in-context support detail, not another navigation destination. */
export function BuildIdentity() {
  const [expanded, setExpanded] = useState(false);
  const build = readBuildIdentity();
  const runtime = Updates.runtimeVersion ?? build.runtimeVersion;
  const channel = Updates.channel ?? build.updateChannel;
  // The embedded bundle also carries an update id, so the launch kind is said in words before the id.
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : null;
  const update = Updates.isEmbeddedLaunch ? `ugrađena verzija${id ? ` · ${id}` : ''}` : id ? `OTA ažuriranje · ${id}` : 'nije zabeležen';
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="Podaci o verziji"
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.button}>
      <Text style={styles.label}>USKOČI · {build.version ?? 'verzija nije zabeležena'}{build.sourceCommit ? ` · ${build.sourceCommit.slice(0, 7)}` : ''}{build.sourceDirty ? ' *' : ''}</Text>
    </Pressable>
    {expanded ? <View accessibilityLiveRegion="polite" style={styles.details}>
      <Text selectable style={styles.copy}>Izvor: {build.sourceCommit ?? 'nije zabeležen'}</Text>
      <Text style={styles.copy}>{build.sourceDirty === true ? 'Radna verzija sa lokalnim izmenama.'
        : build.sourceDirty === false ? 'Izgrađeno iz čistog radnog stabla.' : 'Čistoća radnog stabla nije potvrđena.'}</Text>
      <Text style={styles.copy}>{targets[build.backendTarget]}</Text>
      <Text selectable style={styles.copy}>OTA runtime: {runtime ?? 'nije zabeležen'}</Text>
      <Text style={styles.copy}>OTA kanal: {channel ?? 'nije zabeležen'}</Text>
      <Text selectable style={styles.copy}>OTA sadržaj: {update}</Text>
      <Text style={styles.copy}>Verzija usluge i aktivne mogućnosti proveravaju se zasebno.</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: sys.space.sm },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  label: { color: sys.color.muted, ...sys.type.meta, textAlign: 'center' },
  details: { gap: sys.space.sm, paddingHorizontal: sys.space.sm },
  copy: { color: sys.color.muted, ...sys.type.meta },
});
