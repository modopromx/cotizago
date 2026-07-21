-- CotizaGo — Almacenamiento de logotipos de empresa.
-- Bucket público (el logo se muestra en la cotización pública y en el PDF que
-- ve el cliente final), pero cada workspace solo escribe en su propia carpeta
-- y NO se puede listar el contenido ajeno.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','image/webp'];

drop policy if exists logos_lectura_publica on storage.objects;
drop policy if exists logos_lectura_propia on storage.objects;
drop policy if exists logos_subir on storage.objects;
drop policy if exists logos_actualizar on storage.objects;
drop policy if exists logos_borrar on storage.objects;

-- Sin policy de SELECT pública: los buckets públicos sirven el objeto por URL
-- sin pasar por RLS, así que no hace falta y evita que se listen los ajenos.
create policy logos_lectura_propia on storage.objects
  for select to authenticated using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select workspace_id::text from public.profiles where id = auth.uid())
  );

create policy logos_subir on storage.objects
  for insert to authenticated with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select workspace_id::text from public.profiles where id = auth.uid())
  );

create policy logos_actualizar on storage.objects
  for update to authenticated using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select workspace_id::text from public.profiles where id = auth.uid())
  );

create policy logos_borrar on storage.objects
  for delete to authenticated using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select workspace_id::text from public.profiles where id = auth.uid())
  );
