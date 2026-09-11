import crypto from 'crypto';

export function createUnlockToken(code) {
    const expires = Date.now() + 30000; // 30 seconds
    const data = `${code}:${expires}`;
    const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET)
                            .update(data)
                            .digest('hex');
    return `${expires}:${signature}`;
}

export function verifyUnlockToken(code, token) {
    if (!token) return false;
    const parts = token.split(':');
    if (parts.length !== 2) return false;
    const [expiresStr, signature] = parts;
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || expires < Date.now()) return false;

    const data = `${code}:${expires}`;
    const expectedSignature = crypto.createHmac('sha256', process.env.SESSION_SECRET)
                                    .update(data)
                                    .digest('hex');
    return signature === expectedSignature;
}
