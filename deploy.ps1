#backend
Copy-Item "backend/dist" "deploy/backend" -Recurse -Force
Copy-Item "backend/prisma" "deploy/backend/prisma" -Recurse -Force
Copy-Item "backend/ecosystem.config.js" "deploy/backend" -Force
Copy-Item "backend/package.json" "deploy/backend" -Force
Copy-Item "backend/package-lock.json" "deploy/backend" -Force
Copy-Item "backend/.env.production" "deploy/backend/.env" -Force

#fontend
Copy-Item "frontend/dist" "deploy/frontend" -Recurse -Force

#zip
powershell -Command "Compress-Archive -Path 'deploy' -DestinationPath 'deploy.zip' -Force"

#copy to server
scp deploy.zip root@server:/home/data/TaiChinh

#install package in server
#npm ci --omit=dev