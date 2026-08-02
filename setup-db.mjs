import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Parse .env file properly
const envContent = readFileSync('.env', 'utf-8')
const envLines = envContent.split('\n').filter(l => l.trim() && !l.startsWith('#'))
const env = {}
for (const line of envLines) {
  const idx = line.indexOf('=')
  if (idx > 0) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
}

const DATABASE_URL = env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function runSchema() {
  try {
    console.log('🚀 Running V2 schema migration...\n')

    // ==================== DROP OLD TABLES ====================
    await sql`DROP TABLE IF EXISTS blocked_students CASCADE`
    await sql`DROP TABLE IF EXISTS grades CASCADE`
    await sql`DROP TABLE IF EXISTS results CASCADE`
    await sql`DROP TABLE IF EXISTS questions CASCADE`
    await sql`DROP TABLE IF EXISTS settings CASCADE`
    await sql`DROP TABLE IF EXISTS users CASCADE`
    console.log('✅ Dropped old tables')

    // ==================== USERS ====================
    await sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nama TEXT NOT NULL,
        kelas TEXT,
        role TEXT DEFAULT 'siswa',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Table: users')

    // ==================== QUESTIONS ====================
    await sql`
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
      )
    `
    console.log('✅ Table: questions')

    // ==================== RESULTS ====================
    // JSONB architecture: 1 baris = 1 siswa per ujian (kode_soal)
    // jawaban_siswa JSONB format: {"1":{"jawaban":"A","status":"benar","nilai":100}, ...}
    await sql`
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
      )
    `
    console.log('✅ Table: results (JSONB)')

    // ==================== GRADES ====================
    await sql`
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
      )
    `
    console.log('✅ Table: grades')

    // ==================== SETTINGS ====================
    await sql`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Table: settings')

    // ==================== BLOCKED STUDENTS ====================
    await sql`
      CREATE TABLE blocked_students (
        id SERIAL PRIMARY KEY,
        block_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        exam_code TEXT,
        blocked_at TIMESTAMP DEFAULT NOW()
      )
    `
    console.log('✅ Table: blocked_students')

    // ==================== INDEXES ====================
    await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`
    await sql`CREATE INDEX IF NOT EXISTS idx_questions_kode ON questions(kode)`
    await sql`CREATE INDEX IF NOT EXISTS idx_questions_mata_pelajaran ON questions(mata_pelajaran)`
    await sql`CREATE INDEX IF NOT EXISTS idx_questions_kelas ON questions(kelas)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_result_id ON results(result_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_username ON results(username)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_kelas ON results(kelas)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_mata_pelajaran ON results(mata_pelajaran)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_kode_soal ON results(kode_soal)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_submitted ON results(submitted_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_results_jawaban ON results USING GIN (jawaban_siswa)`
    await sql`CREATE INDEX IF NOT EXISTS idx_grades_grade_id ON grades(grade_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_grades_username ON grades(username)`
    await sql`CREATE INDEX IF NOT EXISTS idx_grades_kelas ON grades(kelas)`
    await sql`CREATE INDEX IF NOT EXISTS idx_grades_kode_soal ON grades(kode_soal)`
    await sql`CREATE INDEX IF NOT EXISTS idx_blocked_students_username ON blocked_students(username)`
    await sql`CREATE INDEX IF NOT EXISTS idx_blocked_students_exam_code ON blocked_students(exam_code)`
    console.log('✅ Indexes created')

    // ==================== SEED DATA ====================
    await sql`
      INSERT INTO users (username, password, nama, kelas, role)
      VALUES ('admin', 'admin123', 'Administrator', NULL, 'admin')
      ON CONFLICT (username) DO NOTHING
    `
    await sql`
      INSERT INTO settings (key, value)
      VALUES ('examConfig', '{"durationMinutes": 60, "shuffle": true}')
      ON CONFLICT (key) DO NOTHING
    `
    console.log('✅ Seed data inserted')

    // ==================== VERIFY ====================
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    console.log('\n📋 Tables in database:')
    tables.forEach(t => console.log('   -', t.table_name))

    const userCount = await sql`SELECT COUNT(*) as count FROM users`
    console.log('\n👥 Users:', userCount[0].count)

    const settingsCount = await sql`SELECT COUNT(*) as count FROM settings`
    console.log('⚙️ Settings:', settingsCount[0].count)

    console.log('\n🎉 V2 Schema migration complete!')

  } catch (error) {
    console.error('❌ Error:', error.message || error)
    console.error(error)
  }
}

runSchema()
