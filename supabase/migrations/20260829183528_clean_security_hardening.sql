-- 01 — bezbednosno stezanje zatečenog stanja
-- Supabase advisor: public.rls_auto_enable() je SECURITY DEFINER i izvrsiva
-- od strane anon preko /rest/v1/rpc/. Administrativna funkcija ne sme da bude
-- dostupna neprijavljenom korisniku. Event trigger ensure_rls nastavlja da radi.
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
