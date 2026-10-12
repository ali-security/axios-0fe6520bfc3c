const LOOPBACK_ADDRESSES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const isIPv6ZeroGroup = (group) => /^0{1,4}$/.test(group);

// The unspecified address (IPv4 0.0.0.0 / IPv6 ::) resolves to the local host
// for outbound connections, so treat it as loopback-equivalent for NO_PROXY
// matching. 0.0.0.0 is covered by LOOPBACK_ADDRESSES; this handles compressed
// and full IPv6 all-zero forms so both families bypass symmetrically.
const isIPv6Unspecified = (host) => {
  if (host === '::') return true;

  const compressionIndex = host.indexOf('::');

  if (compressionIndex !== -1) {
    if (compressionIndex !== host.lastIndexOf('::')) return false;

    const left = host.slice(0, compressionIndex);
    const right = host.slice(compressionIndex + 2);
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const explicitGroups = leftGroups.length + rightGroups.length;

    return (
      explicitGroups < 8 &&
      leftGroups.every(isIPv6ZeroGroup) &&
      rightGroups.every(isIPv6ZeroGroup)
    );
  }

  const groups = host.split(':');
  return groups.length === 8 && groups.every(isIPv6ZeroGroup);
};

const isLoopback = (host) => {
  if (!host) return false;
  if (LOOPBACK_ADDRESSES.has(host)) return true;
  return isIPv6Unspecified(host);
};

const DEFAULT_PORTS = {
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
  ftp: 21,
};

const parseNoProxyEntry = (entry) => {
  let entryHost = entry;
  let entryPort = 0;

  if (entryHost.charAt(0) === '[') {
    const bracketIndex = entryHost.indexOf(']');

    if (bracketIndex !== -1) {
      const host = entryHost.slice(1, bracketIndex);
      const rest = entryHost.slice(bracketIndex + 1);

      if (rest.charAt(0) === ':' && /^\d+$/.test(rest.slice(1))) {
        entryPort = Number.parseInt(rest.slice(1), 10);
      }

      return [host, entryPort];
    }
  }

  const firstColon = entryHost.indexOf(':');
  const lastColon = entryHost.lastIndexOf(':');

  if (
    firstColon !== -1 &&
    firstColon === lastColon &&
    /^\d+$/.test(entryHost.slice(lastColon + 1))
  ) {
    entryPort = Number.parseInt(entryHost.slice(lastColon + 1), 10);
    entryHost = entryHost.slice(0, lastColon);
  }

  return [entryHost, entryPort];
};

const normalizeNoProxyHost = (hostname) => {
  if (!hostname) {
    return hostname;
  }

  if (hostname.charAt(0) === '[' && hostname.charAt(hostname.length - 1) === ']') {
    hostname = hostname.slice(1, -1);
  }

  return hostname.replace(/\.+$/, '');
};

export default function shouldBypassProxy(location) {
  let parsed;

  try {
    parsed = new URL(location);
  } catch (_err) {
    return false;
  }

  const noProxy = (process.env.no_proxy || process.env.NO_PROXY || '').toLowerCase();

  if (!noProxy) {
    return false;
  }

  if (noProxy === '*') {
    return true;
  }

  const port =
    Number.parseInt(parsed.port, 10) || DEFAULT_PORTS[parsed.protocol.split(':', 1)[0]] || 0;

  const hostname = normalizeNoProxyHost(parsed.hostname.toLowerCase());

  return noProxy.split(/[\s,]+/).some((entry) => {
    if (!entry) {
      return false;
    }

    let [entryHost, entryPort] = parseNoProxyEntry(entry);

    entryHost = normalizeNoProxyHost(entryHost);

    if (!entryHost) {
      return false;
    }

    if (entryPort && entryPort !== port) {
      return false;
    }

    if (entryHost.charAt(0) === '*') {
      entryHost = entryHost.slice(1);
    }

    if (entryHost.charAt(0) === '.') {
      return hostname.endsWith(entryHost);
    }

    return hostname === entryHost || (isLoopback(hostname) && isLoopback(entryHost));
  });
}
