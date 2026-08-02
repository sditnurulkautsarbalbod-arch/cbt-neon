import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8')
const firstEqIndex = envContent.indexOf('=')
const DATABASE_URL = envContent.slice(firstEqIndex + 1).replace(/\nIMGBB_API_KEY=.*/, '').trim()

const sql = neon(DATABASE_URL)

try {
  await sql`SELECT 1`
  console.log('✅ DB connection OK')
  
  const users = await sql`SELECT * FROM users`
  console.log(`✅ users: ${users.length} rows`, users.length > 0 ? JSON.stringify(users[0]) : '(empty)')
  
  const settings = await sql`SELECT * FROM settings`
  console.log(`✅ settings: ${settings.length} rows`, settings.length > 0 ? JSON.stringify(settings[0]) : '(empty)')
  
  const questions = await sql`SELECT count(*) as c FROM questions`
  console.log(`✅ questions: ${questions[0].c} rows`)
  
  const results = await sql`SELECT count(*) as c FROM results`
  console.log(`✅ results: ${results[0].c} rows`)
  
  const grades = await sql`SELECT count(*) as c FROM grades`
  console.log(`✅ grades: ${grades[0].c} rows`)
  
  const blocked = await sql`SELECT count(*) as c FROM blocked_students`
  console.log(`✅ blocked_students: ${blocked[0].c} rows`)
  
  console.log('\n🎉 All 6 tables accessible!')
} catch (e) {
  console.error('❌ Error:', e.message)
}
