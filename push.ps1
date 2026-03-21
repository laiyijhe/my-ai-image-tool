Write-Host "--- Start Auto Push ---" -ForegroundColor Cyan

# 1. Add
git add .
Write-Host "Step 1: Files added." -ForegroundColor Green

# 2. Commit
$date = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Auto Update $date"
Write-Host "Step 2: Commit saved ($date)." -ForegroundColor Green

# 3. Push
Write-Host "Step 3: Pushing to GitHub... Please wait." -ForegroundColor Yellow
git push origin main --force

Write-Host "--- ALL DONE! Check Vercel now. ---" -ForegroundColor Magenta