-- ==============================================================================
-- MENU NO AR - DATABASE SETUP SCRIPT (ROBUST CLEANUP)
-- ==============================================================================
-- Este script limpa TUDO (Tabelas e Policies) antes de recriar.
-- Copia e cola este conteúdo no SQL Editor do teu projeto Supabase e corre.
-- ==============================================================================

-- 1. LIMPEZA DE TABELAS
DROP TABLE IF EXISTS "menu_items";
DROP TABLE IF EXISTS "restaurants";
DROP TABLE IF EXISTS "app_users";
DROP TABLE IF EXISTS "contacts";

-- 2. LIMPEZA DE POLICIES (STORAGE)
-- O Supabase não apaga policies de storage automaticamente, temos de forçar.
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Assets" ON storage.objects;

DROP POLICY IF EXISTS "Public Access PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert PDFs" ON storage.objects;

-- 3. TABELA DE UTILIZADORES
CREATE TABLE "app_users" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "username" text NOT NULL UNIQUE,
    "password" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 4. TABELA DE RESTAURANTES
CREATE TABLE "restaurants" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "owner_username" text REFERENCES "app_users"("username") ON DELETE CASCADE,
    "name" text,
    "description" text,
    "slug" text UNIQUE,
    "cover_url" text,
    "font" text DEFAULT 'Inter',
    "menu_type" text DEFAULT 'digital',
    "pdf_url" text,
    "wifi_password" text,
    "phone" text,
    "address" text,
    "category_images" jsonb DEFAULT '{}',
    "category_order" jsonb DEFAULT '[]', -- Ordem das categorias
    "created_at" timestamp with time zone DEFAULT now()
);

-- 5. TABELA DE ITENS DO MENU
CREATE TABLE "menu_items" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "restaurant_id" uuid REFERENCES "restaurants"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text,
    "price" numeric(10,2) NOT NULL,
    "category" text NOT NULL,
    "available" boolean DEFAULT true,
    "image_url" text,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 6. TABELA DE CONTACTOS
CREATE TABLE "contacts" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "name" text,
    "email" text,
    "service" text,
    "created_at" timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- RLS (SEGURANÇA DA BASE DE DADOS)
-- ==============================================================================
ALTER TABLE "app_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "restaurants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access App Users" ON "app_users" FOR ALL USING (true);
CREATE POLICY "Public Access Restaurants" ON "restaurants" FOR ALL USING (true);
CREATE POLICY "Public Access Menu Items" ON "menu_items" FOR ALL USING (true);
CREATE POLICY "Public Access Contacts" ON "contacts" FOR ALL USING (true);

-- ==============================================================================
-- STORAGE (FICHEIROS)
-- ==============================================================================
-- Garante que os buckets existem
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-assets', 'menu-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-pdfs', 'menu-pdfs', true) ON CONFLICT (id) DO NOTHING;

-- Cria as policies de novo
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING ( bucket_id = 'menu-assets' );
CREATE POLICY "Public Insert Assets" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'menu-assets' );
CREATE POLICY "Public Update Assets" ON storage.objects FOR UPDATE USING ( bucket_id = 'menu-assets' );
CREATE POLICY "Public Delete Assets" ON storage.objects FOR DELETE USING ( bucket_id = 'menu-assets' );

CREATE POLICY "Public Access PDFs" ON storage.objects FOR SELECT USING ( bucket_id = 'menu-pdfs' );
CREATE POLICY "Public Insert PDFs" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'menu-pdfs' );

-- ==============================================================================
-- DADOS DE EXEMPLO (SEED)
-- ==============================================================================

-- 1. Admin
INSERT INTO "app_users" ("username", "password") VALUES ('admin', 'admin123');

-- 2. Restaurante
INSERT INTO "restaurants" (
    "owner_username", "name", "description", "slug", "wifi_password", "phone", "address", "cover_url", "category_images", "category_order"
) VALUES (
    'admin', 
    'Restaurante da Baía', 
    'Sabores frescos do mar com vista para o oceano. A melhor mariscada da região.', 
    'exemplo',
    'MarSalgado2024', 
    '+351 912 345 678', 
    'Av. Marginal do Oceano, nº 42, Cascais',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
    '{ "Pratos Principais": "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop", "Sobremesas": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?q=80&w=800&auto=format&fit=crop" }',
    '["Pratos Principais", "Sobremesas", "Bebidas"]'
);

-- 3. Itens
INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Bacalhau à Lagareiro', 'Lombo alto de bacalhau assado no forno com batatas a murro.', 18.50, 'Pratos Principais', true, 'https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Hambúrguer Gourmet', 'Carne 100% Angus, queijo cheddar, bacon crocante.', 14.00, 'Pratos Principais', true, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Risotto de Cogumelos', 'Arroz arbóreo cremoso com mix de cogumelos.', 16.00, 'Pratos Principais', true, 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Cheesecake de Frutos Vermelhos', 'Base de bolacha crocante com creme de queijo.', 5.00, 'Sobremesas', true, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Mousse de Chocolate', 'Intensa, cremosa e feita com chocolate 70%.', 4.50, 'Sobremesas', true, 'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Limonada da Casa', 'Refrescante, com limões do nosso pomar e hortelã.', 3.00, 'Bebidas', true, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';

INSERT INTO "menu_items" ("restaurant_id", "name", "description", "price", "category", "available", "image_url")
SELECT id, 'Cocktail de Verão', 'Gin, tónica e frutos vermelhos.', 8.50, 'Bebidas', true, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800&auto=format&fit=crop'
FROM "restaurants" WHERE slug = 'exemplo';
