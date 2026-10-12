import assert from 'assert';
import shouldBypassProxy from '../../../lib/helpers/shouldBypassProxy.js';

const originalNoProxy = process.env.no_proxy;
const originalNOProxy = process.env.NO_PROXY;

const setNoProxy = (value) => {
  process.env.no_proxy = value;
  process.env.NO_PROXY = value;
};

afterEach(() => {
  if (originalNoProxy === undefined) {
    delete process.env.no_proxy;
  } else {
    process.env.no_proxy = originalNoProxy;
  }

  if (originalNOProxy === undefined) {
    delete process.env.NO_PROXY;
  } else {
    process.env.NO_PROXY = originalNOProxy;
  }
});

describe('helpers::shouldBypassProxy', () => {
  it('should bypass proxy for localhost with a trailing dot', () => {
    setNoProxy('localhost,127.0.0.1,::1');

    assert.strictEqual(shouldBypassProxy('http://localhost.:8080/'), true);
  });

  it('should bypass proxy for bracketed ipv6 loopback', () => {
    setNoProxy('localhost,127.0.0.1,::1');

    assert.strictEqual(shouldBypassProxy('http://[::1]:8080/'), true);
  });

  it('should support bracketed ipv6 entries in no_proxy', () => {
    setNoProxy('[::1]');

    assert.strictEqual(shouldBypassProxy('http://[::1]:8080/'), true);
  });

  it('should bypass proxy for 127.0.0.1 when no_proxy contains localhost', () => {
    setNoProxy('localhost');

    assert.strictEqual(shouldBypassProxy('http://127.0.0.1:7777/'), true);
  });

  it('should bypass proxy for [::1] when no_proxy contains localhost', () => {
    setNoProxy('localhost');

    assert.strictEqual(shouldBypassProxy('http://[::1]:7777/'), true);
  });

  it('should bypass proxy for localhost when no_proxy contains 127.0.0.1', () => {
    setNoProxy('127.0.0.1');

    assert.strictEqual(shouldBypassProxy('http://localhost:7777/'), true);
  });

  it('should bypass proxy for localhost when no_proxy contains ::1', () => {
    setNoProxy('::1');

    assert.strictEqual(shouldBypassProxy('http://localhost:7777/'), true);
  });

  it('should bypass proxy for 0.0.0.0 when no_proxy contains a local entry', () => {
    for (const entry of ['localhost', '127.0.0.1', '::1']) {
      setNoProxy(entry);

      assert.strictEqual(shouldBypassProxy('http://0.0.0.0:7777/'), true);
    }
  });

  it('should respect explicit ports for 0.0.0.0 local matching', () => {
    setNoProxy('localhost:8080');

    assert.strictEqual(shouldBypassProxy('http://0.0.0.0:8080/'), true);
    assert.strictEqual(shouldBypassProxy('http://0.0.0.0:9090/'), false);
  });

  it('should bypass proxy for the IPv6 unspecified address symmetrically with 0.0.0.0', () => {
    for (const entry of ['localhost', '127.0.0.1', '::1']) {
      setNoProxy(entry);

      assert.strictEqual(shouldBypassProxy('http://[::]:7777/'), true);
      assert.strictEqual(shouldBypassProxy('http://[0:0:0:0:0:0:0:0]:7777/'), true);
    }
  });

  it('should bypass proxy for compressed IPv6 unspecified request forms', () => {
    setNoProxy('localhost,127.0.0.1,::1');

    for (const host of ['0::', '::0', '0:0::', '::0:0', '0::0']) {
      assert.strictEqual(shouldBypassProxy(`http://[${host}]:7777/`), true);
    }
  });

  it('should bypass proxy for compressed IPv6 unspecified no_proxy entries', () => {
    for (const entry of ['0::', '::0', '0:0::', '::0:0', '0::0']) {
      setNoProxy(entry);

      assert.strictEqual(shouldBypassProxy('http://[::]:7777/'), true);
      assert.strictEqual(shouldBypassProxy('http://[0:0:0:0:0:0:0:0]:7777/'), true);
    }
  });

  it('should respect explicit ports on compressed IPv6 unspecified no_proxy entries', () => {
    setNoProxy('[0::]:8080');

    assert.strictEqual(shouldBypassProxy('http://[::]:8080/'), true);
    assert.strictEqual(shouldBypassProxy('http://[::]:9090/'), false);
  });

  it('should not treat nonzero compressed IPv6 addresses as unspecified', () => {
    setNoProxy('0::2');

    assert.strictEqual(shouldBypassProxy('http://[::]:7777/'), false);
  });

  it('should still route a real public IPv6 host through the proxy', () => {
    setNoProxy('localhost');

    assert.strictEqual(shouldBypassProxy('http://[2001:db8::1]:7777/'), false);
  });

  it('should match wildcard and explicit ports', () => {
    setNoProxy('*.example.com,localhost:8080');

    assert.strictEqual(shouldBypassProxy('http://api.example.com/'), true);
    assert.strictEqual(shouldBypassProxy('http://localhost:8080/'), true);
    assert.strictEqual(shouldBypassProxy('http://localhost:8081/'), false);
  });
});
