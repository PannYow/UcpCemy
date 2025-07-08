import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Error: Kode otorisasi tidak ditemukan.');
  }

  try {
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

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { id: discordId, username: discordUsername } = userResponse.data;

    const { rows } = await pool.query('SELECT discord_id FROM users WHERE discord_id = $1', [discordId]);

    if (rows.length > 0) {
      const destination = new URL('/', process.env.ROOT_URL);
      destination.searchParams.set('error', 'Akun Discord ini sudah terdaftar.');
      return res.redirect(destination.toString());
    }

    const registrationToken = jwt.sign(
      { discordId, discordUsername },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.redirect(`/register.html?token=${registrationToken}&username=${encodeURIComponent(discordUsername)}`);

  } catch (error) {
    // PERUBAHAN DI SINI UNTUK MELIHAT LOG DETAIL
    console.error('OAuth Callback Error Details:', error.response ? error.response.data : error.message);
    return res.status(500).send('Terjadi kesalahan saat otentikasi dengan Discord. Periksa kembali Client ID/Secret di Vercel.');
  }
}
