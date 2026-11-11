import { useCallback } from 'react';
import { router } from 'expo-router';
import { agreementClientService } from '../../data/agreementClientService';
import { applicationClientService } from '../../data/applicationClientService';
import { needClientService } from '../../data/needClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { ArchiveScreen, type ArchiveSource } from '../../ui/calendar/ArchiveScreen';
import type { ArchiveEntry } from '../../ui/calendar/archive';

/** One read, as the archive draws it: not read yet, failed, or the rows. */
function sourceOf<Row>(resource: { data: readonly Row[] | null; error: boolean }): ArchiveSource<Row> {
  return resource.error ? { state: 'error' } : resource.data ? { state: 'ready', rows: resource.data } : { state: 'loading' };
}

/**
 * Arhiva: what is over, read-only, for both sides at once. Three reads the app already makes (my Dogovori, my tasks, my
 * applications, exactly as Raspored and Početna read them); nothing new is asked of the server. The screen draws them together and
 * every row opens the detail it belongs to.
 */
export default function Arhiva() {
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori({ includeRatings: false }), []));
  const needs = useFocusedResource(useCallback(() => needClientService.mojePotrebe({ includeUrgency: false }), []));
  const applications = useFocusedResource(useCallback(() => applicationClientService.mojePrijave(), []));
  const everything = [agreements, needs, applications];
  const open = (entry: ArchiveEntry) => {
    if (entry.kind === 'dogovor') router.navigate({ pathname: '/dogovor/[id]', params: { id: entry.id } });
    else if (entry.kind === 'zadatak') router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: entry.id } });
    else router.navigate({ pathname: '/moje-prijave', params: { prijavaId: entry.id } });
  };
  return <ArchiveScreen agreements={sourceOf(agreements)} needs={sourceOf(needs)} applications={sourceOf(applications)}
    refreshing={everything.some(resource => !!resource.refreshing)}
    // Opened cold (a shared link) there is nothing behind it: the way back is the planner it belongs to.
    onBack={() => router.canGoBack() ? router.back() : router.replace('/raspored')}
    // A pull keeps what is on screen under the spinner; "Pokušaj ponovo" reads only what failed.
    onRefresh={() => { for (const resource of everything) void resource.refresh('keep'); }}
    onRetry={() => { for (const resource of everything) if (resource.error) void resource.refresh('keep'); }} onOpen={open} />;
}
