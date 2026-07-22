import { pool } from '../db.js';
import { Parser } from 'json2csv';
import xlsx from 'xlsx';

export async function getPrivateStats(req, res) {
    try {
        const { code } = req.params;
        const [[url]] = await pool.query(
            'SELECT id, code, target, title, is_active, created_at, user_id FROM urls WHERE code = ?',
            [code]
        );

        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Totals
        const [[{ total }]]     = await pool.query('SELECT COUNT(*) AS total FROM clicks WHERE url_id = ?', [url.id]);
        const [[{ total24h }]]  = await pool.query('SELECT COUNT(*) AS total24h FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 1 DAY', [url.id]);
        const [[{ total7d }]]   = await pool.query('SELECT COUNT(*) AS total7d FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 7 DAY', [url.id]);
        const [[{ total30d }]]  = await pool.query('SELECT COUNT(*) AS total30d FROM clicks WHERE url_id = ? AND ts >= NOW() - INTERVAL 30 DAY', [url.id]);

        // Timeline 30 jours (par jour)
        const [timeline] = await pool.query(
          `SELECT DATE(ts) AS d, COUNT(*) AS c
           FROM clicks
           WHERE url_id = ? AND ts >= CURDATE() - INTERVAL 30 DAY
           GROUP BY DATE(ts)
           ORDER BY d`,
          [url.id]
        );

        // Top referrers (direct si NULL/vide)
        const [referrers] = await pool.query(
          `SELECT COALESCE(NULLIF(referrer,''), '(direct)') AS ref, COUNT(*) AS c
           FROM clicks
           WHERE url_id = ?
           GROUP BY ref
           ORDER BY c DESC
           LIMIT 10`,
          [url.id]
        );

        // Top combinaisons UTM
        const [utm] = await pool.query(
          `SELECT
             COALESCE(utm_source,'')   AS source,
             COALESCE(utm_medium,'')   AS medium,
             COALESCE(utm_campaign,'') AS campaign,
             COUNT(*) AS c
           FROM clicks
           WHERE url_id = ?
           GROUP BY source, medium, campaign
           ORDER BY c DESC
           LIMIT 10`,
          [url.id]
        );

        // 20 derniers clics "safe"
        const [recent] = await pool.query(
          `SELECT
             ts,
             LEFT(COALESCE(referrer,''), 200)   AS referrer,
             LEFT(COALESCE(utm_source,''), 60)  AS utm_source,
             LEFT(COALESCE(utm_medium,''), 60)  AS utm_medium,
             LEFT(COALESCE(utm_campaign,''), 60)AS utm_campaign
           FROM clicks
           WHERE url_id = ?
           ORDER BY id DESC
           LIMIT 20`,
          [url.id]
        );

        res.json({
            ok: true,
            url: {
                code: url.code,
                title: url.title,
                target: url.target,
                is_active: !!url.is_active,
                created_at: url.created_at
            },
            totals: { all: total, last24h: total24h, last7d: total7d, last30d: total30d },
            timeline,
            referrers,
            utm,
            recent
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
}

export async function getMapLocations(req, res) {
    try {
        const { code } = req.params;
        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);
        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }
        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [locations] = await pool.query(
            `SELECT country_code, lat, lon, COUNT(*) as count
             FROM clicks
             WHERE url_id = ? AND country_code IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL
             GROUP BY country_code, lat, lon`,
            [url.id]
        );
        res.json(locations);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
}

async function handleExport(req, res, format) {
    try {
        const { code } = req.params;
        const [[url]] = await pool.query('SELECT id, user_id FROM urls WHERE code = ?', [code]);

        if (!url) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (url.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const [clicks] = await pool.query('SELECT * FROM clicks WHERE url_id = ? ORDER BY ts DESC', [url.id]);

        if (format === 'csv') {
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(clicks);
            res.header('Content-Type', 'text/csv');
            res.attachment(`${code}-stats.csv`);
            res.send(csv);
        } else if (format === 'xlsx') {
            const worksheet = xlsx.utils.json_to_sheet(clicks);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Clicks');
            const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment(`${code}-stats.xlsx`);
            res.send(buffer);
        }
    } catch (e) {
        console.error(`Error exporting ${format}:`, e);
        res.status(500).json({ error: 'Server error during export' });
    }
}

export function exportCSV(req, res) {
    return handleExport(req, res, 'csv');
}

export function exportXLSX(req, res) {
    return handleExport(req, res, 'xlsx');
}
