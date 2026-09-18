# Express API Security

A minimal demo showing the most common ways to secure an Express API. Built for interview practice — each technique has real code in this repo, and the section below shows you how to talk about it.

## The Interview Question

> **"How would you secure an Express API?"**

This is one of the most common Express questions. Here is a solid, structured answer you can adapt:

### Short answer (30–60 seconds)

> "I would secure an Express API in layers — the same way you'd lock a house (front door, then locks on each room). My go-to layers are:

> 1. **Security HTTP headers** with `helmet` — adds things like `X-Frame-Options` (stops clickjacking), `X-Content-Type-Options: nosniff`, and a Content-Security-Policy.
> 2. **CORS** — only allow my own frontend origins to call the API, so random websites can't.
> 3. **Rate limiting** with `express-rate-limit` — blocks brute-force and basic DDoS by limiting requests per IP.
> 4. **Input sanitization** — `express-mongo-sanitize` strips MongoDB operators like `$gt` (NoSQL injection), `xss-clean` strips `<script>`, and `hpp` blocks parameter pollution.
> 5. **Input validation** — never trust the client; validate in the schema/model, and for complex payloads a library like Joi or Zod.
> 6. **Hide fingerprinting** — turn off `x-powered-by`, limit body size, and never leak stack traces in production.
> 7. **Secrets & transport** — secrets in `.env` (never committed), HTTPS in production, and proper auth (JWT + bcrypt) plus role-based authorization."

### Long answer — with the actual code (30–90 seconds per point)

Every point below is implemented in this repo. Run the server and test each one — that's the best way to be able to explain it in an interview.

---

## Attack vs. Protection map

| Threat | Protection | Package | File |
|---|---|---|---|
| Clickjacking, MIME-sniffing, missing CSP | Security headers | `helmet` | `src/middleware/security.js` |
| Cross-origin abuse | Allow only trusted origins | `cors` | `src/middleware/security.js` |
| Brute force / DoS | Limit requests per IP | `express-rate-limit` | `src/middleware/security.js` |
| NoSQL injection (`$gt`, `$ne`) | Strip `$` and `.` from input | `express-mongo-sanitize` | `src/middleware/security.js` |
| XSS (`<script>alert(1)</script>`) | HTML-encode user input | `xss-clean` | `src/middleware/security.js` |
| HTTP Parameter Pollution (`?name=a&name=b`) | Keep only first/whitelisted query params | `hpp` | `src/middleware/security.js` |
| Invalid/garbage data reaching DB | Schema + regex validation | Mongoose validators | `src/models/User.js` |
| Huge request bodies (DoS) | Cap body size at 10kb | `express.json({ limit })` | `src/app.js` |
| Server fingerprint leak | Remove `X-Powered-By` | `app.disable()` | `src/middleware/security.js` |
| Stack traces leaking in prod | Hide stack when `NODE_ENV=production` | Custom error handler | `src/middleware/errorHandler.js` |
| Secrets committed to git | `.env` + `.gitignore` | `dotenv` | `.env` / `.gitignore` |

---

## How it's implemented (walk-through)

### 1. Security headers — `helmet`

`src/middleware/security.js`

```js
app.use(helmet());
```

Sets ~15 headers, including `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.

**Test it:**
```bash
curl -i http://localhost:5000/api/users | Select-String "content-security|x-frame|x-content"
```

### 2. CORS — only your frontend

```js
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
};
app.use(cors(corsOptions));
```

A browser on `http://evil.com` sees **no** `Access-Control-Allow-Origin` header, so it can't read your API. Multiple frontend domains are supported via comma-separated `CORS_ORIGIN` in `.env`.

**Test it:**
```bash
curl -i http://localhost:5000/api/users -H "Origin: http://evil.com"     # no allow-origin header
curl -i http://localhost:5000/api/users -H "Origin: http://localhost:3000" # access allowed
```

### 3. Rate limiting — `express-rate-limit`

