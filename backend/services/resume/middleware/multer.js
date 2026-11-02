import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";

const uploadPath = path.resolve("uploads");

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        cb(null, `${randomUUID()}.pdf`);
    }

});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
        cb(null, true);
    } else {
        cb(new Error("Only PDF files are allowed"), false);
    }

};

export const upload = multer({
    storage,
    fileFilter,

    limits: {
        fileSize: 20 * 1024 * 1024
    }

});
