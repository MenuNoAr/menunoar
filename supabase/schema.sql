-- TABELA: Restaurantes
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  menu_type TEXT DEFAULT 'digital', -- 'digital' ou 'pdf'
  pdf_url TEXT,
  cover_url TEXT,
  
  -- Informação de contacto/detalhes
  phone TEXT,
  address TEXT,
  wifi_password TEXT,
  
  -- Design
  font TEXT DEFAULT 'Inter',
  category_order JSONB DEFAULT '[]'::jsonb,
  category_images JSONB DEFAULT '{}'::jsonb,
  
  -- Subscrição
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'trialing',
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT owner_id_match CHECK (auth.uid() = owner_id)
);

-- TABELA: Itens do Menu
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  category TEXT NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA: Contactos (Landing Page)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  service TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security)

-- Restaurantes: Dono pode fazer tudo, público pode ver
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono pode gerir o seu restaurante" 
ON restaurants FOR ALL 
USING (auth.uid() = owner_id);

CREATE POLICY "Público pode ver detalhes do restaurante" 
ON restaurants FOR SELECT 
USING (true);

-- Menu Items: Dono pode gerir, público pode ver
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono pode gerir itens" 
ON menu_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE id = menu_items.restaurant_id 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Público pode ver itens" 
ON menu_items FOR SELECT 
USING (true);

-- Contactos: Público pode inserir, admin pode ver
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público pode enviar contacto" 
ON contacts FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Apenas admin pode ver contactos" 
ON contacts FOR SELECT 
USING (auth.jwt() ->> 'email' = 'admin@teste.com'); -- Exemplo de filtro por email admin
