import multer from "multer";

// store in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ['.pdf', '.txt']
        const fileExt = file.originalname.toLowerCase().slice(-4)

        if(allowedTypes.some(ext => fileExt === ext))
            callback(null, true)
        else
            callback(new Error('Only PDF and TXT file allowed'))
    }
})

export const uploadMiddleware = upload.single('file')
