# 经济闪卡学习中心（Web App）

经济学闪卡 Web App
前端托管在 **GitHub Pages**，进度数据存于 **Supabase**

## 功能
- **学生 Key 登录**：老师发放唯一学习 Key，首次登录绑定设备，进度自动上云。
- **云端进度同步**：学过的词、错误次数、打卡日历等跨设备/清缓存可恢复。
- **易错优先复习**：复习时按错误次数加权，薄弱项更高频出现。
- **老师后台**：查看学生完成情况、高频错误术语（可按具体学生筛选）、Key 管理。

## 仓库结构
```
index.html                  入口导航页（链接 6 套闪卡 + 老师后台）
CIE-AS核心定义和单词卡.html
CIE-A2核心定义和单词卡.html
EDX-AS核心定义和单词卡.html
EDX-A2核心定义和单词卡.html
AP微观词汇闪卡.html
AP宏观经济词汇闪卡.html
teacher.html                老师后台
supabase-config.js          Supabase 项目配置（公开安全）
cloudstore.js               云端读写封装
auth.js                     Key 登录 / 设备指纹
sync.js                     本地↔云端进度同步
.github/workflows/keep-alive.yml   每周 ping，防止免费 Supabase 暂停
deploy.sh                   一键部署脚本
```

> 注：`*.py`、`*_data.json`、`smoke_*.js`、`schema*.sql`、`bak*/` 等开发/测试文件已被 `.gitignore` 排除，不会上传。

## 部署步骤（首次）
1. 在 GitHub 新建一个**空仓库**（仓库名随意，例如 `flashcards`）。
2. 在本机用 **Git Bash** 进入本项目目录，运行：
   ```bash
   bash deploy.sh
   ```
   按提示输入：git 邮箱、git 用户名、仓库 HTTPS 地址。
3. 打开仓库页面 → **Settings → Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录 **/(root)**，点 **Save**
4. 等待 1~2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`。

## 重新发布（改了闪卡内容后）
直接再运行一次：
```bash
bash deploy.sh
```
脚本会 `git add -A` 并把改动推到 `main`，Pages 自动更新（通常几十秒生效）。

## 后台数据库（Supabase）—— 仅需配置一次
前端已接入 Supabase，但数据库表与 RPC 需要你在 Supabase 后台执行一次 SQL（按顺序）：
1. `schema.sql`（基础表 + 登录 RPC）
2. `schema_phase3.sql`（进度区分 word/cloze）
3. `schema_fp_migration.sql`（设备指纹兼容）
4. `schema_phase4.sql`（老师表 + 6 个管理 RPC + 种子教师 Key `TEACHER-DONNA-2026`）
5. `schema_weak_students.sql`（高频错误术语按学生筛选）
6. `schema_cards_data.sql`（导入 1429 张卡到 `cards` 表）

并在 Supabase → **Authentication → Providers** 中开启 **Anonymous sign-ins**。
（`keep-alive.yml` 已通过 GitHub Actions 每周访问一次，避免免费项目因 7 天无访问而暂停。）

## 密钥说明
`supabase-config.js` 中的 URL 与 anon key 是**公开安全**的（设计为前端使用），
真正的访问控制由数据库 **RLS 行级安全策略** 保证，可放心放在公开仓库与 GitHub Pages 上。
