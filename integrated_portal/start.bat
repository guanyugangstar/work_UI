@echo off
REM 一键启动脚本 for Windows

REM 设置环境变量


REM 4. 用pythonw.exe后台无窗口启动Flask服务
start python app.py

REM 5. 等待服务启动
timeout /t 1 >nul

REM 6. 自动打开浏览器
start http://127.0.0.1:9000

REM 7. 退出脚本
exit