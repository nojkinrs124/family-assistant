/**
 * Запускай на Mac: node proxy.js
 * Создаёт HTTPS-прокси на порту 8888 — через него бот на сервере
 * будет обращаться к Ленте с твоего домашнего IP
 */
import net from 'net';
import http from 'http';

const PORT = 8888;

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url.startsWith('http') ? req.url : `http://${req.headers.host}${req.url}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: url.host },
    };
    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxy.on('error', () => res.destroy());
    req.pipe(proxy, { end: true });
  } catch {
    res.writeHead(500).end();
  }
});

server.on('connect', (req, socket, head) => {
  const [hostname, portStr] = req.url.split(':');
  const port = parseInt(portStr) || 443;
  const tunnel = net.connect(port, hostname, () => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head?.length) tunnel.write(head);
    tunnel.pipe(socket);
    socket.pipe(tunnel);
  });
  tunnel.on('error', () => socket.destroy());
  socket.on('error', () => tunnel.destroy());
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Прокси запущен на порту ${PORT}`);
  console.log(`   Теперь запусти SSH-туннель:`);
  console.log(`   ssh -R 8888:localhost:8888 -N root@72.56.76.219`);
});