```js
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // window = 15 min
  limit: 100,                // only 100 requests per IP
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', apiLimiter);
```

Applied to the whole `/api` prefix. A stricter `authLimiter` (e.g. 5 login attempts per 15 min) is also exported and ready to drop onto login/register routes.

**Test it:** fire 100+ requests and watch the `429 Too Many Requests` response (headers `RateLimit-Limit` / `RateLimit-Remaining` show the state).

### 4. Input sanitization — Mongo, XSS, HPP

```js
app.use(mongoSanitize()); // { email: { $gt: "" } }  ->  email is stripped of $ operators
app.use(xssClean());      // <script>alert(1)</script> -> &lt;script&gt;alert(1)&lt;/script&gt;
app.use(hpp());           // ?page=1&page=2  only keeps the first value
```

Order matters: these run **after** `express.json()`, because they need a parsed `req.body`.

**Test it:**
```bash
# NoSQL injection: body { "email": { "$gt": "" } } -> fails validation, $ operator is gone
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d '{"name":"Hacker","email":{"$gt":""}}'

# XSS: stored value comes back as &lt;script&gt; instead of <script>
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" -d '{"name":"<script>alert(1)</script>","email":"xss@test.com"}'
```

### 5. Input validation — in the model

`src/models/User.js`

```js
email: {
  required: true,
  unique: true,
  match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
},
```

Mongoose validates `required`, `unique`, `min`, and `match` before writing to the DB. For more complex rules (signup forms etc.) add a library like **Joi** or **Zod** at the route layer — say that in the interview.

### 6. Hide & harden the server

```js
app.disable('x-powered-by');                        // don't advertise "Express"
app.use(express.json({ limit: '10kb' }));           // cap body size -> less DoS surface
```

### 7. Errors that don't leak internals

`src/middleware/errorHandler.js`

```js
stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
```

In development you get the stack for debugging; in production it's `undefined`. Always ship with `NODE_ENV=production`. Catch async errors and pass them to `next(err)` so they land in this handler.

### 8. Secrets & transport (no code change, just discipline)

- Secrets live in `.env` (`.env` is in `.gitignore`, `.env.example` is committed).
- In production: HTTPS/TLS (terminate at a reverse proxy like Nginx), and set `app.set('trust proxy', 1)` behind the proxy so rate limiting sees the real client IP.
- Authentication: `bcrypt` to hash passwords, `JWT` for sessions + role-based authorization middleware (`auth`, then `authorize('admin')`) on protected routes.
- Keep dependencies updated (`npm audit`) and never log tokens, passwords, or `Authorization` headers.

---

## Run it

```bash
npm install
cp .env.example .env        # set MONGO_URI if needed
npm run dev                 # needs MongoDB running locally
```

Then hit `http://localhost:5000/api/users` and test the attacks above.

## Files in this demo

```
server.js                      → bootstraps app + connects MongoDB
src/app.js                     → wires body parser, security(), routes, error handling
src/middleware/security.js     → ALL security middleware lives here (read this file first)
src/middleware/errorHandler.js → centralized errors, hides stack in production
src/middleware/notFound.js     → 404 for unknown routes
src/models/User.js             → schema + built-in validation
```

---

## Likely follow-up questions

- **Which is the most important?** Rate limiting + input sanitization/validation stop the majority of automated attacks. Helmet/CORS/HTTPS harden the edges. Auth is the biggest chunk of *real* protection for a real API.
- **What about SQL injection?** No raw queries with string concatenation. With MongoDB the equivalent is NoSQL injection — `express-mongo-sanitize` handles it. In an SQL world you'd use an ORM/parameterized queries.
- **Why is `x-powered-by` dangerous?** Attackers scan for it to find servers running known-vulnerable Express versions.
- **Where would you put JWT auth?** As middleware between routes and controllers — a protected router gets `router.use(auth)` before the controllers run; `/api/auth/login` and `/api/auth/register` stay public but rate-limited harder.