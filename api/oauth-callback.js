import axios from 'axios';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const db = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
});

export default async function handler(req, res) {
  // ... (Sisa kode di file ini SAMA PERSIS seperti sebelumnya, yang diubah hanya bagian koneksi database di atas)
}
