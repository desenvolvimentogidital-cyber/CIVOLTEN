-- Personalização pública controlada pelo administrador, preserva logo e cores existentes.
alter table public.civolten_branding
 add column if not exists logo_width_px integer not null default 160
  check (logo_width_px between 60 and 320),
 add column if not exists site_headline text not null default 'Peça seu orçamento sem sair de casa.'
  check (length(site_headline) between 8 and 125),
 add column if not exists site_description text not null default 'Descreva o serviço, envie fotos, áudio ou vídeo e, se quiser, faça uma simulação imediata.'
  check (length(site_description) between 15 and 260),
 add column if not exists footer_note text not null default 'Elétrica, reformas e construção civil. Atendimento e orçamentos digitais.'
  check (length(footer_note) between 5 and 220),
 add column if not exists contact_whatsapp text not null default ''
  check (contact_whatsapp = '' or contact_whatsapp ~ '^[1-9][0-9]{10,12}$');
-- Tabela exclusiva do backend: nenhuma política/grant novo para visitantes.
