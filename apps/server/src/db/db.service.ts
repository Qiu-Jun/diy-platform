import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { join } from 'path';
import { DATA_DIR } from '../consts';

export interface FontRow {
  id: number; name: string; url: string; cat?: string; createdAt?: string;
  createdByName?: string | null; updatedByName?: string | null;
}
export interface CatRow { id: number; label: string; sort: number }
export interface AssetRow {
  id: number; name: string; url: string; cat: number; createdAt?: string;
  createdByName?: string | null; updatedByName?: string | null;
}
export interface TemplateRow {
  id: number; name: string; preview: string; data: unknown; createdAt?: string;
  created_by?: number | null;
  createdByName?: string | null; updatedByName?: string | null;
}
export interface UserRow {
  id: number; username: string; nickname: string | null;
  roleId: number; roleCode: string; roleName: string; perms: string[]; createdAt?: string;
}

// 表设计按 MySQL 习惯（snake_case 列、AUTOINCREMENT 语义、data 列 SQLite TEXT ↔ MySQL JSON），
// 后续切 MySQL 只需换驱动 + 建同构表，服务层 SQL 基本不变。
const DDL = `
CREATE TABLE IF NOT EXISTS fonts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  url VARCHAR(255) NOT NULL,
  cat VARCHAR(20),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS cats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label VARCHAR(50) NOT NULL,
  sort INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  url VARCHAR(255) NOT NULL,
  cat INTEGER NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT,
  updated_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_assets_cat ON assets (cat);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  preview VARCHAR(255) NOT NULL,
  data TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS goods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  front VARCHAR(255) NOT NULL,
  back VARCHAR(255) NOT NULL,
  area_w REAL NOT NULL DEFAULT 44,
  area_h REAL NOT NULL DEFAULT 62,
  area_top REAL NOT NULL DEFAULT 21,
  area_left REAL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname VARCHAR(50),
  role_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT,
  updated_by INTEGER
);
`;

// 预置权限点（写操作级），角色通过 role_permissions 关联
const PERMS = [
  { code: 'fonts:manage', name: '字体管理' },
  { code: 'assets:manage', name: '素材管理' },
  { code: 'goods:manage', name: '定制管理' },
  { code: 'templates:manage', name: '模板管理' },
  { code: 'users:manage', name: '用户与角色管理' },
];
const ROLES = [
  { code: 'admin', name: '管理员', perms: PERMS.map((p) => p.code) },
  { code: 'editor', name: '编辑', perms: ['fonts:manage', 'assets:manage', 'goods:manage', 'templates:manage'] },
  { code: 'viewer', name: '查看', perms: [] },
];

@Injectable()
export class DbService {
  readonly sqlite: DatabaseSync;

