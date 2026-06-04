const http = require('http');

function request(path, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataStr = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
        },
        dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {},
        headers
      ),
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (e) {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));

    if (dataStr) req.write(dataStr);
    req.end();
  });
}

(async () => {
  try {
    console.log('Signing up test user...');
    let r = await request('/api/users/signup', 'POST', {
      name: 'Tmp User',
      email: 'tmpuser+copilot@example.com',
      password: 'Test1234!'
    });
    console.log('SIGNUP', r);

    console.log('Logging in test user...');
    r = await request('/api/users/login', 'POST', {
      email: 'tmpuser+copilot@example.com',
      password: 'Test1234!'
    });
    console.log('LOGIN', r);

    const token = r?.body?.data?.token;
    if (!token) {
      console.error('No token returned, aborting.');
      process.exit(1);
    }

    console.log('Creating contact with token...');
    const contact = {
      firstName: 'Alice',
      lastName: 'Tester',
      email: 'alice@example.com',
      primaryContact: '1234567890'
    };

    r = await request('/api/contacts', 'POST', contact, { Authorization: `Bearer ${token}` });
    console.log('CREATE_CONTACT', r);
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
