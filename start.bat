@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   証憑 AI Scan を起動しています...
echo ========================================
echo.

REM このバッチファイルがあるフォルダに移動
cd /d "%~dp0"
echo 現在のフォルダ: %cd%
echo.

REM Node.js が使えるか確認
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [エラー] Node.js が見つかりません。
    echo.
    echo Node.js をインストールしてから、パソコンを再起動してください。
    echo ダウンロード: https://nodejs.org/ja/
    echo.
    pause
    exit /b 1
)

echo Node.js バージョン:
node --version
echo.

REM package.json があるか確認
if not exist "package.json" (
    echo.
    echo [エラー] package.json が見つかりません。
    echo このファイルは C:\codefolder\scan フォルダに置いてください。
    echo.
    pause
    exit /b 1
)

REM node_modules があるか確認
if not exist "node_modules" (
    echo.
    echo [情報] 初回起動のため、必要なファイルをダウンロードします...
    echo しばらくお待ちください（2〜5分程度）
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [エラー] ファイルのダウンロードに失敗しました。
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo ----------------------------------------
echo ブラウザが自動で開きます。
echo 開かない場合は、以下のURLをブラウザで開いてください：
echo.
echo   http://localhost:3000
echo.
echo アプリを終了するには、この画面で Ctrl+C を押すか、
echo この画面を閉じてください。
echo ----------------------------------------
echo.

npm run dev

echo.
echo ========================================
echo   アプリを終了しました
echo ========================================
echo.
pause
