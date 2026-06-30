const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const ftp = require('basic-ftp');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./orders.db');
db.run(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE,
  nickname TEXT,
  password_hash TEXT,
  rank_id TEXT,
  price INTEGER,
  created_at INTEGER,
  confirmed INTEGER DEFAULT 0
)`);

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

// ⚠️ SEM DEJ SVOJE FTP ÚDAJE Z ATERNOSU (Soubory → FTP přístup)
const FTP_CONFIG = {
  host: 'aternos.org',
  user: 'tvoje_ftp_jmeno',
  password: 'tvoje_ftp_heslo',
  secure: false
};

async function uploadOrderFile(token, nickname, rankId, price) {
  const client = new ftp.Client();
  try {
    await client.access(FTP_CONFIG);
    await client.ensureDir('/orders');
    const orderData = JSON.stringify({
      token, nickname, rankId, price, created: Date.now()
    });
    await client.uploadFrom(require('stream').Readable.from([orderData]), `${token}.json`);
    console.log(`Nahrán ${token}.json`);
  } catch (err) {
    console.error('FTP chyba:', err);
    throw new Error('Nelze nahrát objednávku');
  } finally {
    client.close();
  }
}

app.post('/api/create-order', async (req, res) => {
  const { nickname, password, rankId, price } = req.body;
  if (!nickname || !password || !rankId || !price) {
    return res.status(400).json({ error: 'Chybějící údaje' });
  }

  const token = crypto.randomBytes(6).toString('hex');
  const passwordHash = hashPassword(password);
  const createdAt = Date.now();

  db.run(
    `INSERT INTO orders (token, nickname, password_hash, rank_id, price, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [token, nickname, passwordHash, rankId, price, createdAt],
    async function(err) {
      if (err) return res.status(500).json({ error: 'Chyba databáze' });

      try {
        await uploadOrderFile(token, nickname, rankId, price);
        res.json({ token });
      } catch (ftpErr) {
        db.run(`DELETE FROM orders WHERE token = ?`, [token]);
        res.status(500).json({ error: ftpErr.message });
      }
    }
  );
});

app.listen(3000, () => console.log('Backend běží na portu 3000'));
