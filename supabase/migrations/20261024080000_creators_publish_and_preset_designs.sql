-- Pitch path: a creator builds a game and publishes it themselves. Publishing (writing the live version)
-- now also needs the right to edit that game, so a creator can't overwrite someone else's live game.
-- Plus three preset looks in the design library.

update public.role_permissions set level = 1 where role_key = 'creator' and permission_key = 'workflow.publish';

drop policy "Publishers create the live game" on public.game_content;
drop policy "Publishers update the live game" on public.game_content;
create policy "Publishers create the live version of games they edit" on public.game_content
  for insert to authenticated
  with check (stage = 'live' and (select private.has_permission('workflow.publish')) and (select private.can_edit_game(game_key)));
create policy "Publishers update the live version of games they edit" on public.game_content
  for update to authenticated
  using (stage = 'live' and (select private.has_permission('workflow.publish')) and (select private.can_edit_game(game_key)))
  with check (stage = 'live' and (select private.has_permission('workflow.publish')) and (select private.can_edit_game(game_key)));

insert into public.design_systems (name, description, library, tokens) values
  ('Harbour Blue', 'Crisp blue on white with rounded cards. Calm and modern.', true,
   '{"accent":"#0B5FFF","accentInk":"#FFFFFF","ink":"#14213D","muted":"#4A5568","page":"#EEF3FA","surface":"#FFFFFF","line":"#D6DFEB","radius":10,"bodyFont":"inter","headingFont":"inter"}'),
  ('Midnight Audit', 'Dark mode with a cyan accent, for a late-night audit feel.', true,
   '{"accent":"#38BDF8","accentInk":"#0B1220","ink":"#F1F5F9","muted":"#A3B1C6","page":"#0F172A","surface":"#1E293B","line":"#334155","radius":8,"bodyFont":"dm-sans","headingFont":"space-grotesk"}'),
  ('Ledger Serif', 'Warm paper, serif headings and square corners, like a bound ledger.', true,
   '{"accent":"#9C3D10","accentInk":"#FFFFFF","ink":"#2B2118","muted":"#6B5D4F","page":"#F7F3EA","surface":"#FFFDF8","line":"#E6DCCB","radius":2,"bodyFont":"source-sans-3","headingFont":"merriweather"}');
