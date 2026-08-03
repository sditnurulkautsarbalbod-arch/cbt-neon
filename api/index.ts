import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { neon } from '@neondatabase/serverless'

const app = new Hono()
const sql = neon(process.env.DATABASE_URL!)

// Enable CORS
app.use('/*', cors())

// ==================== GAS-COMPATIBLE API ====================
// Single endpoint that mirrors the Google Apps Script interface
// GET  /api/gas?action=xxx&param=value
// POST /api/gas  body: { action: 'xxx', data: {...} }
// Response: { status: 'success'|'error', data: ..., message?: string }

// Handle all GET requests (mirrors GAS GET)
app.get('/api/gas', async (c) => {
  try {
    const url = new URL(c.req.url)
    const action = url.searchParams.get('action')
    const params: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      if (key !== 'action') params[key] = value
    })

    switch (action) {
      case 'getUsers': return handleGetUsers(c)
      case 'getQuestions': return handleGetQuestions(c, params)
      case 'getResults': return handleGetResults(c, params)
      case 'getGrades': return handleGetGrades(c, params)
      case 'getClasses': return handleGetClasses(c)
      case 'getSubjects': return handleGetSubjects(c)
      default:
        return c.json({ status: 'error', message: `Unknown action: ${action}` }, 400)
    }
  } catch (error: any) {
    console.error('GET error:', error)
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// Handle all POST requests (mirrors GAS POST — add/update/delete)
app.post('/api/gas', async (c) => {
  try {
    const body = await c.req.json()
    const { action, data } = body

    switch (action) {
      // ========== USERS ==========
      case 'addUser': return handleAddUser(c, data)
      case 'addUsersBulk': return handleAddUsersBulk(c, data)
      case 'updateUser': return handleUpdateUser(c, data)
      case 'deleteUser': return handleDeleteUser(c, data)

      // ========== QUESTIONS ==========
      case 'addQuestion': return handleAddQuestion(c, data)
      case 'addQuestionsBatch': return handleAddQuestionsBatch(c, data)
      case 'updateQuestion': return handleUpdateQuestion(c, data)
      case 'deleteQuestion': return handleDeleteQuestion(c, data)
      case 'deleteQuestionsBatch': return handleDeleteQuestionsBatch(c, data)

      // ========== RESULTS ==========
      case 'addResults': return handleAddResults(c, data)
      case 'updateResult': return handleUpdateResult(c, data)
      case 'deleteResult': return handleDeleteResult(c, data)
      case 'deleteResults': return handleDeleteResults(c, data)

      // ========== GRADES ==========
      case 'addGrade': return handleAddGrade(c, data)
      case 'addGrades': return handleAddGrades(c, data)
      case 'updateGrade': return handleUpdateGrade(c, data)
      case 'deleteGrade': return handleDeleteGrade(c, data)

      // ========== CLASSES ==========
      case 'addClass': return handleAddClass(c, data)
      case 'updateClass': return handleUpdateClass(c, data)
      case 'deleteClass': return handleDeleteClass(c, data)

      // ========== SUBJECTS ==========
      case 'addSubject': return handleAddSubject(c, data)
      case 'updateSubject': return handleUpdateSubject(c, data)
      case 'deleteSubject': return handleDeleteSubject(c, data)

      // ========== CLEANUP (admin) ==========
      case 'deleteResultsByKodeSoal': {
        const deleted = await sql`DELETE FROM results WHERE kode_soal = ${data.kodeSoal}`
        return c.json({ status: 'success', deleted: deleted.length })
      }
      case 'deleteGradesByKodeSoal': {
        const deleted = await sql`DELETE FROM grades WHERE kode_soal = ${data.kodeSoal}`
        return c.json({ status: 'success', deleted: deleted.length })
      }
      case 'deleteUsersByPrefix': {
        const deleted = await sql`DELETE FROM users WHERE username LIKE ${data.prefix + '%'}`
        return c.json({ status: 'success', deleted: deleted.length })
      }

      // ========== BULK OPERATIONS ==========
      case 'deleteUsersBulk': {
        const usernames: string[] = data.usernames
        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
          return c.json({ status: 'error', message: 'usernames array required' }, 400)
        }
        let deletedCount = 0
        for (const username of usernames) {
          const result = await sql`DELETE FROM users WHERE username = ${username}`
          deletedCount += result.length
        }
        return c.json({ status: 'success', data: { deleted: deletedCount } })
      }
      case 'updateUsersClassBulk': {
        const usernames: string[] = data.usernames
        const newKelas: string = data.kelas
        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
          return c.json({ status: 'error', message: 'usernames array required' }, 400)
        }
        if (!newKelas) {
          return c.json({ status: 'error', message: 'kelas required' }, 400)
        }
        let updatedCount = 0
        for (const username of usernames) {
          const result = await sql`UPDATE users SET kelas = ${newKelas} WHERE username = ${username}`
          updatedCount += result.length
        }
        return c.json({ status: 'success', data: { updated: updatedCount } })
      }
      case 'deleteUsersByClass': {
        const kelas: string = data.kelas
        if (!kelas) {
          return c.json({ status: 'error', message: 'kelas required' }, 400)
        }
        const deleted = await sql`DELETE FROM users WHERE kelas = ${kelas} AND role != 'admin'`
        return c.json({ status: 'success', data: { deleted: deleted.length } })
      }
      case 'updateUsersClassByClass': {
        const fromKelas: string = data.fromKelas
        const toKelas: string = data.toKelas
        if (!fromKelas || !toKelas) {
          return c.json({ status: 'error', message: 'fromKelas and toKelas required' }, 400)
        }
        const updated = await sql`UPDATE users SET kelas = ${toKelas} WHERE kelas = ${fromKelas} AND role != 'admin'`
        return c.json({ status: 'success', data: { updated: updated.length } })
      }

      default:
        return c.json({ status: 'error', message: `Unknown action: ${action}` }, 400)
    }
  } catch (error: any) {
    console.error('POST error:', error)
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== FIREBASE-COMPATIBLE ENDPOINTS ====================
// Settings (replaces Firebase SettingsRemote)
app.get('/api/settings', async (c) => {
  try {
    const result = await sql`SELECT * FROM settings`
    const settings: Record<string, any> = {}
    result.forEach((row: any) => { settings[row.key] = row.value })
    return c.json({ status: 'success', data: settings })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.get('/api/settings/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const result = await sql`SELECT * FROM settings WHERE key = ${key}`
    return c.json({ status: 'success', data: result[0]?.value || null })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.put('/api/settings/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const body = await c.req.json()
    const value = body.value !== undefined ? body.value : body
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
    `
    return c.json({ status: 'success', data: { key, value } })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// Blocked Students (replaces Firebase BlockedStudentsRemote)
app.get('/api/blocked-students', async (c) => {
  try {
    const result = await sql`SELECT * FROM blocked_students ORDER BY blocked_at DESC`
    return c.json({ status: 'success', data: result })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.post('/api/blocked-students', async (c) => {
  try {
    const body = await c.req.json()
    const blockId = body.blockId || `block-${body.username}-${body.examCode}-${Date.now()}`
    const result = await sql`
      INSERT INTO blocked_students (block_id, username, exam_code, blocked_at)
      VALUES (${blockId}, ${body.username}, ${body.examCode || body.exam_code}, ${body.blockedAt || new Date().toISOString()})
      ON CONFLICT (block_id) DO UPDATE SET blocked_at = ${body.blockedAt || new Date().toISOString()}
      RETURNING *
    `
    return c.json({ status: 'success', data: result[0] })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.delete('/api/blocked-students', async (c) => {
  try {
    const url = new URL(c.req.url)
    const username = url.searchParams.get('username')
    const examCode = url.searchParams.get('examCode')

    if (username && examCode) {
      // Delete one
      await sql`DELETE FROM blocked_students WHERE username = ${username} AND exam_code = ${examCode}`
    } else {
      // Delete all
      await sql`DELETE FROM blocked_students`
    }
    return c.json({ status: 'success', data: null })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== IMAGE UPLOAD ====================
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.json()
    const { image } = body

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: process.env.IMGBB_API_KEY!,
        image: image
      }).toString()
    })

    const result = await response.json()

    if (result.success) {
      return c.json({
        status: 'success',
        data: {
          url: result.data.url,
          display_url: result.data.display_url
        }
      })
    } else {
      return c.json({ status: 'error', message: 'Upload failed' }, 500)
    }
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (c) => {
  try {
    await sql`SELECT 1`
    return c.json({ status: 'success', data: { database: 'connected' } })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== HANDLER FUNCTIONS ====================

// ---- USERS ----
async function handleGetUsers(c: any) {
  const result = await sql`SELECT * FROM users ORDER BY id`
  return c.json({ status: 'success', data: result })
}

async function handleAddUser(c: any, data: any) {
  const result = await sql`
    INSERT INTO users (username, password, nama, kelas, role)
    VALUES (${data.username}, ${data.password}, ${data.nama}, ${data.kelas}, ${data.role || 'siswa'})
    RETURNING *
  `
  return c.json({ status: 'success', data: result[0] })
}

async function handleAddUsersBulk(c: any, data: any) {
  const users = Array.isArray(data) ? data : data.users
  if (!Array.isArray(users) || users.length === 0) {
    return c.json({ status: 'error', message: 'Data harus berupa array users' }, 400)
  }

  const results: any[] = []
  const errors: any[] = []

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    try {
      if (!u.username || !u.password || !u.nama || !u.kelas) {
        errors.push({ index: i + 1, username: u.username || '?', error: 'Field wajib kurang: username, password, nama, kelas' })
        continue
      }
      const result = await sql`
        INSERT INTO users (username, password, nama, kelas, role)
        VALUES (${u.username}, ${u.password}, ${u.nama}, ${u.kelas}, ${u.role || 'siswa'})
        RETURNING *
      `
      results.push(result[0])
    } catch (e: any) {
      errors.push({ index: i + 1, username: u.username || '?', error: e.message })
    }
  }

  return c.json({
    status: errors.length === 0 ? 'success' : 'partial',
    data: { inserted: results.length, failed: errors.length },
    errors: errors.length > 0 ? errors : undefined,
    message: `${results.length} user berhasil ditambahkan${errors.length > 0 ? `, ${errors.length} gagal` : ''}`
  })
}

async function handleUpdateUser(c: any, data: any) {
  // Update by username (not ID, matching GAS behavior)
  const result = await sql`
    UPDATE users 
    SET nama = ${data.nama}, kelas = ${data.kelas}, role = ${data.role}, password = COALESCE(${data.password}, password)
    WHERE username = ${data.username}
    RETURNING *
  `
  if (result.length === 0) {
    return c.json({ status: 'error', message: 'User not found' }, 404)
  }
  return c.json({ status: 'success', data: result[0] })
}

async function handleDeleteUser(c: any, data: any) {
  await sql`DELETE FROM users WHERE username = ${data.username}`
  return c.json({ status: 'success', data: null })
}

// ---- QUESTIONS ----
// Map DB snake_case columns to frontend camelCase field names
function mapQuestion(row: any) {
  const opsiJawaban = row.opsi_jawaban || []
  const kunciJawaban = row.kunci_jawaban || null
  
  // Compute correct option index for pilihan_ganda
  // kunci_jawaban could be "A" (index 0), "B" (index 1), etc. or the actual text
  let correct = null
  if (row.tipe_soal === 'pilihan_ganda' && kunciJawaban && Array.isArray(opsiJawaban)) {
    // Try letter-based: "A" → 0, "B" → 1, etc.
    if (/^[A-Z]$/i.test(kunciJawaban)) {
      correct = kunciJawaban.toUpperCase().charCodeAt(0) - 65
    } else {
      // Try text match: find the option that matches the answer
      const idx = opsiJawaban.findIndex((opt: string) => opt === kunciJawaban)
      if (idx !== -1) correct = idx
    }
  }
  
  return {
    id: row.id,
    kode: row.kode,
    mataPelajaran: row.mata_pelajaran,
    kelas: row.kelas,
    pertanyaan: row.pertanyaan,
    pilihan: opsiJawaban,
    jawabanBenar: kunciJawaban,
    tipe: row.tipe_soal,
    gambarSoal: row.gambar_soal,
    gambarOpsi: row.gambar_opsi,
    correct
  }
}

async function handleGetQuestions(c: any, params: Record<string, string>) {
  const kode = params.kode

  if (kode) {
    const result = await sql`SELECT * FROM questions WHERE kode = ${kode} ORDER BY id`
    return c.json({ status: 'success', data: result.map(mapQuestion) })
  }

  const result = await sql`SELECT * FROM questions ORDER BY id`
  return c.json({ status: 'success', data: result.map(mapQuestion) })
}

async function handleAddQuestion(c: any, data: any) {
  // Accept both frontend camelCase and backend snake_case field names
  const opsiJawaban = data.opsiJawaban || data.pilihan || []
  const kunciJawaban = data.kunciJawaban || data.jawabanBenar || null
  const tipeSoal = data.tipeSoal || data.tipe || 'pilihan_ganda'
  const gambarSoal = data.gambarSoal || data.gambar || null
  const gambarOpsi = data.gambarOpsi || null
  
  const result = await sql`
    INSERT INTO questions (kode, mata_pelajaran, kelas, pertanyaan, opsi_jawaban, kunci_jawaban, tipe_soal, gambar_soal, gambar_opsi)
    VALUES (${data.kode}, ${data.mataPelajaran}, ${data.kelas}, ${data.pertanyaan},
            ${JSON.stringify(opsiJawaban)}, ${kunciJawaban}, ${tipeSoal},
            ${gambarSoal}, ${JSON.stringify(gambarOpsi)})
    RETURNING *
  `
  return c.json({ status: 'success', data: mapQuestion(result[0]) })
}

async function handleAddQuestionsBatch(c: any, dataArray: any[]) {
  const results = []
  for (const data of dataArray) {
    const opsiJawaban = data.opsiJawaban || data.pilihan || []
    const kunciJawaban = data.kunciJawaban || data.jawabanBenar || null
    const tipeSoal = data.tipeSoal || data.tipe || 'pilihan_ganda'
    const gambarSoal = data.gambarSoal || data.gambar || null
    const gambarOpsi = data.gambarOpsi || null
    
    const result = await sql`
      INSERT INTO questions (kode, mata_pelajaran, kelas, pertanyaan, opsi_jawaban, kunci_jawaban, tipe_soal, gambar_soal, gambar_opsi)
      VALUES (${data.kode}, ${data.mataPelajaran}, ${data.kelas}, ${data.pertanyaan},
              ${JSON.stringify(opsiJawaban)}, ${kunciJawaban}, ${tipeSoal},
              ${gambarSoal}, ${JSON.stringify(gambarOpsi)})
      RETURNING *
    `
    results.push(result[0])
  }
  return c.json({ status: 'success', data: results })
}

async function handleUpdateQuestion(c: any, data: any) {
  const opsiJawaban = data.opsiJawaban || data.pilihan || []
  const kunciJawaban = data.kunciJawaban || data.jawabanBenar || null
  const tipeSoal = data.tipeSoal || data.tipe || 'pilihan_ganda'
  const gambarSoal = data.gambarSoal || data.gambar || null
  const gambarOpsi = data.gambarOpsi || null
  
  const result = await sql`
    UPDATE questions 
    SET kode = ${data.kode}, mata_pelajaran = ${data.mataPelajaran}, kelas = ${data.kelas},
        pertanyaan = ${data.pertanyaan}, opsi_jawaban = ${JSON.stringify(opsiJawaban)},
        kunci_jawaban = ${kunciJawaban}, tipe_soal = ${tipeSoal},
        gambar_soal = ${gambarSoal}, gambar_opsi = ${JSON.stringify(gambarOpsi)}
    WHERE id = ${data.id}
    RETURNING *
  `
  if (result.length === 0) {
    return c.json({ status: 'error', message: 'Question not found' }, 404)
  }
  return c.json({ status: 'success', data: mapQuestion(result[0]) })
}

async function handleDeleteQuestion(c: any, data: any) {
  await sql`DELETE FROM questions WHERE id = ${data.id}`
  return c.json({ status: 'success', data: null })
}

async function handleDeleteQuestionsBatch(c: any, data: any) {
  const ids = data.ids || []
  if (ids.length > 0) {
    await sql`DELETE FROM questions WHERE id = ANY(${ids})`
  }
  return c.json({ status: 'success', data: null })
}

// ---- RESULTS (JSONB Architecture) ----
// 1 baris = 1 siswa per ujian (kode_soal)
// jawaban_siswa JSONB: {"1":{"jawaban":"A","status":"benar","nilai":100}, ...}

async function handleGetResults(c: any, params: Record<string, string>) {
  let conditions: string[] = []
  let values: any[] = []

  if (params.kodeSoal || params.kodesoal) {
    conditions.push(`kode_soal = $${values.length + 1}`)
    values.push(params.kodeSoal || params.kodesoal)
  }
  if (params.mataPelajaran) {
    conditions.push(`mata_pelajaran = $${values.length + 1}`)
    values.push(params.mataPelajaran)
  }
  if (params.kelas) {
    conditions.push(`kelas = $${values.length + 1}`)
    values.push(params.kelas)
  }
  if (params.namaLengkap || params.namaSiswa) {
    conditions.push(`nama_siswa ILIKE $${values.length + 1}`)
    values.push(`%${params.namaLengkap || params.namaSiswa}%`)
  }
  if (params.username) {
    conditions.push(`username = $${values.length + 1}`)
    values.push(params.username)
  }
  if (params.tahunAjaran) {
    // Legacy filter — no longer stored as column, but kept for backward compat
  }
  if (params.semester) {
    // Same as above
  }

  let query = 'SELECT * FROM results'
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY submitted_at DESC'

  const dbRows = await sql(query, values)

  // FLATTEN JSONB → individual rows (backward compatible with frontend)
  // Each exam row becomes N rows (one per question in jawaban_siswa)
  const flatRows: any[] = []
  for (const row of dbRows) {
    const jawaban = (typeof row.jawaban_siswa === 'string' ? JSON.parse(row.jawaban_siswa) : row.jawaban_siswa) || {}
    const entries = Object.entries(jawaban)

    if (entries.length === 0) {
      // Fallback: no jawaban_siswa data, return row as-is
      flatRows.push({
        resultId: row.result_id,
        namaLengkap: row.nama_siswa,
        username: row.username,
        kelas: row.kelas,
        mataPelajaran: row.mata_pelajaran,
        kodesoal: row.kode_soal,
        noSoal: null,
        pertanyaan: null,
        jawabanSiswa: null,
        status: null,
        nilai: null,
        timestamp: row.submitted_at,
        waktuPengerjaan: row.waktu_pengerjaan,
        totalSoal: row.total_soal,
        totalBenar: row.total_benar,
        totalSalah: row.total_salah,
        totalSkor: row.total_skor
      })
      continue
    }

    for (const [noSoal, entry] of entries) {
      const e = entry as any
      flatRows.push({
        resultId: `${row.result_id}-${noSoal}`,
        namaLengkap: row.nama_siswa,
        username: row.username,
        kelas: row.kelas,
        mataPelajaran: row.mata_pelajaran,
        kodesoal: row.kode_soal,
        noSoal: parseInt(noSoal) || noSoal,
        pertanyaan: e.pertanyaan || null,
        jawabanSiswa: e.jawaban || null,
        status: e.status || null,
        nilai: e.nilai ?? null,
        timestamp: row.submitted_at,
        waktuPengerjaan: row.waktu_pengerjaan,
        totalSoal: row.total_soal,
        totalBenar: row.total_benar,
        totalSalah: row.total_salah,
        totalSkor: row.total_skor,
        // Keep original resultId for operations (edit/delete)
        _originalResultId: row.result_id
      })
    }
  }

  return c.json({ status: 'success', data: flatRows })
}

async function handleAddResults(c: any, dataArray: any[]) {
  // New JSONB architecture: expects array with 1 entry per student per exam
  // Each entry: { username, namaSiswa, kelas, mataPelajaran, kodeSoal, jawabanSiswa: {"1":{...}, ...}, waktuPengerjaan }
  const results = []
  for (const data of dataArray) {
    const resultId = data.resultId || `res-${data.username}-${data.kodeSoal}-${Date.now()}`
    const jawaban = data.jawabanSiswa || {}
    
    // Calculate totals from jawaban_siswa JSONB
    const entries = Object.values(jawaban) as any[]
    const totalSoal = entries.length
    const totalBenar = entries.filter((e: any) => e.status === 'benar').length
    const totalSalah = entries.filter((e: any) => e.status === 'salah').length
    const totalSkor = entries.reduce((sum: number, e: any) => sum + (e.nilai || 0), 0)

    const prevWaktu: string | null = results.length > 0 ? results[0].waktu_pengerjaan : null
    const insertResult: any[] = await sql`
      INSERT INTO results (result_id, username, nama_siswa, kelas, mata_pelajaran, kode_soal, 
                           total_soal, total_benar, total_salah, total_skor, jawaban_siswa, waktu_pengerjaan)
      VALUES (${resultId}, ${data.username}, ${data.namaSiswa || null}, ${data.kelas || null}, 
              ${data.mataPelajaran || null}, ${data.kodeSoal || null},
              ${totalSoal}, ${totalBenar}, ${totalSalah}, ${totalSkor},
              ${JSON.stringify(jawaban)}, ${data.waktuPengerjaan || prevWaktu})
      ON CONFLICT (result_id) DO UPDATE SET 
        jawaban_siswa = ${JSON.stringify(jawaban)},
        total_soal = ${totalSoal}, total_benar = ${totalBenar}, 
        total_salah = ${totalSalah}, total_skor = ${totalSkor},
        waktu_pengerjaan = ${data.waktuPengerjaan || prevWaktu}
      RETURNING *
    `
    results.push(insertResult[0])
  }
  return c.json({ status: 'success', data: results })
}

function extractOriginalResultId(flattenedId: string): { originalId: string; noSoal: string | null } {
  // Flattened format: "res-timestamp-username-code-noSoal" → extract original + noSoal
  // Original format: "res-timestamp-username-code" (no noSoal suffix)
  const parts = flattenedId.split('-')
  // If last part is a number, it's the noSoal suffix from flattening
  if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
    const noSoal = parts.pop()!
    return { originalId: parts.join('-'), noSoal }
  }
  return { originalId: flattenedId, noSoal: null }
}

async function handleUpdateResult(c: any, data: any) {
  if (!data.resultId) {
    return c.json({ status: 'error', message: 'resultId is required' }, 400)
  }

  const { originalId, noSoal } = extractOriginalResultId(data.resultId)

  // Fetch current record first (read-modify-write — avoids Neon template literal issues with ::jsonb cast)
  const rows = await sql`SELECT * FROM results WHERE result_id = ${originalId}`
  if (rows.length === 0) {
    return c.json({ status: 'error', message: 'Result not found' }, 404)
  }
  const row = rows[0]
  const jawabanParsed = typeof row.jawaban_siswa === 'string' ? JSON.parse(row.jawaban_siswa) : (row.jawaban_siswa || {})

  // CASE 1: Frontend sends flattened resultId + nilai + status (edit single answer)
  // e.g. { resultId: "res-xxx-3", nilai: 100, status: "benar" }
  if (noSoal && (data.nilai !== undefined || data.status !== undefined)) {
    const existing = jawabanParsed[noSoal] || {}
    if (data.nilai !== undefined) existing.nilai = data.nilai
    if (data.status !== undefined) existing.status = data.status
    if (data.jawaban !== undefined) existing.jawaban = data.jawaban
    jawabanParsed[noSoal] = existing
  }

  // CASE 2: jawabanSiswa merge (batch update via JSONB)
  if (data.jawabanSiswa) {
    Object.assign(jawabanParsed, data.jawabanSiswa)
  }

  // Recalculate totals
  const entries = Object.values(jawabanParsed) as any[]
  const totalBenar = entries.filter((e: any) => e.status === 'benar').length
  const totalSalah = entries.filter((e: any) => e.status === 'salah').length
  const totalSkor = entries.reduce((sum: number, e: any) => sum + (e.nilai || 0), 0)

  // Write back
  const updated = await sql`
    UPDATE results 
    SET jawaban_siswa = ${JSON.stringify(jawabanParsed)},
        total_benar = ${totalBenar},
        total_salah = ${totalSalah},
        total_skor = ${totalSkor}
    WHERE result_id = ${originalId}
    RETURNING *
  `
  return c.json({ status: 'success', data: updated[0] })
}

async function handleDeleteResult(c: any, data: any) {
  const { originalId, noSoal } = extractOriginalResultId(data.resultId)
  
  if (noSoal) {
    // Flattened ID: remove just that entry from JSONB
    const rows = await sql`SELECT * FROM results WHERE result_id = ${originalId}`
    if (rows.length === 0) {
      return c.json({ status: 'error', message: 'Result not found' }, 404)
    }
    const jawabanParsed = typeof rows[0].jawaban_siswa === 'string' ? JSON.parse(rows[0].jawaban_siswa) : (rows[0].jawaban_siswa || {})
    delete jawabanParsed[noSoal]
    
    const entries = Object.values(jawabanParsed) as any[]
    if (entries.length === 0) {
      // No more answers → delete entire row
      await sql`DELETE FROM results WHERE result_id = ${originalId}`
    } else {
      // Recalculate and update
      const totalBenar = entries.filter((e: any) => e.status === 'benar').length
      const totalSalah = entries.filter((e: any) => e.status === 'salah').length
      const totalSkor = entries.reduce((sum: number, e: any) => sum + (e.nilai || 0), 0)
      await sql`
        UPDATE results 
        SET jawaban_siswa = ${JSON.stringify(jawabanParsed)},
            total_benar = ${totalBenar},
            total_salah = ${totalSalah},
            total_skor = ${totalSkor}
        WHERE result_id = ${originalId}
      `
    }
  } else {
    // Original ID: delete entire row
    await sql`DELETE FROM results WHERE result_id = ${originalId}`
  }
  return c.json({ status: 'success', data: null })
}

async function handleDeleteResults(c: any, data: any) {
  const ids = (data.resultIds || []).map((id: string) => extractOriginalResultId(id).originalId)
  if (ids.length > 0) {
    await sql`DELETE FROM results WHERE result_id = ANY(${ids})`
  }
  return c.json({ status: 'success', data: null })
}

// ---- GRADES ----
// Map DB snake_case columns to frontend camelCase field names for grades
function mapGrade(row: any) {
  return {
    gradeId: row.grade_id,
    namaSiswa: row.nama_siswa,
    username: row.username,
    kelas: row.kelas,
    mataPelajaran: row.mata_pelajaran,
    kodeSoal: row.kode_soal,
    nilai: row.nilai,
    grade: row.grade,
    keterangan: row.keterangan,
    semester: row.semester,
    tahunAjaran: row.tahun_ajaran,
    createdAt: row.created_at
  }
}

async function handleGetGrades(c: any, params: Record<string, string>) {
  let conditions: string[] = []
  let values: any[] = []

  if (params.tahunAjaran) {
    conditions.push(`tahun_ajaran = $${values.length + 1}`)
    values.push(params.tahunAjaran)
  }
  if (params.semester) {
    conditions.push(`semester = $${values.length + 1}`)
    values.push(params.semester)
  }
  if (params.kodeSoal || params.kodesoal) {
    conditions.push(`kode_soal = $${values.length + 1}`)
    values.push(params.kodeSoal || params.kodesoal)
  }
  if (params.mataPelajaran) {
    conditions.push(`mata_pelajaran = $${values.length + 1}`)
    values.push(params.mataPelajaran)
  }
  if (params.kelas) {
    conditions.push(`kelas = $${values.length + 1}`)
    values.push(params.kelas)
  }
  if (params.namaLengkap || params.namaSiswa) {
    conditions.push(`nama_siswa ILIKE $${values.length + 1}`)
    values.push(`%${params.namaLengkap || params.namaSiswa}%`)
  }
  if (params.username) {
    conditions.push(`username = $${values.length + 1}`)
    values.push(params.username)
  }

  let query = 'SELECT * FROM grades'
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY created_at DESC'

  const result = await sql(query, values)
  return c.json({ status: 'success', data: result.map(mapGrade) })
}

async function handleAddGrade(c: any, data: any) {
  const gradeId = data.gradeId || `grade-${data.username}-${data.kodeSoal}-${Date.now()}`
  const result = await sql`
    INSERT INTO grades (grade_id, nama_siswa, username, kelas, mata_pelajaran, kode_soal, nilai, grade, keterangan, semester, tahun_ajaran)
    VALUES (${gradeId}, ${data.namaSiswa}, ${data.username}, ${data.kelas}, ${data.mataPelajaran},
            ${data.kodeSoal}, ${data.nilai}, ${data.grade}, ${data.keterangan || null},
            ${data.semester || null}, ${data.tahunAjaran || null})
    ON CONFLICT (grade_id) DO UPDATE SET 
      nilai = ${data.nilai}, grade = ${data.grade}, keterangan = ${data.keterangan || null}
    RETURNING *
  `
  return c.json({ status: 'success', data: mapGrade(result[0]) })
}

async function handleAddGrades(c: any, dataArray: any[]) {
  const results = []
  for (const data of dataArray) {
    const gradeId = data.gradeId || `grade-${data.username}-${data.kodeSoal}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const result = await sql`
      INSERT INTO grades (grade_id, nama_siswa, username, kelas, mata_pelajaran, kode_soal, nilai, grade, keterangan, semester, tahun_ajaran)
      VALUES (${gradeId}, ${data.namaSiswa}, ${data.username}, ${data.kelas}, ${data.mataPelajaran},
              ${data.kodeSoal}, ${data.nilai}, ${data.grade}, ${data.keterangan || null},
              ${data.semester || null}, ${data.tahunAjaran || null})
      ON CONFLICT (grade_id) DO UPDATE SET 
        nilai = ${data.nilai}, grade = ${data.grade}
      RETURNING *
    `
    results.push(result[0])
  }
  return c.json({ status: 'success', data: results })
}

async function handleUpdateGrade(c: any, data: any) {
  const result = await sql`
    UPDATE grades 
    SET nilai = COALESCE(${data.nilai}, nilai),
        grade = COALESCE(${data.grade}, grade),
        keterangan = COALESCE(${data.keterangan}, keterangan)
    WHERE grade_id = ${data.gradeId}
    RETURNING *
  `
  if (result.length === 0) {
    return c.json({ status: 'error', message: 'Grade not found' }, 404)
  }
  return c.json({ status: 'success', data: result[0] })
}

async function handleDeleteGrade(c: any, data: any) {
  await sql`DELETE FROM grades WHERE grade_id = ${data.gradeId}`
  return c.json({ status: 'success', data: null })
}

// ---- CLASSES ----
async function handleGetClasses(c: any) {
  const result = await sql`SELECT * FROM classes ORDER BY nama`
  return c.json({ status: 'success', data: result })
}

async function handleAddClass(c: any, data: any) {
  const result = await sql`
    INSERT INTO classes (nama, deskripsi)
    VALUES (${data.nama}, ${data.deskripsi || null})
    RETURNING *
  `
  return c.json({ status: 'success', data: result[0] })
}

async function handleUpdateClass(c: any, data: any) {
  const result = await sql`
    UPDATE classes SET nama = ${data.nama}, deskripsi = ${data.deskripsi || null}
    WHERE id = ${data.id}
    RETURNING *
  `
  if (result.length === 0) return c.json({ status: 'error', message: 'Kelas tidak ditemukan' }, 404)
  return c.json({ status: 'success', data: result[0] })
}

async function handleDeleteClass(c: any, data: any) {
  await sql`DELETE FROM classes WHERE id = ${data.id}`
  return c.json({ status: 'success', data: null })
}

// ---- SUBJECTS ----
async function handleGetSubjects(c: any) {
  const result = await sql`SELECT * FROM subjects ORDER BY nama`
  return c.json({ status: 'success', data: result })
}

async function handleAddSubject(c: any, data: any) {
  const result = await sql`
    INSERT INTO subjects (nama, deskripsi)
    VALUES (${data.nama}, ${data.deskripsi || null})
    RETURNING *
  `
  return c.json({ status: 'success', data: result[0] })
}

async function handleUpdateSubject(c: any, data: any) {
  const result = await sql`
    UPDATE subjects SET nama = ${data.nama}, deskripsi = ${data.deskripsi || null}
    WHERE id = ${data.id}
    RETURNING *
  `
  if (result.length === 0) return c.json({ status: 'error', message: 'Mata pelajaran tidak ditemukan' }, 404)
  return c.json({ status: 'success', data: result[0] })
}

async function handleDeleteSubject(c: any, data: any) {
  await sql`DELETE FROM subjects WHERE id = ${data.id}`
  return c.json({ status: 'success', data: null })
}

// ---- CLASSES/subjects DIRECT REST ENDPOINTS (used by management pages) ----
app.get('/api/classes', async (c) => {
  try {
    const result = await sql`SELECT * FROM classes ORDER BY nama`
    return c.json({ status: 'success', data: result })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.post('/api/classes', async (c) => {
  try {
    const body = await c.req.json()
    const result = await sql`
      INSERT INTO classes (nama, deskripsi)
      VALUES (${body.nama}, ${body.deskripsi || null})
      RETURNING *
    `
    return c.json({ status: 'success', data: result[0] })
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      return c.json({ status: 'error', message: 'Kelas sudah ada' }, 409)
    }
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.put('/api/classes/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const result = await sql`
      UPDATE classes SET nama = ${body.nama}, deskripsi = ${body.deskripsi || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'Kelas tidak ditemukan' }, 404)
    return c.json({ status: 'success', data: result[0] })
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      return c.json({ status: 'error', message: 'Nama kelas sudah ada' }, 409)
    }
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.delete('/api/classes/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    await sql`DELETE FROM classes WHERE id = ${id}`
    return c.json({ status: 'success', data: null })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== SUBJECTS CRUD ====================
app.get('/api/subjects', async (c) => {
  try {
    const result = await sql`SELECT * FROM subjects ORDER BY nama`
    return c.json({ status: 'success', data: result })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.post('/api/subjects', async (c) => {
  try {
    const body = await c.req.json()
    const result = await sql`
      INSERT INTO subjects (nama, deskripsi)
      VALUES (${body.nama}, ${body.deskripsi || null})
      RETURNING *
    `
    return c.json({ status: 'success', data: result[0] })
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      return c.json({ status: 'error', message: 'Mata pelajaran sudah ada' }, 409)
    }
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.put('/api/subjects/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const result = await sql`
      UPDATE subjects SET nama = ${body.nama}, deskripsi = ${body.deskripsi || null}
      WHERE id = ${id}
      RETURNING *
    `
    if (result.length === 0) return c.json({ status: 'error', message: 'Mata pelajaran tidak ditemukan' }, 404)
    return c.json({ status: 'success', data: result[0] })
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      return c.json({ status: 'error', message: 'Nama mata pelajaran sudah ada' }, 409)
    }
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

app.delete('/api/subjects/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    await sql`DELETE FROM subjects WHERE id = ${id}`
    return c.json({ status: 'success', data: null })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

// ==================== DASHBOARD MONITORING STATS ====================
app.get('/api/stats', async (c) => {
  try {
    const [usersCount, questionsCount, resultsCount, gradesCount, blockedCount] = await Promise.all([
      sql`SELECT role, COUNT(*) as count FROM users GROUP BY role`,
      sql`SELECT COUNT(*) as count FROM questions`,
      sql`SELECT COUNT(*) as count FROM results`,
      sql`SELECT COUNT(*) as count FROM grades`,
      sql`SELECT COUNT(*) as count FROM blocked_students`
    ])

    // Average score per subject
    const perSubject = await sql`
      SELECT mata_pelajaran, 
             ROUND(AVG(total_skor::numeric), 1) as rata_rata,
             COUNT(*) as total_ujian
      FROM results 
      WHERE total_skor > 0
      GROUP BY mata_pelajaran
      ORDER BY rata_rata DESC
    `

    // Average score per class
    const perClass = await sql`
      SELECT kelas, 
             ROUND(AVG(total_skor::numeric), 1) as rata_rata,
             COUNT(*) as total_ujian
      FROM results
      WHERE kelas IS NOT NULL AND total_skor > 0
      GROUP BY kelas
      ORDER BY kelas
    `

    // Score distribution
    const distribution = await sql`
      SELECT 
        CASE 
          WHEN total_skor >= 90 THEN 'A (90-100)'
          WHEN total_skor >= 80 THEN 'B (80-89)'
          WHEN total_skor >= 70 THEN 'C (70-79)'
          WHEN total_skor >= 60 THEN 'D (60-69)'
          ELSE 'E (<60)'
        END as grade_range,
        COUNT(*) as count
      FROM results
      WHERE total_skor > 0
      GROUP BY grade_range
      ORDER BY grade_range
    `

    // Recent activity (last 10 exams)
    const recentActivity = await sql`
      SELECT nama_siswa, kelas, mata_pelajaran, kode_soal, 
             total_benar, total_salah, total_skor, submitted_at
      FROM results
      ORDER BY submitted_at DESC
      LIMIT 10
    `

    const stats: Record<string, any> = {
      totalUsers: { siswa: 0, guru: 0, admin: 0 },
      totalSoal: 0,
      totalUjianSelesai: 0,
      totalNilai: 0,
      totalTerblokir: 0,
      perSubject,
      perClass,
      distribution,
      recentActivity
    }

    usersCount.forEach((r: any) => {
      if (r.role === 'siswa') stats.totalUsers.siswa = parseInt(r.count)
      else if (r.role === 'guru') stats.totalUsers.guru = parseInt(r.count)
      else if (r.role === 'admin') stats.totalUsers.admin = parseInt(r.count)
    })
    stats.totalSoal = parseInt(questionsCount[0]?.count || '0')
    stats.totalUjianSelesai = parseInt(resultsCount[0]?.count || '0')
    stats.totalNilai = parseInt(gradesCount[0]?.count || '0')
    stats.totalTerblokir = parseInt(blockedCount[0]?.count || '0')

    return c.json({ status: 'success', data: stats })
  } catch (error: any) {
    return c.json({ status: 'error', message: error.message }, 500)
  }
})

export default app
