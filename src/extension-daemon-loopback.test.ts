import { describe, expect, it } from 'vitest';
import { DAEMON_HOST, DAEMON_PORT, DAEMON_PING_URL, DAEMON_WS_URL } from '../extension/src/protocol.js';

describe('extension daemon loopback address (#2690)', () => {
  it('matches the IPv4-only daemon listener for both HTTP and WebSocket', () => {
    expect(DAEMON_HOST).toBe('127.0.0.1');
    expect(DAEMON_PING_URL).toBe(`http://127.0.0.1:${DAEMON_PORT}/ping`);
    expect(DAEMON_WS_URL).toBe(`ws://127.0.0.1:${DAEMON_PORT}/ext`);
  });
});
