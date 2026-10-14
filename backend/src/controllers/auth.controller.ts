import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { env } from '../config/env.js';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    // Cek apakah email sudah terdaftar
    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM auth_users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email ini sudah terdaftar. Silakan login.' });
    }

    // Hash password dan simpan
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const newUserId = uuidv4();

    await pool.query(
      'INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)',
      [newUserId, email, passwordHash]
    );

    // Generate JWT Token
    const token = jwt.sign(
      { userId: newUserId, email },
      env.JWT_SECRET,
      { expiresIn: '7d' } // Berlaku 7 hari
    );

    return res.status(201).json({ 
      message: 'Registrasi berhasil',
      access_token: token,
      user: { id: newUserId, email }
    });
  } catch (error) {
    console.error('Error in register:', error);
    return res.status(500).json({ error: 'Gagal melakukan pendaftaran akun' });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM auth_users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Kredensial login tidak valid' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Kredensial login tidak valid' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login berhasil',
      access_token: token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Error in login:', error);
    return res.status(500).json({ error: 'Gagal melakukan otentikasi (login)' });
  }
};

export const resetSimulated = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password baru wajib diisi' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM auth_users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Email ini tidak terdaftar di sistem kami' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await pool.query(
      'UPDATE auth_users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email]
    );

    return res.status(200).json({ message: 'Password berhasil diperbarui!' });
  } catch (error) {
    console.error('Error in resetSimulated:', error);
    return res.status(500).json({ error: 'Gagal melakukan pemulihan password' });
  }
};
