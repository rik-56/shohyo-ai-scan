@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ============================================
echo   証憑 AI Scan - インストールスクリプト
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [エラー] Node.js がインストールされていません。
    echo.
    echo Node.js をインストールしてください:
    echo   https://nodejs.org/
    echo.
    echo LTS版（推奨）をダウンロードしてインストールしてください。
    echo.
    pause
    exit /b 1
)

REM Display Node.js version
echo [確認] Node.js バージョン:
node --version
echo.

REM Display npm version
echo [確認] npm バージョン:
npm --version
echo.

REM Navigate to project root (parent directory of scaninst)
cd /d "%~dp0.."
echo [情報] プロジェクトディレクトリ: %cd%
echo.

REM Check if package.json exists
if not exist "package.json" (
    echo [エラー] package.json が見つかりません。
    echo 正しいディレクトリで実行してください。
    echo.
    pause
    exit /b 1
)

REM Run npm install
echo [実行] 依存パッケージをインストール中...
echo.
npm install

if %errorlevel% neq 0 (
    echo.
    echo [エラー] インストールに失敗しました。
    echo.
    echo 以下を試してください:
    echo   1. npm cache clean --force
    echo   2. 再度 install.bat を実行
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   インストールが完了しました
echo ============================================
echo.
echo アプリケーションを起動するには:
echo   start.bat をダブルクリックしてください
echo.
echo または:
echo   npm run dev
echo.
echo ブラウザで http://localhost:3000 にアクセスしてください。
echo.
echo ============================================
pause
