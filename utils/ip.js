import net from 'net';

export function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const first = String(xff).split(',')[0].trim();
        if (net.isIP(first)) return first;
    }
    return req.socket.remoteAddress || null;
}
