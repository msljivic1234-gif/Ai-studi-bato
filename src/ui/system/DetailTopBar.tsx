import type { ReactNode } from 'react';
import { ScreenChrome } from './ScreenChrome';

/**
 * Top bar of a screen you arrived at from somewhere else: the arrow back, the screen's name, and at most one action on
 * the right. It is `ScreenChrome`'s detail bar, so it has the same height, arrow, padding and title as every other bar.
 *
 * There is no eyebrow — the small word above the title saying which part of the app a screen belongs to. The owner's
 * rule (2026-09-23): a person who opened a task knows they opened a task; the screen does not explain where they are.
 * A caller with real information to add puts it in the content, not the bar.
 */
export function DetailTopBar({ title, onBack, backLabel = 'Nazad', disabled = false, right, tone }: {
  title: string; onBack: () => void; backLabel?: string; disabled?: boolean; right?: ReactNode; tone?: 'conversation';
}) {
  return <ScreenChrome variant="detail" title={title} onBack={onBack} backLabel={backLabel} disabled={disabled} right={right} tone={tone} />;
}
