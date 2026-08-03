/**
 * Generate Excel Template for Bulk User Import
 * 
 * Run: node generate-template.mjs
 * Output: template-user.xlsx
 */

import { writeFileSync } from 'fs'

// Simple XLSX generator (no external dependencies)
// Uses Office Open XML format

const TEMPLATE_HEADERS = ['username', 'password', 'nama', 'kelas', 'role']
const SAMPLE_DATA = [
  ['siswa001', 'password123', 'Ahmad Fauzi', '5A', 'siswa'],
  ['siswa002', 'password123', 'Siti Nurhaliza', '5A', 'siswa'],
  ['siswa003', 'password123', 'Budi Santoso', '5B', 'siswa'],
  ['guru001', 'guru123', 'Pak Budi', '5A', 'guru'],
]

function generateXLSX() {
  // Create XML content for shared strings (headers + sample data)
  const allStrings = [...TEMPLATE_HEADERS]
  SAMPLE_DATA.forEach(row => row.forEach(cell => allStrings.push(cell)))
  
  const sharedStringsXml = allStrings.map((str, i) => 
    `<si><t>${escapeXml(str)}</t></si>`
  ).join('\n')
  
  // Create worksheet XML
  const rows = []
  
  // Header row (bold)
  const headerCells = TEMPLATE_HEADERS.map((h, i) => 
    `<c r="${getColumnLetter(i)}1" t="s" s="1"><v>${i}</v></c>`
  ).join('')
  rows.push(`<row r="1">${headerCells}</row>`)
  
  // Sample data rows
  SAMPLE_DATA.forEach((row, rowIdx) => {
    const cells = row.map((cell, colIdx) => 
      `<c r="${getColumnLetter(colIdx)}${rowIdx + 2}" t="s"><v>${TEMPLATE_HEADERS.length + rowIdx * row.length + colIdx}</v></c>`
    ).join('')
    rows.push(`<row r="${rowIdx + 2}">${cells}</row>`)
  })
  
  // Add empty rows for user to fill (rows 7-106 = 100 empty rows)
  for (let i = 7; i <= 106; i++) {
    const cells = TEMPLATE_HEADERS.map((_, colIdx) => 
      `<c r="${getColumnLetter(colIdx)}${i}" t="s"><v>0</v></c>`
    ).join('')
    rows.push(`<row r="${i}">${cells}</row>`)
  }
  
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetData>
    ${rows.join('\n    ')}
  </sheetData>
  <autoFilter ref="A1:E1"/>
</worksheet>`

  // Create styles XML (bold header)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font><b/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center"/>
    </xf>
  </cellXfs>
</styleSheet>`

  // Create workbook XML
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Template Import User" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  // Create content types
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`

  // Create relationships
  const relationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const xlRelationshipsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`

  // Create ZIP (XLSX is a ZIP file)
  const files = {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relationshipsXml,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': xlRelationshipsXml,
    'xl/worksheets/sheet1.xml': worksheetXml,
    'xl/styles.xml': stylesXml,
    'xl/sharedStrings.xml': sharedStringsXml,
  }

  // Simple ZIP creation
  const zipBuffer = createZip(files)
  return zipBuffer
}

function createZip(files) {
  const entries = []
  const localHeaders = []
  const centralHeaders = []
  let offset = 0

  const fileNames = Object.keys(files)
  
  for (const fileName of fileNames) {
    const content = Buffer.from(files[fileName], 'utf8')
    const nameBuffer = Buffer.from(fileName, 'utf8')
    
    // CRC32
    const crc = crc32(content)
    
    // Local file header
    const localHeader = Buffer.alloc(30 + nameBuffer.length)
    localHeader.writeUInt32LE(0x04034b50, 0) // signature
    localHeader.writeUInt16LE(20, 4) // version needed
    localHeader.writeUInt16LE(0, 6) // flags
    localHeader.writeUInt16LE(0, 8) // compression (stored)
    localHeader.writeUInt16LE(0, 10) // mod time
    localHeader.writeUInt16LE(0, 12) // mod date
    localHeader.writeUInt32LE(crc, 14) // crc32
    localHeader.writeUInt32LE(content.length, 18) // compressed size
    localHeader.writeUInt32LE(content.length, 22) // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26) // name length
    localHeader.writeUInt16LE(0, 28) // extra length
    nameBuffer.copy(localHeader, 30)
    
    // Central directory header
    const centralHeader = Buffer.alloc(46 + nameBuffer.length)
    centralHeader.writeUInt32LE(0x02014b50, 0) // signature
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed
    centralHeader.writeUInt16LE(0, 8) // flags
    centralHeader.writeUInt16LE(0, 10) // compression
    centralHeader.writeUInt16LE(0, 12) // mod time
    centralHeader.writeUInt16LE(0, 14) // mod date
    centralHeader.writeUInt32LE(crc, 16) // crc32
    centralHeader.writeUInt32LE(content.length, 20) // compressed size
    centralHeader.writeUInt32LE(content.length, 24) // uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28) // name length
    centralHeader.writeUInt16LE(0, 30) // extra length
    centralHeader.writeUInt16LE(0, 32) // comment length
    centralHeader.writeUInt16LE(0, 34) // disk number start
    centralHeader.writeUInt16LE(0, 36) // internal file attributes
    centralHeader.writeUInt32LE(0, 38) // external file attributes
    centralHeader.writeUInt32LE(offset, 42) // relative offset of local header
    nameBuffer.copy(centralHeader, 46)
    
    localHeaders.push(localHeader)
    centralHeaders.push(centralHeader)
    entries.push(content)
    offset += localHeader.length + content.length
  }

  // End of central directory
  const centralDirOffset = offset
  let centralDirSize = 0
  for (const ch of centralHeaders) centralDirSize += ch.length
  
  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0) // signature
  endRecord.writeUInt16LE(0, 4) // disk number
  endRecord.writeUInt16LE(0, 6) // disk with central dir
  endRecord.writeUInt16LE(fileNames.length, 8) // entries on this disk
  endRecord.writeUInt16LE(fileNames.length, 10) // total entries
  endRecord.writeUInt32LE(centralDirSize, 12) // central dir size
  endRecord.writeUInt32LE(centralDirOffset, 16) // central dir offset
  endRecord.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...localHeaders, ...entries, ...centralHeaders, endRecord])
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function getColumnLetter(col) {
  return String.fromCharCode(65 + col)
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Generate and save
const xlsxBuffer = generateXLSX()
writeFileSync('template-user.xlsx', xlsxBuffer)
console.log('✅ Template created: template-user.xlsx')
console.log('📊 Columns: username, password, nama, kelas, role')
console.log('📝 Sample data included (4 rows)')
console.log('💡 Empty rows available for bulk import (100 rows)')
