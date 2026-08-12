#Clean folder
echo "Cleaning build..."
Remove-Item "frontend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend/dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "deploy.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "backend.zip" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "frontend.zip" -Recurse -Force -ErrorAction SilentlyContinue

#Build
echo "Build project..."
npm run build

#backend
echo "Processing backend..."
Copy-Item "backend/dist" "deploy/backend" -Recurse -Force
Copy-Item "backend/prisma" "deploy/backend" -Recurse -Force
Copy-Item "backend/ecosystem.config.js" "deploy/backend" -Force
Copy-Item "backend/package.json" "deploy/backend" -Force
Copy-Item "backend/package-lock.json" "deploy/backend" -Force
Copy-Item "backend/.env.production" "deploy/backend/.env" -Force

#fontend
echo "Processing frontend..."
Copy-Item "frontend/dist" "deploy/frontend" -Recurse -Force

#zip
echo "Zipping..."
powershell -Command "Compress-Archive -Path 'deploy' -DestinationPath 'deploy.zip' -Force"

#copy to server
echo "Deploying..."
scp deploy.zip root@server:/home/data/TaiChinh

#install package in server
#npm ci --omit=dev