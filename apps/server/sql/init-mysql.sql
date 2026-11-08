-- ============================================================
-- DIY 平台 MySQL 初始化脚本
-- 用法：mysql -u root -p < init-mysql.sql
-- 对应 SQLite 表（apps/server/data/diy.db），列名/语义一致，
-- DbService 切换 mysql2 时仅需把占位符调用方式保持 `?` 不变。
-- ============================================================

CREATE DATABASE IF NOT EXISTS diy_platform
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE diy_platform;

-- 字体
CREATE TABLE IF NOT EXISTS fonts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL COMMENT '字体名称',
  url        VARCHAR(255) NOT NULL COMMENT '字体文件 /uploads/xxx.ttf',
  cat        VARCHAR(20)  NULL DEFAULT 'cn' COMMENT '分类：cn/tc/kr/en/num',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '字体';

-- 素材分类
CREATE TABLE IF NOT EXISTS cats (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(50) NOT NULL COMMENT '分类名',
  sort  INT NOT NULL DEFAULT 1 COMMENT '排序权重',
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '素材分类';

-- 素材
CREATE TABLE IF NOT EXISTS assets (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name  VARCHAR(100) NOT NULL COMMENT '素材名',
  url   VARCHAR(255) NOT NULL COMMENT '素材文件 /uploads/xxx.png',
  cat   INT UNSIGNED NOT NULL COMMENT '所属分类 id（cats.id）',
  PRIMARY KEY (id),
  KEY idx_assets_cat (cat)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '素材';

-- 模板（用户保存的定制工程）
CREATE TABLE IF NOT EXISTS templates (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL COMMENT '模板名',
  preview    VARCHAR(255) NOT NULL COMMENT '预览图 /uploads/xxx.png',
  data       JSON NOT NULL COMMENT '工程 JSON（serializeProject 输出，含正反面）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '保存时间',
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '模板';

-- 可选：专用账号（按需修改密码后取消注释）
-- CREATE USER IF NOT EXISTS 'diy'@'%' IDENTIFIED BY '改成你的密码';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON diy_platform.* TO 'diy'@'%';
-- FLUSH PRIVILEGES;

-- 示例数据（按需取消注释）
-- INSERT INTO cats (label, sort) VALUES ('贴纸', 1), ('涂鸦', 2);
