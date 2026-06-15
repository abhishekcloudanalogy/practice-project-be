const multer = require('multer')
const path = require('path')
const fs = require('fs')

const uploadDir = 'uploads/pdfs'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },

  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()

  if (ext !== '.pdf') {
    return cb(new Error('Only PDF files are allowed'))
  }

  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1MB
  },
})

module.exports = upload