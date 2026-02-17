-- ==============================================================================
-- MENU NO AR - AUTHENTICATION & SECURITY UPDATE
-- ==============================================================================
-- Este script migra a base de dados para usar o sistema de Autenticação do Supabase.
-- Corra isto no SQL Editor do Supabase.

-- 1. ATUALIZAR TABELA DE RESTAURANTES
-- Adicionar coluna para ligar ao utilizador autenticado (auth.users)
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES auth.users(id);

-- Vamos assumir que os restaurantes antigos são órfãos ou precisam de ser reclamados.
-- O ideal é apagar dados de teste antigos, já que a estrutura de user mudou radicalmente.
TRUNCATE TABLE "restaurants" CASCADE;
TRUNCATE TABLE "menu_items" CASCADE;

-- Remover dependências antigas
ALTER TABLE "restaurants" DROP CONSTRAINT IF EXISTS "restaurants_owner_username_fkey";
ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "owner_username";

-- A tabela antiga de users já não é necessária
DROP TABLE IF EXISTS "app_users";

-- 2. POLICIES DE SEGURANÇA (RLS) REFORÇADAS

-- Restaurantes
ALTER TABLE "restaurants" Enable ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public View Restaurants" ON "restaurants";
CREATE POLICY "Public View Restaurants" ON "restaurants" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner Manage Restaurants" ON "restaurants";
CREATE POLICY "Owner Manage Restaurants" ON "restaurants" FOR ALL 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Itens do Menu
ALTER TABLE "menu_items" Enable ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public View Items" ON "menu_items";
CREATE POLICY "Public View Items" ON "menu_items" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner Manage Items" ON "menu_items";
CREATE POLICY "Owner Manage Items" ON "menu_items" FOR ALL 
USING (
    restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
);

-- Contactos
ALTER TABLE "contacts" Enable ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Insert Contacts" ON "contacts";
CREATE POLICY "Public Insert Contacts" ON "contacts" FOR INSERT WITH CHECK (true);

-- Apenas admins podem ler contactos (simplificado para admin geral ou owner se associarmos no futuro)
-- Para já, vamos deixar apenas o service_role ou authenticated ler se quisermos
CREATE POLICY "Authenticated View Contacts" ON "contacts" FOR SELECT TO authenticated USING (true);


-- 3. STORAGE POLICIES (Atualizadas para Auth)
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner Upload Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete Assets" ON storage.objects;

-- Qualquer pessoa vê imagens
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING ( bucket_id = 'menu-assets' );

-- Apenas utilizadores autenticados podem fazer upload
CREATE POLICY "Authenticated Upload Assets" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'menu-assets' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Update Assets" ON storage.objects FOR UPDATE
USING ( bucket_id = 'menu-assets' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Delete Assets" ON storage.objects FOR DELETE
USING ( bucket_id = 'menu-assets' AND auth.role() = 'authenticated' );
