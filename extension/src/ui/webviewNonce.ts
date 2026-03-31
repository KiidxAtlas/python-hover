import * as crypto from 'crypto';

export function createWebviewNonce(): string {
    return crypto.randomBytes(16).toString('base64');
}
