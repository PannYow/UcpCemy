import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import axios from 'axios';

// Konfigurasi koneksi ke database TiDB Cloud (MySQL)
const db = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metode tidak diizinkan.' });
  }

  const { token, ucp_name, password } = req.body;

  if (!token || !ucp_name || !password) {
    return res.status(400).json({ message: 'Semua kolom wajib diisi.' });
  }

  try {
    const { discordId } = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(password, 10);
    const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Cek duplikat sekali lagi untuk keamanan
    const [existing] = await db.execute('SELECT ucp_name, discord_id FROM users WHERE ucp_name = ? OR discord_id = ?', [ucp_name, discordId]);
    if (existing.length > 0) {
        return res.status(409).json({ message: 'Nama UCP atau Akun Discord sudah digunakan.' });
    }
    
    // Simpan data ke database
    const query = 'INSERT INTO users (ucp_name, password, discord_id, ip_address, pin) VALUES (?, ?, ?, ?, ?)';
    await db.execute(query, [ucp_name, hashedPassword, discordId, ip_address, pin]);

    // Panggil API bot di Replit untuk finalisasi
    try {
      await axios.post(process.env.REPLIT_BOT_API_URL, {
        discord_id: discordId,
        ucp_name: ucp_name,
        pin: pin
      });
    } catch (botError) {
      console.error("Gagal menghubungi bot di Replit:", botError.message);
      return res.status(500).json({ message: 'Akun berhasil dibuat, tetapi gagal menghubungi bot Discord. Hubungi admin.' });
    }

    return res.status(201).json({ message: 'Akun UCP berhasil dibuat!' });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token pendaftaran tidak valid atau kedaluwarsa.' });
    }
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Nama UCP atau Akun Discord sudah digunakan.' });
    }
    console.error('Register UCP Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan internal pada server.' });
  }
}
