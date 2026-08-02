-- Migration: Add classes + subjects tables (safe — IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_nama ON classes(nama);
CREATE INDEX IF NOT EXISTS idx_subjects_nama ON subjects(nama);

-- Seed default classes (matching frontend hardcoded array)
INSERT INTO classes (nama) VALUES ('4A'),('4B'),('4C'),('5A'),('5B'),('5C'),('6A'),('6B'),('6C')
ON CONFLICT (nama) DO NOTHING;

-- Seed default subjects (matching frontend hardcoded array)
INSERT INTO subjects (nama) VALUES 
  ('Bahasa Indonesia'),('Bahasa Inggris'),('Matematika'),('Pendidikan Agama Islam'),
  ('Pendidikan Agama Kristen'),('Pendidikan Agama Katolik'),('PPKn'),('IPAS'),
  ('Seni Budaya'),('PJOK'),('Bahasa Jawa'),('Informatika'),('Muatan Lokal'),('Budi Pekerti')
ON CONFLICT (nama) DO NOTHING;
