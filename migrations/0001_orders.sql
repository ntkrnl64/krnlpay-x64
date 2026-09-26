CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  order_name TEXT NOT NULL,
  amount REAL NOT NULL,
  qrcode TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  is_paid INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  product_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders (updated_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  about TEXT NOT NULL,
  thank_you TEXT NOT NULL,
  custom_enabled INTEGER NOT NULL,
  custom_min REAL NOT NULL,
  custom_max REAL NOT NULL,
  presets TEXT NOT NULL,
  success_redirect TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO settings (
  id, shop_name, tagline, about, thank_you, custom_enabled, custom_min, custom_max, presets, success_redirect
) VALUES (
  1,
  'NtKrnl64',
  '捐赠给 NtKrnl64',
  '我很可爱，请给我钱',
  '哇谢谢你',
  1,
  1,
  512,
  '[2,4,8,16,32,64,128,256]',
  ''
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sort ON products (sort_order, id);
