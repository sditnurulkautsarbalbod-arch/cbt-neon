-- CBT Application Database Schema V2 — Matches Frontend Data Model
-- Drop old tables and recreate with Indonesian column names

-- ==================== DROP OLD TABLES ====================
DROP TABLE IF EXISTS blocked_students CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==================== USERS ====================
-- Frontend fields: username, password, nama, kelas, role (admin/guru/siswa)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nama TEXT NOT NULL,
  kelas TEXT,
  role TEXT DEFAULT 'siswa',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== QUESTIONS ====================
-- Frontend fields: kode, mataPelajaran, kelas, pertanyaan, opsiJawaban, kunciJawaban, tipeSoal, gambarSoal, gambarOpsi
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  kode TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  kelas TEXT,
  pertanyaan TEXT NOT NULL,
  opsi_jawaban JSONB,
  kunci_jawaban TEXT,
  tipe_soal TEXT DEFAULT 'pilihan_ganda',
  gambar_soal TEXT,
  gambar_opsi JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== RESULTS ====================
-- JSONB architecture: 1 baris = 1 siswa per ujian (kode_soal)
-- jawaban_siswa JSONB format: {"1":{"jawaban":"A","status":"benar","nilai":100}, "2":{...}, ...}
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  result_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  nama_siswa TEXT,
  kelas TEXT,
  mata_pelajaran TEXT,
  kode_soal TEXT,
  total_soal INT DEFAULT 0,
  total_benar INT DEFAULT 0,
  total_salah INT DEFAULT 0,
  total_skor NUMERIC DEFAULT 0,
  jawaban_siswa JSONB NOT NULL DEFAULT '{}',
  waktu_pengerjaan TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- ==================== GRADES ====================
-- Frontend fields: gradeId, namaSiswa, username, kelas, mataPelajaran, kodeSoal, nilai, grade, keterangan, semester, tahunAjaran
CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  grade_id TEXT UNIQUE NOT NULL,
  nama_siswa TEXT,
  username TEXT,
  kelas TEXT,
  mata_pelajaran TEXT,
  kode_soal TEXT,
  nilai NUMERIC,
  grade TEXT,
  keterangan TEXT,
  semester TEXT,
  tahun_ajaran TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SETTINGS ====================
-- Frontend: key='examConfig', value={durationMinutes: 60}
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== BLOCKED STUDENTS ====================
-- Frontend fields: blockId, username, examCode, blockedAt
CREATE TABLE blocked_students (
  id SERIAL PRIMARY KEY,
  block_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  exam_code TEXT,
  blocked_at TIMESTAMP DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_questions_kode ON questions(kode);
CREATE INDEX IF NOT EXISTS idx_questions_mata_pelajaran ON questions(mata_pelajaran);
CREATE INDEX IF NOT EXISTS idx_questions_kelas ON questions(kelas);
CREATE INDEX IF NOT EXISTS idx_results_result_id ON results(result_id);
CREATE INDEX IF NOT EXISTS idx_results_username ON results(username);
CREATE INDEX IF NOT EXISTS idx_results_kelas ON results(kelas);
CREATE INDEX IF NOT EXISTS idx_results_mata_pelajaran ON results(mata_pelajaran);
CREATE INDEX IF NOT EXISTS idx_results_kode_soal ON results(kode_soal);
CREATE INDEX IF NOT EXISTS idx_results_submitted ON results(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_grades_grade_id ON grades(grade_id);
CREATE INDEX IF NOT EXISTS idx_grades_username ON grades(username);
CREATE INDEX IF NOT EXISTS idx_grades_kelas ON grades(kelas);
CREATE INDEX IF NOT EXISTS idx_grades_kode_soal ON grades(kode_soal);
CREATE INDEX IF NOT EXISTS idx_blocked_students_username ON blocked_students(username);
CREATE INDEX IF NOT EXISTS idx_blocked_students_exam_code ON blocked_students(exam_code);
CREATE INDEX IF NOT EXISTS idx_classes_nama ON classes(nama);
CREATE INDEX IF NOT EXISTS idx_subjects_nama ON subjects(nama);

-- ==================== CLASSES ====================
-- Admin-managed classes (replaces hardcoded array)
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SUBJECTS (MATA PELAJARAN) ====================
-- Admin-managed subjects (replaces hardcoded array)
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== SEED DATA ====================
INSERT INTO users (username, password, nama, kelas, role)
VALUES ('admin', 'admin123', 'Administrator', NULL, 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('examConfig', '{"durationMinutes": 60, "shuffle": true}')
ON CONFLICT (key) DO NOTHING;
