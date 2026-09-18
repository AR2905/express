# 34. How to prevent duplicate requests from creating duplicate records

## Short answer (spoken)

> "I wouldn't rely only on frontend checks. Two layers:
>
> 1. **Enforce uniqueness at the database level** — e.g. `email` has a unique index, so even if two identical requests race in, the database rejects the second one with a duplicate-key error. (In SQL that's a `UNIQUE CONSTRAINT`.)
> 2. **Use an idempotency key for retryable operations** — the client sends the same `Idempotency-Key` header on retries; the server stores the key with the created record and returns the original result instead of creating again. So a retry after a timeout can't create a second record."

---

## Implementation (minimal, in this repo)

### Layer 1 — unique index at the DB level

`src/models/User.js` already has `unique: true` on `email`. Mongoose turns that into a MongoDB unique index, which is the **last line of defense**: two simultaneous requests with the same email → the DB fires a duplicate-key error (`code 11000`), and the error handler returns `Duplicate value for field: email`.

```js
email: { type: String, required: true, unique: true, match: [...], }

// errorHandler.js
if (err.code === 11000) {
  const field = Object.keys(err.keyValue || {})[0];
  err.message = `Duplicate value for field: ${field}`;
}
```

### Layer 2 — idempotency key for retries

Client sends a header, server remembers what it already created.

**`src/models/IdempotencyKey.js`**

```js
new mongoose.Schema({
  key:    { type: String, required: true, unique: true },  // unique again — even parallel retries collapse
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
```

**`src/controllers/userController.js` — `createUser`**

```js
const key = req.get('Idempotency-Key');   // e.g. "550e8400-e29b-41d4-a716-446655440000"
try {
  if (key) {
    const existing = await findByIdempotencyKey(key);
    if (existing) return res.status(200).json({ success: true, data: existing, duplicate: true });
  }
  const user = await User.create(req.body);
  if (key) await IdempotencyKey.create({ key, userId: user._id });
  res.status(201).json({ success: true, data: user });
} catch (error) {
  // lost race: two parallel requests sent the SAME key — one wins, the other finds it here
  if (error?.code === 11000 && key) {
    const existing = await findByIdempotencyKey(key);
    if (existing) return res.status(200).json({ success: true, data: existing, duplicate: true });
  }
  next(error);
}
```

Flow:

```
request #1 with key K  →  no record  →  create user  →  store K → user  →  201 + user
request #2 with key K  →  found K     →  return SAME user (no insert)     →  200 + duplicate: true
request #3 same email, no key  →  DB unique index rejects                  →  400 duplicate field
```

## How to test

```bash
# 1st call — creates the user (201)
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" ^
  -H "Idempotency-Key: test-key-1" -d "{\"name\":\"Alice\",\"email\":\"a@b.com\"}"

# retry with the SAME key — returns same record, duplicate: true, no new record (200)
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" ^
  -H "Idempotency-Key: test-key-1" -d "{\"name\":\"Alice\",\"email\":\"a@b.com\"}"

# no key, same email — DB unique index blocks it (400)
curl -X POST http://localhost:5000/api/users -H "Content-Type: application/json" ^
  -d "{\"name\":\"Alice\",\"email\":\"a@b.com\"}"
```

## Follow-up points (bonus for the interviewer)

- **Why both layers?** The unique index stops duplicates even if the app crashes between `User.create` and storing the key. The idempotency key additionally gives a *stable response on retry* instead of an error — clients can safely retry network timeouts.
- **Where does the key come from?** The client generates a UUID and sends the same one on every retry of that operation.
- **Only for non-idempotent verbs.** GET/PUT/DELETE are naturally idempotent; focus on POST (creating resources, payments, orders).
- **Cleanup** — store key with an expiry (TTL) so the table doesn't grow forever. In MongoDB: `expireAfterSeconds`.