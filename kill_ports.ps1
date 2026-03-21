# 定义想要清理的常见开发端口
$ports = @(3000, 5173, 5174, 5175, 8000, 8080, 4200)

Write-Host "--- 正在检查并清理开发端口 ---" -ForegroundColor Cyan

foreach ($port in $ports) {
    # 查找占用该端口且处于 Listening 状态的进程 PID
    $process = Get-NetTCPConnection -LocalPort $port -State Listening -ErrorAction SilentlyContinue

    if ($process) {
        # 获取进程名称，方便让你知道关掉的是什么
        $pInfo = Get-Process -Id $process.OwningProcess -ErrorAction SilentlyContinue
        $pName = if ($pInfo) { $pInfo.ProcessName } else { "未知进程" }

        Write-Host "[!] 发现端口 $port 被进程 '$pName' (PID: $($process.OwningProcess)) 占用" -ForegroundColor Yellow
        
        # 强制停止进程
        Stop-Process -Id $process.OwningProcess -Force
        Write-Host "    [√] 已成功释放端口 $port" -ForegroundColor Green
    } else {
        Write-Host "[OK] 端口 $port 是干净的" -ForegroundColor Gray
    }
}

Write-Host "----------------------------" -ForegroundColor Cyan
Write-Host "清理完成！" -ForegroundColor Cyan