  constructor() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    this.sqlite = new DatabaseSync(join(DATA_DIR, 'diy.db'));
    this.sqlite.exec('PRAGMA journal_mode = WAL;');
    this.sqlite.exec(DDL);
    this.ensureAuditColumns();
    this.importFromJsonIfFirstRun();
    this.seedRbac();
  }

  // —— 类型安全查询助手（node:sqlite 返回 Record<string, SQLOutputValue>，统一经 unknown 转换）——
  all<T>(sql: string, ...params: any[]): T[] {
    return this.sqlite.prepare(sql).all(...params) as unknown as T[];
  }
  get<T>(sql: string, ...params: any[]): T {
    return this.sqlite.prepare(sql).get(...params) as unknown as T;
  }
  run(sql: string, ...params: any[]) {
    return this.sqlite.prepare(sql).run(...params);
  }

  // 已存在的表补列（SQLite 无 ADD COLUMN IF NOT EXISTS）
  private ensureAuditColumns() {
    const add = (table: string, col: string, ddl: string) => {
      const cols = this.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
      if (!cols.includes(col)) this.sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    };
    for (const t of ['fonts', 'assets', 'templates']) {
      add(t, 'created_by', 'created_by INTEGER');
      add(t, 'updated_at', 'updated_at TEXT');
      add(t, 'updated_by', 'updated_by INTEGER');
    }
    for (const t of ['cats']) add(t, 'created_at', 'created_at TEXT'); // ALTER 不允许非常量默认，时间在插入时显式写入
    add('users', 'source', 'source TEXT'); // admin=后台创建 / web=自助注册
    add('goods', 'area_left', 'area_left REAL'); // 印花区左边距 %（NULL=水平居中）
  }

  // —— 首次运行：把旧 db.json 的数据搬进 SQLite ——
  private importFromJsonIfFirstRun() {
    const jsonFile = join(DATA_DIR, 'db.json');
    if (!existsSync(jsonFile)) return;
    const count = (t: string) => (this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`).n);
    if (count('fonts') + count('cats') + count('assets') + count('templates') > 0) return;
    const old = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const insFont = this.sqlite.prepare('INSERT INTO fonts (id, name, url, cat) VALUES (?, ?, ?, ?)');
    const insCat = this.sqlite.prepare('INSERT INTO cats (id, label, sort) VALUES (?, ?, ?)');
    const insAsset = this.sqlite.prepare('INSERT INTO assets (id, name, url, cat) VALUES (?, ?, ?, ?)');
    const insTpl = this.sqlite.prepare('INSERT INTO templates (id, name, preview, data, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const f of old.fonts ?? []) insFont.run(f.id, f.name, f.url, f.cat ?? 'cn');
    for (const c of old.cats ?? []) insCat.run(c.id, c.label, c.sort ?? 1);
    for (const a of old.assets ?? []) insAsset.run(a.id, a.name, a.url, a.cat);
    for (const t of old.templates ?? []) insTpl.run(t.id, t.name, t.preview, JSON.stringify(t.data ?? {}), t.createdAt ?? new Date().toISOString());
    renameSync(jsonFile, jsonFile + '.migrated');
    console.log('[db] db.json 数据已导入 SQLite（diy.db），原文件改名 db.json.migrated');
  }

  // —— RBAC 预置：角色 / 权限点 / 管理员账号（幂等）——
  private seedRbac() {
    if ((this.get<{ n: number }>('SELECT COUNT(*) AS n FROM roles').n) === 0) {
      const insRole = this.sqlite.prepare('INSERT INTO roles (code, name) VALUES (?, ?)');
      const insPerm = this.sqlite.prepare('INSERT INTO permissions (code, name) VALUES (?, ?)');
      const insRp = this.sqlite.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      const roleIds: Record<string, number> = {};
      for (const r of ROLES) roleIds[r.code] = Number(insRole.run(r.code, r.name).lastInsertRowid);
      const permIds: Record<string, number> = {};
      for (const p of PERMS) permIds[p.code] = Number(insPerm.run(p.code, p.name).lastInsertRowid);
      for (const r of ROLES) for (const code of r.perms) insRp.run(roleIds[r.code], permIds[code]);
      this.createUser({ username: 'admin', password: 'admin123', nickname: '管理员', roleId: roleIds.admin, source: 'admin' });
      console.log('[db] 已预置角色/权限与管理员账号 admin/admin123');
    }
    // C 端用户角色（幂等补种：老库升级时 roles 已有数据）
    const hasUserRole = this.get<{ id: number }>("SELECT id FROM roles WHERE code = 'user'");
    if (!hasUserRole) {
      this.sqlite.prepare('INSERT INTO roles (code, name) VALUES (?, ?)').run('user', '用户');
      console.log('[db] 已预置 C 端角色 user');
    }
  }

  // —— 用户 ——
  listUsers(): UserRow[] {
    return this.all<UserRow>(
      'SELECT u.id, u.username, u.nickname, u.role_id AS roleId, r.code AS roleCode, r.name AS roleName, u.created_at AS createdAt FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id',
    );
  }
  getUserById(id: number): UserRow | null {
    return this.all<UserRow>(
      'SELECT u.id, u.username, u.nickname, u.role_id AS roleId, r.code AS roleCode, r.name AS roleName, u.created_at AS createdAt FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
      id,
    )[0] ?? null;
  }
  getUserWithPerms(id: number): (UserRow & { perms: string[] }) | null {
    const u = this.getUserById(id);
    if (!u) return null;
    u.perms = this.all<{ code: string }>(
      'SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?',
      u.roleId,
    ).map((r) => r.code);
    return u;
  }
  getAuthByUsername(username: string): { id: number; username: string; password_hash: string; roleCode: string; perms: string[] } | null {
    const row = this.get<any>(
      'SELECT u.id, u.username, u.password_hash, r.code AS roleCode FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = ?',
      username,
    );
    if (!row) return null;
    row.perms = this.all<{ code: string }>(
      'SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?',
      row.id,
    ).map((r) => r.code);
    return row;
  }
  createUser(dto: { username: string; password: string; nickname?: string; roleId: number; source?: string }): UserRow {
    const hash = scryptSync(dto.password, 'diy-salt', 64).toString('hex');
    const r = this.sqlite.prepare('INSERT INTO users (username, password_hash, nickname, role_id, source) VALUES (?, ?, ?, ?, ?)')
      .run(dto.username, hash, dto.nickname ?? null, dto.roleId, dto.source ?? 'admin');
    return this.getUserById(Number(r.lastInsertRowid))!;
  }
  updateUser(id: number, dto: { nickname?: string; roleId?: number; password?: string }): UserRow {
    const u = this.getUserById(id);
    if (!u) throw new NotFoundException('用户不存在');
    const nickname = dto.nickname !== undefined ? dto.nickname : u.nickname;
    const roleId = dto.roleId !== undefined ? dto.roleId : u.roleId;
    const hash = dto.password ? scryptSync(dto.password, 'diy-salt', 64).toString('hex') : undefined;
    if (hash) this.run('UPDATE users SET nickname = ?, role_id = ?, password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', nickname, roleId, hash, id);
    else this.run('UPDATE users SET nickname = ?, role_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', nickname, roleId, id);
    return this.getUserById(id)!;
  }
  verifyPassword(id: number, password: string): boolean {
    const row = this.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', id);
    const hash = scryptSync(password, 'diy-salt', 64);
    const stored = Buffer.from(row.password_hash, 'hex');
    return stored.length === hash.length && timingSafeEqual(stored, hash);
  }
  countUsers(): number {
    return this.get<{ n: number }>('SELECT COUNT(*) AS n FROM users').n;
  }
  deleteUser(id: number): void {
    this.sqlite.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  // —— 角色 / 权限 ——
  listRoles(): { id: number; code: string; name: string; perms: string[] }[] {
    const roles = this.all<{ id: number; code: string; name: string }>('SELECT id, code, name FROM roles ORDER BY id');
    const rp = this.all<{ role_id: number; code: string }>(
      'SELECT rp.role_id, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id',
    );
    return roles.map((r) => ({ ...r, perms: rp.filter((x) => x.role_id === r.id).map((x) => x.code) }));
  }
  listPermissions(): { code: string; name: string }[] {
    return this.all<{ code: string; name: string }>('SELECT code, name FROM permissions ORDER BY id');
  }
  createRole(dto: { code: string; name: string; perms: string[] }): { id: number } {
    const r = this.sqlite.prepare('INSERT INTO roles (code, name) VALUES (?, ?)').run(dto.code, dto.name);
    const id = Number(r.lastInsertRowid);
    const ins = this.sqlite.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    const ids = this.all<{ id: number; code: string }>('SELECT id, code FROM permissions');
    for (const code of dto.perms) if (ids.find((p) => p.code === code)) ins.run(id, ids.find((p) => p.code === code)!.id);
    return { id };
  }
  setRolePerms(roleId: number, perms: string[]): void {
    this.run('DELETE FROM role_permissions WHERE role_id = ?', roleId);
    const ins = this.sqlite.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    const ids = this.all<{ id: number; code: string }>('SELECT id, code FROM permissions');
    for (const code of perms) { const p = ids.find((x) => x.code === code); if (p) ins.run(roleId, p.id); }
  }
  deleteRole(id: number): boolean {
    const bound = this.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE role_id = ?').n;
    if (bound > 0) throw new NotFoundException('该角色下仍有用户，无法删除');
    this.run('DELETE FROM role_permissions WHERE role_id = ?', id);
    return this.sqlite.prepare('DELETE FROM roles WHERE id = ?').run(id).changes > 0;
  }

  // —— 字体 ——
  listFonts(): FontRow[] {
    return this.all<FontRow>(`
      SELECT f.id, f.name, f.url, f.cat, f.created_at AS createdAt,
             cu.nickname AS createdByName, f.updated_at AS updatedAt, uu.nickname AS updatedByName
      FROM fonts f
      LEFT JOIN users cu ON cu.id = f.created_by
      LEFT JOIN users uu ON uu.id = f.updated_by
      ORDER BY f.id DESC`);
  }
  createFont(dto: { name: string; url: string; cat?: string }, by: number | null): FontRow {
    const r = this.sqlite.prepare('INSERT INTO fonts (name, url, cat, created_by) VALUES (?, ?, ?, ?)')
      .run(dto.name, dto.url, dto.cat ?? 'cn', by);
    return this.get<FontRow>('SELECT id, name, url, cat, created_at AS createdAt FROM fonts WHERE id = ?', Number(r.lastInsertRowid));
  }
  deleteFont(id: number): boolean {
    return this.sqlite.prepare('DELETE FROM fonts WHERE id = ?').run(id).changes > 0;
  }

  // —— 素材分类 ——
  listCats(): CatRow[] {
    return this.all<CatRow>('SELECT id, label, sort FROM cats ORDER BY sort, id');
  }
  createCat(dto: { label: string; sort?: number }): CatRow {
    const r = this.sqlite.prepare("INSERT INTO cats (label, sort, created_at) VALUES (?, ?, datetime('now', 'localtime'))")
      .run(dto.label, dto.sort ?? 1);
    return this.get<CatRow>('SELECT id, label, sort FROM cats WHERE id = ?', Number(r.lastInsertRowid));
  }
  deleteCat(id: number): boolean {
    return this.sqlite.prepare('DELETE FROM cats WHERE id = ?').run(id).changes > 0;
  }

  // —— 素材（分页结构与 H5 端约定一致）——
  listAssets(opts: { page: number; pageSize: number; cat?: number }) {
    const where = opts.cat !== undefined ? 'WHERE a.cat = ?' : '';
    const params: number[] = opts.cat !== undefined ? [opts.cat] : [];
    const total = (this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM assets a ${where}`, ...params)).n;
    const start = (opts.page - 1) * opts.pageSize;
    const data = this.all<AssetRow>(
      `SELECT a.id, a.name, a.url, a.cat, cu.nickname AS createdByName
       FROM assets a LEFT JOIN users cu ON cu.id = a.created_by
       ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      ...params, opts.pageSize, start,
    );
    return { total, per_page: opts.pageSize, last_page: Math.max(1, Math.ceil(total / opts.pageSize)), data };
  }
  createAsset(dto: { name: string; url: string; cat: number }, by: number | null): AssetRow {
    const r = this.sqlite.prepare('INSERT INTO assets (name, url, cat, created_by) VALUES (?, ?, ?, ?)')
      .run(dto.name, dto.url, dto.cat, by);
    return this.get<AssetRow>('SELECT id, name, url, cat FROM assets WHERE id = ?', Number(r.lastInsertRowid));
  }
  deleteAsset(id: number): boolean {
    return this.sqlite.prepare('DELETE FROM assets WHERE id = ?').run(id).changes > 0;
  }

  // —— 模板（列表不带 data 大字段；详情含解析后的 data）——
  listTemplates(opts: { page: number; pageSize: number; userId?: number }) {
    const where = opts.userId !== undefined ? 'WHERE t.created_by = ?' : '';
    const params: number[] = opts.userId !== undefined ? [opts.userId] : [];
    const total = (this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM templates t ${where}`, ...params)).n;
    const start = (opts.page - 1) * opts.pageSize;
    const data = this.all<TemplateRow>(
      `SELECT t.id, t.name, t.preview, t.created_at AS createdAt, cu.nickname AS createdByName,
              t.updated_at AS updatedAt, uu.nickname AS updatedByName
       FROM templates t
       LEFT JOIN users cu ON cu.id = t.created_by
       LEFT JOIN users uu ON uu.id = t.updated_by
       ${where}
       ORDER BY t.id DESC LIMIT ? OFFSET ?`,
      ...params, opts.pageSize, start,
    );
    return { total, per_page: opts.pageSize, last_page: Math.max(1, Math.ceil(total / opts.pageSize)), data };
  }
  getTemplate(id: number): TemplateRow {
    const row = this.get<any>(
      'SELECT id, name, preview, data, created_by, created_at AS createdAt FROM templates WHERE id = ?', id,
    );
    if (!row) throw new NotFoundException('模板不存在');
    return { ...row, data: JSON.parse(row.data) };
  }
  createTemplate(dto: { name: string; preview: string; data: unknown }, by: number | null): { id: number } {
    const r = this.sqlite.prepare(
      'INSERT INTO templates (name, preview, data, created_by) VALUES (?, ?, ?, ?)',
    ).run(dto.name, dto.preview, JSON.stringify(dto.data), by);
    return { id: Number(r.lastInsertRowid) };
  }
  updateTemplate(id: number, dto: { name?: string; preview?: string; data?: unknown; by?: number | null }): TemplateRow {
    const row = this.getTemplate(id);
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.preview !== undefined) row.preview = dto.preview;
    if (dto.data !== undefined) row.data = dto.data;
    // 匿名创建的模板被登录用户编辑保存 → 认领归属
    const createdBy = row.created_by ?? dto.by ?? null;
    this.run(
      "UPDATE templates SET name = ?, preview = ?, data = ?, created_by = ?, updated_at = datetime('now','localtime'), updated_by = ? WHERE id = ?",
      row.name, row.preview, JSON.stringify(row.data), createdBy, dto.by ?? null, id,
    );
    return this.getTemplate(id);
  }
  deleteTemplate(id: number): boolean {
    return this.sqlite.prepare('DELETE FROM templates WHERE id = ?').run(id).changes > 0;
  }

  // —— 供 service 做存在性判断的辅助 ——
  templateExists(id: number): boolean {
    return !!this.get<{ id: number }>('SELECT id FROM templates WHERE id = ?', id);
  }

  // —— 定制品类（底图必须有正反面）——
  listGoods(): { id: number; name: string; front: string; back: string; areaW: number; areaH: number; areaTop: number; areaLeft: number | null }[] {
    return this.all<{ id: number; name: string; front: string; back: string; area_w: number; area_h: number; area_top: number; area_left: number | null }>(
      'SELECT id, name, front, back, area_w, area_h, area_top, area_left FROM goods ORDER BY id DESC',
    ).map((r) => ({ id: r.id, name: r.name, front: r.front, back: r.back, areaW: r.area_w, areaH: r.area_h, areaTop: r.area_top, areaLeft: r.area_left }));
  }
  createGoods(dto: { name: string; front: string; back: string; areaW?: number; areaH?: number; areaTop?: number; areaLeft?: number | null }, by: number | null) {
    const r = this.sqlite.prepare(
      'INSERT INTO goods (name, front, back, area_w, area_h, area_top, area_left, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(dto.name, dto.front, dto.back, dto.areaW ?? 44, dto.areaH ?? 62, dto.areaTop ?? 21, dto.areaLeft ?? null, by);
    return Number(r.lastInsertRowid);
  }
  updateGoods(id: number, dto: { name?: string; front?: string; back?: string; areaW?: number; areaH?: number; areaTop?: number; areaLeft?: number | null }): void {
    this.run(
      'UPDATE goods SET name = ?, front = ?, back = ?, area_w = ?, area_h = ?, area_top = ?, area_left = ? WHERE id = ?',
      dto.name, dto.front, dto.back, dto.areaW, dto.areaH, dto.areaTop, dto.areaLeft ?? null, id,
    );
  }
  deleteGoods(id: number): boolean {
    return this.sqlite.prepare('DELETE FROM goods WHERE id = ?').run(id).changes > 0;
  }
}
