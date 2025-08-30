require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve React UI from /public
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// List todos
app.get('/todos', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM todos ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get one todo
app.get('/todos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create todo
app.post('/todos', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const [result] = await pool.query(
      'INSERT INTO todos (title, description) VALUES (?, ?)',
      [title, description || null]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full update
app.put('/todos/:id', async (req, res) => {
  const { title, description, is_done } = req.body;
  if (typeof title === 'undefined' || typeof is_done === 'undefined') {
    return res.status(400).json({ error: 'title and is_done are required' });
  }
  try {
    await pool.query(
      'UPDATE todos SET title=?, description=?, is_done=? WHERE id=?',
      [title, description || null, is_done ? 1 : 0, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Partial update (PATCH)
app.patch('/todos/:id', async (req, res) => {
  const { title, description, is_done } = req.body;
  const fields = [], values = [];
  if (typeof title !== 'undefined') { fields.push('title=?'); values.push(title); }
  if (typeof description !== 'undefined') { fields.push('description=?'); values.push(description); }
  if (typeof is_done !== 'undefined') { fields.push('is_done=?'); values.push(is_done ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ error: 'no fields to update' });

  try {
    values.push(req.params.id);
    await pool.query(`UPDATE todos SET ${fields.join(', ')} WHERE id=?`, values);
    const [rows] = await pool.query('SELECT * FROM todos WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete todo
app.delete('/todos/:id', async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM todos WHERE id=?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`CRUD API running on port ${port}`));
