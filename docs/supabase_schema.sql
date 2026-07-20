-- Esquema de Base de Datos para el Sistema de Recursos Humanos
-- Puedes ejecutar esto directamente en el editor SQL de tu panel de Supabase.

-- Habilitar extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Exámenes (CRUD por el administrador)
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_psychometric BOOLEAN DEFAULT false,
  parts JSONB DEFAULT '[]'::jsonb, -- Estructura de secciones y preguntas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Candidatos Activos (Habilitados para hacer examen en el día)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  assigned_exams JSONB DEFAULT '[]'::jsonb, -- Lista de exámenes asignados: [{id: "...", name: "..."}]
  status TEXT DEFAULT 'pending', -- 'pending' (activo) o 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Resultados de Exámenes y Perfiles Guardados
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  candidate_info JSONB DEFAULT '{}'::jsonb, -- Formulario de datos personales
  position TEXT, -- Vacante/Puesto
  psychometric_answers JSONB DEFAULT '{}'::jsonb, -- Respuestas del examen psicométrico
  technical_answers JSONB DEFAULT '{}'::jsonb, -- Respuestas del examen técnico/profesión
  assigned_exam_name TEXT,
  score NUMERIC DEFAULT 0, -- Puntaje obtenido en examen técnico
  max_score NUMERIC DEFAULT 0, -- Puntaje máximo posible en examen técnico
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla para el Formulario de Registro Dinámico de Candidatos (CRUD por RH)
CREATE TABLE IF NOT EXISTS registration_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Formulario Estándar',
  fields JSONB DEFAULT '[]'::jsonb, -- Arreglo de campos personalizados creados por RH
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de Usuarios Internos/Permanentes de la Empresa (CRUD por RH)
CREATE TABLE IF NOT EXISTS company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'Admin', 'RH', 'Técnico', 'Diseño Gráfico', 'Ventas', 'Closers', 'Openers', 'Customer Service', 'Programador'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HABILITAR SEGURIDAD RLS Y PERMITIR OPERACIONES PÚBLICAS (Para bypass de políticas de seguridad en pruebas)
-- Habilita RLS en las tablas
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso libre para simplificar el anon key
DROP POLICY IF EXISTS "Public exams policy" ON exams;
CREATE POLICY "Public exams policy" ON exams FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public candidates policy" ON candidates;
CREATE POLICY "Public candidates policy" ON candidates FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public results policy" ON results;
CREATE POLICY "Public results policy" ON results FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public registration_forms policy" ON registration_forms;
CREATE POLICY "Public registration_forms policy" ON registration_forms FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public company_users policy" ON company_users;
CREATE POLICY "Public company_users policy" ON company_users FOR ALL TO public USING (true) WITH CHECK (true);

-- NOTA PARA EL ADMINISTRADOR / ACTUALIZACIÓN DE ROLES:
-- Si ya tienes la tabla 'company_users' en tu base de datos de Supabase, NO es necesario volver a crearla
-- ni borrarla (lo cual daría error de "la tabla ya existe" o borraría tus datos existentes).
-- Como la columna 'role' es de tipo TEXT, acepta de forma nativa los nuevos roles:
-- ('Diseño Gráfico', 'Ventas', 'Closers', 'Openers', 'Customer Service', 'Programador')
-- sin requerir ninguna modificación o alteración estructural en la base de datos.
-- El siguiente comando ALTER es 100% seguro de ejecutar y garantiza que la columna acepte texto de forma ilimitada:
-- ALTER TABLE company_users ALTER COLUMN role TYPE TEXT;
