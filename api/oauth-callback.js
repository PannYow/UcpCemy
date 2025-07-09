import axios from 'axios';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

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
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Error: Kode otorisasi tidak ditemukan.');
  }

  try {
    // 1. Tukar 'code' dengan 'access_token'
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.ROOT_URL}/api/oauth-callback`,
      }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Ambil data user dari Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id: discordId, username: discordUsername } = userResponse.data;

    // 3. Cek apakah user sudah terdaftar di database
    const [rows] = await db.execute('SELECT discord_id FROM users WHERE discord_id = ?', [discordId]);

    if (rows.length > 0) {
      const destination = new URL('/', process.env.ROOT_URL);
      destination.searchParams.set('error', 'Akun Discord ini sudah terdaftar.');
      return res.redirect(destination.toString());
    }

    // 4. Buat token pendaftaran (JWT)
    const registrationToken = jwt.sign(
      { discordId, discordUsername },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 5. Arahkan user ke formulir
    res.redirect(`/register.html?token=${registrationToken}&username=${encodeURIComponent(discordUsername)}`);

  } catch (error) {
    console.error('OAuth Callback Error Details:', error.response ? error.response.data : error.message);
    return res.status(500).send('Terjadi kesalahan saat otentikasi dengan Discord. Periksa kembali Client ID/Secret di Vercel.');
  }
}
