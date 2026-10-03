import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../../src/prisma/prisma.service'
import { API, bootstrapTestApp, seedUsersAndServices } from './helpers'

describe('Auth & keamanan (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let ownerToken: string
  let staffToken: string

  const login = (email: string, password = 'rahasia123') =>
    request(app.getHttpServer()).post(`${API}/auth/login`).send({ email, password })

  beforeAll(async () => {
    app = await bootstrapTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    const seeded = await seedUsersAndServices(app)
    prisma = seeded.prisma
    ownerToken = (await login('owner@test.id').expect(200)).body.accessToken
    staffToken = (await login('staff@test.id').expect(200)).body.accessToken
  })

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

  it('email tidak terdaftar dan password salah memberi respons yang sama persis', async () => {
    const salahPassword = await login('owner@test.id', 'password-salah').expect(401)
    const tidakTerdaftar = await login('hantu@test.id', 'apa-saja').expect(401)
    expect(salahPassword.body).toEqual(tidakTerdaftar.body)
    expect(salahPassword.body.code).toBe('INVALID_CREDENTIALS')
  })

  it('akun nonaktif tidak bisa masuk', async () => {
    await prisma.user.update({ where: { email: 'staff@test.id' }, data: { isActive: false } })
    const res = await login('staff@test.id').expect(403)
    expect(res.body.code).toBe('ACCOUNT_INACTIVE')
  })

  it('endpoint terlindungi menolak request tanpa token', async () => {
    for (const path of ['/orders', '/services', '/customers', '/auth/me']) {
      const res = await request(app.getHttpServer()).get(`${API}${path}`).expect(401)
      expect(res.body.code).toBe('TOKEN_INVALID')
    }
  })

  it('refresh token menghasilkan pasangan token baru', async () => {
    const first = await login('owner@test.id').expect(200)
    const refreshed = await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first.body.refreshToken })
      .expect(200)

    expect(refreshed.body.accessToken).toBeDefined()
    expect(refreshed.body.refreshToken).toBeDefined()
    expect(refreshed.body.expiresIn).toBe(900)
  })

  it('access token tidak bisa dipakai sebagai refresh token', async () => {
    const first = await login('owner@test.id').expect(200)
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first.body.accessToken })
      .expect(401)
    expect(res.body.code).toBe('TOKEN_INVALID')
  })

  // ── Kasus wajib #10 ───────────────────────────────────────────────────────
  it('passwordHash tidak pernah muncul di response endpoint mana pun', async () => {
    const responses = await Promise.all([
      login('owner@test.id').expect(200),
      request(app.getHttpServer()).get(`${API}/auth/me`).set(auth(ownerToken)).expect(200),
      request(app.getHttpServer()).get(`${API}/users`).set(auth(ownerToken)).expect(200),
      request(app.getHttpServer())
        .post(`${API}/users`)
        .set(auth(ownerToken))
        .send({ name: 'Staff Baru', email: 'baru@test.id', password: 'rahasia123', role: 'STAFF' })
        .expect(201),
    ])

    for (const res of responses) {
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('passwordHash')
      expect(body).not.toContain('$argon2')
      expect(body).not.toContain('rahasia123')
    }
  })

  it('STAFF ditolak pada endpoint khusus OWNER', async () => {
    const owneronly: Array<[string, string]> = [
      ['get', '/reports/daily-summary'],
      ['get', '/users'],
    ]
    for (const [method, path] of owneronly) {
      const res = await (request(app.getHttpServer()) as any)
        [method](`${API}${path}`)
        .set(auth(staffToken))
        .expect(403)
      expect(res.body.code).toBe('FORBIDDEN_ROLE')
    }

    await request(app.getHttpServer())
      .post(`${API}/services`)
      .set(auth(staffToken))
      .send({ code: 'X_NEW', name: 'X', category: 'OTHER', price: 1000 })
      .expect(403)
  })

  it('OWNER bisa mengakses endpoint yang sama', async () => {
    await request(app.getHttpServer())
      .get(`${API}/reports/daily-summary`)
      .set(auth(ownerToken))
      .expect(200)
    await request(app.getHttpServer()).get(`${API}/users`).set(auth(ownerToken)).expect(200)
  })

  it('akun dinonaktifkan lewat PATCH, bukan dihapus', async () => {
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'staff@test.id' } })
    const res = await request(app.getHttpServer())
      .patch(`${API}/users/${staff.id}`)
      .set(auth(ownerToken))
      .send({ isActive: false })
      .expect(200)

    expect(res.body.isActive).toBe(false)
    expect(await prisma.user.count()).toBe(2)
  })

  it('validasi bentuk payload mengembalikan VALIDATION_FAILED dengan detail per field', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'bukan-email', password: '' })
      .expect(400)

    expect(res.body.code).toBe('VALIDATION_FAILED')
    expect(res.body.details.fields).toHaveProperty('email')
    expect(res.body.details.fields).toHaveProperty('password')
  })
})
