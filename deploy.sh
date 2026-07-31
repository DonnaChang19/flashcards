#!/usr/bin/env bash
# ============================================================
#  闪卡 Web App → GitHub Pages 一键部署脚本
#  运行环境：Windows 用「Git Bash」打开，macOS/Linux 用终端。
#  用法：bash deploy.sh
# ============================================================
set -e
cd "$(dirname "$0")"

echo "========================================="
echo "   闪卡 Web App → GitHub Pages 部署"
echo "========================================="

# 1. 确认 git 身份（没有则询问）
if [ -z "$(git config user.email)" ]; then
  read -p "请输入 git 邮箱（用于 commit 署名）: " GIT_EMAIL
  git config user.email "$GIT_EMAIL"
fi
if [ -z "$(git config user.name)" ]; then
  read -p "请输入 git 用户名: " GIT_NAME
  git config user.name "$GIT_NAME"
fi

# 2. 读取仓库地址
read -p "请输入 GitHub 仓库地址（例如 https://github.com/用户名/仓库名.git）: " REPO_URL

# 3. 初始化并提交
git init -q 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git add -A
git commit -m "Deploy flashcard web app (Phase 1: GitHub Pages)" \
  || echo "（没有新改动，跳过 commit）"
git branch -M main
git push -u origin main

echo ""
echo "========================================="
echo "   推送成功！"
echo "========================================="
echo "接下来请手动开启 GitHub Pages："
echo "  1. 打开你的 GitHub 仓库页面 → Settings → Pages"
echo "  2. Source 选择 『Deploy from a branch』"
echo "  3. Branch 选 『main』，目录选 『/(root)』，点 Save"
echo "  4. 等待 1~2 分钟，访问："
echo "     https://<用户名>.github.io/<仓库名>/"
echo "========================================="
