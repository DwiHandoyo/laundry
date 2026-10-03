process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://laundry@127.0.0.1:55432/laundry_test?schema=public'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long-xxx'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-xx'
process.env.JWT_ACCESS_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '30d'
process.env.APP_TIMEZONE = 'Asia/Jakarta'
