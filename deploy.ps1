param(
    [string]$p
)

#Clean folder
echo "Cleaning build..."
Remove-Item "frontend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "frontend.zip" -Recurse -Force -ErrorAction SilentlyContinue

Remove-Item "deploy_temp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy_temp.zip" -Recurse -Force -ErrorAction SilentlyContinue

#Build
echo "Build project..."
npm run build

#backend
echo "Processing backend..."
Copy-Item "backend/dist" "deploy_temp/backend" -Recurse -Force
Copy-Item "backend/prisma" "deploy_temp/backend" -Recurse -Force
Copy-Item "backend/ecosystem.config.js" "deploy_temp/backend" -Force
Copy-Item "backend/package.json" "deploy_temp/backend" -Force
Copy-Item "backend/package-lock.json" "deploy_temp/backend" -Force
Copy-Item "backend/.env.production" "deploy_temp/backend/.env" -Force

#fontend
echo "Processing frontend..."
Copy-Item "frontend/dist" "deploy_temp/frontend" -Recurse -Force

#zip
echo "Zipping..."
powershell -Command "Compress-Archive -Path 'deploy_temp' -DestinationPath 'deploy_temp.zip' -Force"

#copy to server
echo "Deploying..."
pscp.exe -pw $p deploy_temp.zip root@server:/home/data/TaiChinh

echo "Deployed successfully..."
#Clean folder
echo "Cleaning build..."
Remove-Item "frontend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "frontend.zip" -Recurse -Force -ErrorAction SilentlyContinue

Remove-Item "deploy_temp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy_temp.zip" -Recurse -Force -ErrorAction SilentlyContinue