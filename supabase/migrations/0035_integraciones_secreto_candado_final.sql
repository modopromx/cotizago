-- Aplicada en Supabase como integraciones_secreto_candado_final (29-oct-2026),
-- después de publicar el panel que guarda con guardar_integracion (0034).
-- El navegador deja de poder leer integraciones.secreto (llaves de Stripe,
-- contraseña del correo, token de WhatsApp de cada usuario).
revoke select on public.integraciones from authenticated, anon;
grant select (id, workspace_id, tipo, config, activa, created_at, updated_at, tiene_secreto)
  on public.integraciones to authenticated;
