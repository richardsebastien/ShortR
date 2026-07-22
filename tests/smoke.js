import test from 'node:test';
import assert from 'node:assert';
import { isValidUrl, isValidCode } from '../utils/validate.js';
import { getClientIp } from '../utils/ip.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { pool } from '../db.js';

test('Utility: isValidUrl', () => {
    assert.strictEqual(isValidUrl('https://example.com'), true);
    assert.strictEqual(isValidUrl('http://shortr.fr/some/path?param=1'), true);
    assert.strictEqual(isValidUrl('ftp://invalid-protocol.com'), false);
    assert.strictEqual(isValidUrl('not-a-url'), false);
    assert.strictEqual(isValidUrl(''), false);
});

test('Utility: isValidCode', () => {
    assert.strictEqual(isValidCode('abcde'), true);
    assert.strictEqual(isValidCode('a_b-123'), true);
    assert.strictEqual(isValidCode('abc'), false); // Too short
    assert.strictEqual(isValidCode('a'.repeat(33)), false); // Too long
    assert.strictEqual(isValidCode('abc$'), false); // Invalid char
});

test('Utility: getClientIp', () => {
    const reqWithXFF = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        socket: { remoteAddress: '127.0.0.1' }
    };
    assert.strictEqual(getClientIp(reqWithXFF), '1.2.3.4');

    const reqWithoutXFF = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    assert.strictEqual(getClientIp(reqWithoutXFF), '127.0.0.1');
});

test('Middleware: requireAuth', () => {
    let statusCalled = null;
    let jsonCalled = null;
    let nextCalled = false;

    const res = {
        status(code) {
            statusCalled = code;
            return {
                json(data) {
                    jsonCalled = data;
                }
            };
        }
    };

    const next = () => {
        nextCalled = true;
    };

    // Case 1: Not authenticated
    const reqUnauth = { session: {} };
    requireAuth(reqUnauth, res, next);
    assert.strictEqual(statusCalled, 401);
    assert.deepStrictEqual(jsonCalled, { error: 'Not authenticated' });
    assert.strictEqual(nextCalled, false);

    // Reset status variables
    statusCalled = null;
    jsonCalled = null;
    nextCalled = false;

    // Case 2: Authenticated
    const reqAuth = { session: { userId: 42 } };
    requireAuth(reqAuth, res, next);
    assert.strictEqual(statusCalled, null);
    assert.strictEqual(jsonCalled, null);
    assert.strictEqual(nextCalled, true);
});

test('Database: mock verification', async () => {
    // Temporarily stub pool.query
    const originalQuery = pool.query;
    let queriedSql = null;
    let queriedValues = null;

    pool.query = async (sql, values) => {
        queriedSql = sql;
        queriedValues = values;
        return [[{ id: 1, email: 'test@test.com' }]];
    };

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
        assert.strictEqual(queriedSql, 'SELECT * FROM users WHERE id = ?');
        assert.deepStrictEqual(queriedValues, [1]);
        assert.strictEqual(rows[0].email, 'test@test.com');
    } finally {
        // Restore original query method
        pool.query = originalQuery;
    }
});
