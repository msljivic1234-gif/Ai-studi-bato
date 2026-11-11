# Original AI identity — source integration

Integration note, 2026-10-03: the three files described below are now copied into the existing app under the owner's design authorization. Source identity was visually inspected before integration. The following preparation record retains its original scope; native acceptance of this integration is still pending.

Prepared only in scratch. No canonical edits, provider calls, packages, device operations or tests. Root authorized the existing task-head identity for both chats and one finite arrival. This is original identity with a short opacity arrival, not a claim that the requested hand wave is implemented.

Current source: `src/ui/aiFirst/AiConversationShell.tsx:233` uses generic ConversationArt88 for the untouched opening and `:352` FactArt chat24 for each assistant turn group. Neither is a robot. Task copy is already distinct (`IntakePresentation.tsx`: “Reci šta ti treba.” / review before publishing); work-profile copy is already distinct (`src/app/(app)/profil/razgovor.tsx`: “Šta umeš da radiš?” / skills, equipment and review before saving). Both use the same shell. No copy or functional role change is required to share one assistant identity.

Three proposed integration paths:

1. `assets/ai/uskoci-assistant.png` — byte-exact existing task-head asset, SHA256 `b04bec024cc55b9f7c951cbc9de252e2df21f3b35619ad8e09a08d995b861cf5`, 1254×1254 RGBA, 1,027,982 bytes.
2. `src/ui/aiFirst/AiAssistantArt.tsx` — local memoized expo-image art with fixed24/88 bounds, downscaling allowed and hidden from accessibility. Shared source/cache for both AI conversations. Its separate welcome wrapper uses one opacity-only native-driver arrival with existing `sys.motion.enter`240ms and `easeOut` tokens. No asset reads for controls or navigation.
3. `src/ui/aiFirst/AiConversationShell.tsx` — opening/speaker art replacements plus one shell-owned welcome-memory ref. Composer, scroll anchors, keyboard behavior, streaming text, messages, callbacks, speech, location and recovery are unchanged. The existing opening naturally yields to the compact speaker mark after the first turn; it does not replay an artificial welcome over restored history. Keyboard hiding/remounting the opening does not replay its arrival.

## Evidence and missing motion

- Existing source: `C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/outputs/uskoci-visual-assets-v1/ai-task-avatar.png`; copied bytes also appear as `.../uskoci-product-design-review-20261001/assets/task-robot.png` and `.../uskoci-visual-assets-v2/robots/task-static.png`.
- v1 `USAGE.md` calls the white shell, dark green joints, orange details, black face and open round eyes the approved robot identity. Its manifest still labels this exact render `STATIC_CANDIDATE`, `integrated:false`. Reuse here is a proposed source integration under the latest owner direction, not retroactive asset/native approval.
- `C:/Users/user/Desktop/USKOCI_DESIGN_MASTER/manifest/assets.json` has a different full-body Sept30 reference `AI-T-REF` (thumbs-up); `AI-T-MASTER`, `AI-W-MASTER`, pose family and `AI-RIG` remain `TO PRODUCE`. The reference's chest mark is not certified as the original composited logo. It is not silently used here as a finished rig.
- v2 `robot-motion.html` is a web face-expression study using separately drawn LED eyes over a blank face raster. It has no arm/hand layers, hand-wave frames, native implementation or physical acceptance. Whole-head rotation is not a hand wave, so none is added or claimed.

The present slice is original identity with one short welcome fade. To satisfy an actual hand wave, an approved arm/hand pose sequence or layered original character is still missing. Do not replace that gap with generic chat art, a fake voice/listening indicator or a new model.

## Review targets

Verify the real PNG at24dp and88dp on white in both task and work-profile conversations; no text should move on decode. Confirm voice mode remains its current true text-response/capture flow with no mascot status claims. Keyboard and first-send must retain the same input instance and existing scroll behavior. Reduced Motion gets static art; background/unmount interrupts and settles the fade. No loop is added. Inline marks are always static. A retained route can finish its already-started240ms fade while hidden; no native focus subscription is added to the shared presentation. The existing real typing indicators are untouched.

Skills read: `uskoci-design`, `animate-expo`, `vercel-react-native-skills`. The old donor design SKILL.md path referenced inside `uskoci-design` no longer exists; current Design Master and actual owner excerpt were used as visual evidence. The skill's generic Reanimated preference yields to this app's documented B22 policy for new native-driver motion; only opacity changes, never layout/SVG geometry. No hand-wave implementation is claimed.
