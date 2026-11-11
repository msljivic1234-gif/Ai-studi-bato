import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { sys } from '../system/tokens';

/**
 * The head of every step of the sign-in sheet: ONE title, in ONE style (`pageTitle`, 28/33, the name of what the screen is), and
 * under it, when there is something to say, ONE sentence in the quiet `copy` style. The sheet used to have three heads (a bar
 * title in 18, a stage title in 28 and a form title in 30, sometimes two of them at once: "Proveri email" over "Proveri
 * email"), a small mark above them and a 58 dp badge above that; the entry behind the sheet already carries the brand.
 *
 * `art` is for a step that is a RESULT or a STATE (the mail was sent, the code is asked for, the link is being made): one fact
 * picture at 48 in the same 80 dp well the other states of the app use (`StateView`, the restricted account, a closing account),
 * so a state says what it is the same way wherever it is drawn.
 */
export function AuthIntro({ title, copy, art, muted = false, alert = false }: { title: string; copy?: string; art?: FactArtKind;
  /** A picture that is not good news: drawn grey, as an error or an offline state is everywhere else. */ muted?: boolean;
  /** The sentence under the title is what went wrong: it is announced as an alert. */ alert?: boolean }) {
  return <View style={s.head}>
    {art ? <View style={s.well} accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind={art} size={48} muted={muted} />
    </View> : null}
    <View style={s.words}>
      <T accessibilityRole="header" variant="pageTitle">{title}</T>
      {copy ? <T variant="copy" tone="muted" accessibilityRole={alert ? 'alert' : undefined}>{copy}</T> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  head: { gap: sys.space.base },
  // Title to its sentence: 8, the one gap between a name and what is said about it.
  words: { gap: sys.space.sm },
  well: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
});
